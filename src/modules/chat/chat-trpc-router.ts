/**
 * Chat tRPC Router
 * API endpoints for chat functionality
 */

import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import chatService from './chat-service';

export const chatRouter = router({
  /**
   * Create a new chat session
   */
  createSession: protectedProcedure
    .input(
      z.object({
        title: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return chatService.createSession(ctx.userId, input.title);
    }),

  /**
   * Get all user's chat sessions
   */
  getSessions: protectedProcedure.query(async ({ ctx }) => {
    return chatService.getUserSessions(ctx.userId);
  }),

  /**
   * Get a specific session with messages
   */
  getSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const result = await chatService.getSessionWithMessages(input.sessionId);

      // Verify session belongs to user
      if (result.session.userId !== ctx.userId) {
        throw new Error('Unauthorized');
      }

      return result;
    }),

  /**
   * Get context for the current user
   * Returns recent activities and upcoming calendar events
   */
  getContext: protectedProcedure.query(async ({ ctx }) => {
    return chatService.getContextForUser(ctx.userId);
  }),

  /**
   * Update session title
   */
  updateSessionTitle: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        title: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await chatService.getSessionWithMessages(input.sessionId);

      // Verify session belongs to user
      if (session.session.userId !== ctx.userId) {
        throw new Error('Unauthorized');
      }

      return chatService.updateSessionTitle(input.sessionId, input.title);
    }),

  /**
   * Delete a session
   */
  deleteSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await chatService.getSessionWithMessages(input.sessionId);

      // Verify session belongs to user
      if (session.session.userId !== ctx.userId) {
        throw new Error('Unauthorized');
      }

      return chatService.deleteSession(input.sessionId);
    }),
});
