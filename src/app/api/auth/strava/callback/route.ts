/**
 * Strava OAuth Callback Handler
 * Handles the OAuth callback from Strava
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import StravaService from '@/modules/strava/strava-service';
import { StravaPersister } from '@/modules/strava/strava-persister';

const stravaService = new StravaService({
  clientId: process.env.STRAVA_CLIENT_ID!,
  clientSecret: process.env.STRAVA_CLIENT_SECRET!,
  redirectUri: process.env.STRAVA_REDIRECT_URI!,
});

export async function GET(request: NextRequest) {
  try {
    // Get user from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // Get code, state, and scope from query params
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const scope = searchParams.get('scope');
    const error = searchParams.get('error');

    // Handle authorization denial
    if (error) {
      return NextResponse.redirect(
        new URL(`/admin?error=${encodeURIComponent('Strava authorization was denied')}`, request.url)
      );
    }

    // Validate code
    if (!code) {
      return NextResponse.redirect(
        new URL(`/admin?error=${encodeURIComponent('No authorization code received')}`, request.url)
      );
    }

    // Verify state matches userId
    if (state !== userId) {
      return NextResponse.redirect(
        new URL(`/admin?error=${encodeURIComponent('Invalid state parameter')}`, request.url)
      );
    }

    // Validate scope
    if (!scope) {
      return NextResponse.redirect(
        new URL(`/admin?error=${encodeURIComponent('No scope received from Strava')}`, request.url)
      );
    }

    // Exchange code for tokens
    const tokenResponse = await stravaService.exchangeAuthorizationCode(code);

    // Use scope from token response, fallback to URL scope, or use default
    const scopeToSave = tokenResponse.scope || scope || 'read,activity:read_all';

    console.log('Token response:', {
      athleteId: tokenResponse.athlete.id,
      scopeFromUrl: scope,
      scopeFromToken: tokenResponse.scope,
      scopeToSave,
      expiresAt: tokenResponse.expires_at,
    });

    // Save connection to database
    await StravaPersister.upsertConnection(
      userId,
      {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: tokenResponse.expires_at,
        athleteId: tokenResponse.athlete.id,
      },
      scopeToSave
    );

    // Redirect back to admin page with success message
    return NextResponse.redirect(
      new URL('/admin?success=strava_connected', request.url)
    );
  } catch (error) {
    console.error('Strava OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(
        `/admin?error=${encodeURIComponent('Failed to connect Strava account')}`,
        request.url
      )
    );
  }
}
