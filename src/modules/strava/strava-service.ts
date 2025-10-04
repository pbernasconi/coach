/**
 * Strava Service
 * Business logic for Strava API integration
 */

import type {
  StravaAthlete,
  StravaActivity,
  StravaTokenResponse,
  StravaRefreshTokenResponse,
  StravaAuthCredentials,
  StravaWebhookSubscription,
} from './strava-types';

interface StravaConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

class StravaService {
  private config: StravaConfig;
  private baseUrl = 'https://www.strava.com/api/v3';

  constructor(config: StravaConfig) {
    this.config = config;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all,activity:write,profile:read_all',
      ...(state && { state }),
    });

    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeAuthorizationCode(code: string): Promise<StravaTokenResponse> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange authorization code: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(refreshToken: string): Promise<StravaRefreshTokenResponse> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh access token: ${error}`);
    }

    return response.json();
  }

  /**
   * Ensure access token is valid, refresh if necessary
   */
  async ensureValidToken(credentials: StravaAuthCredentials): Promise<StravaAuthCredentials> {
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // Refresh 5 minutes before expiry

    if (credentials.expiresAt > now + bufferTime) {
      return credentials;
    }

    const refreshed = await this.refreshAccessToken(credentials.refreshToken);

    return {
      athleteId: credentials.athleteId,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: refreshed.expires_at,
    };
  }

  /**
   * Make authenticated request to Strava API
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    accessToken: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Strava API request failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Get authenticated athlete profile
   */
  async getAuthenticatedAthlete(accessToken: string): Promise<StravaAthlete> {
    return this.authenticatedRequest<StravaAthlete>('/athlete', accessToken);
  }

  /**
   * Get athlete activities with pagination
   */
  async getAthleteActivities(
    accessToken: string,
    options: {
      before?: number;
      after?: number;
      page?: number;
      perPage?: number;
    } = {}
  ): Promise<StravaActivity[]> {
    const params = new URLSearchParams();
    if (options.before) params.append('before', options.before.toString());
    if (options.after) params.append('after', options.after.toString());
    if (options.page) params.append('page', options.page.toString());
    if (options.perPage) params.append('per_page', options.perPage.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.authenticatedRequest<StravaActivity[]>(
      `/athlete/activities${query}`,
      accessToken
    );
  }

  /**
   * Get detailed activity by ID
   */
  async getActivity(accessToken: string, activityId: number): Promise<StravaActivity> {
    return this.authenticatedRequest<StravaActivity>(
      `/activities/${activityId}`,
      accessToken
    );
  }

  /**
   * Update activity
   */
  async updateActivity(
    accessToken: string,
    activityId: number,
    updates: {
      name?: string;
      type?: string;
      sport_type?: string;
      gear_id?: string;
      trainer?: boolean;
      commute?: boolean;
      description?: string;
    }
  ): Promise<StravaActivity> {
    return this.authenticatedRequest<StravaActivity>(
      `/activities/${activityId}`,
      accessToken,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
  }

  /**
   * Create webhook subscription
   */
  async createWebhookSubscription(
    callbackUrl: string,
    verifyToken: string
  ): Promise<StravaWebhookSubscription> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      callback_url: callbackUrl,
      verify_token: verifyToken,
    });

    const response = await fetch(`${this.baseUrl}/push_subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create webhook subscription: ${error}`);
    }

    return response.json();
  }

  /**
   * List webhook subscriptions
   */
  async listWebhookSubscriptions(): Promise<StravaWebhookSubscription[]> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(`${this.baseUrl}/push_subscriptions?${params.toString()}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list webhook subscriptions: ${error}`);
    }

    return response.json();
  }

  /**
   * Delete webhook subscription
   */
  async deleteWebhookSubscription(subscriptionId: number): Promise<void> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(
      `${this.baseUrl}/push_subscriptions/${subscriptionId}?${params.toString()}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete webhook subscription: ${error}`);
    }
  }
}

export default StravaService;
