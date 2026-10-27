// @ts-check
// Where a notification lands when it is tapped: one typed destination per screen, and the two links built from it.
// The app link (`lift://…`) opens the Lift iPhone app on that screen; lift/PUSH.md is the contract and
// lift/ios/Lift/App/AppLink.swift its other half. The web link opens the same thing on the coach web app, for a
// device without Lift. Event definitions name a destination, never a URL, so no event hand-builds a link.

/**
 * @typedef {{ kind: 'liftSession', id: string }
 *   | { kind: 'activity', id: string }
 *   | { kind: 'weighIn', date: string }
 *   | { kind: 'today' }
 *   | { kind: 'coach' }} Destination
 */

const SESSION_ID = /^[0-9a-f-]{1,64}$/i;
const ACTIVITY_ID = /^[0-9A-Za-z_-]{1,64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks a destination's id, so a link never carries text that could change its path.
 * @param {Destination} d
 * @returns {Destination}
 */
export function checked(d) {
  if (d.kind === 'liftSession' && !SESSION_ID.test(d.id)) throw new Error('liftSession id must be a session UUID');
  if (d.kind === 'activity' && !ACTIVITY_ID.test(d.id)) throw new Error('activity id must be a Strava or row id');
  if (d.kind === 'weighIn' && !DAY.test(d.date)) throw new Error('weighIn date must be YYYY-MM-DD');
  return d;
}

/**
 * The Lift app link: `lift://session/<id>`, `lift://activity/<id>`, `lift://weigh-in/<YYYY-MM-DD>`, `lift://today`,
 * `lift://coach`.
 * Session ids are lower case, as the App API sends them.
 * @param {Destination} d
 */
export function appLink(d) {
  const c = checked(d);
  switch (c.kind) {
    case 'liftSession':
      return `lift://session/${c.id.toLowerCase()}`;
    case 'activity':
      return `lift://activity/${c.id}`;
    case 'weighIn':
      return `lift://weigh-in/${c.date}`;
    case 'today':
      return 'lift://today';
    case 'coach':
      return 'lift://coach';
  }
}

/**
 * The same place on the coach web app.
 * @param {Destination} d
 * @param {string} origin e.g. https://coach.paolobernasconi.com
 */
export function webLink(d, origin) {
  const c = checked(d);
  const base = origin.replace(/\/+$/, '');
  switch (c.kind) {
    case 'liftSession':
      return `${base}/lift/sessions/${c.id.toLowerCase()}`;
    case 'activity':
      return `${base}/activities/${c.id}`;
    case 'weighIn':
      return `${base}/health`;
    case 'today':
    case 'coach':
      return `${base}/`;
  }
}
