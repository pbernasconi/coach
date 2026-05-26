/**
 * User profile config — neutral location for athlete-wide constants used
 * across modules (chat, training-plan, weather).
 * TODO: Move to DB (users / user_goals) and surface in settings UI.
 */

export interface UserLocation {
  latitude: number;
  longitude: number;
  label: string;
  timezone: string;
  temperatureUnit: 'celsius' | 'fahrenheit';
}

export const USER_LOCATION: UserLocation = {
  latitude: 37.7749,
  longitude: -122.4194,
  label: 'San Francisco, CA',
  timezone: 'America/Los_Angeles',
  temperatureUnit: 'celsius',
};
