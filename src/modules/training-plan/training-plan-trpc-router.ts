/**
 * Training Plan tRPC Router
 * Type-safe API endpoints for training plan generation and management
 */

import { z } from 'zod';
import { router, publicProcedure } from '@/server/trpc';
import TrainingPlanService from './training-plan-service';

const trainingPlanService = new TrainingPlanService();

export const trainingPlanRouter = router({
  /**
   * Generate a new weekly training plan
   */
  generatePlan: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        weekStartDate: z.date(),
        calendarConnectionId: z.string().optional(),
        stravaActivities: z.array(z.any()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await trainingPlanService.generateWeeklyPlan(input);
      return result;
    }),

  /**
   * Get all training plans for a user
   */
  getUserPlans: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const plans = await trainingPlanService.getUserPlans(input.userId);
      return { plans };
    }),

  /**
   * Get specific plan with activities
   */
  getPlanDetails: publicProcedure
    .input(
      z.object({
        planId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const result = await trainingPlanService.getPlanWithActivities(input.planId);
      return result;
    }),

  /**
   * Update user goals
   */
  updateGoals: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        primarySport: z.string().optional(),
        goalType: z.string().optional(),
        targetEvent: z.string().optional(),
        targetEventDate: z.date().optional(),
        daysPerWeek: z.number().optional(),
        hoursPerWeek: z.number().optional(),
        preferredDays: z.array(z.string()).optional(),
        fitnessLevel: z.string().optional(),
        currentWeeklyVolume: z.any().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { userId, ...goals } = input;
      const updated = await trainingPlanService.updateUserGoals(userId, goals);
      return { goals: updated };
    }),

  /**
   * Mark activity as completed
   */
  completeActivity: publicProcedure
    .input(
      z.object({
        activityId: z.string().min(1),
        stravaActivityId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const activity = await trainingPlanService.completeActivity(
        input.activityId,
        input.stravaActivityId
      );
      return { activity };
    }),

  /**
   * Archive a training plan
   */
  archivePlan: publicProcedure
    .input(
      z.object({
        planId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const plan = await trainingPlanService.archivePlan(input.planId);
      return { plan };
    }),
});
