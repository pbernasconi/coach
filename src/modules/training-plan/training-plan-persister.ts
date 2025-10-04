/**
 * Training Plan Persister
 * Database operations for training plans
 */

import { db } from '@/db';
import {
  trainingPlans,
  trainingPlanActivities,
  userGoals,
  type TrainingPlan,
  type NewTrainingPlan,
  type TrainingPlanActivity,
  type NewTrainingPlanActivity,
  type UserGoals,
  type NewUserGoals,
} from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

/**
 * Training Plans
 */
export namespace TrainingPlanPersister {
  export async function create(data: NewTrainingPlan): Promise<TrainingPlan> {
    const [plan] = await db.insert(trainingPlans).values(data).returning();
    return plan;
  }

  export async function findById(id: string): Promise<TrainingPlan | null> {
    const [plan] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, id))
      .limit(1);
    return plan || null;
  }

  export async function findByUserId(userId: string): Promise<TrainingPlan[]> {
    return db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.userId, userId))
      .orderBy(desc(trainingPlans.weekStartDate));
  }

  export async function findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TrainingPlan[]> {
    return db
      .select()
      .from(trainingPlans)
      .where(
        and(
          eq(trainingPlans.userId, userId),
          gte(trainingPlans.weekStartDate, startDate),
          lte(trainingPlans.weekEndDate, endDate)
        )
      )
      .orderBy(desc(trainingPlans.weekStartDate));
  }

  export async function update(
    id: string,
    data: Partial<Omit<TrainingPlan, 'id' | 'createdAt'>>
  ): Promise<TrainingPlan> {
    const [updated] = await db
      .update(trainingPlans)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(trainingPlans.id, id))
      .returning();
    return updated;
  }

  export async function deleteById(id: string): Promise<void> {
    await db.delete(trainingPlans).where(eq(trainingPlans.id, id));
  }
}

/**
 * Training Plan Activities
 */
export namespace TrainingPlanActivityPersister {
  export async function create(data: NewTrainingPlanActivity): Promise<TrainingPlanActivity> {
    const [activity] = await db.insert(trainingPlanActivities).values(data).returning();
    return activity;
  }

  export async function createMany(
    data: NewTrainingPlanActivity[]
  ): Promise<TrainingPlanActivity[]> {
    if (data.length === 0) return [];
    return db.insert(trainingPlanActivities).values(data).returning();
  }

  export async function findById(id: string): Promise<TrainingPlanActivity | null> {
    const [activity] = await db
      .select()
      .from(trainingPlanActivities)
      .where(eq(trainingPlanActivities.id, id))
      .limit(1);
    return activity || null;
  }

  export async function findByPlanId(planId: string): Promise<TrainingPlanActivity[]> {
    return db
      .select()
      .from(trainingPlanActivities)
      .where(eq(trainingPlanActivities.planId, planId))
      .orderBy(trainingPlanActivities.scheduledDate);
  }

  export async function findByDateRange(
    planId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TrainingPlanActivity[]> {
    return db
      .select()
      .from(trainingPlanActivities)
      .where(
        and(
          eq(trainingPlanActivities.planId, planId),
          gte(trainingPlanActivities.scheduledDate, startDate),
          lte(trainingPlanActivities.scheduledDate, endDate)
        )
      )
      .orderBy(trainingPlanActivities.scheduledDate);
  }

  export async function update(
    id: string,
    data: Partial<Omit<TrainingPlanActivity, 'id' | 'createdAt'>>
  ): Promise<TrainingPlanActivity> {
    const [updated] = await db
      .update(trainingPlanActivities)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(trainingPlanActivities.id, id))
      .returning();
    return updated;
  }

  export async function markCompleted(
    id: string,
    stravaActivityId?: string
  ): Promise<TrainingPlanActivity> {
    return update(id, {
      isCompleted: true,
      completedAt: new Date(),
      stravaActivityId: stravaActivityId || null,
    });
  }

  export async function deleteById(id: string): Promise<void> {
    await db.delete(trainingPlanActivities).where(eq(trainingPlanActivities.id, id));
  }
}

/**
 * User Goals
 */
export namespace UserGoalsPersister {
  export async function create(data: NewUserGoals): Promise<UserGoals> {
    const [goals] = await db.insert(userGoals).values(data).returning();
    return goals;
  }

  export async function findByUserId(userId: string): Promise<UserGoals | null> {
    const [goals] = await db
      .select()
      .from(userGoals)
      .where(eq(userGoals.userId, userId))
      .limit(1);
    return goals || null;
  }

  export async function upsert(data: NewUserGoals): Promise<UserGoals> {
    const existing = await findByUserId(data.userId);

    if (existing) {
      return update(existing.id, data);
    }

    return create(data);
  }

  export async function update(
    id: string,
    data: Partial<Omit<UserGoals, 'id' | 'createdAt'>>
  ): Promise<UserGoals> {
    const [updated] = await db
      .update(userGoals)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userGoals.id, id))
      .returning();
    return updated;
  }

  export async function deleteById(id: string): Promise<void> {
    await db.delete(userGoals).where(eq(userGoals.id, id));
  }
}
