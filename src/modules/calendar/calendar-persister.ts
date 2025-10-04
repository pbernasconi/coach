/**
 * Calendar Persister
 * Database operations for Google Calendar integration
 */

import { db } from '@/db';
import {
  calendarConnections,
  calendarEvents,
  calendarSyncHistory,
  type CalendarConnection,
  type NewCalendarConnection,
  type CalendarEvent,
  type NewCalendarEvent,
  type CalendarSyncHistory,
  type NewCalendarSyncHistory,
} from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

/**
 * Calendar Connections
 */
export namespace CalendarConnectionPersister {
  export async function create(data: NewCalendarConnection): Promise<CalendarConnection> {
    const [connection] = await db
      .insert(calendarConnections)
      .values(data)
      .returning();
    return connection;
  }

  export async function findById(id: string): Promise<CalendarConnection | null> {
    const [connection] = await db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.id, id))
      .limit(1);
    return connection || null;
  }

  export async function findByUserId(userId: string): Promise<CalendarConnection[]> {
    return db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, userId));
  }

  export async function findAllActive(): Promise<CalendarConnection[]> {
    return db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.isActive, true));
  }

  export async function findByGoogleAccountId(
    googleAccountId: string
  ): Promise<CalendarConnection | null> {
    const [connection] = await db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.googleAccountId, googleAccountId))
      .limit(1);
    return connection || null;
  }

  export async function updateTokens(
    id: string,
    data: {
      accessToken: string;
      refreshToken: string;
      tokenExpiresAt: Date;
    }
  ): Promise<CalendarConnection> {
    const [updated] = await db
      .update(calendarConnections)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(calendarConnections.id, id))
      .returning();
    return updated;
  }

  export async function updateLastSyncedAt(
    id: string,
    lastSyncedAt: Date
  ): Promise<CalendarConnection> {
    const [updated] = await db
      .update(calendarConnections)
      .set({
        lastSyncedAt,
        updatedAt: new Date(),
      })
      .where(eq(calendarConnections.id, id))
      .returning();
    return updated;
  }

  export async function setActive(id: string, isActive: boolean): Promise<CalendarConnection> {
    const [updated] = await db
      .update(calendarConnections)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(calendarConnections.id, id))
      .returning();
    return updated;
  }

  export async function deleteById(id: string): Promise<void> {
    await db.delete(calendarConnections).where(eq(calendarConnections.id, id));
  }
}

/**
 * Calendar Events
 */
export namespace CalendarEventPersister {
  export async function create(data: NewCalendarEvent): Promise<CalendarEvent> {
    const [event] = await db.insert(calendarEvents).values(data).returning();
    return event;
  }

  export async function createMany(data: NewCalendarEvent[]): Promise<CalendarEvent[]> {
    if (data.length === 0) return [];
    return db.insert(calendarEvents).values(data).returning();
  }

  export async function findById(id: string): Promise<CalendarEvent | null> {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .limit(1);
    return event || null;
  }

  export async function findByGoogleEventId(
    googleEventId: string,
    connectionId: string
  ): Promise<CalendarEvent | null> {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.googleEventId, googleEventId),
          eq(calendarEvents.connectionId, connectionId)
        )
      )
      .limit(1);
    return event || null;
  }

  export async function findByConnectionId(connectionId: string): Promise<CalendarEvent[]> {
    return db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.connectionId, connectionId))
      .orderBy(desc(calendarEvents.startTime));
  }

  export async function findByConnectionIdInTimeRange(
    connectionId: string,
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent[]> {
    // Find events that overlap with the time range
    // Event overlaps if: event.start < range.end AND event.end > range.start
    return db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.connectionId, connectionId),
          lte(calendarEvents.startTime, endTime), // Event starts before range ends
          gte(calendarEvents.endTime, startTime)  // Event ends after range starts
        )
      )
      .orderBy(desc(calendarEvents.startTime));
  }

  export async function update(
    id: string,
    data: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>
  ): Promise<CalendarEvent> {
    const [updated] = await db
      .update(calendarEvents)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(calendarEvents.id, id))
      .returning();
    return updated;
  }

  export async function updateByGoogleEventId(
    googleEventId: string,
    connectionId: string,
    data: Partial<Omit<CalendarEvent, 'id' | 'createdAt' | 'googleEventId' | 'connectionId'>>
  ): Promise<CalendarEvent | null> {
    const [updated] = await db
      .update(calendarEvents)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(calendarEvents.googleEventId, googleEventId),
          eq(calendarEvents.connectionId, connectionId)
        )
      )
      .returning();
    return updated || null;
  }

  export async function deleteById(id: string): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  }

  export async function deleteByConnectionId(connectionId: string): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.connectionId, connectionId));
  }

  export async function deleteByGoogleEventId(
    googleEventId: string,
    connectionId: string
  ): Promise<void> {
    await db
      .delete(calendarEvents)
      .where(
        and(
          eq(calendarEvents.googleEventId, googleEventId),
          eq(calendarEvents.connectionId, connectionId)
        )
      );
  }
}

/**
 * Sync History
 */
export namespace CalendarSyncHistoryPersister {
  export async function create(data: NewCalendarSyncHistory): Promise<CalendarSyncHistory> {
    const [record] = await db.insert(calendarSyncHistory).values(data).returning();
    return record;
  }

  export async function findById(id: string): Promise<CalendarSyncHistory | null> {
    const [record] = await db
      .select()
      .from(calendarSyncHistory)
      .where(eq(calendarSyncHistory.id, id))
      .limit(1);
    return record || null;
  }

  export async function findByConnectionId(
    connectionId: string,
    limit = 10
  ): Promise<CalendarSyncHistory[]> {
    return db
      .select()
      .from(calendarSyncHistory)
      .where(eq(calendarSyncHistory.connectionId, connectionId))
      .orderBy(desc(calendarSyncHistory.syncStartedAt))
      .limit(limit);
  }

  export async function update(
    id: string,
    data: Partial<Omit<CalendarSyncHistory, 'id' | 'connectionId' | 'createdAt'>>
  ): Promise<CalendarSyncHistory> {
    const [updated] = await db
      .update(calendarSyncHistory)
      .set(data)
      .where(eq(calendarSyncHistory.id, id))
      .returning();
    return updated;
  }

  export async function complete(
    id: string,
    stats: {
      eventsCreated: number;
      eventsUpdated: number;
      eventsDeleted: number;
    }
  ): Promise<CalendarSyncHistory> {
    return update(id, {
      status: 'completed',
      syncCompletedAt: new Date(),
      ...stats,
    });
  }

  export async function fail(id: string, error: Error): Promise<CalendarSyncHistory> {
    return update(id, {
      status: 'failed',
      syncCompletedAt: new Date(),
      errorMessage: error.message,
      errorDetails: {
        name: error.name,
        stack: error.stack,
      },
    });
  }
}
