#!/usr/bin/env node
/**
 * Apple Notes Workout Hook
 *
 * Pulls notes from the macOS Notes app that look like personal workout plans.
 * Strategy:
 *   1) If a folder named "Workouts" or "Training" exists, dump every note in it.
 *   2) Otherwise, scan all notes and surface those whose title or body matches
 *      workout-shaped patterns (intervals, distances, reps, heart-rate zones).
 *
 * Output: JSON array of { folder, title, modified, body }.
 *
 * Permissions: macOS will prompt for Automation access to "Notes" the first time
 * this runs. Accept it or no notes will return.
 *
 * Usage:
 *   node scripts/apple-notes-workouts.mjs
 *   node scripts/apple-notes-workouts.mjs --folder "Training"
 *   node scripts/apple-notes-workouts.mjs --since 2026-03-01
 */

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const folderArg = args.includes('--folder') ? args[args.indexOf('--folder') + 1] : null;
const sinceArg = args.includes('--since') ? args[args.indexOf('--since') + 1] : null;
const since = sinceArg ? new Date(sinceArg) : null;

// --folder is interpolated into AppleScript source. Restrict to safe characters
// to avoid breaking out of the string literal and executing arbitrary AppleScript.
const SAFE_FOLDER_NAME = /^[A-Za-z0-9 _\-]+$/;
if (folderArg && !SAFE_FOLDER_NAME.test(folderArg)) {
  console.error(`Invalid --folder name: must match ${SAFE_FOLDER_NAME}`);
  process.exit(1);
}
const WORKOUT_FOLDER_NAMES = folderArg ? [folderArg] : ['Workouts', 'Training', 'Coach', 'Running', 'Cycling'];

// AppleScript: list folders, find the target one, and dump notes from it.
// If no target folder exists, dump all notes (filtered by content later in JS).
const script = `
on run argv
  set jsonRows to {}
  tell application "Notes"
    set targetFolderNames to {${WORKOUT_FOLDER_NAMES.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(', ')}}
    set targetFolders to {}
    repeat with f in folders
      if name of f is in targetFolderNames then
        copy f to end of targetFolders
      end if
    end repeat

    if (count of targetFolders) > 0 then
      -- Pull notes from matched folders only
      repeat with f in targetFolders
        set fName to name of f
        repeat with n in notes of f
          set nTitle to name of n
          set nMod to modification date of n
          set nBody to body of n
          set rowDelim to "<<<NOTE>>>"
          set fieldDelim to "<<<F>>>"
          set rowText to fName & fieldDelim & nTitle & fieldDelim & (nMod as «class isot» as string) & fieldDelim & nBody
          copy rowText to end of jsonRows
        end repeat
      end repeat
    else
      -- Fallback: dump all notes; we'll filter by keyword in Node.
      repeat with n in notes
        set nFolder to ""
        try
          set nFolder to name of (container of n)
        end try
        set nTitle to name of n
        set nMod to modification date of n
        set nBody to body of n
        set fieldDelim to "<<<F>>>"
        set rowText to nFolder & fieldDelim & nTitle & fieldDelim & (nMod as «class isot» as string) & fieldDelim & nBody
        copy rowText to end of jsonRows
      end repeat
    end if
  end tell

  -- Join with row delimiter
  set AppleScript's text item delimiters to "<<<ROW>>>"
  set out to jsonRows as string
  set AppleScript's text item delimiters to ""
  return out
end run
`;

let raw;
try {
  raw = execFileSync('osascript', ['-e', script], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  console.error(JSON.stringify({
    error: 'osascript_failed',
    message: e.message,
    hint: 'Grant Automation permission to Notes in System Settings → Privacy & Security → Automation. Or no Notes app installed (Linux/headless).',
  }));
  process.exit(1);
}

const rows = raw.split('<<<ROW>>>').map((r) => r.trim()).filter(Boolean);

// Workout-shape regex — strict: must look like training content, not just contain a single keyword.
// Title-level patterns that strongly signal a workout note.
const TITLE_PAT = /^(workout|lift|gym|run|ride|bike|interval|tempo|long\s+run|long\s+ride|brick|easy\s+run|recovery|warm[- ]?up|hotel\s+gym|swim)\b/i;
// Body-level: requires 2+ workout signals to count.
const BODY_SIGNALS = [
  /\b\d+\s*[xX×]\s*\d+(\s*reps?)?\b/, // "3x5", "3×8 reps", "10x1"
  /\b\d+\s*(lb|lbs|kg)\b/i, // "225lb", "135 lbs"
  /\bZ[1-5]\b/, // zone references
  /\b(tempo|interval|threshold|VO2|FTP|RPE)\b/i,
  /\bwarm[- ]?up\b/i,
  /\bcool[- ]?down\b/i,
  /@\s*\d+\s*bpm\b/i,
  /\b\d+\s*(km|miles?|mi)\s+(easy|tempo|long|run|ride)?/i,
  /\b(squat|deadlift|bench|row|press|lunge|plank|curl)\b/i,
];
function isWorkoutNote(title, body) {
  if (TITLE_PAT.test(title)) return true;
  const matches = BODY_SIGNALS.filter((p) => p.test(body)).length;
  return matches >= 2;
}

const usingFolder = rows.length > 0; // we don't strictly know but harmless heuristic
const out = [];
for (const row of rows) {
  const [folder, title, modifiedIso, ...bodyParts] = row.split('<<<F>>>');
  const body = bodyParts.join('<<<F>>>').replace(/<\/?[^>]+>/g, ''); // strip HTML
  if (!title) continue;

  // Filter by since date
  if (since && modifiedIso) {
    const mod = new Date(modifiedIso);
    if (!isNaN(mod) && mod < since) continue;
  }

  // If we had matching folders, take all. Otherwise filter by workout pattern.
  const looksLikeWorkout = WORKOUT_FOLDER_NAMES.includes(folder) || isWorkoutNote(title, body);
  if (!looksLikeWorkout) continue;

  out.push({
    folder: folder || '(none)',
    title,
    modified: modifiedIso || null,
    body: body.trim().slice(0, 4000), // cap body to keep prompts reasonable
  });
}

// Sort by modified desc
out.sort((a, b) => (b.modified || '').localeCompare(a.modified || ''));

console.log(JSON.stringify(out, null, 2));
console.error(`Found ${out.length} workout-like notes (scanned ${rows.length} rows).`);
