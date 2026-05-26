/**
 * Chat Types
 * TypeScript interfaces for the chat module
 */

import type { ChatSession, ChatMessage, CalendarEvent, StravaActivity } from '@/db/schema';
import type { WeatherForecast } from '../weather/weather-types';

export interface ChatContext {
  recentActivities: StravaActivity[];
  upcomingEvents: CalendarEvent[];
  goals: {
    primarySport: string;
    targetEvent: string;
    targetEventDate: string;
    weeklyVolumeTarget: {
      running: string;
      cycling: string;
    };
  };
  weather?: WeatherForecast | null;
}

export interface CreateSessionInput {
  userId: string;
  title?: string;
}

export interface SendMessageInput {
  sessionId: string;
  content: string;
  userId: string;
}

export interface ChatMessageWithContext extends ChatMessage {
  contextSummary?: string;
}

export interface SessionWithMessages extends ChatSession {
  messages: ChatMessage[];
}

export { ChatSession, ChatMessage };
