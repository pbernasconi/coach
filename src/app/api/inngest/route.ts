/**
 * Inngest API Route
 * Serves Inngest functions and handles webhook events
 */

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';

// Import all workflow functions
import { syncAllCalendars, syncSingleCalendar } from '@/modules/calendar/calendar-workflow';
import { syncStravaActivities, handleStravaWebhook } from '@/modules/strava/strava-workflow';

// Register all functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Calendar workflows
    syncAllCalendars,
    syncSingleCalendar,

    // Strava workflows
    syncStravaActivities,
    handleStravaWebhook,
  ],
});
