/**
 * Strava Controller
 * Thin HTTP request/response handlers
 * Extract request data, call services, send responses (no business logic)
 */

import type { Request, Response, NextFunction } from 'express';
import StravaService from './strava-service';
import { StravaPersister } from './strava-persister';
import type { StravaWebhookEvent } from './strava-types';

/**
 * NOTE: You'll need to instantiate StravaService with proper config
 * Example:
 * const stravaService = new StravaService({
 *   clientId: process.env.STRAVA_CLIENT_ID!,
 *   clientSecret: process.env.STRAVA_CLIENT_SECRET!,
 *   redirectUri: process.env.STRAVA_REDIRECT_URI!,
 * });
 */

/**
 * Initiate OAuth flow - redirect to Strava authorization
 */
export async function initiateOAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const stravaService = req.app.locals.stravaService as StravaService;
    const userId = req.user?.id; // Assumes auth middleware adds user to request

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Use userId as state for OAuth callback
    const authUrl = stravaService.getAuthorizationUrl(userId);

    res.json({ authUrl });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle OAuth callback from Strava
 */
export async function handleOAuthCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const stravaService = req.app.locals.stravaService as StravaService;
    const { code, state: userId, scope } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Exchange code for tokens
    const tokenResponse = await stravaService.exchangeAuthorizationCode(code);

    // Save connection to database
    await StravaPersister.upsertConnection(
      userId,
      {
        athleteId: tokenResponse.athlete.id,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: tokenResponse.expires_at,
      },
      scope
    );

    res.json({
      success: true,
      athlete: tokenResponse.athlete,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get connected Strava account info
 */
export async function getConnection(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const connection = await StravaPersister.getConnectionByUserId(userId);

    if (!connection) {
      return res.status(404).json({ error: 'No Strava connection found' });
    }

    // Don't expose sensitive tokens
    res.json({
      athleteId: connection.athleteId,
      scope: connection.scope,
      connectedAt: connection.createdAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Disconnect Strava account
 */
export async function disconnect(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await StravaPersister.deleteConnection(userId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * Sync activities from Strava
 */
export async function syncActivities(req: Request, res: Response, next: NextFunction) {
  try {
    const stravaService = req.app.locals.stravaService as StravaService;
    const userId = req.user?.id;
    const { after, before, page, perPage } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get connection
    const connection = await StravaPersister.getConnectionByUserId(userId);
    if (!connection) {
      return res.status(404).json({ error: 'No Strava connection found' });
    }

    // Ensure token is valid
    const validCredentials = await stravaService.ensureValidToken({
      athleteId: connection.athleteId,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.expiresAt,
    });

    // Update tokens if refreshed
    if (validCredentials.accessToken !== connection.accessToken) {
      await StravaPersister.updateConnectionTokens(userId, validCredentials);
    }

    // Fetch activities from Strava
    const activities = await stravaService.getAthleteActivities(validCredentials.accessToken, {
      after,
      before,
      page,
      perPage,
    });

    // Save activities to database
    const savedActivities = await Promise.all(
      activities.map((activity) =>
        StravaPersister.upsertActivity(userId, activity)
      )
    );

    res.json({
      success: true,
      count: savedActivities.length,
      activities: savedActivities,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's synced activities
 */
export async function getActivities(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const { limit, offset, startDate, endDate, type } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const activities = await StravaPersister.getUserActivities(userId, {
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      type: type as string | undefined,
    });

    const count = await StravaPersister.getActivityCount(userId);

    res.json({
      activities,
      count,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single activity
 */
export async function getActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const { activityId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const activity = await StravaPersister.getActivityByStravaId(
      userId,
      parseInt(activityId, 10)
    );

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json(activity);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle webhook verification challenge
 */
export async function handleWebhookVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': verifyToken } = req.query;

    // Verify token matches your configured token
    const expectedToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      res.json({ 'hub.challenge': challenge });
    } else {
      res.status(403).json({ error: 'Verification failed' });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Handle webhook events from Strava
 */
export async function handleWebhookEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const event = req.body as StravaWebhookEvent;

    // Acknowledge receipt immediately
    res.status(200).json({ success: true });

    // TODO: Process event asynchronously (use Inngest workflow)
    // For now, just log
    console.log('Received Strava webhook event:', event);

    // Example: Trigger background job to sync updated activity
    // await inngest.send({
    //   name: 'strava/activity.updated',
    //   data: event,
    // });
  } catch (error) {
    next(error);
  }
}
