import { z } from "zod";
import { isValidTimeZone } from "./dates";
import { isRecurrenceType } from "./recurrence";

export const emailSchema = z.string().trim().email().max(180);
export const passwordSchema = z.string().min(8).max(128);
export const idSchema = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const ratingSchema = z.number().int().min(1).max(10);

export const recurrenceSchema = z.object({
  recurrenceType: z.string().refine(isRecurrenceType, "Unsupported recurrence"),
  recurrenceConfig: z.object({
    days: z.array(z.number().int().min(1).max(7)).max(7).optional(),
    targetCount: z.number().int().min(1).max(7).optional(),
    date: dateSchema.optional(),
  }),
  startDate: dateSchema,
  endDate: dateSchema.nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({ code: "custom", message: "End date must be on or after the start date." });
  }
  if (value.recurrenceType === "weekdays" && !(value.recurrenceConfig.days && value.recurrenceConfig.days.length)) {
    ctx.addIssue({ code: "custom", message: "Choose at least one weekday." });
  }
  if (value.recurrenceType === "once" && !value.recurrenceConfig.date) {
    ctx.addIssue({ code: "custom", message: "Choose the date for this one-time goal." });
  }
});

export const habitInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().nullable(),
  categoryId: idSchema.nullable().optional(),
  targetQuantity: z.number().positive().max(100000).nullable().optional(),
  targetUnit: z.string().trim().max(40).nullable().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTime: timeSchema.nullable().optional(),
}).and(recurrenceSchema);

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().nullable(),
  categoryId: idSchema.nullable().optional(),
  priority: z.enum(["low", "medium", "high"]),
  scheduledDate: dateSchema,
  targetTime: timeSchema.nullable().optional(),
});

export const priorityInputSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().nullable(),
  categoryId: idSchema.nullable().optional(),
  targetTime: timeSchema.nullable().optional(),
});

export const morningSchema = z.object({
  localDate: dateSchema,
  intention: z.string().trim().max(80).optional().nullable(),
  customIntention: z.string().trim().max(160).optional().nullable(),
  personalCommitment: z.string().trim().max(500).optional().nullable(),
  priorities: z.array(priorityInputSchema).max(3),
});

export const eveningSchema = z.object({
  localDate: dateSchema,
  peaceRating: ratingSchema,
  confidenceRating: ratingSchema,
  whatWentWell: z.string().trim().max(2000).optional().nullable(),
  energyDrainers: z.string().trim().max(2000).optional().nullable(),
  tomorrowAdjustment: z.string().trim().max(2000).optional().nullable(),
});

export const journalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  localDate: dateSchema,
  categoryId: idSchema.nullable().optional(),
  moodTag: z.string().trim().max(40).optional().nullable(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  icon: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid timezone."),
});

export const preferencesSchema = z.object({
  theme: z.enum(["dark", "light", "system"]),
  reducedMotion: z.boolean(),
  streakThreshold: z.number().int().min(1).max(100),
  startOfWeek: z.number().int().min(1).max(7),
  motivationalEnabled: z.boolean(),
  dashboardMission: z.string().trim().min(1).max(240),
  quietHoursStart: timeSchema,
  quietHoursEnd: timeSchema,
});

export const occurrenceStatusSchema = z.enum(["pending", "completed", "skipped", "not_applicable"]);

export function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}
