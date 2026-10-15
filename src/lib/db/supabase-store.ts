import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { addDays, eachDate } from "../domain/dates";
import { mergePreferences, type Preferences } from "../domain/defaults";
import type { OccurrenceStatus } from "../domain/metrics";
import { isScheduledOn, normalizeSchedule, versionCovers, type RecurrenceType, type ScheduleConfig } from "../domain/recurrence";
import { AppError, type CategoryRecord, type CheckinRecord, type HabitRecord, type JournalRecord, type OccurrenceRecord, type PriorityRecord, type ProfileRecord, type ReminderRecord, type TaskRecord, type UserRecord } from "./sqlite";
import type { DataStore, PriorityDraft } from "./data-store";
import type { Viewer } from "../session";
import { createSupabaseServer } from "../supabase/server";

type Db = SupabaseClient;

function logDb(error: { message?: string; code?: string }) {
  console.error("[peace-mode] database", error.code ?? "error");
}

function raise(error: { message?: string; code?: string } | null, fallback = "We couldn't save that just now."): void {
  if (!error) return;
  logDb(error);
  const message = error.message ?? "";
  if (message.includes("category_owner_mismatch") || message.includes("habit_owner_mismatch")) {
    throw new AppError("That category doesn't belong to this account.", "forbidden", 403);
  }
  if (error.code === "23505" || message.toLowerCase().includes("duplicate")) {
    throw new AppError("That record already exists.", "conflict", 409);
  }
  if (error.code === "23514") throw new AppError("Please check the values and try again.", "validation");
  throw new AppError(fallback, "db", 500);
}

function id(): string {
  return crypto.randomUUID();
}

export class SupabaseStore implements DataStore {
  constructor(private readonly db: Db, private readonly userId: string | null) {}

  static async connect(): Promise<SupabaseStore> {
    return new SupabaseStore(await createSupabaseServer(), null);
  }

  async currentSession(): Promise<Viewer | null> {
    const { data, error } = await this.db.auth.getUser();
    if (error || !data.user) return null;
    const user = data.user;
    let profile = await this.getProfile(user.id);
    if (!profile) {
      const { error: insertError } = await this.db.from("profiles").insert({
        id: user.id,
        display_name: "",
        timezone: "Africa/Casablanca",
        preferences: mergePreferences({}),
      });
      raise(insertError, "We couldn't prepare your profile.");
      profile = await this.getProfile(user.id);
    }
    if (!profile) return null;
    const record: UserRecord = {
      id: user.id,
      email: user.email ?? "",
      passwordHash: "",
      emailVerifiedAt: user.email_confirmed_at ?? null,
      createdAt: user.created_at,
    };
    return { user: record, profile, store: new SupabaseStore(this.db, user.id), sessionId: user.id };
  }

  private owner(userId: string): void {
    if (this.userId && this.userId !== userId) throw new AppError("You don't have access to that.", "forbidden", 403);
  }

  async getProfile(userId: string): Promise<ProfileRecord | null> {
    const { data, error } = await this.db.from("profiles").select("*").eq("id", userId).maybeSingle();
    raise(error, "We couldn't load your profile.");
    return data ? mapProfile(data) : null;
  }

  async updateProfile(userId: string, input: { displayName?: string; timezone?: string; preferences?: Preferences }): Promise<ProfileRecord> {
    this.owner(userId);
    const current = await this.getProfile(userId);
    if (!current) throw new AppError("Profile not found.", "not_found", 404);
    const next = {
      display_name: input.displayName?.trim() || current.displayName,
      timezone: input.timezone || current.timezone,
      preferences: input.preferences ?? current.preferences,
    };
    const { error } = await this.db.from("profiles").update(next).eq("id", userId);
    raise(error);
    return (await this.getProfile(userId))!;
  }

  async updatePassword(userId: string, password: string): Promise<void> {
    this.owner(userId);
    const { error } = await this.db.auth.updateUser({ password });
    if (error) throw new AppError("We couldn't change the password.", "auth", 400);
  }

  async listCategories(userId: string, includeArchived = false): Promise<CategoryRecord[]> {
    this.owner(userId);
    let query = this.db.from("categories").select("*").eq("user_id", userId).order("sort_order");
    if (!includeArchived) query = query.eq("is_archived", false);
    const { data, error } = await query;
    raise(error);
    return (data ?? []).map(mapCategory);
  }

  async createCategory(userId: string, input: { name: string; description?: string | null; icon: string; color: string; sortOrder?: number }): Promise<CategoryRecord> {
    this.owner(userId);
    const row = {
      id: id(),
      user_id: userId,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon,
      color: input.color,
      sort_order: input.sortOrder ?? (await this.listCategories(userId, true)).length + 1,
      is_archived: false,
    };
    const { error } = await this.db.from("categories").insert(row);
    raise(error);
    return (await this.listCategories(userId, true)).find((item) => item.id === row.id)!;
  }

  async updateCategory(userId: string, categoryId: string, input: Partial<{ name: string; description: string | null; icon: string; color: string; isArchived: boolean; sortOrder: number }>): Promise<CategoryRecord> {
    this.owner(userId);
    const current = (await this.listCategories(userId, true)).find((item) => item.id === categoryId);
    if (!current) throw new AppError("Category not found.", "not_found", 404);
    const { error } = await this.db.from("categories").update({
      name: input.name ?? current.name,
      description: input.description === undefined ? current.description : input.description,
      icon: input.icon ?? current.icon,
      color: input.color ?? current.color,
      is_archived: input.isArchived ?? current.isArchived,
      sort_order: input.sortOrder ?? current.sortOrder,
    }).eq("id", categoryId).eq("user_id", userId);
    raise(error);
    return (await this.listCategories(userId, true)).find((item) => item.id === categoryId)!;
  }

  async listHabits(userId: string, includeArchived = false): Promise<HabitRecord[]> {
    this.owner(userId);
    let query = this.db.from("habits").select("*").eq("user_id", userId).order("sort_order");
    if (!includeArchived) query = query.eq("is_archived", false);
    const { data, error } = await query;
    raise(error);
    return (data ?? []).map(mapHabit);
  }

  async getHabit(userId: string, habitId: string): Promise<HabitRecord | null> {
    this.owner(userId);
    const { data, error } = await this.db.from("habits").select("*").eq("user_id", userId).eq("id", habitId).maybeSingle();
    raise(error);
    return data ? mapHabit(data) : null;
  }

  async createHabit(userId: string, input: Omit<HabitRecord, "id" | "userId" | "isActive" | "isArchived" | "sortOrder"> & { sortOrder?: number }): Promise<HabitRecord> {
    this.owner(userId);
    await this.assertCategory(userId, input.categoryId);
    const habitId = id();
    const config = normalizeSchedule(input.recurrenceType, input.recurrenceConfig);
    const { error } = await this.db.from("habits").insert({
      id: habitId,
      user_id: userId,
      category_id: input.categoryId,
      title: input.title,
      description: input.description,
      recurrence_type: input.recurrenceType,
      recurrence_config: config,
      target_quantity: input.targetQuantity,
      target_unit: input.targetUnit,
      start_date: input.startDate,
      end_date: input.endDate,
      is_active: true,
      is_archived: false,
      sort_order: input.sortOrder ?? (await this.listHabits(userId, true)).length + 1,
      reminder_enabled: input.reminderEnabled,
      reminder_time: input.reminderTime,
    });
    raise(error);
    await this.insertVersion(userId, habitId, input.startDate, null, snapshot(input, config));
    return (await this.getHabit(userId, habitId))!;
  }

  async updateHabit(userId: string, habitId: string, input: Partial<HabitRecord>, today: string): Promise<HabitRecord> {
    this.owner(userId);
    const current = await this.getHabit(userId, habitId);
    if (!current) throw new AppError("Habit not found.", "not_found", 404);
    if (input.categoryId) await this.assertCategory(userId, input.categoryId);
    const next: HabitRecord = {
      ...current,
      ...input,
      id: current.id,
      userId,
      recurrenceConfig: normalizeSchedule(input.recurrenceType ?? current.recurrenceType, input.recurrenceConfig ?? current.recurrenceConfig),
    };
    const scheduleChanged = JSON.stringify([current.recurrenceType, current.recurrenceConfig, current.startDate, current.endDate])
      !== JSON.stringify([next.recurrenceType, next.recurrenceConfig, next.startDate, next.endDate]);
    const { error } = await this.db.from("habits").update({
      category_id: next.categoryId,
      title: next.title,
      description: next.description,
      recurrence_type: next.recurrenceType,
      recurrence_config: next.recurrenceConfig,
      target_quantity: next.targetQuantity,
      target_unit: next.targetUnit,
      start_date: next.startDate,
      end_date: next.endDate,
      reminder_enabled: next.reminderEnabled,
      reminder_time: next.reminderTime,
    }).eq("id", habitId).eq("user_id", userId);
    raise(error);
    if (scheduleChanged) await this.splitVersion(userId, next, today);
    else await this.rewriteOpenVersion(userId, next);
    return (await this.getHabit(userId, habitId))!;
  }

  async archiveHabit(userId: string, habitId: string, today: string): Promise<void> {
    this.owner(userId);
    if (!(await this.getHabit(userId, habitId))) throw new AppError("Habit not found.", "not_found", 404);
    const { error } = await this.db.from("habits").update({ is_archived: true, is_active: false }).eq("id", habitId).eq("user_id", userId);
    raise(error);
    const open = await this.openVersion(habitId);
    if (!open) return;
    if (open.effective_from < today) {
      const { error: versionError } = await this.db.from("habit_schedule_versions").update({ effective_until: addDays(today, -1) }).eq("id", open.id);
      raise(versionError);
    } else {
      const { error: versionError } = await this.db.from("habit_schedule_versions").delete().eq("id", open.id);
      raise(versionError);
    }
  }

  async restoreHabit(userId: string, habitId: string, today: string): Promise<void> {
    this.owner(userId);
    const habit = await this.getHabit(userId, habitId);
    if (!habit) throw new AppError("Habit not found.", "not_found", 404);
    const { error } = await this.db.from("habits").update({ is_archived: false, is_active: true }).eq("id", habitId).eq("user_id", userId);
    raise(error);
    const restored = (await this.getHabit(userId, habitId))!;
    await this.insertVersion(userId, habitId, today, null, snapshot(restored, restored.recurrenceConfig));
  }

  async deleteHabit(userId: string, habitId: string): Promise<void> {
    this.owner(userId);
    const { error, count } = await this.db.from("habits").delete({ count: "exact" }).eq("id", habitId).eq("user_id", userId);
    raise(error);
    if (!count) throw new AppError("Habit not found.", "not_found", 404);
  }

  async reorderHabits(userId: string, orderedIds: string[]): Promise<void> {
    this.owner(userId);
    for (let index = 0; index < orderedIds.length; index += 1) {
      const habitId = orderedIds[index];
      if (!habitId) continue;
      const { error } = await this.db.from("habits").update({ sort_order: index + 1 }).eq("id", habitId).eq("user_id", userId);
      raise(error);
    }
  }

  async materialize(userId: string, from: string, to: string, today: string): Promise<number> {
    this.owner(userId);
    const end = to < today ? to : today;
    if (from > end) return 0;
    const versions = await this.listVersions(userId);
    let created = 0;
    for (const date of eachDate(from, end)) {
      for (const version of versions) {
        if (!versionCovers(version.effective_from, version.effective_until, date)) continue;
        if (!isScheduledOn(version.schedule, date)) continue;
        const snapshotBody = {
          title: version.schedule.title,
          categoryId: version.schedule.categoryId,
          recurrenceType: version.schedule.recurrenceType,
          recurrenceConfig: version.schedule.recurrenceConfig,
          targetQuantity: version.schedule.targetQuantity,
          targetUnit: version.schedule.targetUnit,
        };
        const { error } = await this.db.from("habit_occurrences").upsert({
          id: id(),
          user_id: userId,
          habit_id: version.habit_id,
          schedule_version_id: version.id,
          occurrence_date: date,
          occurrence_snapshot: snapshotBody,
          status: "pending",
        }, { onConflict: "habit_id,occurrence_date", ignoreDuplicates: true });
        if (error && error.code !== "23505") raise(error);
        else if (!error) created += 1;
      }
    }
    return created;
  }

  async listOccurrences(userId: string, from: string, to: string): Promise<OccurrenceRecord[]> {
    this.owner(userId);
    const { data, error } = await this.db.from("habit_occurrences").select("*").eq("user_id", userId).gte("occurrence_date", from).lte("occurrence_date", to).order("occurrence_date");
    raise(error);
    return (data ?? []).map(mapOccurrence);
  }

  async setOccurrenceStatus(userId: string, occurrenceId: string, status: OccurrenceStatus, today: string, extra?: { quantity?: number | null; note?: string | null }): Promise<OccurrenceRecord> {
    this.owner(userId);
    const { data, error } = await this.db.from("habit_occurrences").select("*").eq("id", occurrenceId).eq("user_id", userId).maybeSingle();
    raise(error);
    if (!data) throw new AppError("Habit entry not found.", "not_found", 404);
    if (String(data.occurrence_date) > today) throw new AppError("Future days cannot be completed yet.", "future_date");
    const { error: updateError } = await this.db.from("habit_occurrences").update({
      status,
      quantity: extra?.quantity === undefined ? data.quantity : extra.quantity,
      note: extra?.note === undefined ? data.note : extra.note,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    }).eq("id", occurrenceId).eq("user_id", userId);
    raise(updateError);
    return (await this.listOccurrences(userId, String(data.occurrence_date), String(data.occurrence_date))).find((item) => item.id === occurrenceId)!;
  }

  async listTasks(userId: string, from?: string, to?: string): Promise<TaskRecord[]> {
    this.owner(userId);
    let query = this.db.from("daily_tasks").select("*").eq("user_id", userId).order("scheduled_date");
    if (from && to) query = query.gte("scheduled_date", from).lte("scheduled_date", to);
    const { data, error } = await query;
    raise(error);
    return (data ?? []).map(mapTask);
  }

  async createTask(userId: string, input: Omit<TaskRecord, "id" | "userId" | "status" | "completedAt" | "createdAt">): Promise<TaskRecord> {
    this.owner(userId);
    await this.assertCategory(userId, input.categoryId);
    const taskId = id();
    const { error } = await this.db.from("daily_tasks").insert({
      id: taskId,
      user_id: userId,
      category_id: input.categoryId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      scheduled_date: input.scheduledDate,
      target_time: input.targetTime,
      status: "pending",
    });
    raise(error);
    return (await this.listTasks(userId)).find((task) => task.id === taskId)!;
  }

  async updateTask(userId: string, taskId: string, input: Partial<Pick<TaskRecord, "title" | "description" | "categoryId" | "priority" | "scheduledDate" | "targetTime">>): Promise<TaskRecord> {
    this.owner(userId);
    const current = (await this.listTasks(userId)).find((task) => task.id === taskId);
    if (!current) throw new AppError("Task not found.", "not_found", 404);
    if (input.categoryId) await this.assertCategory(userId, input.categoryId);
    const { error } = await this.db.from("daily_tasks").update({
      title: input.title ?? current.title,
      description: input.description === undefined ? current.description : input.description,
      category_id: input.categoryId === undefined ? current.categoryId : input.categoryId,
      priority: input.priority ?? current.priority,
      scheduled_date: input.scheduledDate ?? current.scheduledDate,
      target_time: input.targetTime === undefined ? current.targetTime : input.targetTime,
    }).eq("id", taskId).eq("user_id", userId);
    raise(error);
    return (await this.listTasks(userId)).find((task) => task.id === taskId)!;
  }

  async setTaskStatus(userId: string, taskId: string, status: "pending" | "completed", today: string): Promise<TaskRecord> {
    this.owner(userId);
    const current = (await this.listTasks(userId)).find((task) => task.id === taskId);
    if (!current) throw new AppError("Task not found.", "not_found", 404);
    if (status === "completed" && current.scheduledDate > today) throw new AppError("Future tasks cannot be completed yet.", "future_date");
    const { error } = await this.db.from("daily_tasks").update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    }).eq("id", taskId).eq("user_id", userId);
    raise(error);
    return (await this.listTasks(userId)).find((task) => task.id === taskId)!;
  }

  async deleteTask(userId: string, taskId: string): Promise<void> {
    this.owner(userId);
    const { error, count } = await this.db.from("daily_tasks").delete({ count: "exact" }).eq("id", taskId).eq("user_id", userId);
    raise(error);
    if (!count) throw new AppError("Task not found.", "not_found", 404);
  }

  async getCheckin(userId: string, localDate: string): Promise<CheckinRecord | null> {
    this.owner(userId);
    const { data, error } = await this.db.from("daily_checkins").select("*").eq("user_id", userId).eq("local_date", localDate).maybeSingle();
    raise(error);
    return data ? mapCheckin(data) : null;
  }

  async countCheckins(userId: string, localDate: string): Promise<number> {
    this.owner(userId);
    const { count, error } = await this.db.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("local_date", localDate);
    raise(error);
    return count ?? 0;
  }

  async saveMorning(userId: string, input: { localDate: string; intention: string | null; customIntention: string | null; personalCommitment: string | null; priorities: PriorityDraft[] }): Promise<CheckinRecord> {
    this.owner(userId);
    if (input.priorities.length > 3) throw new AppError("Choose up to three priorities.", "validation");
    for (const priority of input.priorities) await this.assertCategory(userId, priority.categoryId);
    const existing = await this.getCheckin(userId, input.localDate);
    if (!existing) {
      const { error } = await this.db.from("daily_checkins").insert({
        id: id(),
        user_id: userId,
        local_date: input.localDate,
        morning_intention: input.intention,
        morning_intention_custom: input.customIntention,
        personal_commitment: input.personalCommitment,
        morning_completed_at: new Date().toISOString(),
      });
      raise(error);
    } else {
      const { error } = await this.db.from("daily_checkins").update({
        morning_intention: input.intention,
        morning_intention_custom: input.customIntention,
        personal_commitment: input.personalCommitment,
        morning_completed_at: existing.morningCompletedAt ?? new Date().toISOString(),
      }).eq("user_id", userId).eq("local_date", input.localDate);
      raise(error);
    }
    const current = await this.listPriorities(userId, input.localDate);
    const keep = new Set(input.priorities.map((item) => item.id).filter(Boolean));
    for (const priority of current) {
      if (!keep.has(priority.id)) {
        const { error } = await this.db.from("daily_priorities").delete().eq("id", priority.id).eq("user_id", userId);
        raise(error);
      }
    }
    for (let index = 0; index < input.priorities.length; index += 1) {
      const priority = input.priorities[index]!;
      const previous = priority.id ? current.find((item) => item.id === priority.id) : undefined;
      if (previous) {
        const { error } = await this.db.from("daily_priorities").update({
          title: priority.title,
          description: priority.description ?? null,
          category_id: priority.categoryId ?? null,
          target_time: priority.targetTime ?? null,
          sort_order: index,
        }).eq("id", previous.id).eq("user_id", userId);
        raise(error);
      } else {
        const { error } = await this.db.from("daily_priorities").insert({
          id: id(),
          user_id: userId,
          local_date: input.localDate,
          category_id: priority.categoryId ?? null,
          title: priority.title,
          description: priority.description ?? null,
          target_time: priority.targetTime ?? null,
          status: "pending",
          sort_order: index,
        });
        raise(error);
      }
    }
    return (await this.getCheckin(userId, input.localDate))!;
  }

  async saveEvening(userId: string, input: { localDate: string; peaceRating: number; confidenceRating: number; whatWentWell: string | null; energyDrainers: string | null; tomorrowAdjustment: string | null }): Promise<CheckinRecord> {
    this.owner(userId);
    const existing = await this.getCheckin(userId, input.localDate);
    if (!existing) {
      const { error } = await this.db.from("daily_checkins").insert({
        id: id(),
        user_id: userId,
        local_date: input.localDate,
        peace_rating: input.peaceRating,
        confidence_rating: input.confidenceRating,
        what_went_well: input.whatWentWell,
        energy_drainers: input.energyDrainers,
        tomorrow_adjustment: input.tomorrowAdjustment,
        evening_completed_at: new Date().toISOString(),
      });
      raise(error);
    } else {
      const { error } = await this.db.from("daily_checkins").update({
        peace_rating: input.peaceRating,
        confidence_rating: input.confidenceRating,
        what_went_well: input.whatWentWell,
        energy_drainers: input.energyDrainers,
        tomorrow_adjustment: input.tomorrowAdjustment,
        evening_completed_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("local_date", input.localDate);
      raise(error);
    }
    return (await this.getCheckin(userId, input.localDate))!;
  }

  async listPriorities(userId: string, localDate: string): Promise<PriorityRecord[]> {
    this.owner(userId);
    const { data, error } = await this.db.from("daily_priorities").select("*").eq("user_id", userId).eq("local_date", localDate).order("sort_order");
    raise(error);
    return (data ?? []).map(mapPriority);
  }

  async listPrioritiesBetween(userId: string, from: string, to: string): Promise<PriorityRecord[]> {
    this.owner(userId);
    const { data, error } = await this.db.from("daily_priorities").select("*").eq("user_id", userId).gte("local_date", from).lte("local_date", to).order("local_date");
    raise(error);
    return (data ?? []).map(mapPriority);
  }

  async setPriorityStatus(userId: string, priorityId: string, status: "pending" | "completed", today: string): Promise<PriorityRecord> {
    this.owner(userId);
    const { data, error } = await this.db.from("daily_priorities").select("*").eq("id", priorityId).eq("user_id", userId).maybeSingle();
    raise(error);
    if (!data) throw new AppError("Priority not found.", "not_found", 404);
    if (String(data.local_date) > today) throw new AppError("Future priorities cannot be completed yet.", "future_date");
    const { error: updateError } = await this.db.from("daily_priorities").update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    }).eq("id", priorityId).eq("user_id", userId);
    raise(updateError);
    return (await this.listPriorities(userId, String(data.local_date))).find((item) => item.id === priorityId)!;
  }

  async listCheckins(userId: string, from: string, to: string): Promise<CheckinRecord[]> {
    this.owner(userId);
    const { data, error } = await this.db.from("daily_checkins").select("*").eq("user_id", userId).gte("local_date", from).lte("local_date", to).order("local_date");
    raise(error);
    return (data ?? []).map(mapCheckin);
  }

  async listJournal(userId: string, filters: { query?: string; date?: string; categoryId?: string; limit?: number; offset?: number }): Promise<JournalRecord[]> {
    this.owner(userId);
    let query = this.db.from("journal_entries").select("*").eq("user_id", userId).order("local_date", { ascending: false });
    if (filters.date) query = query.eq("local_date", filters.date);
    if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
    if (filters.query) {
      const term = filters.query.replaceAll("%", "");
      query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
    }
    const from = filters.offset ?? 0;
    const to = from + (filters.limit ?? 20) - 1;
    const { data, error } = await query.range(from, to);
    raise(error);
    return (data ?? []).map(mapJournal);
  }

  async getJournal(userId: string, entryId: string): Promise<JournalRecord | null> {
    this.owner(userId);
    const { data, error } = await this.db.from("journal_entries").select("*").eq("user_id", userId).eq("id", entryId).maybeSingle();
    raise(error);
    return data ? mapJournal(data) : null;
  }

  async saveJournal(userId: string, input: { id?: string; localDate: string; title: string; body: string; categoryId?: string | null; moodTag?: string | null }): Promise<JournalRecord> {
    this.owner(userId);
    if (input.categoryId) await this.assertCategory(userId, input.categoryId);
    if (input.id) {
      if (!(await this.getJournal(userId, input.id))) throw new AppError("Journal entry not found.", "not_found", 404);
      const { error } = await this.db.from("journal_entries").update({
        local_date: input.localDate,
        title: input.title,
        body: input.body,
        category_id: input.categoryId ?? null,
        mood_tag: input.moodTag ?? null,
      }).eq("id", input.id).eq("user_id", userId);
      raise(error);
      return (await this.getJournal(userId, input.id))!;
    }
    const entryId = id();
    const { error } = await this.db.from("journal_entries").insert({
      id: entryId,
      user_id: userId,
      local_date: input.localDate,
      title: input.title,
      body: input.body,
      category_id: input.categoryId ?? null,
      mood_tag: input.moodTag ?? null,
    });
    raise(error);
    return (await this.getJournal(userId, entryId))!;
  }

  async deleteJournal(userId: string, entryId: string): Promise<void> {
    this.owner(userId);
    const { error, count } = await this.db.from("journal_entries").delete({ count: "exact" }).eq("id", entryId).eq("user_id", userId);
    raise(error);
    if (!count) throw new AppError("Journal entry not found.", "not_found", 404);
  }

  async listReminders(userId: string): Promise<ReminderRecord[]> {
    this.owner(userId);
    const { data, error } = await this.db.from("reminder_preferences").select("*").eq("user_id", userId);
    raise(error);
    return (data ?? []).map(mapReminder);
  }

  async upsertReminder(userId: string, input: { reminderType: ReminderRecord["reminderType"]; referenceId?: string | null; isEnabled: boolean; reminderTime: string | null }): Promise<ReminderRecord> {
    this.owner(userId);
    const existing = (await this.listReminders(userId)).find((item) => item.reminderType === input.reminderType && item.referenceId === (input.referenceId ?? null));
    if (existing) {
      const { error } = await this.db.from("reminder_preferences").update({
        is_enabled: input.isEnabled,
        reminder_time: input.reminderTime,
      }).eq("id", existing.id).eq("user_id", userId);
      raise(error);
      return (await this.listReminders(userId)).find((item) => item.id === existing.id)!;
    }
    const reminderId = id();
    const { error } = await this.db.from("reminder_preferences").insert({
      id: reminderId,
      user_id: userId,
      reminder_type: input.reminderType,
      reference_id: input.referenceId ?? null,
      is_enabled: input.isEnabled,
      reminder_time: input.reminderTime,
      configuration: {},
    });
    raise(error);
    return (await this.listReminders(userId)).find((item) => item.id === reminderId)!;
  }

  async exportUser(userId: string): Promise<Record<string, unknown>> {
    this.owner(userId);
    const profile = await this.getProfile(userId);
    return {
      exportedAt: new Date().toISOString(),
      account: { id: userId },
      profile,
      categories: await this.listCategories(userId, true),
      habits: await this.listHabits(userId, true),
      occurrences: await this.listOccurrences(userId, "1970-01-01", "2999-12-31"),
      tasks: await this.listTasks(userId),
      checkins: await this.listCheckins(userId, "1970-01-01", "2999-12-31"),
      priorities: await this.listPrioritiesBetween(userId, "1970-01-01", "2999-12-31"),
      journal: await this.listJournal(userId, { limit: 10000 }),
      reminders: await this.listReminders(userId),
    };
  }

  async deleteUser(userId: string): Promise<void> {
    this.owner(userId);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new AppError("Account deletion needs the server service role key.", "config", 500);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      logDb(error);
      throw new AppError("We couldn't delete the account.", "delete_failed", 500);
    }
  }

  private async assertCategory(userId: string, categoryId: string | null | undefined): Promise<void> {
    if (!categoryId) return;
    const found = (await this.listCategories(userId, true)).some((item) => item.id === categoryId);
    if (!found) throw new AppError("Category not found.", "not_found", 404);
  }

  private async listVersions(userId: string): Promise<Array<{ id: string; habit_id: string; effective_from: string; effective_until: string | null; schedule: OccurrenceSchedule }>> {
    const { data, error } = await this.db.from("habit_schedule_versions").select("*").eq("user_id", userId);
    raise(error);
    return (data ?? []).map((row) => ({
      id: String(row.id),
      habit_id: String(row.habit_id),
      effective_from: String(row.effective_from),
      effective_until: row.effective_until ? String(row.effective_until) : null,
      schedule: asSchedule(row.schedule_configuration),
    }));
  }

  private async openVersion(habitId: string) {
    const { data, error } = await this.db.from("habit_schedule_versions").select("*").eq("habit_id", habitId).is("effective_until", null).order("effective_from", { ascending: false }).limit(1).maybeSingle();
    raise(error);
    return data ? { id: String(data.id), effective_from: String(data.effective_from) } : null;
  }

  private async insertVersion(userId: string, habitId: string, from: string, until: string | null, body: OccurrenceSchedule): Promise<void> {
    const { error } = await this.db.from("habit_schedule_versions").insert({
      id: id(),
      habit_id: habitId,
      user_id: userId,
      effective_from: from,
      effective_until: until,
      schedule_configuration: body,
    });
    raise(error);
  }

  private async splitVersion(userId: string, habit: HabitRecord, today: string): Promise<void> {
    const open = await this.openVersion(habit.id);
    if (open && open.effective_from < today) {
      const { error } = await this.db.from("habit_schedule_versions").update({ effective_until: addDays(today, -1) }).eq("id", open.id);
      raise(error);
      await this.insertVersion(userId, habit.id, today, null, snapshot(habit, habit.recurrenceConfig));
      return;
    }
    if (open) {
      const { error } = await this.db.from("habit_schedule_versions").update({
        schedule_configuration: snapshot(habit, habit.recurrenceConfig),
      }).eq("id", open.id);
      raise(error);
      return;
    }
    await this.insertVersion(userId, habit.id, today, null, snapshot(habit, habit.recurrenceConfig));
  }

  private async rewriteOpenVersion(userId: string, habit: HabitRecord): Promise<void> {
    const open = await this.openVersion(habit.id);
    if (!open) return;
    const { error } = await this.db.from("habit_schedule_versions").update({
      schedule_configuration: snapshot(habit, habit.recurrenceConfig),
    }).eq("id", open.id).eq("user_id", userId);
    raise(error);
  }
}

type OccurrenceSchedule = {
  title: string;
  categoryId: string | null;
  recurrenceType: RecurrenceType;
  recurrenceConfig: ScheduleConfig;
  startDate: string;
  endDate: string | null;
  targetQuantity: number | null;
  targetUnit: string | null;
};

function snapshot(habit: Pick<HabitRecord, "title" | "categoryId" | "recurrenceType" | "startDate" | "endDate" | "targetQuantity" | "targetUnit">, config: ScheduleConfig): OccurrenceSchedule {
  return {
    title: habit.title,
    categoryId: habit.categoryId,
    recurrenceType: habit.recurrenceType,
    recurrenceConfig: config,
    startDate: habit.startDate,
    endDate: habit.endDate,
    targetQuantity: habit.targetQuantity,
    targetUnit: habit.targetUnit,
  };
}

function asSchedule(value: unknown): OccurrenceSchedule {
  const raw = (typeof value === "string" ? JSON.parse(value) : value) as OccurrenceSchedule;
  return raw;
}

function mapProfile(row: Record<string, unknown>): ProfileRecord {
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? ""),
    timezone: String(row.timezone),
    preferences: mergePreferences(row.preferences),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCategory(row: Record<string, unknown>): CategoryRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    icon: String(row.icon),
    color: String(row.color),
    sortOrder: Number(row.sort_order),
    isArchived: Boolean(row.is_archived),
  };
}

function mapHabit(row: Record<string, unknown>): HabitRecord {
  const config = (typeof row.recurrence_config === "string" ? JSON.parse(row.recurrence_config) : row.recurrence_config) as ScheduleConfig;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    categoryId: row.category_id ? String(row.category_id) : null,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    recurrenceType: String(row.recurrence_type) as RecurrenceType,
    recurrenceConfig: config ?? {},
    targetQuantity: row.target_quantity === null || row.target_quantity === undefined ? null : Number(row.target_quantity),
    targetUnit: row.target_unit ? String(row.target_unit) : null,
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : null,
    isActive: Boolean(row.is_active),
    isArchived: Boolean(row.is_archived),
    sortOrder: Number(row.sort_order),
    reminderEnabled: Boolean(row.reminder_enabled),
    reminderTime: row.reminder_time ? String(row.reminder_time) : null,
  };
}

function mapOccurrence(row: Record<string, unknown>): OccurrenceRecord {
  const snapshotBody = asSchedule(row.occurrence_snapshot);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    habitId: String(row.habit_id),
    scheduleVersionId: row.schedule_version_id ? String(row.schedule_version_id) : null,
    date: String(row.occurrence_date),
    title: snapshotBody.title,
    categoryId: snapshotBody.categoryId,
    recurrenceType: snapshotBody.recurrenceType,
    recurrenceConfig: snapshotBody.recurrenceConfig,
    targetQuantity: snapshotBody.targetQuantity,
    targetUnit: snapshotBody.targetUnit,
    status: String(row.status) as OccurrenceStatus,
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    note: row.note ? String(row.note) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

function mapTask(row: Record<string, unknown>): TaskRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    categoryId: row.category_id ? String(row.category_id) : null,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    priority: String(row.priority) as TaskRecord["priority"],
    scheduledDate: String(row.scheduled_date),
    targetTime: row.target_time ? String(row.target_time) : null,
    status: String(row.status) as TaskRecord["status"],
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
  };
}

function mapCheckin(row: Record<string, unknown>): CheckinRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    localDate: String(row.local_date),
    morningIntention: row.morning_intention ? String(row.morning_intention) : null,
    morningIntentionCustom: row.morning_intention_custom ? String(row.morning_intention_custom) : null,
    personalCommitment: row.personal_commitment ? String(row.personal_commitment) : null,
    morningCompletedAt: row.morning_completed_at ? String(row.morning_completed_at) : null,
    peaceRating: row.peace_rating === null || row.peace_rating === undefined ? null : Number(row.peace_rating),
    confidenceRating: row.confidence_rating === null || row.confidence_rating === undefined ? null : Number(row.confidence_rating),
    whatWentWell: row.what_went_well ? String(row.what_went_well) : null,
    energyDrainers: row.energy_drainers ? String(row.energy_drainers) : null,
    tomorrowAdjustment: row.tomorrow_adjustment ? String(row.tomorrow_adjustment) : null,
    eveningCompletedAt: row.evening_completed_at ? String(row.evening_completed_at) : null,
  };
}

function mapPriority(row: Record<string, unknown>): PriorityRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    localDate: String(row.local_date),
    categoryId: row.category_id ? String(row.category_id) : null,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    targetTime: row.target_time ? String(row.target_time) : null,
    status: String(row.status) as PriorityRecord["status"],
    completedAt: row.completed_at ? String(row.completed_at) : null,
    sortOrder: Number(row.sort_order),
  };
}

function mapJournal(row: Record<string, unknown>): JournalRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    localDate: String(row.local_date),
    title: String(row.title),
    body: String(row.body),
    categoryId: row.category_id ? String(row.category_id) : null,
    moodTag: row.mood_tag ? String(row.mood_tag) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapReminder(row: Record<string, unknown>): ReminderRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    reminderType: String(row.reminder_type) as ReminderRecord["reminderType"],
    referenceId: row.reference_id ? String(row.reference_id) : null,
    isEnabled: Boolean(row.is_enabled),
    reminderTime: row.reminder_time ? String(row.reminder_time) : null,
    configuration: (row.configuration && typeof row.configuration === "object" ? row.configuration : {}) as Record<string, unknown>,
  };
}
