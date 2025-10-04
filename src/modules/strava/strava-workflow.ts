/**
 * Strava Workflow
 * Inngest background functions for Strava syncing
 * Note: This is a placeholder for future Strava data syncing
 */

import { inngest } from '@/lib/inngest';
import StravaService from './strava-service';

const stravaService = new StravaService({
  clientId: process.env.STRAVA_CLIENT_ID!,
  clientSecret: process.env.STRAVA_CLIENT_SECRET!,
  redirectUri: process.env.STRAVA_REDIRECT_URI!,
});

/**
 * Sync recent Strava activities for a user
 * Triggered by cron or manual event
 */
export const syncStravaActivities = inngest.createFunction(
  { id: 'sync-strava-activities', name: 'Sync Strava Activities' },
  { event: 'strava/sync.activities' },
  async ({ event, step }) => {
    const { accessToken, athleteId, after, before } = event.data;

    // Fetch activities from Strava
    const activities = await step.run('fetch-activities', async () => {
      return stravaService.getAthleteActivities(accessToken, {
        after,
        before,
        perPage: 50,
      });
    });

    // TODO: Persist activities to database if needed
    // For now, just return them

    return {
      athleteId,
      activitiesCount: activities.length,
      activities: activities.slice(0, 10), // Return first 10 for summary
    };
  }
);

/**
 * Handle Strava webhook events
 * Triggered when Strava sends activity updates
 */
export const handleStravaWebhook = inngest.createFunction(
  { id: 'handle-strava-webhook', name: 'Handle Strava Webhook' },
  { event: 'strava/webhook' },
  async ({ event, step }) => {
    const { aspect_type, object_type, object_id, owner_id, updates } = event.data;

    if (object_type !== 'activity') {
      return { skipped: true, reason: 'Not an activity event' };
    }

    // Handle different event types
    switch (aspect_type) {
      case 'create':
        // New activity created
        return await step.run('handle-new-activity', async () => {
          // TODO: Fetch activity details and store
          return {
            type: 'create',
            activityId: object_id,
            athleteId: owner_id,
          };
        });

      case 'update':
        // Activity updated
        return await step.run('handle-updated-activity', async () => {
          // TODO: Update stored activity
          return {
            type: 'update',
            activityId: object_id,
            updates,
          };
        });

      case 'delete':
        // Activity deleted
        return await step.run('handle-deleted-activity', async () => {
          // TODO: Delete stored activity
          return {
            type: 'delete',
            activityId: object_id,
          };
        });

      default:
        return { skipped: true, reason: 'Unknown aspect_type' };
    }
  }
);
