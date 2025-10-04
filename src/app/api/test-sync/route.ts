/**
 * Test endpoint to manually sync user
 */

import { auth, clerkClient } from '@clerk/nextjs/server';
import AuthService from '@/modules/auth/auth-service';

const authService = new AuthService();

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user exists
    let user = await authService.getUserProfile(userId);

    if (!user) {
      // Sync from Clerk
      const clerkUser = await (await clerkClient()).users.getUser(userId);
      user = await authService.syncUserFromClerk(clerkUser);
      return Response.json({ message: 'User synced', user });
    }

    return Response.json({ message: 'User already exists', user });
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
