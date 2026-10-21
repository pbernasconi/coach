import { auth, currentUser } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { cache } from 'react';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { HEALTH_HEADER } from '@/lib/health-header';
import { sql } from '@/db';

type Owner = { id: string; email: string };

// Remembered for a while by the running function instance, so a page load makes no Clerk API call and no owner
// query after the first: the owner row (it does not change) and the Clerk users already matched to it by email.
const TTL_MS = 10 * 60_000;
let ownerMemo: { owner: Owner | null; until: number } | null = null;
const matchedUntil = new Map<string, number>();

async function ownerRow(now: number): Promise<Owner | null> {
  if (ownerMemo && ownerMemo.until > now) return ownerMemo.owner;
  const [owner] = (await sql`SELECT id, email FROM users ORDER BY created_at LIMIT 1`) as Owner[];
  ownerMemo = { owner: owner ?? null, until: now + TTL_MS };
  return ownerMemo.owner;
}

/**
 * The data owner's user id for the signed-in Clerk user, or null. Once per request (React cache): the layout and
 * the page share the answer.
 *
 * Coach is personal and all data belongs to the first row in users. A Clerk user with that id is the owner.
 * A Clerk user with another id (for example after a new Clerk instance) is the owner only when their
 * verified primary email is the owner's email. A GET with a valid health header (the deploy check) is the owner.
 * Anyone else gets null.
 */
export const ownerForSignedInUser = cache(async (): Promise<string | null> => {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) return null;
  const now = Date.now();
  // The deploy check (GET only: proxy.ts removes the header from other methods) renders pages as the owner.
  const health = (await headers()).get(HEALTH_HEADER);
  if (health && isAuthorized(`Bearer ${health}`, process.env.HEALTH_TOKEN)) return (await ownerRow(now))?.id ?? null;
  const { userId } = await auth();
  if (!userId) return null;
  const owner = await ownerRow(now);
  if (!owner) return null;
  if (owner.id === userId || (matchedUntil.get(userId) ?? 0) > now) return owner.id;
  const user = await currentUser();
  const primary = user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  const verified = primary?.verification?.status === 'verified';
  if (!verified || primary?.emailAddress.toLowerCase() !== owner.email.toLowerCase()) return null;
  matchedUntil.set(userId, now + TTL_MS);
  return owner.id;
});
