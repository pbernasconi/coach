/**
 * Root tRPC App Router
 * Combines all feature routers into one root router
 */

import { router } from '../trpc';
import { authRouter } from '@/modules/auth/auth-trpc-router';
import { calendarTrpcRouter } from '@/modules/calendar/calendar-trpc-router';
import { stravaRouter } from '@/modules/strava/strava-trpc-router';
import { trainingPlanRouter } from '@/modules/training-plan/training-plan-trpc-router';
import { chatRouter } from '@/modules/chat/chat-trpc-router';

export const appRouter = router({
  auth: authRouter,
  calendar: calendarTrpcRouter,
  strava: stravaRouter,
  trainingPlan: trainingPlanRouter,
  chat: chatRouter,
});

// Export type definition for client
export type AppRouter = typeof appRouter;
