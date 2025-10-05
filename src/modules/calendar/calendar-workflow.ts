/**
 * Calendar Workflow
 * Inngest background functions for calendar syncing
 */

import { inngest } from '@/lib/inngest';
import calendarService from './calendar-service';
import { CalendarConnectionPersister } from './calendar-persister';

/**
 * Automatic 6-hour calendar sync for all active connections
 * Runs every 6 hours via cron schedule
 */
export const syncAllCalendarsCron = inngest.createFunction(
  { id: 'sync-all-calendars-cron', name: 'Sync All Calendars (Every 6 Hours)' },
  { cron: '0 */6 * * *' }, // Every 6 hours at :00 minutes
  async ({ step }) => {
    // Fetch all active calendar connections
    const connections = await step.run('fetch-active-connections', async () => {
      return await CalendarConnectionPersister.findAllActive();
    });

    if (connections.length === 0) {
      return {
        totalConnections: 0,
        message: 'No active calendar connections to sync',
      };
    }

    // Calculate sync window: today to 1 year from now
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    // Sync each connection
    const results = await Promise.allSettled(
      connections.map((connection) =>
        step.run(`sync-calendar-${connection.id}`, async () => {
          try {
            const result = await calendarService.syncCalendarEvents(connection.id, {
              startDate,
              endDate,
            });
            return {
              connectionId: connection.id,
              googleEmail: connection.googleEmail,
              success: true,
              ...result,
            };
          } catch (error) {
            console.error(`Failed to sync calendar ${connection.id}:`, error);
            return {
              connectionId: connection.id,
              googleEmail: connection.googleEmail,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      )
    );

    return {
      totalConnections: connections.length,
      syncedAt: new Date().toISOString(),
      results: results.map((r) => (r.status === 'fulfilled' ? r.value : r.reason)),
    };
  }
);

/**
 * Manual calendar sync for all active connections
 * Triggered by event for immediate sync
 */
export const syncAllCalendars = inngest.createFunction(
  { id: 'sync-all-calendars', name: 'Sync All Calendar Connections' },
  { event: 'calendar/sync.all' },
  async ({ event, step }) => {
    const { connectionIds } = event.data;

    // Sync each connection
    const results = await Promise.allSettled(
      connectionIds.map((connectionId: string) =>
        step.run(`sync-calendar-${connectionId}`, async () => {
          try {
            const result = await calendarService.syncCalendarEvents(connectionId);
            return {
              connectionId,
              success: true,
              ...result,
            };
          } catch (error) {
            return {
              connectionId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      )
    );

    return {
      totalConnections: connectionIds.length,
      results: results.map((r) => (r.status === 'fulfilled' ? r.value : r.reason)),
    };
  }
);

/**
 * Sync a single calendar connection
 * Can be triggered manually or by webhook
 */
export const syncSingleCalendar = inngest.createFunction(
  { id: 'sync-single-calendar', name: 'Sync Single Calendar Connection' },
  { event: 'calendar/sync.single' },
  async ({ event, step }) => {
    const { connectionId, startDate, endDate } = event.data;

    const result = await step.run('sync-calendar', async () => {
      return calendarService.syncCalendarEvents(connectionId, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
    });

    return result;
  }
);
