/**
 * Strava Routes
 * Express router + inline Zod schemas for validation
 */

import express from 'express';
import { StravaService } from './strava-service';

export const stravaRouter = express.Router();

stravaRouter.get('/auth', (req, res) => {
  const url = StravaService.getAuthUrl();
  res.redirect(url);
});

stravaRouter.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const userId = state; // Assuming userId is passed in state

  if (!code || !userId) {
    return res.status(400).send('Invalid request');
  }

  try {
    await StravaService.handleAuthCallback(userId, code);
    res.send('Strava connected successfully!');
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to connect Strava');
  }
});
