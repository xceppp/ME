import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addDays } from "../src/lib/domain/dates";
import { openStore } from "../src/lib/db/sqlite";

function tempStore() {
  const file = path.join(os.tmpdir(), `peace-${crypto.randomUUID()}.db`);
  return openStore(file);
}

describe("persistence and isolation", () => {
  it("keeps morning planning to one check-in and preserves priorities", () => {
    const store = tempStore();
    const user = store.createUser({ email: "a@example.com", password: "password123", displayName: "A", timezone: "Africa/Casablanca" });
    store.saveMorning(user.id, {
      localDate: "2026-04-02",
      intention: "Calm",
      customIntention: null,
      personalCommitment: "Leave work at work",
      priorities: [{ title: "Write the brief" }, { title: "Walk" }, { title: "Call once" }],
    });
    store.saveMorning(user.id, {
      localDate: "2026-04-02",
      intention: "Focused",
      customIntention: "Steady",
      personalCommitment: "Leave work at work",
      priorities: [{ title: "Write the brief" }],
    });
    expect(store.countCheckins(user.id, "2026-04-02")).toBe(1);
    expect(store.getCheckin(user.id, "2026-04-02")?.morningIntention).toBe("Focused");
    expect(store.listPriorities(user.id, "2026-04-02")).toHaveLength(1);
  });

  it("materializes occurrences once and blocks future completion", () => {
    const store = tempStore();
    const user = store.createUser({ email: "b@example.com", password: "password123", displayName: "B", timezone: "Africa/Casablanca" });
    const category = store.createCategory(user.id, { name: "Fitness", icon: "dumbbell", color: "#C4B48A" });
    const habit = store.createHabit(user.id, {
      title: "Walk",
      description: null,
      categoryId: category.id,
      recurrenceType: "daily",
      recurrenceConfig: {},
      targetQuantity: null,
      targetUnit: null,
      startDate: "2026-04-01",
      endDate: null,
      reminderEnabled: false,
      reminderTime: null,
    });
    expect(store.materialize(user.id, "2026-04-01", "2026-04-03", "2026-04-02")).toBe(2);
    expect(store.materialize(user.id, "2026-04-01", "2026-04-03", "2026-04-02")).toBe(0);
    expect(store.listOccurrences(user.id, "2026-04-01", "2026-04-03")).toHaveLength(2);
    const other = store.createUser({ email: "c@example.com", password: "password123", displayName: "C", timezone: "Africa/Casablanca" });
    expect(store.listOccurrences(other.id, "2026-04-01", "2026-04-03")).toHaveLength(0);
    expect(store.getHabit(other.id, habit.id)).toBeNull();
    expect(() => store.createHabit(other.id, {
      title: "Borrowed",
      description: null,
      categoryId: category.id,
      recurrenceType: "daily",
      recurrenceConfig: {},
      targetQuantity: null,
      targetUnit: null,
      startDate: "2026-04-01",
      endDate: null,
      reminderEnabled: false,
      reminderTime: null,
    })).toThrow(/Category not found/);
  });

  it("preserves history when a habit is archived or its schedule changes", () => {
    const store = tempStore();
    const user = store.createUser({ email: "d@example.com", password: "password123", displayName: "D", timezone: "Africa/Casablanca" });
    const habit = store.createHabit(user.id, {
      title: "Original",
      description: null,
      categoryId: null,
      recurrenceType: "daily",
      recurrenceConfig: {},
      targetQuantity: null,
      targetUnit: null,
      startDate: "2026-04-01",
      endDate: null,
      reminderEnabled: false,
      reminderTime: null,
    });
    store.materialize(user.id, "2026-04-01", "2026-04-02", "2026-04-03");
    const first = store.listOccurrences(user.id, "2026-04-01", "2026-04-01")[0]!;
    store.setOccurrenceStatus(user.id, first.id, "completed", "2026-04-03");
    store.updateHabit(user.id, habit.id, { title: "Renamed", recurrenceType: "weekdays", recurrenceConfig: { days: [1] } }, "2026-04-03");
    expect(store.listOccurrences(user.id, "2026-04-01", "2026-04-01")[0]?.title).toBe("Original");
    expect(store.listOccurrences(user.id, "2026-04-01", "2026-04-01")[0]?.status).toBe("completed");
    store.archiveHabit(user.id, habit.id, "2026-04-04");
    store.materialize(user.id, "2026-04-04", "2026-04-04", "2026-04-04");
    expect(store.listOccurrences(user.id, "2026-04-04", "2026-04-04")).toHaveLength(0);
    expect(store.listOccurrences(user.id, "2026-04-01", "2026-04-01")).toHaveLength(1);
  });

  it("rejects invalid ratings, keeps tasks after reflection, and exports then deletes", () => {
    const store = tempStore();
    const user = store.createUser({ email: "e@example.com", password: "password123", displayName: "E", timezone: "Africa/Casablanca" });
    const task = store.createTask(user.id, { title: "Send note", description: null, categoryId: null, priority: "medium", scheduledDate: "2026-04-02", targetTime: null });
    expect(() => store.saveEvening(user.id, { localDate: "2026-04-02", peaceRating: 12, confidenceRating: 5, whatWentWell: null, energyDrainers: null, tomorrowAdjustment: null })).toThrow();
    store.saveEvening(user.id, { localDate: "2026-04-02", peaceRating: 6, confidenceRating: 7, whatWentWell: "A calm meeting", energyDrainers: null, tomorrowAdjustment: null });
    store.saveEvening(user.id, { localDate: "2026-04-02", peaceRating: 8, confidenceRating: 7, whatWentWell: "Revised", energyDrainers: null, tomorrowAdjustment: null });
    expect(store.countCheckins(user.id, "2026-04-02")).toBe(1);
    expect(store.listTasks(user.id).find((item) => item.id === task.id)?.status).toBe("pending");
    expect(() => store.setOccurrenceStatus(user.id, crypto.randomUUID(), "completed", "2026-04-02")).toThrow();
    const future = store.createTask(user.id, { title: "Later", description: null, categoryId: null, priority: "low", scheduledDate: addDays("2026-04-02", 2), targetTime: null });
    expect(() => store.setTaskStatus(user.id, future.id, "completed", "2026-04-02")).toThrow(/Future/);
    const exported = store.exportUser(user.id);
    expect(JSON.stringify(exported)).toContain("Send note");
    expect(JSON.stringify(exported)).toContain("A calm meeting".replace("A calm meeting", "Revised"));
    store.deleteUser(user.id);
    expect(store.findUserById(user.id)).toBeNull();
    expect(store.listTasks(user.id)).toHaveLength(0);
    expect(store.getJournal(user.id, crypto.randomUUID())).toBeNull();
  });

  it("reschedules a task without removing it", () => {
    const store = tempStore();
    const user = store.createUser({ email: "f@example.com", password: "password123", displayName: "F", timezone: "Africa/Casablanca" });
    const task = store.createTask(user.id, { title: "Errand", description: "Bank", categoryId: null, priority: "high", scheduledDate: "2026-04-02", targetTime: "09:00" });
    store.updateTask(user.id, task.id, { scheduledDate: "2026-04-05", title: "Errand moved" });
    const tasks = store.listTasks(user.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.scheduledDate).toBe("2026-04-05");
    store.deleteTask(user.id, task.id);
    expect(store.listTasks(user.id)).toHaveLength(0);
  });
});

describe("security files", () => {
  it("enables row level security on every private Supabase table", () => {
    const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/001_init.sql"), "utf8");
    const tables = ["profiles", "categories", "habits", "habit_schedule_versions", "habit_occurrences", "daily_tasks", "daily_checkins", "daily_priorities", "journal_entries", "reminder_preferences"];
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`auth.uid() = ${table === "profiles" ? "id" : "user_id"}`);
    }
    expect(sql).not.toContain("service_role");
  });

  it("does not place the service role key in client components", () => {
    const files = walk(path.join(process.cwd(), "src"));
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      if (text.includes('"use client"') || text.includes("'use client'")) {
        expect(text).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
        expect(text).not.toContain("password_hash");
      }
    }
  });
});

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}
