/**
 * Runs an optional loader. On an error it writes the error to the server log and returns `fallback`, so one bad
 * row or one slow service hides one part of a page instead of the whole site. Use it only for parts a page can
 * show without (a banner, a section); /api/health runs the same loaders without it, so a failure still shows.
 */
export async function safe<T>(label: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(`[safe] ${label} failed:`, error);
    return fallback;
  }
}

/** The result of a loader for a page section: its value, or the error that the section shows instead. */
export type Loaded<T> = { ok: true; value: T } | { ok: false };

export async function load<T>(label: string, run: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    console.error(`[section] ${label} failed:`, error);
    return { ok: false };
  }
}
