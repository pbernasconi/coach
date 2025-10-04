/**
 * Strava tRPC Router
 * Type-safe API endpoints for Strava integration
 */

import { z } from 'zod';
import { router, publicProcedure } from '@/server/trpc';
import StravaService from './strava-service';

// Initialize service
const stravaService = new StravaService({
  clientId: process.env.STRAVA_CLIENT_ID!,
  clientSecret: process.env.STRAVA_CLIENT_SECRET!,
  redirectUri: process.env.STRAVA_REDIRECT_URI!,
});

export const stravaRouter = router({
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
});
