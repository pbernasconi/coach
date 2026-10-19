import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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

const withClerk = clerkMiddleware(async (auth, request) => {
  // Protect all routes except public ones
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

// Without Clerk keys the root layout shows a setup notice instead of the pages (see src/app/layout.tsx).
export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? withClerk : () => NextResponse.next();

// Routes with their own bearer token never run Clerk, so they keep working even when Clerk is down or
// not configured: Lift sync, the start-page summary, Vercel cron and the Strava webhook.
// Next.js needs the matcher as plain strings, so the list is written out in both patterns.
export const config = {
  matcher: [
    // Skip Next.js internals, machine routes and all static files, unless found in search params
    '/((?!_next|api/home|api/lift/sync|api/cron|api/webhooks/strava|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for the other API routes
    '/(api(?!/home|/lift/sync|/cron|/webhooks/strava)|trpc)(.*)',
  ],
};
