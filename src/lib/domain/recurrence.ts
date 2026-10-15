import { isoWeekday } from "./dates";

export type RecurrenceType = "daily" | "weekdays" | "weekly" | "once";

export type ScheduleConfig = {
  days?: number[];
  targetCount?: number;
  date?: string;
};

export type ScheduleSnapshot = {
  recurrenceType: RecurrenceType;
  recurrenceConfig: ScheduleConfig;
  startDate: string;
  endDate: string | null;
};

const TYPES: RecurrenceType[] = ["daily", "weekdays", "weekly", "once"];

export function isRecurrenceType(value: string): value is RecurrenceType {
  return TYPES.includes(value as RecurrenceType);
}

export function normalizeSchedule(type: RecurrenceType, config: ScheduleConfig): ScheduleConfig {
  const days = [...new Set((config.days ?? []).filter((day) => day >= 1 && day <= 7))].sort();
  if (type === "weekdays") {
    return { days };
  }
  if (type === "weekly") {
    const fallback = days.length > 0 ? days.length : 3;
    const targetCount = Math.min(7, Math.max(1, Math.round(config.targetCount ?? fallback)));
    return days.length ? { days, targetCount } : { targetCount };
  }
  if (type === "once") {
    return { date: config.date };
  }
  return {};
}

export function isDateInRange(dateISO: string, startDate: string, endDate: string | null): boolean {
  if (dateISO < startDate) return false;
  if (endDate && dateISO > endDate) return false;
  return true;
}

export function isScheduledOn(schedule: ScheduleSnapshot, dateISO: string): boolean {
  if (!isDateInRange(dateISO, schedule.startDate, schedule.endDate)) return false;
  const config = schedule.recurrenceConfig;
  const weekday = isoWeekday(dateISO);
  switch (schedule.recurrenceType) {
    case "daily":
      return true;
    case "weekdays":
      return (config.days ?? []).includes(weekday);
    case "weekly":
      if (config.days && config.days.length > 0) return config.days.includes(weekday);
      return true;
    case "once":
      return config.date === dateISO;
    default:
      return false;
  }
}

export function versionCovers(effectiveFrom: string, effectiveUntil: string | null, dateISO: string): boolean {
  if (dateISO < effectiveFrom) return false;
  if (effectiveUntil && dateISO > effectiveUntil) return false;
  return true;
}
