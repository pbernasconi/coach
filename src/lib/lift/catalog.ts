import catalog from '../../../lift/ios/Packages/LiftKit/Sources/LiftCore/Resources/exercise-catalog.json';

/**
 * The Lift app's bundled exercise catalog, read from the app's own file so the web and the iPhone show the same
 * names, pictures, muscles and instructions. Server only: the file is about 1 MB.
 *
 * Media (© Gym visual) loads from the dataset repository at the pinned commit, exactly as the app does
 * (lift/ios/Lift/Features/ExerciseMedia/ExerciseMediaSource.swift). It is never re-hosted or proxied, so pages show
 * it with a plain <img>. Coach is personal and signed in, like Lift (lift/ios/ExerciseMedia/ATTRIBUTION.md).
 */

type Entry = {
  id: string;
  name: string;
  bodyPart?: string;
  equipment?: string;
  target?: string;
  secondary?: string[];
  steps?: string[];
  image?: string;
  gif?: string;
};

export type ExerciseMedia = {
  catalogName: string;
  image: string | null;
  gif: string | null;
  target: string | null;
  secondary: string[];
  equipment: string | null;
  bodyPart: string | null;
  steps: string[];
};

const REPOSITORY = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/';
const COMMIT = /^[0-9a-f]{40}$/i;
const PATH = /^(images|videos)\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.(jpg|gif)$/;

const data = catalog as unknown as { commit: string; exercises: Entry[] };
const BY_ID = new Map(data.exercises.map((e) => [e.id, e]));

/** The raw URL of a dataset path; null for a bad commit or path, so a bad value can never point elsewhere. */
export function mediaUrl(path: string | undefined): string | null {
  if (!path || !COMMIT.test(data.commit) || !PATH.test(path)) return null;
  return `${REPOSITORY}${data.commit}/${path}`;
}

/** The catalog facts for a library exercise's catalogID ("0043"), or null. */
export function exerciseMedia(catalogId: string | null | undefined): ExerciseMedia | null {
  const e = catalogId ? BY_ID.get(catalogId) : undefined;
  if (!e) return null;
  return {
    catalogName: e.name,
    image: mediaUrl(e.image),
    gif: mediaUrl(e.gif),
    target: e.target ?? null,
    secondary: e.secondary ?? [],
    equipment: e.equipment ?? null,
    bodyPart: e.bodyPart ?? null,
    steps: e.steps ?? [],
  };
}

/** Adds `media` to every exercise of a session detail (or anything with `catalogId` on its exercises). */
export type WithMedia<T extends { exercises: { catalogId: string | null }[] }> = Omit<T, 'exercises'> & {
  exercises: (T['exercises'][number] & { media: ExerciseMedia | null })[];
};

export function withMedia<T extends { exercises: { catalogId: string | null }[] }>(detail: T): WithMedia<T> {
  return { ...detail, exercises: detail.exercises.map((e) => ({ ...e, media: exerciseMedia(e.catalogId) })) };
}

const nameOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const BY_NAME = new Map<string, string | null>();
for (const e of data.exercises) {
  const key = nameOf(e.name);
  BY_NAME.set(key, BY_NAME.has(key) ? null : e.id);
}

/** The catalog id of the one entry with exactly this name ("Standing Calf Raise"), for a new library exercise's picture. */
export function catalogIdByName(name: string): string | null {
  return BY_NAME.get(nameOf(name)) ?? null;
}
