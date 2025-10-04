/**
 * Google Calendar OAuth Callback Handler
 * Handles the OAuth callback from Google
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import calendarService from '@/modules/calendar/calendar-service';

export async function GET(request: NextRequest) {
  try {
    // Get user from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // Get code and state from query params
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Handle authorization denial
    if (error) {
      return NextResponse.redirect(
        new URL(`/admin?error=${encodeURIComponent('Google Calendar authorization was denied')}`, request.url)
      );
    }

    // Validate code
    if (!code) {
      return NextResponse.redirect(
        new URL(`/admin?error=${encodeURIComponent('No authorization code received')}`, request.url)
      );
    }

    // Connect the calendar (this will exchange code for tokens and save to DB)
    const connection = await calendarService.connectCalendar(code, userId);

    // Trigger initial sync for the newly connected calendar
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 60); // Sync last 60 days
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // Sync 1 year ahead

      await calendarService.syncCalendarEvents(connection.id, {
        startDate,
        endDate,
      });
    } catch (syncError) {
      console.error('Failed to perform initial sync:', syncError);
      // Don't fail the connection if sync fails - user can manually sync later
    }

    // Redirect back to admin page with success message
    return NextResponse.redirect(
      new URL('/admin?success=calendar_connected', request.url)
    );
  } catch (error) {
    console.error('Google Calendar OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(
        `/admin?error=${encodeURIComponent('Failed to connect Google Calendar')}`,
        request.url
      )
    );
  }
}
