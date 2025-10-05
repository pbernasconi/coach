/**
 * Calendar tRPC Router
 * Type-safe API endpoints for Google Calendar integration
 */

import { z } from 'zod';
import { publicProcedure, router } from '@/server/trpc';
import CalendarService from './calendar-service';
import { CalendarConnectionPersister } from './calendar-persister';

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
    .input(z.object({ userId: z.string(), fullResync: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const connections = await CalendarService.getUserConnections(input.userId);
      let successfulSyncs = 0;
      let failedSyncs = 0;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90); // Last 90 days
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // 1 year ahead

      for (const connection of connections) {
        try {
          // If fullResync, clear lastSyncedAt to force full sync
          if (input.fullResync) {
            await CalendarConnectionPersister.updateLastSyncedAt(connection.id, null);
          }

          await CalendarService.syncCalendarEvents(connection.id, {
            startDate,
            endDate,
          });
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
