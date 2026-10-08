#!/usr/bin/env node
/**
 * Quality-rotation state — which above-threshold session comes next.
 *
 * The variety mandate alternates bike VO2 ↔ run intervals week to week. This
 * derives the last quality session actually *planned* (from prior plans/*.json)
 * so the next one is deterministic rather than eyeballed. Eyeballing is how the
 * weeks of 2026-07-06 and 2026-07-13 both ended up as ride-vo2.
 *
 * Lives in its own module (rather than inline in coach-profile.mjs) so it is
 * testable — coach-profile.mjs runs DB queries at import time and can't be
 * imported by a test. Also mirrors the travel.mjs precedent: non-trivial derived
 * state belongs outside the aggregator.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const QUALITY_TYPES = ['ride-vo2', 'run-intervals', 'run-tempo', 'ride-sst'];
const DEFAULT = { lastQuality: null, lastQualityWeek: null, nextQuality: 'ride-vo2' };

/**
 * @param plansDir  directory holding YYYY-MM-DD.json plan files
 * @param targetKey the Monday being planned ('YYYY-MM-DD'); plans on/after this
 *                  are ignored so re-running /plan for a week doesn't read its
 *                  own output and flip the rotation.
 */
export function rotationState(plansDir, targetKey) {
  try {
    const priorPlans = readdirSync(plansDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.slice(0, 10))
      .filter((k) => k < targetKey)
      .sort()
      .reverse();

    for (const key of priorPlans) {
      let plan;
      try {
        plan = JSON.parse(readFileSync(resolve(plansDir, `${key}.json`), 'utf8'));
      } catch {
        continue; // malformed plan — skip, don't abort the whole derivation
      }
      const q = (plan.events ?? [])
        .filter((e) => QUALITY_TYPES.includes(e.workoutType))
        .sort((a, b) => String(a.start).localeCompare(String(b.start)))
        .at(-1);
      if (q) {
        return {
          lastQuality: q.workoutType,
          lastQualityWeek: key,
          nextQuality: q.workoutType.startsWith('ride') ? 'run-intervals' : 'ride-vo2',
        };
      }
    }
  } catch (e) {
    console.error('rotation state fail (defaulting to ride-vo2):', e.message);
  }
  return { ...DEFAULT };
}
