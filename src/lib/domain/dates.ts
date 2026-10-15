import { DateTime } from "luxon";

export const DEFAULT_TIMEZONE = "Africa/Casablanca";

export function isValidTimeZone(zone: string): boolean {
  return DateTime.now().setZone(zone).isValid;
}

export function assertTimeZone(zone: string): string {
  if (!isValidTimeZone(zone)) {
    throw new Error("Invalid timezone");
  }
  return zone;
}

export function zonedDateTime(input: Date | string, timeZone: string): DateTime {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  const dt = input instanceof Date
    ? DateTime.fromJSDate(input, { zone: "utc" }).setZone(zone)
    : DateTime.fromISO(input, { zone: "utc" }).setZone(zone);
  if (!dt.isValid) {
    throw new Error("Invalid date");
  }
  return dt;
}

/** Calendar date in the user's IANA timezone. Never uses a fixed UTC offset. */
export function localDateISO(input: Date | string, timeZone: string): string {
  return zonedDateTime(input, timeZone).toISODate()!;
}

export function todayISO(timeZone: string, now: Date = new Date()): string {
  return localDateISO(now, timeZone);
}

export function addDays(dateISO: string, days: number): string {
  const dt = DateTime.fromISO(dateISO, { zone: "utc" }).plus({ days });
  if (!dt.isValid) throw new Error("Invalid date");
  return dt.toISODate()!;
}

export function compareDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isoWeekday(dateISO: string): number {
  const dt = DateTime.fromISO(dateISO, { zone: "utc" });
  if (!dt.isValid) throw new Error("Invalid date");
  return dt.weekday;
}

export function formatLongDate(dateISO: string): string {
  const dt = DateTime.fromISO(dateISO, { zone: "utc" });
  if (!dt.isValid) return dateISO;
  return dt.toFormat("cccc, d LLLL yyyy");
}

export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

export function greeting(timeZone: string, now: Date = new Date()): string {
  return greetingForHour(zonedDateTime(now, timeZone).hour);
}

export function eachDate(from: string, to: string): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
    if (dates.length > 4000) break;
  }
  return dates;
}

/** Week start date for a local date. startOfWeek is Luxon weekday 1 (Mon) through 7 (Sun). */
export function weekStart(dateISO: string, startOfWeek: number): string {
  const weekday = isoWeekday(dateISO);
  const start = Math.min(7, Math.max(1, startOfWeek));
  const delta = (weekday - start + 7) % 7;
  return addDays(dateISO, -delta);
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = DateTime.fromObject({ year, month, day: 1 }, { zone: "utc" });
  if (!start.isValid) throw new Error("Invalid month");
  return {
    start: start.toISODate()!,
    end: start.endOf("month").toISODate()!,
  };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const dt = DateTime.fromObject({ year, month, day: 1 }, { zone: "utc" }).plus({ months: delta });
  return { year: dt.year, month: dt.month };
}

export function localMinutes(timeZone: string, now: Date = new Date()): number {
  const dt = zonedDateTime(now, timeZone);
  return dt.hour * 60 + dt.minute;
}

export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function isInQuietHours(nowMinutes: number, start: string, end: string): boolean {
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  if (startMin === null || endMin === null) return false;
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMinutes >= startMin && nowMinutes < endMin;
  return nowMinutes >= startMin || nowMinutes < endMin;
}
