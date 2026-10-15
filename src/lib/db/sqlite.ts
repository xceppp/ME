import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { addDays, eachDate } from "../domain/dates";
import { mergePreferences, type Preferences } from "../domain/defaults";
import { isScheduledOn, normalizeSchedule, versionCovers, type RecurrenceType, type ScheduleConfig, type ScheduleSnapshot } from "../domain/recurrence";
import { hashPassword, randomId, sha256 } from "../auth/password";
import type { OccurrenceStatus } from "../domain/metrics";

export class AppError extends Error {
  constructor(message: string, readonly code: string, readonly status = 400) {
    super(message);
  }
}

type Row = Record<string, unknown>;

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type ProfileRecord = {
  id: string;
  displayName: string;
  timezone: string;
  preferences: Preferences;
  createdAt: string;
  updatedAt: string;
};

export type CategoryRecord = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  isArchived: boolean;
};

export type HabitRecord = {
  id: string;
  userId: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  recurrenceType: RecurrenceType;
  recurrenceConfig: ScheduleConfig;
  targetQuantity: number | null;
  targetUnit: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  isArchived: boolean;
  sortOrder: number;
  reminderEnabled: boolean;
  reminderTime: string | null;
};

export type VersionRecord = {
  id: string;
  habitId: string;
  userId: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  schedule: ScheduleSnapshot & {
    title: string;
    categoryId: string | null;
    targetQuantity: number | null;
    targetUnit: string | null;
  };
};

export type OccurrenceRecord = {
  id: string;
  userId: string;
  habitId: string;
  scheduleVersionId: string | null;
  date: string;
  title: string;
  categoryId: string | null;
  recurrenceType: RecurrenceType;
  recurrenceConfig: ScheduleConfig;
  targetQuantity: number | null;
  targetUnit: string | null;
  status: OccurrenceStatus;
  quantity: number | null;
  note: string | null;
  completedAt: string | null;
};

export type TaskRecord = {
  id: string;
  userId: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  scheduledDate: string;
  targetTime: string | null;
  status: "pending" | "completed";
  completedAt: string | null;
  createdAt: string;
};

export type CheckinRecord = {
  id: string;
  userId: string;
  localDate: string;
  morningIntention: string | null;
  morningIntentionCustom: string | null;
  personalCommitment: string | null;
  morningCompletedAt: string | null;
  peaceRating: number | null;
  confidenceRating: number | null;
  whatWentWell: string | null;
  energyDrainers: string | null;
  tomorrowAdjustment: string | null;
  eveningCompletedAt: string | null;
};

export type PriorityRecord = {
  id: string;
  userId: string;
  localDate: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  targetTime: string | null;
  status: "pending" | "completed";
  completedAt: string | null;
  sortOrder: number;
};

export type JournalRecord = {
  id: string;
  userId: string;
  localDate: string;
  title: string;
  body: string;
  categoryId: string | null;
  moodTag: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReminderRecord = {
  id: string;
  userId: string;
  reminderType: "morning_planning" | "evening_reflection" | "habit";
  referenceId: string | null;
  isEnabled: boolean;
  reminderTime: string | null;
  configuration: Record<string, unknown>;
};

const SCHEMA = `
create table if not exists users (
  id text primary key,
  email text not null unique collate nocase,
  password_hash text not null,
  email_verified_at text,
  created_at text not null,
  updated_at text not null
);
create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at text not null,
  created_at text not null
);
create table if not exists auth_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  purpose text not null check (purpose in ('verify_email', 'reset_password')),
  token_hash text not null unique,
  expires_at text not null,
  used_at text,
  created_at text not null
);
create table if not exists rate_limits (
  bucket text not null,
  window_start integer not null,
  count integer not null,
  primary key (bucket, window_start)
);
create table if not exists profiles (
  id text primary key references users(id) on delete cascade,
  display_name text not null default '',
  timezone text not null default 'Africa/Casablanca',
  preferences text not null default '{}',
  created_at text not null,
  updated_at text not null
);
create table if not exists categories (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  description text,
  icon text not null,
  color text not null,
  sort_order integer not null,
  is_archived integer not null default 0,
  created_at text not null,
  updated_at text not null
);
create table if not exists habits (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  category_id text references categories(id) on delete set null,
  title text not null,
  description text,
  recurrence_type text not null,
  recurrence_config text not null,
  target_quantity real,
  target_unit text,
  start_date text not null,
  end_date text,
  is_active integer not null default 1,
  is_archived integer not null default 0,
  sort_order integer not null default 0,
  reminder_enabled integer not null default 0,
  reminder_time text,
  created_at text not null,
  updated_at text not null
);
create table if not exists habit_schedule_versions (
  id text primary key,
  habit_id text not null references habits(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  effective_from text not null,
  effective_until text,
  schedule_configuration text not null,
  created_at text not null
);
create table if not exists habit_occurrences (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  habit_id text not null references habits(id) on delete cascade,
  schedule_version_id text references habit_schedule_versions(id) on delete set null,
  occurrence_date text not null,
  occurrence_snapshot text not null,
  status text not null,
  quantity real,
  note text,
  completed_at text,
  created_at text not null,
  updated_at text not null,
  unique (habit_id, occurrence_date)
);
create table if not exists daily_tasks (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  category_id text references categories(id) on delete set null,
  title text not null,
  description text,
  priority text not null,
  scheduled_date text not null,
  target_time text,
  status text not null,
  completed_at text,
  created_at text not null,
  updated_at text not null
);
create table if not exists daily_checkins (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  local_date text not null,
  morning_intention text,
  morning_intention_custom text,
  personal_commitment text,
  morning_completed_at text,
  peace_rating integer,
  confidence_rating integer,
  what_went_well text,
  energy_drainers text,
  tomorrow_adjustment text,
  evening_completed_at text,
  created_at text not null,
  updated_at text not null,
  unique (user_id, local_date),
  check (peace_rating is null or (peace_rating between 1 and 10)),
  check (confidence_rating is null or (confidence_rating between 1 and 10))
);
create table if not exists daily_priorities (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  local_date text not null,
  category_id text references categories(id) on delete set null,
  title text not null,
  description text,
  target_time text,
  status text not null,
  completed_at text,
  sort_order integer not null,
  created_at text not null,
  updated_at text not null
);
create table if not exists journal_entries (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  local_date text not null,
  title text not null,
  body text not null,
  category_id text references categories(id) on delete set null,
  mood_tag text,
  created_at text not null,
  updated_at text not null
);
create table if not exists reminder_preferences (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  reminder_type text not null,
  reference_id text,
  is_enabled integer not null default 0,
  reminder_time text,
  configuration text not null default '{}',
  created_at text not null,
  updated_at text not null
);
create index if not exists habits_user_idx on habits (user_id, sort_order);
create index if not exists occurrences_user_date_idx on habit_occurrences (user_id, occurrence_date);
create index if not exists tasks_user_date_idx on daily_tasks (user_id, scheduled_date);
create index if not exists journal_user_idx on journal_entries (user_id, local_date);
`;

function nowIso(): string {
  return new Date().toISOString();
}

function bool(value: unknown): boolean {
  return value === 1 || value === true;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export class SqliteStore {
  constructor(private readonly db: DatabaseSync) {}

  transaction<T>(fn: () => T): T {
    this.db.exec("begin immediate");
    try {
      const result = fn();
      this.db.exec("commit");
      return result;
    } catch (error) {
      this.db.exec("rollback");
      throw error;
    }
  }

  consumeRateLimit(bucket: string, limit: number, windowMs: number): boolean {
    const windowStart = Math.floor(Date.now() / windowMs);
    this.db.prepare(
      "insert into rate_limits (bucket, window_start, count) values (?, ?, 1) on conflict(bucket, window_start) do update set count = count + 1",
    ).run(bucket, windowStart);
    const row = this.db.prepare("select count from rate_limits where bucket = ? and window_start = ?").get(bucket, windowStart) as Row;
    return Number(row.count) <= limit;
  }

  createUser(input: { email: string; password: string; displayName: string; timezone: string; preferences?: Preferences }): UserRecord {
    const email = input.email.trim().toLowerCase();
    const existing = this.findUserByEmail(email);
    if (existing) throw new AppError("An account with that email already exists.", "email_taken", 409);
    const id = randomId();
    const timestamp = nowIso();
    const preferences = input.preferences ?? mergePreferences({});
    this.transaction(() => {
      this.db.prepare(
        "insert into users (id, email, password_hash, email_verified_at, created_at, updated_at) values (?, ?, ?, null, ?, ?)",
      ).run(id, email, hashPassword(input.password), timestamp, timestamp);
      this.db.prepare(
        "insert into profiles (id, display_name, timezone, preferences, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
      ).run(id, input.displayName.trim(), input.timezone, JSON.stringify(preferences), timestamp, timestamp);
      this.db.prepare(
        "insert into reminder_preferences (id, user_id, reminder_type, reference_id, is_enabled, reminder_time, configuration, created_at, updated_at) values (?, ?, 'morning_planning', null, 0, '08:00', '{}', ?, ?)",
      ).run(randomId(), id, timestamp, timestamp);
      this.db.prepare(
        "insert into reminder_preferences (id, user_id, reminder_type, reference_id, is_enabled, reminder_time, configuration, created_at, updated_at) values (?, ?, 'evening_reflection', null, 0, '21:00', '{}', ?, ?)",
      ).run(randomId(), id, timestamp, timestamp);
    });
    return this.findUserById(id)!;
  }

  findUserByEmail(email: string): UserRecord | null {
    const row = this.db.prepare("select * from users where email = ?").get(email.trim().toLowerCase()) as Row | undefined;
    return row ? mapUser(row) : null;
  }

  findUserById(id: string): UserRecord | null {
    const row = this.db.prepare("select * from users where id = ?").get(id) as Row | undefined;
    return row ? mapUser(row) : null;
  }

  markEmailVerified(userId: string): void {
    this.db.prepare("update users set email_verified_at = ?, updated_at = ? where id = ?").run(nowIso(), nowIso(), userId);
  }

  updatePassword(userId: string, password: string): void {
    this.db.prepare("update users set password_hash = ?, updated_at = ? where id = ?").run(hashPassword(password), nowIso(), userId);
  }

  createSession(userId: string, token: string, expiresAt: string): string {
    const id = randomId();
    this.db.prepare("insert into sessions (id, user_id, token_hash, expires_at, created_at) values (?, ?, ?, ?, ?)").run(
      id, userId, sha256(token), expiresAt, nowIso(),
    );
    return id;
  }

  sessionIsActive(sessionId: string, userId: string): boolean {
    const row = this.db.prepare("select expires_at from sessions where id = ? and user_id = ?").get(sessionId, userId) as Row | undefined;
    if (!row) return false;
    return String(row.expires_at) > new Date().toISOString();
  }

  deleteSession(sessionId: string): void {
    this.db.prepare("delete from sessions where id = ?").run(sessionId);
  }

  createAuthToken(userId: string, purpose: "verify_email" | "reset_password", token: string, expiresAt: string): void {
    this.db.prepare("insert into auth_tokens (id, user_id, purpose, token_hash, expires_at, used_at, created_at) values (?, ?, ?, ?, ?, null, ?)").run(
      randomId(), userId, purpose, sha256(token), expiresAt, nowIso(),
    );
  }

  consumeAuthToken(token: string, purpose: "verify_email" | "reset_password"): string | null {
    const row = this.db.prepare("select * from auth_tokens where token_hash = ? and purpose = ? and used_at is null").get(sha256(token), purpose) as Row | undefined;
    if (!row) return null;
    if (String(row.expires_at) < new Date().toISOString()) return null;
    this.db.prepare("update auth_tokens set used_at = ? where id = ?").run(nowIso(), String(row.id));
    return String(row.user_id);
  }

  getProfile(userId: string): ProfileRecord | null {
    const row = this.db.prepare("select * from profiles where id = ?").get(userId) as Row | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      displayName: String(row.display_name),
      timezone: String(row.timezone),
      preferences: mergePreferences(parseJson(row.preferences, {})),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  updateProfile(userId: string, input: { displayName?: string; timezone?: string; preferences?: Preferences }): ProfileRecord {
    const current = this.getProfile(userId);
    if (!current) throw new AppError("Profile not found.", "not_found", 404);
    const next = {
      displayName: input.displayName?.trim() || current.displayName,
      timezone: input.timezone || current.timezone,
      preferences: input.preferences ?? current.preferences,
    };
    this.db.prepare("update profiles set display_name = ?, timezone = ?, preferences = ?, updated_at = ? where id = ?").run(
      next.displayName, next.timezone, JSON.stringify(next.preferences), nowIso(), userId,
    );
    return this.getProfile(userId)!;
  }

  listCategories(userId: string, includeArchived = false): CategoryRecord[] {
    const sql = includeArchived
      ? "select * from categories where user_id = ? order by sort_order, name"
      : "select * from categories where user_id = ? and is_archived = 0 order by sort_order, name";
    return (this.db.prepare(sql).all(userId) as Row[]).map(mapCategory);
  }

  createCategory(userId: string, input: { name: string; description?: string | null; icon: string; color: string; sortOrder?: number }): CategoryRecord {
    const id = randomId();
    const timestamp = nowIso();
    const sortOrder = input.sortOrder ?? (this.listCategories(userId, true).length + 1);
    this.db.prepare(
      "insert into categories (id, user_id, name, description, icon, color, sort_order, is_archived, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
    ).run(id, userId, input.name, input.description ?? null, input.icon, input.color, sortOrder, timestamp, timestamp);
    return this.listCategories(userId, true).find((item) => item.id === id)!;
  }

  updateCategory(userId: string, id: string, input: Partial<{ name: string; description: string | null; icon: string; color: string; isArchived: boolean; sortOrder: number }>): CategoryRecord {
    const current = this.ownedCategory(userId, id);
    this.db.prepare(
      "update categories set name = ?, description = ?, icon = ?, color = ?, is_archived = ?, sort_order = ?, updated_at = ? where id = ? and user_id = ?",
    ).run(
      input.name ?? current.name,
      input.description === undefined ? current.description : input.description,
      input.icon ?? current.icon,
      input.color ?? current.color,
      input.isArchived === undefined ? Number(current.isArchived) : Number(input.isArchived),
      input.sortOrder ?? current.sortOrder,
      nowIso(),
      id,
      userId,
    );
    return this.ownedCategory(userId, id);
  }

  private ownedCategory(userId: string, id: string): CategoryRecord {
    const row = this.db.prepare("select * from categories where id = ? and user_id = ?").get(id, userId) as Row | undefined;
    if (!row) throw new AppError("Category not found.", "not_found", 404);
    return mapCategory(row);
  }

  private assertCategoryOwner(userId: string, categoryId: string | null | undefined): void {
    if (!categoryId) return;
    this.ownedCategory(userId, categoryId);
  }

  listHabits(userId: string, includeArchived = false): HabitRecord[] {
    const sql = includeArchived
      ? "select * from habits where user_id = ? order by sort_order, title"
      : "select * from habits where user_id = ? and is_archived = 0 order by sort_order, title";
    return (this.db.prepare(sql).all(userId) as Row[]).map(mapHabit);
  }

  getHabit(userId: string, id: string): HabitRecord | null {
    const row = this.db.prepare("select * from habits where id = ? and user_id = ?").get(id, userId) as Row | undefined;
    return row ? mapHabit(row) : null;
  }

  createHabit(userId: string, input: Omit<HabitRecord, "id" | "userId" | "isActive" | "isArchived" | "sortOrder"> & { sortOrder?: number }): HabitRecord {
    this.assertCategoryOwner(userId, input.categoryId);
    const id = randomId();
    const timestamp = nowIso();
    const config = normalizeSchedule(input.recurrenceType, input.recurrenceConfig);
    const sortOrder = input.sortOrder ?? this.listHabits(userId, true).length + 1;
    this.transaction(() => {
      this.db.prepare(`insert into habits (
        id, user_id, category_id, title, description, recurrence_type, recurrence_config, target_quantity, target_unit,
        start_date, end_date, is_active, is_archived, sort_order, reminder_enabled, reminder_time, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?)`).run(
        id, userId, input.categoryId, input.title, input.description, input.recurrenceType, JSON.stringify(config),
        input.targetQuantity, input.targetUnit, input.startDate, input.endDate, sortOrder,
        Number(input.reminderEnabled), input.reminderTime, timestamp, timestamp,
      );
      this.insertVersion(userId, id, input.startDate, null, this.snapshotFrom(input, config));
    });
    return this.getHabit(userId, id)!;
  }

  updateHabit(userId: string, id: string, input: Partial<HabitRecord>, today: string): HabitRecord {
    const current = this.getHabit(userId, id);
    if (!current) throw new AppError("Habit not found.", "not_found", 404);
    if (input.categoryId) this.assertCategoryOwner(userId, input.categoryId);
    const next: HabitRecord = {
      ...current,
      ...input,
      id: current.id,
      userId,
      recurrenceConfig: normalizeSchedule(input.recurrenceType ?? current.recurrenceType, input.recurrenceConfig ?? current.recurrenceConfig),
    };
    const scheduleChanged = JSON.stringify({
      type: current.recurrenceType,
      config: current.recurrenceConfig,
      start: current.startDate,
      end: current.endDate,
    }) !== JSON.stringify({
      type: next.recurrenceType,
      config: next.recurrenceConfig,
      start: next.startDate,
      end: next.endDate,
    });
    this.transaction(() => {
      this.db.prepare(`update habits set category_id = ?, title = ?, description = ?, recurrence_type = ?, recurrence_config = ?,
        target_quantity = ?, target_unit = ?, start_date = ?, end_date = ?, reminder_enabled = ?, reminder_time = ?, updated_at = ?
        where id = ? and user_id = ?`).run(
        next.categoryId, next.title, next.description, next.recurrenceType, JSON.stringify(next.recurrenceConfig),
        next.targetQuantity, next.targetUnit, next.startDate, next.endDate, Number(next.reminderEnabled), next.reminderTime,
        nowIso(), id, userId,
      );
      if (scheduleChanged) this.splitVersion(userId, next, today);
      else this.rewriteOpenVersionMeta(userId, next);
    });
    return this.getHabit(userId, id)!;
  }

  archiveHabit(userId: string, id: string, today: string): void {
    const habit = this.getHabit(userId, id);
    if (!habit) throw new AppError("Habit not found.", "not_found", 404);
    this.transaction(() => {
      this.db.prepare("update habits set is_archived = 1, is_active = 0, updated_at = ? where id = ? and user_id = ?").run(nowIso(), id, userId);
      const open = this.db.prepare("select * from habit_schedule_versions where habit_id = ? and effective_until is null order by effective_from desc limit 1").get(id) as Row | undefined;
      if (!open) return;
      if (String(open.effective_from) < today) {
        this.db.prepare("update habit_schedule_versions set effective_until = ? where id = ?").run(addDays(today, -1), String(open.id));
      } else {
        this.db.prepare("delete from habit_schedule_versions where id = ?").run(String(open.id));
      }
    });
  }

  restoreHabit(userId: string, id: string, today: string): void {
    const habit = this.getHabit(userId, id);
    if (!habit) throw new AppError("Habit not found.", "not_found", 404);
    this.transaction(() => {
      this.db.prepare("update habits set is_archived = 0, is_active = 1, updated_at = ? where id = ? and user_id = ?").run(nowIso(), id, userId);
      const restored = this.getHabit(userId, id)!;
      this.insertVersion(userId, id, today, null, this.snapshotFrom(restored, restored.recurrenceConfig));
    });
  }

  deleteHabit(userId: string, id: string): void {
    const result = this.db.prepare("delete from habits where id = ? and user_id = ?").run(id, userId);
    if (result.changes === 0) throw new AppError("Habit not found.", "not_found", 404);
  }

  reorderHabits(userId: string, orderedIds: string[]): void {
    this.transaction(() => {
      orderedIds.forEach((id, index) => {
        this.db.prepare("update habits set sort_order = ?, updated_at = ? where id = ? and user_id = ?").run(index + 1, nowIso(), id, userId);
      });
    });
  }

  materialize(userId: string, from: string, to: string, today: string): number {
    const end = to < today ? to : today;
    if (from > end) return 0;
    const versions = this.listVersions(userId);
    let created = 0;
    this.transaction(() => {
      for (const date of eachDate(from, end)) {
        for (const version of versions) {
          if (!versionCovers(version.effectiveFrom, version.effectiveUntil, date)) continue;
          if (!isScheduledOn(version.schedule, date)) continue;
          const snapshot = {
            title: version.schedule.title,
            categoryId: version.schedule.categoryId,
            recurrenceType: version.schedule.recurrenceType,
            recurrenceConfig: version.schedule.recurrenceConfig,
            targetQuantity: version.schedule.targetQuantity,
            targetUnit: version.schedule.targetUnit,
          };
          const result = this.db.prepare(`insert into habit_occurrences (
            id, user_id, habit_id, schedule_version_id, occurrence_date, occurrence_snapshot, status, quantity, note, completed_at, created_at, updated_at
          ) values (?, ?, ?, ?, ?, ?, 'pending', null, null, null, ?, ?)
          on conflict(habit_id, occurrence_date) do nothing`).run(
            randomId(), userId, version.habitId, version.id, date, JSON.stringify(snapshot), nowIso(), nowIso(),
          );
          created += Number(result.changes);
        }
      }
    });
    return created;
  }

  listOccurrences(userId: string, from: string, to: string): OccurrenceRecord[] {
    return (this.db.prepare(
      "select * from habit_occurrences where user_id = ? and occurrence_date >= ? and occurrence_date <= ? order by occurrence_date, habit_id",
    ).all(userId, from, to) as Row[]).map(mapOccurrence);
  }

  setOccurrenceStatus(userId: string, occurrenceId: string, status: OccurrenceStatus, today: string, extra?: { quantity?: number | null; note?: string | null }): OccurrenceRecord {
    const row = this.db.prepare("select * from habit_occurrences where id = ? and user_id = ?").get(occurrenceId, userId) as Row | undefined;
    if (!row) throw new AppError("Habit entry not found.", "not_found", 404);
    if (String(row.occurrence_date) > today) throw new AppError("Future days cannot be completed yet.", "future_date");
    const completedAt = status === "completed" ? nowIso() : null;
    const quantity = extra?.quantity === undefined ? (row.quantity == null ? null : Number(row.quantity)) : extra.quantity;
    const note = extra?.note === undefined ? (row.note == null ? null : String(row.note)) : extra.note;
    this.db.prepare("update habit_occurrences set status = ?, quantity = ?, note = ?, completed_at = ?, updated_at = ? where id = ? and user_id = ?").run(
      status,
      quantity,
      note,
      completedAt,
      nowIso(),
      occurrenceId,
      userId,
    );
    return mapOccurrence(this.db.prepare("select * from habit_occurrences where id = ? and user_id = ?").get(occurrenceId, userId) as Row);
  }

  listTasks(userId: string, from?: string, to?: string): TaskRecord[] {
    if (from && to) {
      return (this.db.prepare("select * from daily_tasks where user_id = ? and scheduled_date >= ? and scheduled_date <= ? order by scheduled_date, created_at").all(userId, from, to) as Row[]).map(mapTask);
    }
    return (this.db.prepare("select * from daily_tasks where user_id = ? order by scheduled_date, created_at").all(userId) as Row[]).map(mapTask);
  }

  createTask(userId: string, input: Omit<TaskRecord, "id" | "userId" | "status" | "completedAt" | "createdAt">): TaskRecord {
    this.assertCategoryOwner(userId, input.categoryId);
    const id = randomId();
    const timestamp = nowIso();
    this.db.prepare(`insert into daily_tasks (
      id, user_id, category_id, title, description, priority, scheduled_date, target_time, status, completed_at, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, 'pending', null, ?, ?)`).run(
      id, userId, input.categoryId, input.title, input.description, input.priority, input.scheduledDate, input.targetTime, timestamp, timestamp,
    );
    return this.listTasks(userId).find((task) => task.id === id)!;
  }

  updateTask(userId: string, id: string, input: Partial<Pick<TaskRecord, "title" | "description" | "categoryId" | "priority" | "scheduledDate" | "targetTime">>): TaskRecord {
    const current = this.listTasks(userId).find((task) => task.id === id);
    if (!current) throw new AppError("Task not found.", "not_found", 404);
    if (input.categoryId) this.assertCategoryOwner(userId, input.categoryId);
    this.db.prepare(`update daily_tasks set title = ?, description = ?, category_id = ?, priority = ?, scheduled_date = ?, target_time = ?, updated_at = ?
      where id = ? and user_id = ?`).run(
      input.title ?? current.title,
      input.description === undefined ? current.description : input.description,
      input.categoryId === undefined ? current.categoryId : input.categoryId,
      input.priority ?? current.priority,
      input.scheduledDate ?? current.scheduledDate,
      input.targetTime === undefined ? current.targetTime : input.targetTime,
      nowIso(),
      id,
      userId,
    );
    return this.listTasks(userId).find((task) => task.id === id)!;
  }

  setTaskStatus(userId: string, id: string, status: "pending" | "completed", today: string): TaskRecord {
    const current = this.listTasks(userId).find((task) => task.id === id);
    if (!current) throw new AppError("Task not found.", "not_found", 404);
    if (status === "completed" && current.scheduledDate > today) {
      throw new AppError("Future tasks cannot be completed yet.", "future_date");
    }
    this.db.prepare("update daily_tasks set status = ?, completed_at = ?, updated_at = ? where id = ? and user_id = ?").run(
      status, status === "completed" ? nowIso() : null, nowIso(), id, userId,
    );
    return this.listTasks(userId).find((task) => task.id === id)!;
  }

  deleteTask(userId: string, id: string): void {
    const result = this.db.prepare("delete from daily_tasks where id = ? and user_id = ?").run(id, userId);
    if (result.changes === 0) throw new AppError("Task not found.", "not_found", 404);
  }

  getCheckin(userId: string, localDate: string): CheckinRecord | null {
    const row = this.db.prepare("select * from daily_checkins where user_id = ? and local_date = ?").get(userId, localDate) as Row | undefined;
    return row ? mapCheckin(row) : null;
  }

  countCheckins(userId: string, localDate: string): number {
    const row = this.db.prepare("select count(*) as count from daily_checkins where user_id = ? and local_date = ?").get(userId, localDate) as Row;
    return Number(row.count);
  }

  saveMorning(userId: string, input: {
    localDate: string;
    intention: string | null;
    customIntention: string | null;
    personalCommitment: string | null;
    priorities: Array<{ id?: string; title: string; description?: string | null; categoryId?: string | null; targetTime?: string | null }>;
  }): CheckinRecord {
    if (input.priorities.length > 3) throw new AppError("Choose up to three priorities.", "validation");
    for (const priority of input.priorities) this.assertCategoryOwner(userId, priority.categoryId);
    this.transaction(() => {
      const existing = this.getCheckin(userId, input.localDate);
      const timestamp = nowIso();
      if (!existing) {
        this.db.prepare(`insert into daily_checkins (
          id, user_id, local_date, morning_intention, morning_intention_custom, personal_commitment, morning_completed_at,
          peace_rating, confidence_rating, what_went_well, energy_drainers, tomorrow_adjustment, evening_completed_at, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, null, null, null, null, null, null, ?, ?)`).run(
          randomId(), userId, input.localDate, input.intention, input.customIntention, input.personalCommitment, timestamp, timestamp, timestamp,
        );
      } else {
        this.db.prepare(`update daily_checkins set morning_intention = ?, morning_intention_custom = ?, personal_commitment = ?,
          morning_completed_at = coalesce(morning_completed_at, ?), updated_at = ? where user_id = ? and local_date = ?`).run(
          input.intention, input.customIntention, input.personalCommitment, timestamp, timestamp, userId, input.localDate,
        );
      }
      const current = this.listPriorities(userId, input.localDate);
      const keep = new Set(input.priorities.map((item) => item.id).filter(Boolean));
      for (const priority of current) {
        if (!keep.has(priority.id)) {
          this.db.prepare("delete from daily_priorities where id = ? and user_id = ?").run(priority.id, userId);
        }
      }
      input.priorities.forEach((priority, index) => {
        const previous = priority.id ? current.find((item) => item.id === priority.id) : undefined;
        if (previous) {
          this.db.prepare(`update daily_priorities set title = ?, description = ?, category_id = ?, target_time = ?, sort_order = ?, updated_at = ?
            where id = ? and user_id = ?`).run(
            priority.title, priority.description ?? null, priority.categoryId ?? null, priority.targetTime ?? null, index, nowIso(), previous.id, userId,
          );
        } else {
          this.db.prepare(`insert into daily_priorities (
            id, user_id, local_date, category_id, title, description, target_time, status, completed_at, sort_order, created_at, updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, 'pending', null, ?, ?, ?)`).run(
            randomId(), userId, input.localDate, priority.categoryId ?? null, priority.title, priority.description ?? null, priority.targetTime ?? null, index, nowIso(), nowIso(),
          );
        }
      });
    });
    return this.getCheckin(userId, input.localDate)!;
  }

  saveEvening(userId: string, input: {
    localDate: string;
    peaceRating: number;
    confidenceRating: number;
    whatWentWell: string | null;
    energyDrainers: string | null;
    tomorrowAdjustment: string | null;
  }): CheckinRecord {
    const timestamp = nowIso();
    const existing = this.getCheckin(userId, input.localDate);
    if (!existing) {
      this.db.prepare(`insert into daily_checkins (
        id, user_id, local_date, morning_intention, morning_intention_custom, personal_commitment, morning_completed_at,
        peace_rating, confidence_rating, what_went_well, energy_drainers, tomorrow_adjustment, evening_completed_at, created_at, updated_at
      ) values (?, ?, ?, null, null, null, null, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        randomId(), userId, input.localDate, input.peaceRating, input.confidenceRating, input.whatWentWell, input.energyDrainers, input.tomorrowAdjustment, timestamp, timestamp, timestamp,
      );
    } else {
      this.db.prepare(`update daily_checkins set peace_rating = ?, confidence_rating = ?, what_went_well = ?, energy_drainers = ?,
        tomorrow_adjustment = ?, evening_completed_at = ?, updated_at = ? where user_id = ? and local_date = ?`).run(
        input.peaceRating, input.confidenceRating, input.whatWentWell, input.energyDrainers, input.tomorrowAdjustment, timestamp, timestamp, userId, input.localDate,
      );
    }
    return this.getCheckin(userId, input.localDate)!;
  }

  listPriorities(userId: string, localDate: string): PriorityRecord[] {
    return (this.db.prepare("select * from daily_priorities where user_id = ? and local_date = ? order by sort_order").all(userId, localDate) as Row[]).map(mapPriority);
  }

  listPrioritiesBetween(userId: string, from: string, to: string): PriorityRecord[] {
    return (this.db.prepare("select * from daily_priorities where user_id = ? and local_date >= ? and local_date <= ? order by local_date, sort_order").all(userId, from, to) as Row[]).map(mapPriority);
  }

  setPriorityStatus(userId: string, id: string, status: "pending" | "completed", today: string): PriorityRecord {
    const row = this.db.prepare("select * from daily_priorities where id = ? and user_id = ?").get(id, userId) as Row | undefined;
    if (!row) throw new AppError("Priority not found.", "not_found", 404);
    if (String(row.local_date) > today) throw new AppError("Future priorities cannot be completed yet.", "future_date");
    this.db.prepare("update daily_priorities set status = ?, completed_at = ?, updated_at = ? where id = ? and user_id = ?").run(
      status, status === "completed" ? nowIso() : null, nowIso(), id, userId,
    );
    return mapPriority(this.db.prepare("select * from daily_priorities where id = ?").get(id) as Row);
  }

  listCheckins(userId: string, from: string, to: string): CheckinRecord[] {
    return (this.db.prepare("select * from daily_checkins where user_id = ? and local_date >= ? and local_date <= ? order by local_date").all(userId, from, to) as Row[]).map(mapCheckin);
  }

  listJournal(userId: string, filters: { query?: string; date?: string; categoryId?: string; limit?: number; offset?: number }): JournalRecord[] {
    const clauses = ["user_id = ?"];
    const params: Array<string | number> = [userId];
    if (filters.date) {
      clauses.push("local_date = ?");
      params.push(filters.date);
    }
    if (filters.categoryId) {
      clauses.push("category_id = ?");
      params.push(filters.categoryId);
    }
    if (filters.query) {
      clauses.push("(title like ? or body like ?)");
      const like = `%${filters.query.replaceAll("%", "")}%`;
      params.push(like, like);
    }
    params.push(filters.limit ?? 20, filters.offset ?? 0);
    const sql = `select * from journal_entries where ${clauses.join(" and ")} order by local_date desc, updated_at desc limit ? offset ?`;
    return (this.db.prepare(sql).all(...params) as Row[]).map(mapJournal);
  }

  getJournal(userId: string, id: string): JournalRecord | null {
    const row = this.db.prepare("select * from journal_entries where id = ? and user_id = ?").get(id, userId) as Row | undefined;
    return row ? mapJournal(row) : null;
  }

  saveJournal(userId: string, input: { id?: string; localDate: string; title: string; body: string; categoryId?: string | null; moodTag?: string | null }): JournalRecord {
    if (input.categoryId) this.assertCategoryOwner(userId, input.categoryId);
    const timestamp = nowIso();
    if (input.id) {
      const existing = this.getJournal(userId, input.id);
      if (!existing) throw new AppError("Journal entry not found.", "not_found", 404);
      this.db.prepare("update journal_entries set local_date = ?, title = ?, body = ?, category_id = ?, mood_tag = ?, updated_at = ? where id = ? and user_id = ?").run(
        input.localDate, input.title, input.body, input.categoryId ?? null, input.moodTag ?? null, timestamp, input.id, userId,
      );
      return this.getJournal(userId, input.id)!;
    }
    const id = randomId();
    this.db.prepare("insert into journal_entries (id, user_id, local_date, title, body, category_id, mood_tag, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      id, userId, input.localDate, input.title, input.body, input.categoryId ?? null, input.moodTag ?? null, timestamp, timestamp,
    );
    return this.getJournal(userId, id)!;
  }

  deleteJournal(userId: string, id: string): void {
    const result = this.db.prepare("delete from journal_entries where id = ? and user_id = ?").run(id, userId);
    if (result.changes === 0) throw new AppError("Journal entry not found.", "not_found", 404);
  }

  listReminders(userId: string): ReminderRecord[] {
    return (this.db.prepare("select * from reminder_preferences where user_id = ? order by reminder_type").all(userId) as Row[]).map(mapReminder);
  }

  upsertReminder(userId: string, input: { reminderType: ReminderRecord["reminderType"]; referenceId?: string | null; isEnabled: boolean; reminderTime: string | null }): ReminderRecord {
    const existing = this.listReminders(userId).find((item) => item.reminderType === input.reminderType && item.referenceId === (input.referenceId ?? null));
    const timestamp = nowIso();
    if (existing) {
      this.db.prepare("update reminder_preferences set is_enabled = ?, reminder_time = ?, updated_at = ? where id = ? and user_id = ?").run(
        Number(input.isEnabled), input.reminderTime, timestamp, existing.id, userId,
      );
      return this.listReminders(userId).find((item) => item.id === existing.id)!;
    }
    const id = randomId();
    this.db.prepare("insert into reminder_preferences (id, user_id, reminder_type, reference_id, is_enabled, reminder_time, configuration, created_at, updated_at) values (?, ?, ?, ?, ?, ?, '{}', ?, ?)").run(
      id, userId, input.reminderType, input.referenceId ?? null, Number(input.isEnabled), input.reminderTime, timestamp, timestamp,
    );
    return this.listReminders(userId).find((item) => item.id === id)!;
  }

  exportUser(userId: string): Record<string, unknown> {
    const profile = this.getProfile(userId);
    const user = this.findUserById(userId);
    return {
      exportedAt: nowIso(),
      account: user ? { id: user.id, email: user.email, createdAt: user.createdAt } : null,
      profile,
      categories: this.listCategories(userId, true),
      habits: this.listHabits(userId, true),
      scheduleVersions: this.listVersions(userId),
      occurrences: this.listOccurrences(userId, "1970-01-01", "2999-12-31"),
      tasks: this.listTasks(userId),
      checkins: this.listCheckins(userId, "1970-01-01", "2999-12-31"),
      priorities: this.listPrioritiesBetween(userId, "1970-01-01", "2999-12-31"),
      journal: this.listJournal(userId, { limit: 10000 }),
      reminders: this.listReminders(userId),
    };
  }

  deleteUser(userId: string): void {
    const result = this.db.prepare("delete from users where id = ?").run(userId);
    if (result.changes === 0) throw new AppError("Account not found.", "not_found", 404);
  }

  private listVersions(userId: string): VersionRecord[] {
    return (this.db.prepare("select * from habit_schedule_versions where user_id = ?").all(userId) as Row[]).map(mapVersion);
  }

  private snapshotFrom(habit: Pick<HabitRecord, "title" | "categoryId" | "recurrenceType" | "startDate" | "endDate" | "targetQuantity" | "targetUnit">, config: ScheduleConfig) {
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

  private insertVersion(userId: string, habitId: string, from: string, until: string | null, schedule: ReturnType<SqliteStore["snapshotFrom"]>): void {
    this.db.prepare("insert into habit_schedule_versions (id, habit_id, user_id, effective_from, effective_until, schedule_configuration, created_at) values (?, ?, ?, ?, ?, ?, ?)").run(
      randomId(), habitId, userId, from, until, JSON.stringify(schedule), nowIso(),
    );
  }

  private splitVersion(userId: string, habit: HabitRecord, today: string): void {
    const open = this.db.prepare("select * from habit_schedule_versions where habit_id = ? and user_id = ? and effective_until is null order by effective_from desc limit 1").get(habit.id, userId) as Row | undefined;
    if (open && String(open.effective_from) < today) {
      this.db.prepare("update habit_schedule_versions set effective_until = ? where id = ?").run(addDays(today, -1), String(open.id));
      this.insertVersion(userId, habit.id, today, null, this.snapshotFrom(habit, habit.recurrenceConfig));
      return;
    }
    if (open) {
      this.db.prepare("update habit_schedule_versions set schedule_configuration = ?, effective_from = ? where id = ?").run(
        JSON.stringify(this.snapshotFrom(habit, habit.recurrenceConfig)),
        habit.startDate > today ? habit.startDate : String(open.effective_from),
        String(open.id),
      );
      return;
    }
    this.insertVersion(userId, habit.id, today, null, this.snapshotFrom(habit, habit.recurrenceConfig));
  }

  private rewriteOpenVersionMeta(userId: string, habit: HabitRecord): void {
    const open = this.db.prepare("select * from habit_schedule_versions where habit_id = ? and user_id = ? and effective_until is null order by effective_from desc limit 1").get(habit.id, userId) as Row | undefined;
    if (!open) return;
    this.db.prepare("update habit_schedule_versions set schedule_configuration = ? where id = ?").run(
      JSON.stringify(this.snapshotFrom(habit, habit.recurrenceConfig)),
      String(open.id),
    );
  }
}

function mapUser(row: Row): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    emailVerifiedAt: row.email_verified_at ? String(row.email_verified_at) : null,
    createdAt: String(row.created_at),
  };
}

function mapCategory(row: Row): CategoryRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    icon: String(row.icon),
    color: String(row.color),
    sortOrder: Number(row.sort_order),
    isArchived: bool(row.is_archived),
  };
}

function mapHabit(row: Row): HabitRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    categoryId: row.category_id ? String(row.category_id) : null,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    recurrenceType: String(row.recurrence_type) as RecurrenceType,
    recurrenceConfig: parseJson<ScheduleConfig>(row.recurrence_config, {}),
    targetQuantity: row.target_quantity === null || row.target_quantity === undefined ? null : Number(row.target_quantity),
    targetUnit: row.target_unit ? String(row.target_unit) : null,
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : null,
    isActive: bool(row.is_active),
    isArchived: bool(row.is_archived),
    sortOrder: Number(row.sort_order),
    reminderEnabled: bool(row.reminder_enabled),
    reminderTime: row.reminder_time ? String(row.reminder_time) : null,
  };
}

function mapVersion(row: Row): VersionRecord {
  const schedule = parseJson<VersionRecord["schedule"]>(row.schedule_configuration, {
    title: "",
    categoryId: null,
    recurrenceType: "daily",
    recurrenceConfig: {},
    startDate: String(row.effective_from),
    endDate: null,
    targetQuantity: null,
    targetUnit: null,
  });
  return {
    id: String(row.id),
    habitId: String(row.habit_id),
    userId: String(row.user_id),
    effectiveFrom: String(row.effective_from),
    effectiveUntil: row.effective_until ? String(row.effective_until) : null,
    schedule,
  };
}

function mapOccurrence(row: Row): OccurrenceRecord {
  const snapshot = parseJson<{
    title: string;
    categoryId: string | null;
    recurrenceType: RecurrenceType;
    recurrenceConfig: ScheduleConfig;
    targetQuantity: number | null;
    targetUnit: string | null;
  }>(row.occurrence_snapshot, {
    title: "Habit",
    categoryId: null,
    recurrenceType: "daily",
    recurrenceConfig: {},
    targetQuantity: null,
    targetUnit: null,
  });
  return {
    id: String(row.id),
    userId: String(row.user_id),
    habitId: String(row.habit_id),
    scheduleVersionId: row.schedule_version_id ? String(row.schedule_version_id) : null,
    date: String(row.occurrence_date),
    title: snapshot.title,
    categoryId: snapshot.categoryId,
    recurrenceType: snapshot.recurrenceType,
    recurrenceConfig: snapshot.recurrenceConfig,
    targetQuantity: snapshot.targetQuantity,
    targetUnit: snapshot.targetUnit,
    status: String(row.status) as OccurrenceStatus,
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    note: row.note ? String(row.note) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

function mapTask(row: Row): TaskRecord {
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

function mapCheckin(row: Row): CheckinRecord {
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

function mapPriority(row: Row): PriorityRecord {
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

function mapJournal(row: Row): JournalRecord {
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

function mapReminder(row: Row): ReminderRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    reminderType: String(row.reminder_type) as ReminderRecord["reminderType"],
    referenceId: row.reference_id ? String(row.reference_id) : null,
    isEnabled: bool(row.is_enabled),
    reminderTime: row.reminder_time ? String(row.reminder_time) : null,
    configuration: parseJson(row.configuration, {}),
  };
}

const defaultPath = path.join(process.cwd(), "data", "peace.db");
let singleton: SqliteStore | null = null;

export function openStore(file = defaultPath): SqliteStore {
  if (file === defaultPath && singleton) return singleton;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("pragma foreign_keys = on;");
  db.exec(SCHEMA);
  const store = new SqliteStore(db);
  if (file === defaultPath) singleton = store;
  return store;
}
