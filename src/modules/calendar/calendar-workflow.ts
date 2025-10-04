/**
 * Calendar Workflow
 * Inngest background functions for calendar syncing
 */

import { inngest } from '@/lib/inngest';
import CalendarService from './calendar-service';

const calendarService = new CalendarService({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
});

/**
 * Daily calendar sync for all active connections
 * Triggered by cron or manual event
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
