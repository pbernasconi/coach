/**
 * Strava Persister
 * Database operations for Strava-related data
 */

import { db } from '@/db';
import { stravaConnections, stravaActivities, type StravaConnection } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { StravaAuthCredentials } from './strava-types';

/**
 * Strava Persister namespace
 * All database operations are exported as a namespace following the pattern
 */
export namespace StravaPersister {
  /**
   * Save or update Strava connection credentials
   */
  export async function upsertConnection(
    userId: string,
    credentials: StravaAuthCredentials,
    scope: string
  ): Promise<StravaConnection> {
    console.log('upsertConnection called with scope:', scope);
    const [connection] = await db
      .insert(stravaConnections)
      .values({
        userId: userId,
        athleteId: credentials.athleteId,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: credentials.expiresAt,
        scope: scope,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: stravaConnections.userId,
        set: {
          athleteId: credentials.athleteId,
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          expiresAt: credentials.expiresAt,
          scope: scope,
          updatedAt: new Date(),
        },
      })
      .returning();
    return connection;
  }

  /**
   * Get Strava connection by user ID
   */
  export async function getConnectionByUserId(userId: string): Promise<StravaConnection | null> {
    const [connection] = await db
      .select()
      .from(stravaConnections)
      .where(eq(stravaConnections.userId, userId))
      .limit(1);
    return connection ?? null;
  }

  /**
   * Get Strava connection by athlete ID
   */
  export async function getConnectionByAthleteId(
  ): Promise<StravaConnection | null> {
    // TODO: Implement with Drizzle ORM
    // Example:
    // const [connection] = await db
    //   .select()
    //   .from(stravaConnections)
    //   .where(eq(stravaConnections.athleteId, athleteId))
    //   .limit(1);
    // return connection ?? null;

    throw new Error('Database not configured. Implement with Drizzle ORM.');
  }

  /**
   * Update connection tokens (after refresh)
   */
  export async function updateConnectionTokens(
  ): Promise<void> {
    // TODO: Implement with Drizzle ORM
    // Example:
    // await db
    //   .update(stravaConnections)
    //   .set({
    //     accessToken: credentials.accessToken,
    //     refreshToken: credentials.refreshToken,
    //     expiresAt: credentials.expiresAt,
    //     updatedAt: new Date(),
    //   })
    //   .where(eq(stravaConnections.userId, userId));

    throw new Error('Database not configured. Implement with Drizzle ORM.');
  }

  /**
   * Delete Strava connection
   */
  export async function deleteConnection(): Promise<void> {
    // TODO: Implement with Drizzle ORM
    // Example:
    // await db
    //   .delete(stravaConnections)
    //   .where(eq(stravaConnections.userId, userId));

    throw new Error('Database not configured. Implement with Drizzle ORM.');
  }

  /**
   * Save or update activity
   */
  export async function upsertActivity(
    userId: string,
    activity: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const connection = await getConnectionByUserId(userId);
    if (!connection) {
      throw new Error('Strava connection not found');
    }

    // Helper to ensure we return undefined for null/undefined values
    const toNullableInt = (val: unknown): number | undefined => {
      return val != null ? Math.round(val as number) : undefined;
    };

    // Build the values object
    const values = {
        userId: userId,
        connectionId: connection.id,
        stravaActivityId: activity.id as number,
        name: activity.name as string,
        type: activity.type as string,
        sportType: activity.sport_type as string,
        distance: Math.round(activity.distance as number),
        movingTime: activity.moving_time as number,
        elapsedTime: activity.elapsed_time as number,
        totalElevationGain: toNullableInt(activity.total_elevation_gain),
        startDate: new Date(activity.start_date as string),
        startDateLocal: new Date(activity.start_date_local as string),
        timezone: (activity.timezone as string) || undefined,
        averageSpeed: activity.average_speed != null ? Math.round((activity.average_speed as number) * 100) : undefined,
        maxSpeed: activity.max_speed != null ? Math.round((activity.max_speed as number) * 100) : undefined,
        averageCadence: toNullableInt(activity.average_cadence),
        averageWatts: toNullableInt(activity.average_watts),
        averageHeartrate: toNullableInt(activity.average_heartrate),
        maxHeartrate: toNullableInt(activity.max_heartrate),
        kilojoules: toNullableInt(activity.kilojoules),
        kudosCount: (activity.kudos_count as number) ?? 0,
        commentCount: (activity.comment_count as number) ?? 0,
        summaryPolyline: ((activity.map as Record<string, unknown>)?.summary_polyline as string) || undefined,
        rawActivityData: activity,
        updatedAt: new Date(),
      };

    // Remove any undefined values
    const cleanedValues = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== undefined)
    ) as typeof values;

    const [saved] = await db
      .insert(stravaActivities)
      .values(cleanedValues)
      .onConflictDoUpdate({
        target: [stravaActivities.userId, stravaActivities.stravaActivityId],
        set: {
          name: activity.name as string,
          distance: Math.round(activity.distance as number),
          movingTime: activity.moving_time as number,
          elapsedTime: activity.elapsed_time as number,
          totalElevationGain: toNullableInt(activity.total_elevation_gain),
          averageSpeed: activity.average_speed != null ? Math.round((activity.average_speed as number) * 100) : undefined,
          maxSpeed: activity.max_speed != null ? Math.round((activity.max_speed as number) * 100) : undefined,
          averageCadence: toNullableInt(activity.average_cadence),
          averageWatts: toNullableInt(activity.average_watts),
          averageHeartrate: toNullableInt(activity.average_heartrate),
          maxHeartrate: toNullableInt(activity.max_heartrate),
          kilojoules: toNullableInt(activity.kilojoules),
          kudosCount: (activity.kudos_count as number) ?? 0,
          commentCount: (activity.comment_count as number) ?? 0,
          rawActivityData: activity,
          updatedAt: new Date(),
        },
      })
      .returning();

    return saved;
  }

  /**
   * Get activity by Strava activity ID
   */
  export async function getActivityByStravaId(
  ): Promise<StravaActivityRecord | null> {
    // TODO: Implement with Drizzle ORM
    // Example:
    // const [activity] = await db
    //   .select()
    //   .from(stravaActivities)
    //   .where(
    //     and(
    //       eq(stravaActivities.userId, userId),
    //       eq(stravaActivities.stravaActivityId, stravaActivityId)
    //     )
    //   )
    //   .limit(1);
    // return activity ?? null;

    throw new Error('Database not configured. Implement with Drizzle ORM.');
  }

  /**
   * Get user activities with pagination
   */
  export async function getUserActivities(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      type?: string;
    } = {}
  ): Promise<Record<string, unknown>[]> {
    const { limit = 50, offset = 0 } = options;

    const activities = await db
      .select()
      .from(stravaActivities)
      .where(eq(stravaActivities.userId, userId))
      .orderBy(desc(stravaActivities.startDate))
      .limit(limit)
      .offset(offset);

    return activities;
  }

  /**
   * Delete activity
   */
  export async function deleteActivity(): Promise<void> {
    // TODO: Implement with Drizzle ORM
    // Example:
    // await db
    //   .delete(stravaActivities)
    //   .where(
    //     and(
    //       eq(stravaActivities.userId, userId),
    //       eq(stravaActivities.stravaActivityId, stravaActivityId)
    //     )
    //   );

    throw new Error('Database not configured. Implement with Drizzle ORM.');
  }

  /**
   * Get activity count by user
   */
  export async function getActivityCount(): Promise<number> {
    // TODO: Implement with Drizzle ORM
    // Example:
    // const [result] = await db
    //   .select({ count: count() })
    //   .from(stravaActivities)
    //   .where(eq(stravaActivities.userId, userId));
    // return result?.count ?? 0;

    throw new Error('Database not configured. Implement with Drizzle ORM.');
  }
}
