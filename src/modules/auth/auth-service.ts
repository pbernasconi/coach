/**
 * Auth Service
 * Business logic for user authentication and management
 */

import { AuthPersister } from './auth-persister';
import type { User, NewUser } from '@/db/schema';

export class AuthService {
  /**
   * Sync user from Clerk to database
   * Called when user signs up or signs in
   */
  async syncUserFromClerk(clerkUser: {
    id: string;
    emailAddresses: Array<{ emailAddress: string }>;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string;
    username: string | null;
  }): Promise<User> {
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      throw new Error('User email not found');
    }

    const fullName = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(' ') || undefined;

    const userData: NewUser = {
      id: clerkUser.id,
      email,
      firstName: clerkUser.firstName || undefined,
      lastName: clerkUser.lastName || undefined,
      fullName,
      username: clerkUser.username || undefined,
      imageUrl: clerkUser.imageUrl,
    };

    const user = await AuthPersister.upsertUser(userData);
    await AuthPersister.updateLastLogin(clerkUser.id);

    return user;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<User | null> {
    return AuthPersister.getUserById(userId);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    updates: Partial<Pick<User, 'firstName' | 'lastName' | 'fullName' | 'username' | 'timezone'>>
  ): Promise<User> {
    return AuthPersister.updateUserProfile(userId, updates);
  }

  /**
   * Delete user account
   * This should be called when user deletes their Clerk account
   */
  async deleteUserAccount(userId: string): Promise<void> {
    await AuthPersister.deleteUser(userId);
  }

  /**
   * Check if user exists in database
   */
  async userExists(userId: string): Promise<boolean> {
    const user = await AuthPersister.getUserById(userId);
    return user !== null;
  }
}

export default AuthService;
