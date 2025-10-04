/**
 * Strava API Types
 * Based on Strava API v3 documentation
 */

export interface StravaAthlete {
  id: number;
  username: string | null;
  resource_state: number;
  firstname: string;
  lastname: string;
  bio: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  sex: 'M' | 'F' | null;
  premium: boolean;
  summit: boolean;
  created_at: string;
  updated_at: string;
  badge_type_id: number;
  weight: number | null;
  profile_medium: string;
  profile: string;
  friend: boolean | null;
  follower: boolean | null;
}

export interface StravaActivity {
  id: number;
  resource_state: number;
  athlete: {
    id: number;
    resource_state: number;
  };
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  workout_type: number | null;
  start_date: string;
  start_date_local: string;
  timezone: string;
  utc_offset: number;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map: {
    id: string;
    summary_polyline: string | null;
    resource_state: number;
  };
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  visibility: string;
  flagged: boolean;
  gear_id: string | null;
  start_latlng: [number, number] | null;
  end_latlng: [number, number] | null;
  average_speed: number;
  max_speed: number;
  average_cadence: number | null;
  average_watts: number | null;
  weighted_average_watts: number | null;
  kilojoules: number | null;
  device_watts: boolean;
  has_heartrate: boolean;
  average_heartrate: number | null;
  max_heartrate: number | null;
  heartrate_opt_out: boolean;
  display_hide_heartrate_option: boolean;
  elev_high: number | null;
  elev_low: number | null;
  upload_id: number | null;
  upload_id_str: string | null;
  external_id: string | null;
  from_accepted_tag: boolean;
  pr_count: number;
  total_photo_count: number;
  has_kudoed: boolean;
}

export interface StravaTokenResponse {
  token_type: 'Bearer';
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: StravaAthlete;
}

export interface StravaRefreshTokenResponse {
  token_type: 'Bearer';
  access_token: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
}

export interface StravaWebhookSubscription {
  id: number;
  resource_state: number;
  application_id: number;
  callback_url: string;
  created_at: string;
  updated_at: string;
}

export interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  updates: Record<string, unknown>;
  owner_id: number;
  subscription_id: number;
  event_time: number;
}

export interface StravaAuthCredentials {
  athleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
