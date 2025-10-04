/**
 * tRPC Base Configuration
 * Defines context, middleware, and procedure builders
 */

import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';

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
 * Middleware to check if user is authenticated
 * Usage: protectedProcedure.query(...)
 */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new Error('Not authenticated');
  }
  return next({
    ctx: {
      userId: ctx.userId,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
