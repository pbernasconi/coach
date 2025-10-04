/**
 * Calendar tRPC Router
 * Type-safe API endpoints for Google Calendar integration
 */

import { z } from 'zod';
import { publicProcedure, router } from '@/server/trpc';
import CalendarService from './calendar-service';

export const calendarTrpcRouter = router({
  getAuthUrl: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ input }) => {
      const authUrl = CalendarService.getAuthorizationUrl(input.userId);
      return { authUrl };
    }),

  getConnections: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const connections = await CalendarService.getUserConnections(input.userId);
      return { connections };
    }),

  syncNow: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const connections = await CalendarService.getUserConnections(input.userId);
      let successfulSyncs = 0;
      let failedSyncs = 0;

      for (const connection of connections) {
        try {
          await CalendarService.syncCalendarEvents(connection.id);
          successfulSyncs++;
        } catch (error) {
          console.error(`Failed to sync calendar for connection ${connection.id}:`, error);
          failedSyncs++;
        }
      }
      return {
        success: failedSyncs === 0,
        successfulSyncs,
        failedSyncs,
      };
    }),

  getAllUserEvents: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        startTime: z.date(),
        endTime: z.date(),
      })
    )
    .query(async ({ input }) => {
      const connections = await CalendarService.getUserConnections(input.userId);
      const allEvents = [];

      for (const connection of connections) {
        const events = await CalendarService.getEvents(
          connection.id,
          input.startTime,
          input.endTime
        );
        allEvents.push(...events);
      }
      return { events: allEvents };
    }),

  deleteConnection: publicProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ input }) => {
      await CalendarService.deleteCalendarConnection(input.connectionId);
      return { success: true };
    }),

  debugEvents: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const connections = await CalendarService.getUserConnections(input.userId);
      const allEvents = [];

      for (const connection of connections) {
        const events = await CalendarService.getEvents(
          connection.id,
          new Date('2024-09-01'),
          new Date('2024-10-01')
        );
        allEvents.push(...events);
      }

      return {
        totalEvents: allEvents.length,
        septemberEvents: allEvents,
        firstFive: allEvents.slice(0, 5).map(e => ({
          summary: e.summary,
          start: e.startTime,
          end: e.endTime,
        })),
      };
    }),
});
