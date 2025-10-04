/**
 * Auth Persister
 * Database operations for user management
 */

import { db } from '@/db';
import { users, type User, type NewUser } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Auth Persister namespace
 * All database operations for users
 */
export namespace AuthPersister {
  /**
   * Create or update user from Clerk data
   */
  export async function upsertUser(userData: NewUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          fullName: userData.fullName,
          username: userData.username,
          imageUrl: userData.imageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  /**
   * Get user by ID (Clerk ID)
   */
  export async function getUserById(userId: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user ?? null;
  }

  /**
   * Get user by email
   */
  export async function getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user ?? null;
  }

  /**
   * Update user's last login timestamp
   */
  export async function updateLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Update user profile
   */
  export async function updateUserProfile(
    userId: string,
    updates: Partial<Pick<User, 'firstName' | 'lastName' | 'fullName' | 'username' | 'timezone'>>
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  /**
   * Deactivate user
   */
  export async function deactivateUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Reactivate user
   */
  export async function reactivateUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Delete user (hard delete)
   */
  export async function deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }
}
