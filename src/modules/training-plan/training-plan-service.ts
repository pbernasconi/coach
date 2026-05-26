/**
 * Training Plan Service
 * Business logic for AI-generated training plans
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  TrainingPlanPersister,
  TrainingPlanActivityPersister,
  UserGoalsPersister,
} from './training-plan-persister';
import { CalendarEventPersister } from '../calendar/calendar-persister';
import weatherService from '../weather/weather-service';
import { USER_LOCATION } from '../user-profile/user-profile-config';
import type { WeatherForecast } from '../weather/weather-types';
import type { TrainingPlan, UserGoals, NewTrainingPlan, CalendarEvent, StravaActivity } from '@/db/schema';

interface GeneratePlanInput {
  userId: string;
  weekStartDate: Date;
  calendarConnectionId?: string;
  stravaActivities?: StravaActivity[]; // Recent Strava activities
}

interface GeneratedPlanResult {
  plan: TrainingPlan;
  activitiesCount: number;
}

class TrainingPlanService {
  private aiModel = 'gpt-4o';

  /**
   * Generate a new weekly training plan using AI
   */
  async generateWeeklyPlan(input: GeneratePlanInput): Promise<GeneratedPlanResult> {
    const { userId, weekStartDate, calendarConnectionId, stravaActivities = [] } = input;

    // Calculate week end date (6 days after start)
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    // 1. Fetch user goals and preferences
    const userGoals = await UserGoalsPersister.findByUserId(userId);

    // 2. Fetch calendar availability if connection provided
    let calendarEvents: CalendarEvent[] = [];
    if (calendarConnectionId) {
      calendarEvents = await CalendarEventPersister.findByConnectionIdInTimeRange(
        calendarConnectionId,
        weekStartDate,
        weekEndDate
      );
    }

    // 3. Fetch weather forecast for the planned week (best-effort)
    let weather: WeatherForecast | null = null;
    try {
      const daysSpan = Math.max(
        1,
        Math.min(16, Math.ceil((weekEndDate.getTime() - Date.now()) / 86_400_000) + 1),
      );
      weather = await weatherService.getForecast({
        latitude: USER_LOCATION.latitude,
        longitude: USER_LOCATION.longitude,
        label: USER_LOCATION.label,
        timezone: USER_LOCATION.timezone,
        unit: USER_LOCATION.temperatureUnit,
        days: daysSpan,
      });
    } catch (err) {
      console.warn('Weather fetch failed; generating plan without it.', err);
    }

    // 4. Build context for AI
    const context = {
      goals: userGoals,
      calendarEvents: calendarEvents.map((e) => ({
        summary: e.summary,
        startTime: e.startTime,
        endTime: e.endTime,
        isAllDay: e.isAllDay,
      })),
      recentActivities: stravaActivities.slice(0, 10), // Last 10 activities
      weather,
      weekStartDate,
      weekEndDate,
    };

    // 5. Generate training plan with Claude
    const prompt = this.buildPrompt(context);

    const { text } = await generateText({
      model: openai(this.aiModel),
      prompt,
      temperature: 0.7,
    });

    // 5. Parse and save plan
    const plan = await TrainingPlanPersister.create({
      userId,
      weekStartDate,
      weekEndDate,
      planContent: text,
      aiModel: this.aiModel,
      goals: userGoals ? JSON.parse(JSON.stringify(userGoals)) : null,
      contextData: context,
      status: 'active',
    } as NewTrainingPlan);

    // 6. Parse structured activities from AI response (if formatted correctly)
    // For now, we'll just return the plan. In production, you'd parse the activities.
    const activitiesCount = 0; // TODO: Parse activities from AI response

    return {
      plan,
      activitiesCount,
    };
  }

  /**
   * Build AI prompt for training plan generation
   */
  private buildPrompt(context: Record<string, unknown>): string {
    const { goals, calendarEvents, recentActivities, weather, weekStartDate, weekEndDate } = context as {
      goals: UserGoals | null;
      calendarEvents: CalendarEvent[];
      recentActivities: StravaActivity[];
      weather: WeatherForecast | null;
      weekStartDate: Date;
      weekEndDate: Date;
    };

    return `You are an expert endurance sports coach specializing in running and cycling training plans.

Generate a detailed weekly training plan for the following athlete:

**Training Goals:**
${goals ? JSON.stringify(goals, null, 2) : 'General fitness improvement'}

**Week Range:**
- Start: ${weekStartDate.toDateString()}
- End: ${weekEndDate.toDateString()}

**Calendar Availability:**
${calendarEvents.length > 0 ? JSON.stringify(calendarEvents, null, 2) : 'No calendar constraints provided'}

**Recent Activities (from Strava):**
${recentActivities.length > 0 ? JSON.stringify(recentActivities.map((a: StravaActivity) => ({
  type: a.type || a.sportType,
  distance: a.distance,
  duration: a.movingTime || a.elapsedTime,
  date: a.startDate,
})), null, 2) : 'No recent activities available'}

**Weather Forecast:**
${weather ? weatherService.formatForPrompt(weather) : 'No forecast available'}

**Instructions:**
1. Create a balanced weekly training plan with specific workouts for each day
2. Consider the athlete's calendar commitments and schedule workouts around them
3. Progress appropriately based on recent training volume
4. Include workout types (easy run, intervals, long ride, recovery, rest, etc.)
5. Specify duration, distance, intensity, and key workout details
6. Provide coaching notes and rationale for each workout
7. Include rest and recovery days

**Output Format:**
Provide a structured plan with:
- Daily breakdown (Day 1 through Day 7)
- For each workout: type, duration, distance, intensity, description
- Weekly overview and training philosophy
- Tips for the week

Generate the training plan now:`;
  }

  /**
   * Get user's training plans
   */
  async getUserPlans(userId: string): Promise<TrainingPlan[]> {
    return TrainingPlanPersister.findByUserId(userId);
  }

  /**
   * Get specific plan with activities
   */
  async getPlanWithActivities(planId: string) {
    const plan = await TrainingPlanPersister.findById(planId);
    if (!plan) {
      throw new Error('Training plan not found');
    }

    const activities = await TrainingPlanActivityPersister.findByPlanId(planId);

    return {
      plan,
      activities,
    };
  }

  /**
   * Update user goals
   */
  async updateUserGoals(userId: string, goals: Partial<UserGoals>): Promise<UserGoals> {
    return UserGoalsPersister.upsert({
      userId,
      ...goals,
    });
  }

  /**
   * Mark activity as completed
   */
  async completeActivity(activityId: string, stravaActivityId?: string) {
    return TrainingPlanActivityPersister.markCompleted(activityId, stravaActivityId);
  }

  /**
   * Archive old plans
   */
  async archivePlan(planId: string): Promise<TrainingPlan> {
    return TrainingPlanPersister.update(planId, {
      status: 'archived',
    });
  }
}

export default TrainingPlanService;
