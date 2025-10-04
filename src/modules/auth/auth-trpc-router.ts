/**
 * Auth tRPC Router
 * tRPC endpoints for user authentication and profile management
 */

import { router, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import AuthService from './auth-service';
import { clerkClient } from '@clerk/nextjs/server';

const authService = new AuthService();

export const authRouter = router({
  /**
   * Get current user's profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    // Ensure user exists in our database
    let user = await authService.getUserProfile(ctx.userId);

    // If user doesn't exist, sync from Clerk
    if (!user) {
      const clerkUser = await (await clerkClient()).users.getUser(ctx.userId);
      user = await authService.syncUserFromClerk(clerkUser);
    }

    return user;
  }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        fullName: z.string().optional(),
        username: z.string().optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return authService.updateUserProfile(ctx.userId, input);
    }),

  /**
   * Sync user from Clerk
   * Useful for manual sync after profile updates in Clerk
   */
  syncFromClerk: protectedProcedure.mutation(async ({ ctx }) => {
    const clerkUser = await (await clerkClient()).users.getUser(ctx.userId);
    return authService.syncUserFromClerk(clerkUser);
  }),
});
