import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { HEALTH_HEADER } from '@/lib/health-header';
import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from 'next/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  // Lift sync: the iPhone authenticates with its own bearer token (LIFT_SYNC_TOKEN), not Clerk.
  '/api/lift/sync/push',
  '/api/lift/sync/pull',
  // Vercel cron (CRON_SECRET bearer) and the start-page summary (HOME_TOKEN bearer).
  '/api/cron(.*)',
  '/api/home',
]);

// Routes with their own bearer token. They never run Clerk, so they work even when Clerk is down or not
// configured. Vercel can run middleware for paths the matcher skips, so the code checks them too.
const isMachineRoute = (path: string) =>
  /^\/api\/(home|health|lift\/sync|lift\/enroll|cron|webhooks\/strava)(\/|$)/.test(path);

// The deploy check renders the real pages as the owner with this header (src/lib/owner.ts reads it). Only GET and
// HEAD: on any other method the header is removed, so a server action never runs on it.
const isRead = (req: NextRequest) => req.method === 'GET' || req.method === 'HEAD';

async function sha256(text: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/** Constant-time check of the health header (Web Crypto: middleware runs on the edge runtime). */
async function healthHeaderValid(req: NextRequest) {
  const expected = process.env.HEALTH_TOKEN;
  const presented = req.headers.get(HEALTH_HEADER);
  if (!expected || !presented) return false;
  const [a, b] = await Promise.all([sha256(presented), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Created on first use: clerkMiddleware() throws "Missing publishableKey" when Clerk has no keys.
let withClerk: NextMiddleware | null = null;

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isMachineRoute(request.nextUrl.pathname)) return NextResponse.next();
  // Without Clerk keys the root layout shows a setup notice instead of the pages (see src/app/layout.tsx).
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) return NextResponse.next();
  withClerk ??= clerkMiddleware(async (auth, req) => {
    // Protect all routes except public ones
    const health = isRead(req) && (await healthHeaderValid(req));
    if (!isPublicRoute(req) && !health) await auth.protect();
    if (req.headers.has(HEALTH_HEADER) && !health) {
      const headers = new Headers(req.headers);
      headers.delete(HEALTH_HEADER);
      return NextResponse.next({ request: { headers } });
    }
  });
  return withClerk(request, event);
}

// Next.js needs the matcher as plain strings, so the list is written out in both patterns.
export const config = {
  matcher: [
    // Skip Next.js internals, machine routes and all static files, unless found in search params
    '/((?!_next|api/home|api/health|api/lift/sync|api/lift/enroll|api/cron|api/webhooks/strava|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for the other API routes
    '/(api(?!/home|/health|/lift/sync|/lift/enroll|/cron|/webhooks/strava)|trpc)(.*)',
  ],
};
