/**
 * Calendar tRPC Router
 * Type-safe API endpoints for Google Calendar integration
 */

import { z } from 'zod';
import { router, publicProcedure } from '@/server/trpc';
import CalendarService from './calendar-service';

// Initialize service
const calendarService = new CalendarService({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
});

export const calendarRouter = router({
  /**
   * Get OAuth authorization URL
   */
  getAuthUrl: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
      })
    )
    .query(({ input }) => {
      const authUrl = calendarService.getAuthorizationUrl(input.userId);
      return { authUrl };
    }),

  /**
   * Connect Google Calendar (exchange code for tokens)
   */
  connect: publicProcedure
    .input(
      z.object({
        code: z.string().min(1),
        userId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const connection = await calendarService.connectCalendar(
        input.code,
        input.userId
      );

      return {
        connection: {
          id: connection.id,
          googleEmail: connection.googleEmail,
          isActive: connection.isActive,
          lastSyncedAt: connection.lastSyncedAt,
          createdAt: connection.createdAt,
        },
      };
    }),

  /**
   * Get user's calendar connections
   */
  getConnections: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const connections = await calendarService.getUserConnections(input.userId);

      return {
        connections: connections.map((conn) => ({
          id: conn.id,
          googleEmail: conn.googleEmail,
          isActive: conn.isActive,
          lastSyncedAt: conn.lastSyncedAt,
          createdAt: conn.createdAt,
        })),
      };
    }),

  /**
   * Sync calendar events
   */
  syncEvents: publicProcedure
    .input(
      z.object({
        connectionId: z.string().min(1),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        calendarId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await calendarService.syncCalendarEvents(input.connectionId, {
        startDate: input.startDate,
        endDate: input.endDate,
        calendarId: input.calendarId,
      });

      return result;
    }),

  /**
   * Get events for a connection
   */
  getEvents: publicProcedure
    .input(
      z.object({
        connectionId: z.string().min(1),
        startTime: z.date(),
        endTime: z.date(),
      })
    )
    .query(async ({ input }) => {
      const events = await calendarService.getEvents(
        input.connectionId,
        input.startTime,
        input.endTime
      );

      return {
        events: events.map((event) => ({
          id: event.id,
          googleEventId: event.googleEventId,
          summary: event.summary,
          description: event.description,
          location: event.location,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          status: event.status,
          attendees: event.attendees,
          organizer: event.organizer,
          htmlLink: event.htmlLink,
          hangoutLink: event.hangoutLink,
          conferenceData: event.conferenceData,
        })),
      };
    }),

  /**
   * Disconnect calendar (soft delete)
   */
  disconnect: publicProcedure
    .input(
      z.object({
        connectionId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await calendarService.disconnectCalendar(input.connectionId);
      return { success: true };
    }),

  /**
   * Delete calendar connection permanently
   */
  deleteConnection: publicProcedure
    .input(
      z.object({
        connectionId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await calendarService.deleteCalendarConnection(input.connectionId);
      return { success: true };
    }),
});
