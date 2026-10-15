import type {
  CategoryRecord,
  CheckinRecord,
  HabitRecord,
  JournalRecord,
  OccurrenceRecord,
  PriorityRecord,
  ProfileRecord,
  ReminderRecord,
  TaskRecord,
} from "./sqlite";
import type { OccurrenceStatus } from "../domain/metrics";
import type { Preferences } from "../domain/defaults";

type Maybe<T> = T | Promise<T>;

export type PriorityDraft = {
  id?: string;
  title: string;
  description?: string | null;
  categoryId?: string | null;
  targetTime?: string | null;
};

export interface DataStore {
  getProfile(userId: string): Maybe<ProfileRecord | null>;
  updateProfile(userId: string, input: { displayName?: string; timezone?: string; preferences?: Preferences }): Maybe<ProfileRecord>;
  updatePassword(userId: string, password: string): Maybe<void>;
  listCategories(userId: string, includeArchived?: boolean): Maybe<CategoryRecord[]>;
  createCategory(userId: string, input: { name: string; description?: string | null; icon: string; color: string; sortOrder?: number }): Maybe<CategoryRecord>;
  updateCategory(userId: string, id: string, input: Partial<{ name: string; description: string | null; icon: string; color: string; isArchived: boolean; sortOrder: number }>): Maybe<CategoryRecord>;
  listHabits(userId: string, includeArchived?: boolean): Maybe<HabitRecord[]>;
  getHabit(userId: string, id: string): Maybe<HabitRecord | null>;
  createHabit(userId: string, input: Omit<HabitRecord, "id" | "userId" | "isActive" | "isArchived" | "sortOrder"> & { sortOrder?: number }): Maybe<HabitRecord>;
  updateHabit(userId: string, id: string, input: Partial<HabitRecord>, today: string): Maybe<HabitRecord>;
  archiveHabit(userId: string, id: string, today: string): Maybe<void>;
  restoreHabit(userId: string, id: string, today: string): Maybe<void>;
  deleteHabit(userId: string, id: string): Maybe<void>;
  reorderHabits(userId: string, orderedIds: string[]): Maybe<void>;
  materialize(userId: string, from: string, to: string, today: string): Maybe<number>;
  listOccurrences(userId: string, from: string, to: string): Maybe<OccurrenceRecord[]>;
  setOccurrenceStatus(userId: string, occurrenceId: string, status: OccurrenceStatus, today: string, extra?: { quantity?: number | null; note?: string | null }): Maybe<OccurrenceRecord>;
  listTasks(userId: string, from?: string, to?: string): Maybe<TaskRecord[]>;
  createTask(userId: string, input: Omit<TaskRecord, "id" | "userId" | "status" | "completedAt" | "createdAt">): Maybe<TaskRecord>;
  updateTask(userId: string, id: string, input: Partial<Pick<TaskRecord, "title" | "description" | "categoryId" | "priority" | "scheduledDate" | "targetTime">>): Maybe<TaskRecord>;
  setTaskStatus(userId: string, id: string, status: "pending" | "completed", today: string): Maybe<TaskRecord>;
  deleteTask(userId: string, id: string): Maybe<void>;
  getCheckin(userId: string, localDate: string): Maybe<CheckinRecord | null>;
  countCheckins(userId: string, localDate: string): Maybe<number>;
  saveMorning(userId: string, input: { localDate: string; intention: string | null; customIntention: string | null; personalCommitment: string | null; priorities: PriorityDraft[] }): Maybe<CheckinRecord>;
  saveEvening(userId: string, input: { localDate: string; peaceRating: number; confidenceRating: number; whatWentWell: string | null; energyDrainers: string | null; tomorrowAdjustment: string | null }): Maybe<CheckinRecord>;
  listPriorities(userId: string, localDate: string): Maybe<PriorityRecord[]>;
  listPrioritiesBetween(userId: string, from: string, to: string): Maybe<PriorityRecord[]>;
  setPriorityStatus(userId: string, id: string, status: "pending" | "completed", today: string): Maybe<PriorityRecord>;
  listCheckins(userId: string, from: string, to: string): Maybe<CheckinRecord[]>;
  listJournal(userId: string, filters: { query?: string; date?: string; categoryId?: string; limit?: number; offset?: number }): Maybe<JournalRecord[]>;
  getJournal(userId: string, id: string): Maybe<JournalRecord | null>;
  saveJournal(userId: string, input: { id?: string; localDate: string; title: string; body: string; categoryId?: string | null; moodTag?: string | null }): Maybe<JournalRecord>;
  deleteJournal(userId: string, id: string): Maybe<void>;
  listReminders(userId: string): Maybe<ReminderRecord[]>;
  upsertReminder(userId: string, input: { reminderType: ReminderRecord["reminderType"]; referenceId?: string | null; isEnabled: boolean; reminderTime: string | null }): Maybe<ReminderRecord>;
  exportUser(userId: string): Maybe<Record<string, unknown>>;
  deleteUser(userId: string): Maybe<void>;
}
