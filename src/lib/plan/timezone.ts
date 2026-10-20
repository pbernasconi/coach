import { cookies } from 'next/headers';

export const HOME_TZ = 'America/Los_Angeles';

/** An IANA time zone that this runtime knows, else the home zone. */
export function validTimeZone(tz: string | undefined) {
  if (!tz) return HOME_TZ;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return HOME_TZ;
  }
}

/** The browser's time zone from the tz cookie (PlanBoard sets it), else the home zone. */
export async function cookieTimeZone() {
  return validTimeZone((await cookies()).get('tz')?.value);
}
