/**
 * Root tRPC App Router
 * Combines all feature routers into one root router
 */

import { router } from '../trpc';
import { calendarRouter } from '@/modules/calendar/calendar-trpc-router';
import { stravaRouter } from '@/modules/strava/strava-trpc-router';
import { trainingPlanRouter } from '@/modules/training-plan/training-plan-trpc-router';

export const appRouter = router({
  calendar: calendarRouter,
  strava: stravaRouter,
  trainingPlan: trainingPlanRouter,
});

// Export type definition for client
export type AppRouter = typeof appRouter;
