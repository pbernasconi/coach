/**
 * tRPC Base Configuration
 * Defines context, middleware, and procedure builders
 */

import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { clerkClient } from '@clerk/nextjs/server';
import AuthService from '@/modules/auth/auth-service';

const authService = new AuthService();

/**
 * Context passed to all tRPC procedures
 * Add user auth, sessions, etc. here as needed
 */
export interface Context {
  // Add userId from session/auth later
  userId?: string;
}

/**
 * Initialize tRPC with superjson transformer for Date/Map/Set support
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Export reusable router and procedure builders
 */
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware to check if user is authenticated and sync to database
 * Usage: protectedProcedure.query(...)
 */
const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new Error('Not authenticated');
  }

  // Ensure user exists in database (sync from Clerk if needed)
  try {
    let user = await authService.getUserProfile(ctx.userId);

    if (!user) {
      // User doesn't exist, sync from Clerk
      const clerkUser = await (await clerkClient()).users.getUser(ctx.userId);
      user = await authService.syncUserFromClerk(clerkUser);
    }
  } catch (error) {
    console.error('Failed to sync user:', error);
    // Continue anyway - don't block the request
  }

  return next({
    ctx: {
      userId: ctx.userId,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
