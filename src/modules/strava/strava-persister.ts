/**
 * Strava Persister
 * Database operations for Strava-related data
 */

import { db } from '@/db';
import { stravaConnections, stravaActivities, type StravaConnection } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import type { StravaActivity, StravaAuthCredentials } from './strava-types';

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
    activity: StravaActivity
  ): Promise<typeof stravaActivities.$inferSelect> {
    const connection = await getConnectionByUserId(userId);
    if (!connection) {
      throw new Error('Strava connection not found');
    }

    console.log('upsertActivity called with activity:', activity);

    // Convert activity ID to string
    const activityIdStr = String(activity.id);
    console.log('Activity ID type:', typeof activityIdStr, 'value:', activityIdStr);

    // Build the values object - map all Strava fields to our schema
    const values: typeof stravaActivities.$inferInsert = {
      userId: userId,
      connectionId: connection.id,
      stravaActivityId: activityIdStr,

      // // Activity details
      name: activity.name,
      type: activity.type,
      sportType: activity.sport_type,

      // Metrics
      distance: activity.distance,
      movingTime: activity.moving_time,
      elapsedTime: activity.elapsed_time,
      totalElevationGain: activity.total_elevation_gain,

      // Timing
      startDate: new Date(activity.start_date),
      startDateLocal: new Date(activity.start_date_local),
      timezone: activity.timezone,

      // // Speed (convert from m/s to m/s * 100 for precision)
      averageSpeed: activity.average_speed,
      maxSpeed: activity.max_speed,

    //   // // Other metrics
      averageCadence: activity.average_cadence,
      averageWatts: activity.average_watts,
      averageHeartrate: activity.average_heartrate,
      maxHeartrate: activity.max_heartrate,
      kilojoules: activity.kilojoules,

     // // Social
     kudosCount: activity.kudos_count,
     commentCount: activity.comment_count,
   };

    console.log('values:', values);

    // Check if activity already exists
    const [existing] = await db
      .select()
      .from(stravaActivities)
      .where(
        and(
          eq(stravaActivities.userId, userId),
          eq(stravaActivities.stravaActivityId, activityIdStr)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing activity using the primary key instead of activity ID
      console.log('Updating existing activity with ID:', activityIdStr);
      const [updated] = await db
        .update(stravaActivities)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(stravaActivities.id, existing.id))
        .returning();

      return updated;
    } else {
      // Insert new activity
      const [inserted] = await db
        .insert(stravaActivities)
        .values(values)
        .returning();

      return inserted;
    }
  }

  /**
   * Get activity by Strava activity ID
   */
  export async function getActivityByStravaId(
  ): Promise<(typeof stravaActivities.$inferSelect) | null> {
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
      stravaActivityId?: string;
      endDate?: Date;
      type?: string;
    } = {}
  ): Promise<(typeof stravaActivities.$inferSelect)[]> {
    const { limit = 50, offset = 0 } = options;

    const activities = await db
      .select()
      .from(stravaActivities)
      .where(eq(stravaActivities.userId, userId))
      .orderBy(desc(stravaActivities.stravaActivityId))
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
