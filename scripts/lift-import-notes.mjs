#!/usr/bin/env node
/**
 * Writes Lift rows the way the iPhone pushes them, through the sync push code (src/lib/lift-sync/sync.mjs:
 * validateChange, and the same last-writer-wins upsert as drizzle-repository.ts), so the iPhone pulls them.
 *
 * Usage (DATABASE_URL from the env file; --host must equal its host, a guard against the wrong database):
 *   node --env-file=.env.local scripts/lift-import-notes.mjs --host <db host> --file <sessions.json> [--dry-run] [--check]
 *   node --env-file=.env.local scripts/lift-import-notes.mjs --host <db host> --set-muscles <muscles.json> [--dry-run] [--check]
 *   node --env-file=.env.local scripts/lift-import-notes.mjs --host <db host> --check [--from YYYY-MM-DD --to YYYY-MM-DD]
 *
 * --file: a notes-import file (an array of sessions, each with exercises and sets; built outside the repo, it holds
 *   personal data and is never committed). Writes the custom exercises it needs, then sessions, session exercises and
 *   sets. Ids are UUID v5 of the file's session ids and positions, so a re-run updates rows in place. Each session's
 *   note starts with "Imported from Apple Notes (notes-import)" (lift_rows has no source column).
 * --set-muscles: a JSON array [{ "name": "Dead bug", "primary": ["core"], "secondary": [] }]; sets the muscles of the
 *   live library exercise with that name and keeps every other field.
 * Every row is compared with the stored copy (ignoring updatedAt): unchanged rows are skipped; new or changed rows are
 * pushed with a fresh idempotency key and updatedAt = now. One pg connection; one transaction per 500 rows.
 * --dry-run is read-only and prints what would change. --check prints the dashboard summaries
 * (src/lib/lift-dashboard/stats.mjs); --from/--to set the hard-sets-per-muscle window (default: the last 4 weeks).
 * Writes only lift_rows, lift_applied_changes (idempotency keys) and lift_rows_seq.
 */

import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { push } from '../src/lib/lift-sync/sync.mjs';
import { MAX_CHANGES_PER_PUSH } from '../src/lib/lift-sync/contract.mjs';
import { buildModel, displayUnit, exerciseDetail, exerciseList, muscleSets, sessionSummaries, topLifts, weeklyVolume } from '../src/lib/lift-dashboard/stats.mjs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const file = opt('--file');
const host = opt('--host');
const dryRun = args.includes('--dry-run');
const checkOnly = args.includes('--check');
const musclesFile = opt('--set-muscles');
if (!file && !musclesFile && !checkOnly) {
  console.error('Usage: lift-import-notes.mjs --host <db host> (--file <sessions.json> | --set-muscles <muscles.json> | --check) [--dry-run] [--check]');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
const dbHost = new URL(url).hostname;
if (host !== dbHost) {
  console.error(`Refusing: --host ${host ?? '(missing)'} does not match DATABASE_URL host ${dbHost}.`);
  process.exit(1);
}
// One TCP connection for the whole run (no per-row HTTPS requests), and one transaction per chunk of 500 rows.
const client = new pg.Client({ connectionString: url });
await client.connect();
const q = async (text, params = []) => (await client.query(text, params)).rows;
const finish = async (code) => {
  await client.end();
  process.exit(code);
};
if (dryRun || (checkOnly && !file && !musclesFile)) await q('SET default_transaction_read_only = on');

// ---------------------------------------------------------------- ids and stamps

const NAMESPACE = 'a9d6f1c2-6b1e-4f43-9c1d-2f6d1b0e7a11'; // notes-import namespace (fixed)

/** RFC 4122 version 5 UUID of `name` in `namespace`, upper case like Swift's uuidString. */
function uuidV5(name, namespace = NAMESPACE) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(Buffer.concat([ns, Buffer.from(name, 'utf8')])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toUpperCase();
}

const RUN_STAMP = new Date().toISOString(); // updatedAt for changed rows; the key ignores it

/** Stable JSON (sorted keys) for hashing. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** A push change for `entity` with `payload` (without updatedAt); the key is set when it is pushed. */
function change(entity, payload) {
  return { idempotencyKey: null, entity, rowId: payload.id, op: 'insert', payload: { ...payload, updatedAt: RUN_STAMP } };
}

const withoutStamp = (payload) => Object.fromEntries(Object.entries(payload).filter(([k]) => k !== 'updatedAt'));

// ---------------------------------------------------------------- mapping

const EQUIPMENT = new Set(['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'other']);
/** sessions.json lift_load_mode → LiftStore loadMode */
const libraryMode = (m) => (m.startsWith('bodyweight') ? 'bodyweight' : m);

function setLoadMode(ex, s) {
  if (ex.lift_load_mode.startsWith('bodyweight')) return 'bodyweight';
  const oneDumbbell = s.flags.some((f) => f.startsWith("'1x' read as one dumbbell") || f.startsWith("'both arms'"));
  if (s.per_hand && ex.proposed_name === 'Seated cable row') return 'perSide';
  if (s.per_hand) return 'perHand';
  if (ex.lift_load_mode === 'perHand' && !oneDumbbell) return 'perHand';
  return 'total';
}

function sessionTitle(title) {
  const t = title
    .replace(/\s*[-–—]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}(st|nd|rd|th)?\b/i, '')
    .replace(/\s*\((june|jun)\s*\d+(th)?\)/i, '')
    .replace(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}$/i, 'Workout')
    .replace(/\s+/g, ' ')
    .trim();
  return t || 'Workout';
}

function setNote(s) {
  const parts = [];
  if (s.duration_s !== null) parts.push(`${s.duration_s} s (reps = seconds)`);
  if (s.per_side) parts.push('per side');
  if (s.note) parts.push(s.note);
  return parts.length ? parts.join('; ') : null;
}

function buildChanges(sessions) {
  const exercises = new Map(); // proposed name -> payload
  const changes = { exercise: [], session: [], sessionExercise: [], set: [] };
  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (!ex.new_exercise || exercises.has(ex.proposed_name)) continue;
      const spec = ex.new_exercise_spec;
      const aliases = [...new Set(sessions.flatMap((s) => s.exercises)
        .filter((e) => e.proposed_name === ex.proposed_name)
        .map((e) => e.original_name.toLowerCase().replace(/\s+/g, ' ').trim())
        .filter((a) => a && a !== ex.proposed_name.toLowerCase()))].sort().slice(0, 12);
      if (!EQUIPMENT.has(spec.equipment)) throw new Error(`bad equipment ${spec.equipment}`);
      exercises.set(ex.proposed_name, {
        id: uuidV5(`exercise:${ex.proposed_name}`),
        name: spec.name,
        aliases: JSON.stringify(aliases),
        equipment: spec.equipment,
        loadMode: libraryMode(spec.load_mode),
        loadAddedValue: null,
        loadAddedUnit: null,
        primaryMuscles: JSON.stringify(spec.primary),
        secondaryMuscles: JSON.stringify(spec.secondary),
        videoURL: null,
        isArchived: 0,
        catalogID: spec.closest_catalog_id ?? null,
        createdAt: '2026-10-20T00:00:00.000Z',
        deletedAt: null,
      });
    }
  }
  for (const p of exercises.values()) changes.exercise.push(change('exercise', p));

  for (const session of sessions) {
    const sessionId = uuidV5(`session:${session.id}`);
    const createdAt = session.started_at ?? `${session.date}T12:00:00.000Z`;
    const src = session.source_notes[0];
    const noteLines = [`Imported from Apple Notes (notes-import): “${src.title}”, note created ${src.created}, modified ${src.modified}.`];
    if (session.date_confidence !== 'high') noteLines.push(`Date confidence ${session.date_confidence}: ${session.date_evidence}`);
    if (session.notes) noteLines.push(session.notes);
    changes.session.push(change('session', {
      id: sessionId,
      day: session.date,
      title: sessionTitle(session.title),
      templateID: null,
      startedAt: session.started_at,
      finishedAt: session.finished_at,
      warmUpNote: null,
      note: noteLines.join('\n'),
      unitsAtLog: 'lb',
      healthWorkoutID: null,
      createdAt,
      deletedAt: null,
    }));
    const groups = new Map();
    session.exercises.forEach((ex, position) => {
      const seId = uuidV5(`sessionExercise:${session.id}:${position}`);
      const exerciseId = ex.new_exercise ? exercises.get(ex.proposed_name).id : ex.lift_exercise_id.toUpperCase();
      let group = null;
      if (ex.superset_group) {
        if (!groups.has(ex.superset_group)) groups.set(ex.superset_group, groups.size + 1);
        group = groups.get(ex.superset_group);
      }
      const modes = ex.sets.map((s) => setLoadMode(ex, s));
      const tally = new Map();
      for (const m of modes) tally.set(m, (tally.get(m) ?? 0) + 1);
      const seMode = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? libraryMode(ex.lift_load_mode);
      const seNote = [`Note: “${ex.original_name}”`, ex.exercise_note].filter(Boolean).join('; ');
      changes.sessionExercise.push(change('sessionExercise', {
        id: seId,
        sessionID: sessionId,
        exerciseID: exerciseId,
        position,
        displayName: ex.proposed_name,
        loadMode: seMode,
        loadAddedValue: null,
        loadAddedUnit: null,
        equipment: ex.new_exercise_spec?.equipment ?? null,
        restSeconds: null,
        note: seNote,
        supersetGroup: group,
        nextTimeHintValue: null,
        nextTimeHintUnit: null,
        createdAt,
        deletedAt: null,
      }));
      ex.sets.forEach((s, i) => {
        const fromPlan = s.flags.some((f) => f.startsWith('from plan'));
        const reps = s.duration_s !== null ? s.duration_s : s.reps;
        const mode = setLoadMode(ex, s);
        changes.set.push(change('set', {
          id: uuidV5(`set:${session.id}:${position}:${i}`),
          sessionExerciseID: seId,
          position: i,
          kind: 'working',
          targetReps: fromPlan ? reps : null,
          targetRepMin: null,
          targetRepMax: null,
          targetWeight: fromPlan ? s.weight_lb : null,
          actualReps: reps,
          actualWeight: s.weight_lb,
          unit: 'lb',
          loadMode: mode,
          loadAddedValue: mode === 'bodyweight' ? s.weight_lb : null,
          loadAddedUnit: mode === 'bodyweight' && s.weight_lb !== null ? 'lb' : null,
          status: 'done',
          completedAt: session.finished_at ?? session.started_at,
          note: setNote(s),
          createdAt,
          deletedAt: null,
        }));
      });
    });
  }
  return changes;
}

// ---------------------------------------------------------------- repository (same SQL as drizzle-repository.ts)

const outcomes = { applied: 0, stale: 0, duplicate: 0 };
const repo = {
  async applyChange(c) {
    const rows = await q(
      `WITH key AS (
        INSERT INTO lift_applied_changes (idempotency_key)
        VALUES ($1::uuid)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING idempotency_key
      ), up AS (
        INSERT INTO lift_rows (entity, id, payload, updated_at, deleted_at)
        SELECT $2, $3::uuid, $4::jsonb, $5::timestamptz, $6::timestamptz
        FROM key
        ON CONFLICT (entity, id) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          seq = nextval('lift_rows_seq')
        WHERE excluded.updated_at > lift_rows.updated_at
        RETURNING seq
      )
      SELECT (SELECT count(*) FROM key)::int AS fresh, (SELECT count(*) FROM up)::int AS applied`,
      [c.idempotencyKey, c.entity, c.id, JSON.stringify(c.payload), c.updatedAt.toISOString(),
        c.deletedAt ? c.deletedAt.toISOString() : null]
    );
    const row = rows[0];
    const outcome = !row || Number(row.fresh) === 0 ? 'duplicate' : Number(row.applied) > 0 ? 'applied' : 'stale';
    outcomes[outcome] += 1;
    return outcome;
  },
  async listSince() {
    throw new Error('not used');
  },
};

// ---------------------------------------------------------------- check

async function check() {
  const rows = await q('SELECT entity, payload FROM lift_rows WHERE deleted_at IS NULL');
  const data = { exercises: [], sessions: [], sessionExercises: [], sets: [] };
  for (const r of rows) {
    if (r.entity === 'exercise') data.exercises.push(r.payload);
    else if (r.entity === 'session') data.sessions.push(r.payload);
    else if (r.entity === 'sessionExercise') data.sessionExercises.push(r.payload);
    else if (r.entity === 'set') data.sets.push(r.payload);
  }
  const model = buildModel(data);
  const unit = displayUnit(model.sets);
  const counts = await q('SELECT entity, count(*)::int AS n FROM lift_rows GROUP BY entity ORDER BY entity');
  console.log('lift_rows:', counts.map((c) => `${c.entity} ${c.n}`).join(', '));
  console.log(`model: ${model.sessions.size} sessions, ${model.sets.length} sets joined (of ${data.sets.length} set rows), display unit ${unit}`);
  const summaries = sessionSummaries(model, unit);
  console.log(`sessions page: ${summaries.length} sessions, newest ${summaries[0]?.day} “${summaries[0]?.title}” ${summaries[0]?.setsLogged}/${summaries[0]?.setsTotal} sets, oldest ${summaries.at(-1)?.day}`);
  const weeks = weeklyVolume(model, unit);
  console.log(`weekly volume: ${weeks.length} weeks, ${weeks.filter((w) => w.sessions > 0).length} with sessions`);
  const last = opt('--to') ?? summaries[0]?.day;
  const from = opt('--from') ?? new Date(Date.parse(`${last}T00:00:00Z`) - 27 * 86400000).toISOString().slice(0, 10);
  console.log(`hard sets per muscle ${from}..${last}:`, muscleSets(model, from, last).map((m) => `${m.muscle} ${m.sets}`).join(', '));
  console.log('top lifts since 2026-01-01:', topLifts(model, unit, '2026-01-01').map((t) => `${t.name} (${t.sessions} sessions, e1RM ${t.latest?.toFixed(0)}, change ${t.change === null ? '—' : (t.change * 100).toFixed(0) + '%'})`).join('; '));
  const list = exerciseList(model, unit);
  console.log(`exercise list: ${list.length} exercises`);
  for (const name of ['Back squat', 'Bulgarian split squat', 'Romanian deadlift', 'Leg extension']) {
    const e = list.find((x) => x.name === name);
    const d = e && exerciseDetail(model, e.key, unit);
    console.log(`  ${name}: ${d?.sessions} sessions, ${d?.loggedSets} sets, heaviest ${d?.heaviest}, first ${d?.e1rmOverTime[0]?.day}, last ${d?.e1rmOverTime.at(-1)?.day}`);
  }
  const orphans = data.sets.length - model.sets.length;
  if (orphans) console.log(`WARNING: ${orphans} set rows did not join to a session`);
}

// ---------------------------------------------------------------- main

const MUSCLES = new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core', 'forearms']);

/** Library rows with new muscles, from a --set-muscles file. */
async function muscleChanges(path) {
  const wanted = JSON.parse(readFileSync(path, 'utf8'));
  const library = await q(`SELECT payload FROM lift_rows WHERE entity = 'exercise' AND deleted_at IS NULL`);
  const out = [];
  for (const w of wanted) {
    for (const m of [...w.primary, ...w.secondary]) if (!MUSCLES.has(m)) throw new Error(`${w.name}: '${m}' is not a Lift muscle`);
    const rows = library.filter((r) => String(r.payload.name).trim().toLowerCase() === w.name.toLowerCase());
    if (rows.length !== 1) throw new Error(`${w.name}: ${rows.length} live exercises with that name, expected 1`);
    const payload = withoutStamp(rows[0].payload);
    console.log(`${w.name}: primary ${payload.primaryMuscles} → ${JSON.stringify(w.primary)}, secondary ${payload.secondaryMuscles} → ${JSON.stringify(w.secondary)}`);
    out.push(change('exercise', { ...payload, primaryMuscles: JSON.stringify(w.primary), secondaryMuscles: JSON.stringify(w.secondary) }));
  }
  return out;
}

if (checkOnly && !file && !musclesFile) {
  await check();
  await finish(0);
}
let ordered;
if (musclesFile) {
  ordered = await muscleChanges(musclesFile);
} else {
  const sessions = JSON.parse(readFileSync(file, 'utf8'));
  const changes = buildChanges(sessions);
  ordered = [...changes.exercise, ...changes.session, ...changes.sessionExercise, ...changes.set];
  console.log(`${sessions.length} sessions → ${changes.exercise.length} exercises, ${changes.session.length} sessions, ${changes.sessionExercise.length} session exercises, ${changes.set.length} sets (${ordered.length} rows) for ${dbHost}`);
  // Library names the new custom exercises would duplicate (a different id with the same name).
  const library = await q(`SELECT id::text AS id, payload->>'name' AS name FROM lift_rows WHERE entity = 'exercise' AND deleted_at IS NULL`);
  const clashes = changes.exercise.filter((c) => library.some((e) => e.id !== c.rowId.toLowerCase() && e.name?.trim().toLowerCase() === c.payload.name.toLowerCase()));
  if (clashes.length) console.log(`WARNING: ${clashes.length} new exercise names already exist in Lift with another id: ${clashes.map((c) => c.payload.name).join(', ')}`);
}
if (opt('--dump')) writeFileSync(opt('--dump'), JSON.stringify(ordered));

// Compare with what is stored: unchanged rows are skipped.
const stored = new Map();
const rowsNow = await q('SELECT entity, id::text AS id, payload FROM lift_rows WHERE id = ANY($1::uuid[])', [ordered.map((c) => c.rowId.toLowerCase())]);
for (const r of rowsNow) stored.set(`${r.entity}:${r.id}`, stable(withoutStamp(r.payload)));
const pending = ordered.filter((c) => stored.get(`${c.entity}:${c.rowId.toLowerCase()}`) !== stable(withoutStamp(c.payload)));
for (const c of pending) c.idempotencyKey = randomUUID();
const unchanged = ordered.length - pending.length;
const isNew = pending.filter((c) => !stored.has(`${c.entity}:${c.rowId.toLowerCase()}`)).length;
console.log(`plan: ${isNew} new rows, ${pending.length - isNew} changed rows, ${unchanged} unchanged (${dbHost})`);
if (dryRun) await finish(0);

let rejected = 0;
for (let i = 0; i < pending.length; i += MAX_CHANGES_PER_PUSH) {
  await q('BEGIN');
  try {
    const result = await push(repo, pending.slice(i, i + MAX_CHANGES_PER_PUSH));
    for (const r of result.rejected) console.error(`rejected ${r.idempotencyKey}: ${r.reason}`);
    rejected += result.rejected.length;
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    console.error(`chunk ${i / MAX_CHANGES_PER_PUSH + 1} rolled back: ${error instanceof Error ? error.message : error}`);
    await finish(1);
  }
}
console.log(`push: unchanged ${unchanged} (skipped), applied ${outcomes.applied}, duplicate ${outcomes.duplicate}, stale ${outcomes.stale}, rejected ${rejected}`);
if (args.includes('--check')) await check();
await finish(rejected ? 1 : 0);
