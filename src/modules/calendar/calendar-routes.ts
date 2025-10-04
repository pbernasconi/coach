/**
 * Calendar Routes
 * Express router with inline Zod validation
 */

import express from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import * as calendarController from './calendar-controller';
import { google } from 'googleapis';

export function createCalendarAPIRoutes() {
  const router = express.Router();

  router.get('/google/callback', async (req, res) => {
    const code = req.query.code as string;
    const state = req.query.state as string; // userId is passed in state
    const userId = state; // Assuming state contains userId

    if (!code || !userId) {
      res.status(400).json({ success: false, error: 'Invalid code or state' });
      return;
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.BASE_URL}/calendar/google/callback`
      );

      const token = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(token.tokens);

      // Store the access token and refresh token in the user's session or database
      // For now, we'll just return a success message
      res.json({ success: true, message: 'Google Calendar connected successfully!' });
    } catch (error) {
      console.error('Google callback error:', error);
      res.status(500).json({ success: false, error: 'Failed to connect Google Calendar' });
    }
  });

  /**
   * Validation middleware factory
   */
  function validate<T extends z.ZodTypeAny>(schema: T, source: 'body' | 'query' | 'params') {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = req[source];
        const parsed = schema.parse(data);
        req[source] = parsed;
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            success: false,
            error: 'Validation error',
            details: error.errors,
          });
        } else {
          next(error);
        }
      }
    };
  }

  // Schemas
  const getAuthUrlSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
  });

  const connectCalendarSchema = z.object({
    code: z.string().min(1, 'Authorization code is required'),
    userId: z.string().min(1, 'User ID is required'),
  });

  const getUserConnectionsSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
  });

  const syncCalendarEventsSchema = z.object({
    connectionId: z.string().min(1, 'Connection ID is required'),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    calendarId: z.string().optional(),
  });

  const getEventsSchema = z.object({
    connectionId: z.string().min(1, 'Connection ID is required'),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
  });

  const disconnectCalendarSchema = z.object({
    connectionId: z.string().min(1, 'Connection ID is required'),
  });

  const deleteConnectionParamsSchema = z.object({
    connectionId: z.string().min(1, 'Connection ID is required'),
  });

  // Routes

  /**
   * GET /calendar/auth-url
   * Get OAuth authorization URL for Google Calendar
   */
  router.get('/auth-url', validate(getAuthUrlSchema, 'query'), calendarController.getAuthUrl);

  /**
   * POST /calendar/connect
   * Handle OAuth callback and create calendar connection
   */
  router.post(
    '/connect',
    validate(connectCalendarSchema, 'body'),
    calendarController.connectCalendar
  );

  /**
   * GET /calendar/connections
   * Get all calendar connections for a user
   */
  router.get(
    '/connections',
    validate(getUserConnectionsSchema, 'query'),
    calendarController.getUserConnections
  );

  /**
   * POST /calendar/sync
   * Sync calendar events for a connection
   */
  router.post(
    '/sync',
    validate(syncCalendarEventsSchema, 'body'),
    calendarController.syncCalendarEvents
  );

  /**
   * GET /calendar/events
   * Get events for a connection within a time range
   */
  router.get('/events', validate(getEventsSchema, 'query'), calendarController.getEvents);

  /**
   * POST /calendar/disconnect
   * Disconnect calendar connection (soft delete)
   */
  router.post(
    '/disconnect',
    validate(disconnectCalendarSchema, 'body'),
    calendarController.disconnectCalendar
  );

  /**
   * DELETE /calendar/connections/:connectionId
   * Delete calendar connection permanently
   */
  router.delete(
    '/connections/:connectionId',
    validate(deleteConnectionParamsSchema, 'params'),
    calendarController.deleteCalendarConnection
  );

  /**
   * Error handler middleware
   */
  router.use((err: Error, req: Request, res: Response) => {
    console.error('Calendar route error:', err);

    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  return router;
}
