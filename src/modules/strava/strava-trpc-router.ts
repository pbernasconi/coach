/**
 * Strava tRPC Router
 * Type-safe API endpoints for Strava integration
 */

import { z } from 'zod';
import { router, publicProcedure } from '@/server/trpc';
import StravaService from './strava-service';
import { StravaPersister } from './strava-persister';

// Initialize service
const stravaService = new StravaService({
  clientId: process.env.STRAVA_CLIENT_ID!,
  clientSecret: process.env.STRAVA_CLIENT_SECRET!,
  redirectUri: process.env.STRAVA_REDIRECT_URI!,
});

export const stravaRouter = router({
  /**
   * Get user's Strava connections
   */
  getConnections: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const connection = await StravaPersister.getConnectionByUserId(input.userId);
      return { connections: connection ? [connection] : [] };
    }),

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl: publicProcedure
    .input(
      z.object({
        state: z.string().optional(),
      })
    )
    .query(({ input }) => {
      const authUrl = stravaService.getAuthorizationUrl(input.state);
      return { authUrl };
    }),

  /**
   * Exchange authorization code for tokens
   */
  exchangeCode: publicProcedure
    .input(
      z.object({
        code: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const tokenResponse = await stravaService.exchangeAuthorizationCode(input.code);
      return tokenResponse;
    }),

  /**
   * Refresh access token
   */
  refreshToken: publicProcedure
    .input(
      z.object({
        refreshToken: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const refreshed = await stravaService.refreshAccessToken(input.refreshToken);
      return refreshed;
    }),

  /**
   * Get authenticated athlete
   */
  getAthlete: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const athlete = await stravaService.getAuthenticatedAthlete(input.accessToken);
      return athlete;
    }),

  /**
   * Get athlete activities
   */
  getActivities: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        before: z.number().optional(),
        after: z.number().optional(),
        page: z.number().optional(),
        perPage: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const activities = await stravaService.getAthleteActivities(input.accessToken, {
        before: input.before,
        after: input.after,
        page: input.page,
        perPage: input.perPage,
      });
      return { activities };
    }),

  /**
   * Get activity details
   */
  getActivity: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        activityId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const activity = await stravaService.getActivity(
        input.accessToken,
        input.activityId
      );
      return activity;
    }),

  /**
   * Update activity
   */
  updateActivity: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        activityId: z.number(),
        updates: z.object({
          name: z.string().optional(),
          type: z.string().optional(),
          sport_type: z.string().optional(),
          gear_id: z.string().optional(),
          trainer: z.boolean().optional(),
          commute: z.boolean().optional(),
          description: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const updated = await stravaService.updateActivity(
        input.accessToken,
        input.activityId,
        input.updates
      );
      return updated;
    }),

  /**
   * Sync activities from Strava to database
   */
  syncActivities: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        monthsBack: z.number().optional().default(6),
      })
    )
    .mutation(async ({ input }) => {
      // Get user's Strava connection
      const connection = await StravaPersister.getConnectionByUserId(input.userId);

      if (!connection) {
        throw new Error('Strava connection not found');
      }

      // Calculate date range (6 months back from now)
      const after = Math.floor(Date.now() / 1000) - (input.monthsBack * 30 * 24 * 60 * 60);

      // Fetch all activities from Strava
      let page = 1;
      let totalSynced = 0;
      let hasMore = true;

      while (hasMore) {
        const activities = await stravaService.getAthleteActivities(connection.accessToken, {
          after,
          page,
          perPage: 200, // Max allowed by Strava API
        });

        if (activities.length === 0) {
          hasMore = false;
          break;
        }

        // Save activities to database
        for (const activity of activities) {
          await StravaPersister.upsertActivity(input.userId, activity);
          totalSynced++;
        }

        page++;
      }

      return {
        success: true,
        totalSynced,
        message: `Successfully synced ${totalSynced} activities from the last ${input.monthsBack} months`
      };
    }),

  /**
   * Get user's activities from database
   */
  getUserActivities: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ input }) => {
      const activities = await StravaPersister.getUserActivities(input.userId, {
        limit: input.limit,
        offset: input.offset,
      });
      return { activities };
    }),
});
