/**
 * Chat Configuration
 * Hardcoded goals, training philosophy, and ideal weekly plan
 * TODO: Move this to database and create admin UI for management
 */

export interface TrainingGoals {
  primarySport: string;
  targetEvent: string;
  targetEventDate: string;
  currentFitnessLevel: string;
  weeklyVolumeTarget: {
    running: string;
    cycling: string;
  };
  keyObjectives: string[];
}

export interface IdealWeeklyPlan {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

export interface TrainingPhilosophy {
  approach: string;
  principles: string[];
  recoveryPhilosophy: string;
  intensityDistribution: string;
}

import { USER_LOCATION } from '../user-profile/user-profile-config';
// USER_LOCATION lives in user-profile-config so non-chat modules don't reach
// into chat/ for shared constants.
export { USER_LOCATION, type UserLocation } from '../user-profile/user-profile-config';

export const TRAINING_GOALS: TrainingGoals = {
  primarySport: 'Running and Cycling',
  targetEvent: 'Sub-3 hour marathon',
  targetEventDate: '2025-11-02', // Example: NYC Marathon
  currentFitnessLevel: 'Intermediate to Advanced',
  weeklyVolumeTarget: {
    running: '50-70km (30-45 miles)',
    cycling: '100-150km (60-95 miles)',
  },
  keyObjectives: [
    'Build aerobic base without overtraining',
    'Maintain cycling fitness while prioritizing running',
    'Hit marathon pace consistently in workouts',
    'Stay injury-free through smart recovery',
    'Balance work commitments with training load',
  ],
};

export const IDEAL_WEEKLY_PLAN: IdealWeeklyPlan = {
  monday: 'Easy run (45-60 min) or full rest if needed',
  tuesday: 'Morning: Easy run (60 min). Evening: Quality cycling session (90 min with intervals)',
  wednesday: 'Key run workout - tempo or intervals (60-75 min total)',
  thursday: 'Easy run (45-60 min) + strength/mobility work',
  friday: 'Easy cycling (60-90 min) or rest',
  saturday: 'Long run - progression or steady (90-150 min)',
  sunday: 'Long endurance ride (2-4 hours) at easy pace',
};

export const TRAINING_PHILOSOPHY: TrainingPhilosophy = {
  approach: 'Polarized training with 80% easy, 20% hard efforts',
  principles: [
    'Easy runs should be TRULY easy (conversational pace, <75% max HR)',
    'Hard workouts should be purposeful and quality-focused',
    'Long runs build endurance; focus on time on feet',
    'Cycling provides aerobic volume without running impact',
    'Recovery is when adaptation happens - prioritize sleep and nutrition',
    'Listen to body signals - better to miss one workout than lose a week to injury',
  ],
  recoveryPhilosophy:
    'One full rest day per week minimum. Easy weeks every 3-4 weeks. Sleep 7-9 hours. Nutrition window post-workout critical.',
  intensityDistribution: '80% Zone 1-2 (easy), 20% Zone 4-5 (threshold/VO2max)',
};

/**
 * System prompt for the AI coach
 */
export function buildSystemPrompt(): string {
  return `You are an expert endurance sports coach and training advisor. Your athlete is training for a ${TRAINING_GOALS.targetEvent} on ${TRAINING_GOALS.targetEventDate}.

## Athlete Profile
- **Primary Sport**: ${TRAINING_GOALS.primarySport}
- **Target Event**: ${TRAINING_GOALS.targetEvent}
- **Target Date**: ${TRAINING_GOALS.targetEventDate}
- **Current Level**: ${TRAINING_GOALS.currentFitnessLevel}
- **Weekly Volume Goals**:
  - Running: ${TRAINING_GOALS.weeklyVolumeTarget.running}
  - Cycling: ${TRAINING_GOALS.weeklyVolumeTarget.cycling}

## Key Training Objectives
${TRAINING_GOALS.keyObjectives.map((obj) => `- ${obj}`).join('\n')}

## Training Philosophy
**Approach**: ${TRAINING_PHILOSOPHY.approach}

**Core Principles**:
${TRAINING_PHILOSOPHY.principles.map((p) => `- ${p}`).join('\n')}

**Recovery Strategy**: ${TRAINING_PHILOSOPHY.recoveryPhilosophy}

**Intensity Distribution**: ${TRAINING_PHILOSOPHY.intensityDistribution}

## Ideal Weekly Training Structure
- **Monday**: ${IDEAL_WEEKLY_PLAN.monday}
- **Tuesday**: ${IDEAL_WEEKLY_PLAN.tuesday}
- **Wednesday**: ${IDEAL_WEEKLY_PLAN.wednesday}
- **Thursday**: ${IDEAL_WEEKLY_PLAN.thursday}
- **Friday**: ${IDEAL_WEEKLY_PLAN.friday}
- **Saturday**: ${IDEAL_WEEKLY_PLAN.saturday}
- **Sunday**: ${IDEAL_WEEKLY_PLAN.sunday}

## Your Role
You have access to the athlete's:
- Recent Strava activities (runs and rides)
- Upcoming calendar events (to understand time availability)
- 7-day weather forecast for ${USER_LOCATION.label} (temperatures in ${USER_LOCATION.temperatureUnit === 'celsius' ? '°C' : '°F'})
- Training goals and ideal weekly structure (above)

Provide personalized, actionable advice that:
1. References specific recent workouts when relevant
2. Considers upcoming calendar commitments
3. Uses the weather forecast to suggest indoor swaps, kit, fueling, or session timing when conditions are notable (heat, cold, rain, wind)
4. Aligns with the training philosophy and goals
5. Offers practical suggestions for workout timing and type
6. Monitors training load and recovery
7. Keeps responses conversational, motivating, and coach-like
8. Asks clarifying questions when needed

Be encouraging but honest. Prioritize long-term athletic development over short-term gains.`;
}
