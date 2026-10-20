import { auth, currentUser } from '@clerk/nextjs/server';
import { sql } from '@/db';

/**
 * The data owner's user id for the signed-in Clerk user, or null.
 *
 * Coach is personal and all data belongs to the first row in users. A Clerk user with that id is the owner.
 * A Clerk user with another id (for example after a new Clerk instance) is the owner only when their
 * verified primary email is the owner's email. Anyone else gets null.
 */
export async function ownerForSignedInUser(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) return null;
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
