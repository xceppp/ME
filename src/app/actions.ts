"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { DEFAULT_CATEGORIES, DEFAULT_HABITS, DEFAULT_PREFERENCES, mergePreferences } from "@/lib/domain/defaults";
import { todayISO } from "@/lib/domain/dates";
import {
  categorySchema,
  eveningSchema,
  formatZodError,
  habitInputSchema,
  journalSchema,
  morningSchema,
  occurrenceStatusSchema,
  preferencesSchema,
  profileSchema,
  taskInputSchema,
} from "@/lib/domain/validation";
import { AppError } from "@/lib/db/sqlite";
import { requireViewer } from "@/lib/session";

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: formatZodError(error) };
  if (error instanceof AppError) return { ok: false, error: error.message };
  console.error("[peace-mode] action");
  return { ok: false, error: "Something went wrong. Please try again." };
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function signOut() {
  const viewer = await requireViewer();
  const { cookies } = await import("next/headers");
  const { dataMode } = await import("@/lib/config");
  if (dataMode() === "supabase") {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
  } else {
    const { openStore } = await import("@/lib/db/sqlite");
    openStore().deleteSession(viewer.sessionId);
    const jar = await cookies();
    jar.delete("pm_session");
  }
  redirect("/login");
}

export async function setOccurrenceStatus(occurrenceId: string, status: string, note?: string) {
  try {
    const viewer = await requireViewer();
    const parsed = occurrenceStatusSchema.parse(status);
    const today = todayISO(viewer.profile.timezone);
    await viewer.store.setOccurrenceStatus(viewer.user.id, occurrenceId, parsed, today, { note: note ?? null });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function saveHabit(input: unknown, habitId?: string) {
  try {
    const viewer = await requireViewer();
    const parsed = habitInputSchema.parse(input);
    const today = todayISO(viewer.profile.timezone);
    if (habitId) {
      await viewer.store.updateHabit(viewer.user.id, habitId, {
        title: parsed.title,
        description: parsed.description ?? null,
        categoryId: parsed.categoryId ?? null,
        recurrenceType: parsed.recurrenceType,
        recurrenceConfig: parsed.recurrenceConfig,
        startDate: parsed.startDate,
        endDate: parsed.endDate ?? null,
        targetQuantity: parsed.targetQuantity ?? null,
        targetUnit: parsed.targetUnit ?? null,
        reminderEnabled: Boolean(parsed.reminderEnabled),
        reminderTime: parsed.reminderTime ?? null,
      }, today);
    } else {
      await viewer.store.createHabit(viewer.user.id, {
        title: parsed.title,
        description: parsed.description ?? null,
        categoryId: parsed.categoryId ?? null,
        recurrenceType: parsed.recurrenceType,
        recurrenceConfig: parsed.recurrenceConfig,
        startDate: parsed.startDate,
        endDate: parsed.endDate ?? null,
        targetQuantity: parsed.targetQuantity ?? null,
        targetUnit: parsed.targetUnit ?? null,
        reminderEnabled: Boolean(parsed.reminderEnabled),
        reminderTime: parsed.reminderTime ?? null,
      });
    }
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveHabit(habitId: string) {
  try {
    const viewer = await requireViewer();
    await viewer.store.archiveHabit(viewer.user.id, habitId, todayISO(viewer.profile.timezone));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function restoreHabit(habitId: string) {
  try {
    const viewer = await requireViewer();
    await viewer.store.restoreHabit(viewer.user.id, habitId, todayISO(viewer.profile.timezone));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteHabit(habitId: string) {
  try {
    const viewer = await requireViewer();
    await viewer.store.deleteHabit(viewer.user.id, habitId);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function reorderHabits(ids: string[]) {
  try {
    const viewer = await requireViewer();
    await viewer.store.reorderHabits(viewer.user.id, z.array(z.string().uuid()).parse(ids));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function saveTask(input: unknown, taskId?: string) {
  try {
    const viewer = await requireViewer();
    const parsed = taskInputSchema.parse(input);
    if (taskId) await viewer.store.updateTask(viewer.user.id, taskId, {
      title: parsed.title,
      description: parsed.description ?? null,
      categoryId: parsed.categoryId ?? null,
      priority: parsed.priority,
      scheduledDate: parsed.scheduledDate,
      targetTime: parsed.targetTime ?? null,
    });
    else await viewer.store.createTask(viewer.user.id, {
      title: parsed.title,
      description: parsed.description ?? null,
      categoryId: parsed.categoryId ?? null,
      priority: parsed.priority,
      scheduledDate: parsed.scheduledDate,
      targetTime: parsed.targetTime ?? null,
    });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function setTaskStatus(taskId: string, status: "pending" | "completed") {
  try {
    const viewer = await requireViewer();
    await viewer.store.setTaskStatus(viewer.user.id, taskId, status, todayISO(viewer.profile.timezone));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTask(taskId: string) {
  try {
    const viewer = await requireViewer();
    await viewer.store.deleteTask(viewer.user.id, taskId);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function setPriorityStatus(priorityId: string, status: "pending" | "completed") {
  try {
    const viewer = await requireViewer();
    await viewer.store.setPriorityStatus(viewer.user.id, priorityId, status, todayISO(viewer.profile.timezone));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function saveMorning(input: unknown) {
  try {
    const viewer = await requireViewer();
    const parsed = morningSchema.parse(input);
    const today = todayISO(viewer.profile.timezone);
    if (parsed.localDate > today) return { ok: false as const, error: "You can plan today, not a future date." };
    await viewer.store.saveMorning(viewer.user.id, {
      localDate: parsed.localDate,
      intention: parsed.intention ?? null,
      customIntention: parsed.customIntention ?? null,
      personalCommitment: parsed.personalCommitment ?? null,
      priorities: parsed.priorities.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description ?? null,
        categoryId: item.categoryId ?? null,
        targetTime: item.targetTime ?? null,
      })),
    });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function saveEvening(input: unknown) {
  try {
    const viewer = await requireViewer();
    const parsed = eveningSchema.parse(input);
    const today = todayISO(viewer.profile.timezone);
    if (parsed.localDate > today) return { ok: false as const, error: "Future reflections stay closed until that day arrives." };
    await viewer.store.saveEvening(viewer.user.id, {
      localDate: parsed.localDate,
      peaceRating: parsed.peaceRating,
      confidenceRating: parsed.confidenceRating,
      whatWentWell: parsed.whatWentWell ?? null,
      energyDrainers: parsed.energyDrainers ?? null,
      tomorrowAdjustment: parsed.tomorrowAdjustment ?? null,
    });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function saveJournal(input: unknown, entryId?: string) {
  try {
    const viewer = await requireViewer();
    const parsed = journalSchema.parse(input);
    const saved = await viewer.store.saveJournal(viewer.user.id, {
      id: entryId,
      localDate: parsed.localDate,
      title: parsed.title,
      body: parsed.body,
      categoryId: parsed.categoryId ?? null,
      moodTag: parsed.moodTag ?? null,
    });
    refresh();
    return { ok: true as const, id: saved.id };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteJournal(entryId: string) {
  try {
    const viewer = await requireViewer();
    await viewer.store.deleteJournal(viewer.user.id, entryId);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function saveCategory(input: unknown, categoryId?: string) {
  try {
    const viewer = await requireViewer();
    const parsed = categorySchema.parse(input);
    if (categoryId) await viewer.store.updateCategory(viewer.user.id, categoryId, parsed);
    else await viewer.store.createCategory(viewer.user.id, parsed);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveCategory(categoryId: string, archived: boolean) {
  try {
    const viewer = await requireViewer();
    await viewer.store.updateCategory(viewer.user.id, categoryId, { isArchived: archived });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function savePreferences(input: unknown) {
  try {
    const viewer = await requireViewer();
    const parsed = preferencesSchema.parse(input);
    const preferences = mergePreferences({ ...viewer.profile.preferences, ...parsed, onboardingComplete: true });
    await viewer.store.updateProfile(viewer.user.id, { preferences });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function saveProfile(input: unknown) {
  try {
    const viewer = await requireViewer();
    const parsed = profileSchema.parse(input);
    await viewer.store.updateProfile(viewer.user.id, { displayName: parsed.displayName, timezone: parsed.timezone });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function changePassword(currentPassword: string, nextPassword: string) {
  try {
    const viewer = await requireViewer();
    const { dataMode } = await import("@/lib/config");
    if (nextPassword.length < 8) return { ok: false as const, error: "Use at least 8 characters." };
    if (dataMode() === "supabase") {
      await viewer.store.updatePassword(viewer.user.id, nextPassword);
    } else {
      const { openStore } = await import("@/lib/db/sqlite");
      const store = openStore();
      const user = store.findUserById(viewer.user.id);
      if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
        return { ok: false as const, error: "The current password doesn't match." };
      }
      store.updatePassword(viewer.user.id, nextPassword);
    }
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function saveReminder(input: { reminderType: "morning_planning" | "evening_reflection"; isEnabled: boolean; reminderTime: string }) {
  try {
    const viewer = await requireViewer();
    await viewer.store.upsertReminder(viewer.user.id, {
      reminderType: input.reminderType,
      isEnabled: input.isEnabled,
      reminderTime: input.reminderTime,
    });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function completeOnboarding(input: { displayName: string; timezone: string; habitKeys: string[] }) {
  try {
    const viewer = await requireViewer();
    const profile = profileSchema.parse({ displayName: input.displayName, timezone: input.timezone });
    const keys = new Set(input.habitKeys);
    const existing = await viewer.store.listCategories(viewer.user.id, true);
    if (existing.length === 0) {
      const categoryIds = new Map<string, string>();
      for (const category of DEFAULT_CATEGORIES) {
        const created = await viewer.store.createCategory(viewer.user.id, category);
        categoryIds.set(category.key, created.id);
      }
      const today = todayISO(profile.timezone);
      for (const habit of DEFAULT_HABITS) {
        if (!keys.has(habit.key)) continue;
        await viewer.store.createHabit(viewer.user.id, {
          title: habit.title,
          description: habit.description ?? null,
          categoryId: categoryIds.get(habit.categoryKey) ?? null,
          recurrenceType: "daily",
          recurrenceConfig: {},
          targetQuantity: null,
          targetUnit: null,
          startDate: today,
          endDate: null,
          reminderEnabled: false,
          reminderTime: null,
        });
      }
    }
    await viewer.store.updateProfile(viewer.user.id, {
      displayName: profile.displayName,
      timezone: profile.timezone,
      preferences: mergePreferences({
        ...DEFAULT_PREFERENCES,
        ...viewer.profile.preferences,
        onboardingComplete: true,
        streakThreshold: 70,
        dashboardMission: DEFAULT_PREFERENCES.dashboardMission,
      }),
    });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
