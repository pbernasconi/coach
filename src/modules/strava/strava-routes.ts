/**
 * Strava Routes
 * Express router + inline Zod schemas for validation
 */

import { Router } from 'express';
import { z } from 'zod';
import * as controller from './strava-controller';

const router = Router();

/**
 * Zod validation middleware factory
 */
function validate<T extends z.ZodTypeAny>(schema: T, source: 'body' | 'query' | 'params' = 'body') {
  return (req: any, res: any, next: any) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      req[source] = schema.parse(data);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      next(error);
    }
  };
}

/**
 * OAuth Schemas
 */
const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1), // userId
  scope: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Activity Sync Schemas
 */
const syncActivitiesSchema = z.object({
  after: z.number().optional(),
  before: z.number().optional(),
  page: z.number().min(1).optional(),
  perPage: z.number().min(1).max(200).optional().default(30),
});

const getActivitiesQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  type: z.string().optional(),
});

const activityParamsSchema = z.object({
  activityId: z.string().regex(/^\d+$/, 'Activity ID must be numeric'),
});

/**
 * Webhook Schemas
 */
const webhookVerificationSchema = z.object({
  'hub.mode': z.enum(['subscribe']),
  'hub.challenge': z.string(),
  'hub.verify_token': z.string(),
});

const webhookEventSchema = z.object({
  object_type: z.enum(['activity', 'athlete']),
  object_id: z.number(),
  aspect_type: z.enum(['create', 'update', 'delete']),
  updates: z.record(z.unknown()).optional(),
  owner_id: z.number(),
  subscription_id: z.number(),
  event_time: z.number(),
});

/**
 * Routes
 */

// OAuth flow
router.get('/auth', controller.initiateOAuth);

router.post(
  '/auth/callback',
  validate(oauthCallbackSchema, 'body'),
  controller.handleOAuthCallback
);

// Connection management
router.get('/connection', controller.getConnection);

router.delete('/connection', controller.disconnect);

// Activity sync
router.post(
  '/activities/sync',
  validate(syncActivitiesSchema, 'body'),
  controller.syncActivities
);

// Activity retrieval
router.get(
  '/activities',
  validate(getActivitiesQuerySchema, 'query'),
  controller.getActivities
);

router.get(
  '/activities/:activityId',
  validate(activityParamsSchema, 'params'),
  controller.getActivity
);

// Webhooks
router.get(
  '/webhook',
  validate(webhookVerificationSchema, 'query'),
  controller.handleWebhookVerification
);

router.post(
  '/webhook',
  validate(webhookEventSchema, 'body'),
  controller.handleWebhookEvent
);

export default router;
