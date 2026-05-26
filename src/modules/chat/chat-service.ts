/**
 * Chat Service
 * Business logic for AI coaching chatbot with context retrieval
 */

import { ChatSessionPersister, ChatMessagePersister } from './chat-persister';
import { StravaPersister } from '../strava/strava-persister';
import { CalendarConnectionPersister } from '../calendar/calendar-persister';
import { CalendarEventPersister } from '../calendar/calendar-persister';
import { TRAINING_GOALS, USER_LOCATION } from './chat-config';
import weatherService from '../weather/weather-service';
import type { WeatherForecast } from '../weather/weather-types';
import type { ChatSession, ChatMessage, CalendarEvent } from '@/db/schema';
import type { ChatContext } from './chat-types';

class ChatService {
  /**
   * Create a new chat session
   */
  async createSession(userId: string, title?: string): Promise<ChatSession> {
    return ChatSessionPersister.create({
      userId,
      title: title || 'New Chat',
      isActive: true,
    });
  }

  /**
   * Get user's chat sessions
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    return ChatSessionPersister.findByUserId(userId);
  }

  /**
   * Get session with all messages
   */
  async getSessionWithMessages(sessionId: string): Promise<{
    session: ChatSession;
    messages: ChatMessage[];
  }> {
    const session = await ChatSessionPersister.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const messages = await ChatMessagePersister.findBySessionId(sessionId);

    return { session, messages };
  }

  /**
   * Get context for AI response
   * Fetches recent Strava activities and upcoming calendar events
   */
  async getContextForUser(userId: string): Promise<ChatContext> {
    // Get recent Strava activities (last 14 days)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const stravaActivities = await StravaPersister.getUserActivities(userId, {
      limit: 20,
    });

    // Filter to last 2 weeks
    const recentActivities = stravaActivities.filter((activity) => {
      if (!activity.startDate) return false;
      return activity.startDate >= twoWeeksAgo;
    });

    // Get upcoming calendar events (next 7 days)
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    let upcomingEvents: CalendarEvent[] = [];

    // Try to get calendar connection
    const calendarConnections = await CalendarConnectionPersister.findByUserId(userId);
    if (calendarConnections.length > 0) {
      const activeConnection = calendarConnections.find((c) => c.isActive);
      if (activeConnection) {
        upcomingEvents = await CalendarEventPersister.findByConnectionIdInTimeRange(
          activeConnection.id,
          now,
          nextWeek
        );
      }
    }

    // Fetch 7-day weather forecast (best-effort; never block chat on a weather error)
    let weather: WeatherForecast | null = null;
    try {
      weather = await weatherService.getForecast({
        latitude: USER_LOCATION.latitude,
        longitude: USER_LOCATION.longitude,
        label: USER_LOCATION.label,
        timezone: USER_LOCATION.timezone,
        unit: USER_LOCATION.temperatureUnit,
        days: 7,
      });
    } catch (err) {
      console.warn('Weather fetch failed; continuing without it.', err);
    }

    return {
      recentActivities,
      upcomingEvents,
      goals: {
        primarySport: TRAINING_GOALS.primarySport,
        targetEvent: TRAINING_GOALS.targetEvent,
        targetEventDate: TRAINING_GOALS.targetEventDate,
        weeklyVolumeTarget: TRAINING_GOALS.weeklyVolumeTarget,
      },
      weather,
    };
  }

  /**
   * Save user message
   */
  async saveUserMessage(
    sessionId: string,
    content: string,
    context?: ChatContext
  ): Promise<ChatMessage> {
    return ChatMessagePersister.create({
      sessionId,
      role: 'user',
      content,
      contextData: context || null,
    });
  }

  /**
   * Save assistant message
   */
  async saveAssistantMessage(
    sessionId: string,
    content: string,
    context?: ChatContext
  ): Promise<ChatMessage> {
    return ChatMessagePersister.create({
      sessionId,
      role: 'assistant',
      content,
      contextData: context || null,
    });
  }

  /**
   * Get recent messages for conversation context
   */
  async getRecentMessages(sessionId: string, limit: number = 10): Promise<ChatMessage[]> {
    return ChatMessagePersister.findRecentBySessionId(sessionId, limit);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    return ChatSessionPersister.deleteById(sessionId);
  }

  /**
   * Update session title
   */
  async updateSessionTitle(sessionId: string, title: string): Promise<ChatSession> {
    return ChatSessionPersister.updateTitle(sessionId, title);
  }

  /**
   * Format context for AI prompt
   */
  formatContextForPrompt(context: ChatContext): string {
    let prompt = '\n\n## Current Context\n\n';

    // Recent activities
    if (context.recentActivities.length > 0) {
      prompt += '### Recent Training (Last 14 Days)\n';
      context.recentActivities.forEach((activity) => {
        const distance = activity.distance ? `${(activity.distance / 1000).toFixed(1)}km` : '';
        const duration = activity.movingTime
          ? `${Math.floor(activity.movingTime / 60)}min`
          : activity.elapsedTime
          ? `${Math.floor(activity.elapsedTime / 60)}min`
          : '';
        const pace =
          activity.averageSpeed && activity.averageSpeed > 0
            ? `${Math.floor(1000 / activity.averageSpeed / 60)}:${String(
                Math.floor((1000 / activity.averageSpeed) % 60)
              ).padStart(2, '0')}/km`
            : '';
        const date = activity.startDate ? activity.startDate.toLocaleDateString() : '';

        prompt += `- **${activity.name || activity.type || 'Activity'}** (${date})\n`;
        prompt += `  ${activity.type || activity.sportType || 'Unknown'} - ${distance} - ${duration}`;
        if (pace) prompt += ` - ${pace} avg pace`;
        if (activity.averageHeartrate) prompt += ` - ${Math.round(activity.averageHeartrate)} bpm avg`;
        prompt += '\n';
      });
    } else {
      prompt += '### Recent Training\nNo recent activities found.\n';
    }

    // Upcoming calendar events
    if (context.upcomingEvents.length > 0) {
      prompt += '\n### Upcoming Calendar (Next 7 Days)\n';
      context.upcomingEvents.forEach((event) => {
        const date = event.startTime.toLocaleDateString();
        const startTime = event.startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
        const endTime = event.endTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });

        prompt += `- **${event.summary || 'Untitled Event'}** (${date})\n`;
        prompt += `  ${startTime} - ${endTime}`;
        if (event.location) prompt += ` | ${event.location}`;
        prompt += '\n';
      });
    } else {
      prompt += '\n### Upcoming Calendar\nNo upcoming events or calendar not connected.\n';
    }

    // Weather forecast
    if (context.weather && context.weather.daily.length > 0) {
      prompt += '\n### 7-Day Weather Forecast\n';
      prompt += weatherService.formatForPrompt(context.weather);
      prompt += '\n';
    }

    return prompt;
  }
}

const chatService = new ChatService();
export default chatService;
