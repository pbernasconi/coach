/**
 * Calendar Controller
 * HTTP request/response handlers for calendar endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import CalendarService from './calendar-service';

// Initialize service (config should be loaded from env vars)
const calendarService = new CalendarService({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
});

export interface TypedRequestBody<T> extends Request {
  body: T;
}

export interface TypedRequestQuery<T> extends Request {
  query: T;
}

export interface TypedRequestParams<T> extends Request {
  params: T;
}

/**
 * Get OAuth authorization URL for Google Calendar
 * GET /calendar/auth-url
 */
export async function getAuthUrl(
  req: TypedRequestQuery<{ userId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = req.query;

    const authUrl = calendarService.getAuthorizationUrl(userId);

    res.json({
      success: true,
      data: {
        authUrl,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle OAuth callback and create calendar connection
 * POST /calendar/connect
 */
export async function connectCalendar(
  req: TypedRequestBody<{ code: string; userId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { code, userId } = req.body;

    const connection = await calendarService.connectCalendar(code, userId);

    res.json({
      success: true,
      data: {
        connection: {
          id: connection.id,
          googleEmail: connection.googleEmail,
          isActive: connection.isActive,
          lastSyncedAt: connection.lastSyncedAt,
          createdAt: connection.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all calendar connections for a user
 * GET /calendar/connections
 */
export async function getUserConnections(
  req: TypedRequestQuery<{ userId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = req.query;

    const connections = await calendarService.getUserConnections(userId);

    res.json({
      success: true,
      data: {
        connections: connections.map((conn) => ({
          id: conn.id,
          googleEmail: conn.googleEmail,
          isActive: conn.isActive,
          lastSyncedAt: conn.lastSyncedAt,
          createdAt: conn.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Sync calendar events for a connection
 * POST /calendar/sync
 */
export async function syncCalendarEvents(
  req: TypedRequestBody<{
    connectionId: string;
    startDate?: string;
    endDate?: string;
    calendarId?: string;
  }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { connectionId, startDate, endDate, calendarId } = req.body;

    const result = await calendarService.syncCalendarEvents(connectionId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      calendarId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get events for a connection within a time range
 * GET /calendar/events
 */
export async function getEvents(
  req: TypedRequestQuery<{
    connectionId: string;
    startTime: string;
    endTime: string;
  }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { connectionId, startTime, endTime } = req.query;

    const events = await calendarService.getEvents(
      connectionId,
      new Date(startTime),
      new Date(endTime)
    );

    res.json({
      success: true,
      data: {
        events: events.map((event) => ({
          id: event.id,
          googleEventId: event.googleEventId,
          summary: event.summary,
          description: event.description,
          location: event.location,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          status: event.status,
          attendees: event.attendees,
          organizer: event.organizer,
          htmlLink: event.htmlLink,
          hangoutLink: event.hangoutLink,
          conferenceData: event.conferenceData,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Disconnect calendar connection (soft delete)
 * POST /calendar/disconnect
 */
export async function disconnectCalendar(
  req: TypedRequestBody<{ connectionId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { connectionId } = req.body;

    await calendarService.disconnectCalendar(connectionId);

    res.json({
      success: true,
      message: 'Calendar connection disconnected successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete calendar connection permanently
 * DELETE /calendar/connections/:connectionId
 */
export async function deleteCalendarConnection(
  req: TypedRequestParams<{ connectionId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { connectionId } = req.params;

    await calendarService.deleteCalendarConnection(connectionId);

    res.json({
      success: true,
      message: 'Calendar connection deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
