import { auth, currentUser } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { HEALTH_HEADER } from '@/lib/health-header';
import { sql } from '@/db';

/**
 * The data owner's user id for the signed-in Clerk user, or null.
 *
 * Coach is personal and all data belongs to the first row in users. A Clerk user with that id is the owner.
 * A Clerk user with another id (for example after a new Clerk instance) is the owner only when their
 * verified primary email is the owner's email. A GET with a valid health header (the deploy check) is the owner.
 * Anyone else gets null.
 */
export async function ownerForSignedInUser(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) return null;
  // The deploy check (GET only: middleware.ts removes the header from other methods) renders pages as the owner.
  const health = (await headers()).get(HEALTH_HEADER);
  if (health && isAuthorized(`Bearer ${health}`, process.env.HEALTH_TOKEN)) {
    const [first] = (await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`) as { id: string }[];
    return first?.id ?? null;
  }
  const { userId } = await auth();
  if (!userId) return null;
  const [owner] = (await sql`SELECT id, email FROM users ORDER BY created_at LIMIT 1`) as { id: string; email: string }[];
  if (!owner) return null;
  if (owner.id === userId) return owner.id;
  const user = await currentUser();
  const primary = user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  const verified = primary?.verification?.status === 'verified';
  return verified && primary?.emailAddress.toLowerCase() === owner.email.toLowerCase() ? owner.id : null;
}
