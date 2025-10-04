/**
 * Calendar Service
 * Business logic for Google Calendar integration
 */

import { google } from 'googleapis';
import {
  CalendarConnectionPersister,
  CalendarEventPersister,
  CalendarSyncHistoryPersister,
} from './calendar-persister';
import type { CalendarConnection, CalendarEvent, NewCalendarEvent } from '@/db/schema';

interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface CalendarSyncOptions {
  startDate?: Date;
  endDate?: Date;
  calendarId?: string; // Default is 'primary'
}

export interface CalendarSyncResult {
  syncHistoryId: string;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
}

class CalendarService {
  private config: GoogleCalendarConfig;

  constructor(config: GoogleCalendarConfig) {
    this.config = config;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(userId: string): string {
    const oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );

    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass userId in state to link connection back to user
      prompt: 'consent', // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens and create connection
   */
  async connectCalendar(
    code: string,
    userId: string
  ): Promise<CalendarConnection> {
    const oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to obtain access and refresh tokens');
    }

    oauth2Client.setCredentials(tokens);

    // Get user's Google account info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email || !userInfo.id) {
      throw new Error('Failed to retrieve user email and ID from Google');
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (tokens.expiry_date || 3600 * 1000));

    // Check if connection already exists for this Google account
    const existingConnection = await CalendarConnectionPersister.findByGoogleAccountId(
      userInfo.id
    );

    if (existingConnection) {
      // Update existing connection
      return CalendarConnectionPersister.updateTokens(existingConnection.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
      });
    }

    // Create new connection
    return CalendarConnectionPersister.create({
      userId,
      googleEmail: userInfo.email,
      googleAccountId: userInfo.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
      scope: tokens.scope || '',
      isActive: true,
    });
  }

  /**
   * Get OAuth2 client with valid credentials
   */
  private async getAuthenticatedClient(
    connection: CalendarConnection
  ): Promise<typeof google.auth.OAuth2.prototype> {
    const oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );

    // Check if token needs refresh
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (connection.tokenExpiresAt.getTime() - now.getTime() < bufferTime) {
      // Token expired or about to expire, refresh it
      oauth2Client.setCredentials({
        refresh_token: connection.refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      if (!credentials.access_token || !credentials.refresh_token) {
        throw new Error('Failed to refresh access token');
      }

      // Update connection with new tokens
      const expiresAt = new Date(Date.now() + (credentials.expiry_date || 3600 * 1000));

      await CalendarConnectionPersister.updateTokens(connection.id, {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token,
        tokenExpiresAt: expiresAt,
      });

      oauth2Client.setCredentials(credentials);
    } else {
      // Token still valid
      oauth2Client.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken,
      });
    }

    return oauth2Client;
  }

  /**
   * Sync calendar events for a connection
   */
  async syncCalendarEvents(
    connectionId: string,
    options: CalendarSyncOptions = {}
  ): Promise<CalendarSyncResult> {
    const connection = await CalendarConnectionPersister.findById(connectionId);
    if (!connection) {
      throw new Error('Calendar connection not found');
    }

    if (!connection.isActive) {
      throw new Error('Calendar connection is not active');
    }

    // Create sync history record
    const syncHistory = await CalendarSyncHistoryPersister.create({
      connectionId,
      syncStartedAt: new Date(),
      status: 'in_progress',
    });

    let eventsCreated = 0;
    let eventsUpdated = 0;
    let eventsDeleted = 0;

    try {
      const oauth2Client = await this.getAuthenticatedClient(connection);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const calendarId = options.calendarId || 'primary';

      // Default to syncing last 30 days if no dates provided
      const timeMin = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const timeMax = options.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      // Optimize: Only fetch events modified since last sync (incremental sync)
      const lastSync = connection.lastSyncedAt;
      const updatedMin = lastSync ? lastSync.toISOString() : undefined;

      // Fetch events from Google Calendar
      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        updatedMin, // Key optimization: only fetch changed events
        maxResults: 2500,
        singleEvents: true,
        orderBy: 'startTime',
        showDeleted: true, // Include deleted events to detect deletions
      });

      const googleEvents = response.data.items || [];

      // Process each event
      for (const googleEvent of googleEvents) {
        if (!googleEvent.id) continue;

        // Handle deleted events
        if (googleEvent.status === 'cancelled') {
          const existingEvent = await CalendarEventPersister.findByGoogleEventId(
            googleEvent.id,
            connectionId
          );

          if (existingEvent) {
            await CalendarEventPersister.deleteByGoogleEventId(googleEvent.id, connectionId);
            eventsDeleted++;
          }
          continue;
        }

        // Skip events without start time
        if (!googleEvent.start) continue;

        const startTime = googleEvent.start.dateTime
          ? new Date(googleEvent.start.dateTime)
          : new Date(googleEvent.start.date!);

        const endTime = googleEvent.end?.dateTime
          ? new Date(googleEvent.end.dateTime)
          : googleEvent.end?.date
          ? new Date(googleEvent.end.date)
          : new Date(startTime.getTime() + 60 * 60 * 1000);

        // Debug logging for date parsing
        if (eventsCreated < 3) {
          console.log('Event date debug:', {
            summary: googleEvent.summary,
            googleStart: googleEvent.start,
            parsedStart: startTime,
            googleEnd: googleEvent.end,
            parsedEnd: endTime,
          });
        }

        const eventData: Omit<NewCalendarEvent, 'id' | 'createdAt' | 'updatedAt'> = {
          connectionId,
          googleEventId: googleEvent.id,
          googleCalendarId: calendarId,
          summary: googleEvent.summary || null,
          description: googleEvent.description || null,
          location: googleEvent.location || null,
          startTime,
          endTime,
          timezone: googleEvent.start.timeZone || null,
          isAllDay: !!googleEvent.start.date,
          recurringEventId: googleEvent.recurringEventId || null,
          recurrence: googleEvent.recurrence ? googleEvent.recurrence : null,
          status: (googleEvent.status as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
          attendees: googleEvent.attendees || null,
          organizer: googleEvent.organizer || null,
          htmlLink: googleEvent.htmlLink || null,
          hangoutLink: googleEvent.hangoutLink || null,
          conferenceData: googleEvent.conferenceData || null,
          rawEventData: googleEvent,
          lastModified: googleEvent.updated ? new Date(googleEvent.updated) : null,
        };

        // Check if event already exists
        const existingEvent = await CalendarEventPersister.findByGoogleEventId(
          googleEvent.id,
          connectionId
        );

        if (existingEvent) {
          // Check if event was updated
          const shouldUpdate =
            !existingEvent.lastModified ||
            !googleEvent.updated ||
            new Date(googleEvent.updated) > existingEvent.lastModified;

          if (shouldUpdate) {
            await CalendarEventPersister.updateByGoogleEventId(
              googleEvent.id,
              connectionId,
              eventData
            );
            eventsUpdated++;
          }
        } else {
          // Create new event
          await CalendarEventPersister.create(eventData as NewCalendarEvent);
          eventsCreated++;
        }
      }

      // Update connection last synced time
      await CalendarConnectionPersister.updateLastSyncedAt(connectionId, new Date());

      // Complete sync history
      await CalendarSyncHistoryPersister.complete(syncHistory.id, {
        eventsCreated,
        eventsUpdated,
        eventsDeleted,
      });

      return {
        syncHistoryId: syncHistory.id,
        eventsCreated,
        eventsUpdated,
        eventsDeleted,
      };
    } catch (error) {
      // Mark sync as failed
      await CalendarSyncHistoryPersister.fail(
        syncHistory.id,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Get events for a connection within a time range
   */
  async getEvents(
    connectionId: string,
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent[]> {
    return CalendarEventPersister.findByConnectionIdInTimeRange(connectionId, startTime, endTime);
  }

  /**
   * Get all connections for a user
   */
  async getUserConnections(userId: string): Promise<CalendarConnection[]> {
    return CalendarConnectionPersister.findByUserId(userId);
  }

  /**
   * Disconnect calendar (soft delete by setting inactive)
   */
  async disconnectCalendar(connectionId: string): Promise<void> {
    await CalendarConnectionPersister.setActive(connectionId, false);
  }

  /**
   * Permanently delete calendar connection and all associated events
   */
  async deleteCalendarConnection(connectionId: string): Promise<void> {
    await CalendarConnectionPersister.deleteById(connectionId);
    // Events will be cascade deleted due to foreign key constraint
  }
}

const calendarService = new CalendarService({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: `${process.env.BASE_URL}/api/auth/google/callback`,
});

export default calendarService;
