import { addDays, compareDates, weekStart } from "./dates";
import type { RecurrenceType, ScheduleConfig } from "./recurrence";

export type OccurrenceStatus = "pending" | "completed" | "skipped" | "not_applicable";

export type ScoreOccurrence = {
  habitId: string;
  date: string;
  status: OccurrenceStatus;
  recurrenceType: RecurrenceType;
  targetCount: number | null;
  categoryId: string | null;
};

export type DayScore = {
  date: string;
  completed: number;
  eligible: number;
  percentage: number | null;
  outcome: "success" | "below" | "neutral";
};

export type StreakSummary = {
  current: number;
  longest: number;
  threshold: number;
  todayIncluded: boolean;
  rule: string;
};

const EXCLUDED: OccurrenceStatus[] = ["skipped", "not_applicable"];

export function isExcludedStatus(status: OccurrenceStatus): boolean {
  return EXCLUDED.includes(status);
}

/**
 * Eligible occurrences are pending or completed.
 * Skipped (intentional rest) and not applicable are excluded from both sides.
 * Future dates must not be passed in.
 * Weekly habits stop counting on later days once the weekly target is already met
 * and the current day was not itself completed.
 */
export function eligibleOccurrences(items: ScoreOccurrence[], startOfWeek: number): ScoreOccurrence[] {
  const weeklyCompleted = new Map<string, number>();
  const ordered = [...items].sort((a, b) => compareDates(a.date, b.date));
  for (const item of ordered) {
    if (item.recurrenceType !== "weekly" || item.status !== "completed") continue;
    const key = `${item.habitId}:${weekStart(item.date, startOfWeek)}`;
    weeklyCompleted.set(key, (weeklyCompleted.get(key) ?? 0) + 1);
  }

  return ordered.filter((item) => {
    if (isExcludedStatus(item.status)) return false;
    if (item.status !== "pending" && item.status !== "completed") return false;
    if (item.recurrenceType === "weekly" && item.targetCount) {
      const key = `${item.habitId}:${weekStart(item.date, startOfWeek)}`;
      const completed = weeklyCompleted.get(key) ?? 0;
      if (item.status !== "completed" && completed >= item.targetCount) return false;
    }
    return true;
  });
}

export function rate(completed: number, eligible: number): number | null {
  if (eligible <= 0) return null;
  return Math.round((completed / eligible) * 100);
}

export function scoreDay(date: string, items: ScoreOccurrence[], threshold: number, startOfWeek: number): DayScore {
  const eligibleItems = eligibleOccurrences(items.filter((item) => item.date === date), startOfWeek);
  const completed = eligibleItems.filter((item) => item.status === "completed").length;
  const eligible = eligibleItems.length;
  const percentage = rate(completed, eligible);
  let outcome: DayScore["outcome"] = "neutral";
  if (percentage !== null) outcome = percentage >= threshold ? "success" : "below";
  return { date, completed, eligible, percentage, outcome };
}

export function scoreRange(
  dates: string[],
  items: ScoreOccurrence[],
  threshold: number,
  startOfWeek: number,
): DayScore[] {
  return dates.map((date) => scoreDay(date, items, threshold, startOfWeek));
}

export function overallConsistency(days: DayScore[]): { completed: number; eligible: number; percentage: number | null } {
  const completed = days.reduce((sum, day) => sum + day.completed, 0);
  const eligible = days.reduce((sum, day) => sum + day.eligible, 0);
  return { completed, eligible, percentage: rate(completed, eligible) };
}

export function categoryRates(
  items: ScoreOccurrence[],
  startOfWeek: number,
): Map<string, { completed: number; eligible: number; percentage: number | null }> {
  const eligibleItems = eligibleOccurrences(items, startOfWeek);
  const map = new Map<string, { completed: number; eligible: number; percentage: number | null }>();
  for (const item of eligibleItems) {
    const key = item.categoryId ?? "uncategorized";
    const current = map.get(key) ?? { completed: 0, eligible: 0, percentage: null };
    current.eligible += 1;
    if (item.status === "completed") current.completed += 1;
    current.percentage = rate(current.completed, current.eligible);
    map.set(key, current);
  }
  return map;
}

/**
 * Current streak uses completed local dates.
 * Today extends the streak only when it has already reached the threshold.
 * A still-open today does not break the streak.
 * Days with no eligible habits are neutral and are skipped.
 */
export function calculateStreaks(days: DayScore[], today: string, threshold: number): StreakSummary {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const chronological = [...days].sort((a, b) => compareDates(a.date, b.date));

  let longest = 0;
  let run = 0;
  for (const day of chronological) {
    if (day.date > today) continue;
    if (day.outcome === "neutral") continue;
    if (day.outcome === "success") {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  const todayScore = byDate.get(today);
  const todayIncluded = todayScore?.outcome === "success";
  let cursor = todayIncluded ? today : addDays(today, -1);
  let current = 0;
  for (let i = 0; i < 3660; i += 1) {
    const day = byDate.get(cursor);
    if (!day) break;
    if (day.outcome === "neutral") {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (day.outcome === "success") {
      current += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }

  return {
    current,
    longest,
    threshold,
    todayIncluded,
    rule: `A successful day completes at least ${threshold}% of eligible habits. Skipped and not-applicable habits are excluded. Days with nothing eligible are neutral. Today counts only after it reaches the threshold, so an unfinished morning does not break the streak.`,
  };
}

export function weeklyBars(
  days: DayScore[],
  startOfWeek: number,
): { week: string; completed: number; eligible: number }[] {
  const map = new Map<string, { week: string; completed: number; eligible: number }>();
  for (const day of days) {
    const week = weekStart(day.date, startOfWeek);
    const current = map.get(week) ?? { week, completed: 0, eligible: 0 };
    current.completed += day.completed;
    current.eligible += day.eligible;
    map.set(week, current);
  }
  return [...map.values()].sort((a, b) => compareDates(a.week, b.week));
}

export function targetCountFromConfig(type: RecurrenceType, config: ScheduleConfig): number | null {
  if (type !== "weekly") return null;
  return config.targetCount ?? null;
}
