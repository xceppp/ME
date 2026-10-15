import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { addDays, isInQuietHours, localDateISO, todayISO } from "../src/lib/domain/dates";
import { isScheduledOn, type ScheduleSnapshot } from "../src/lib/domain/recurrence";
import { calculateStreaks, eligibleOccurrences, scoreDay, type ScoreOccurrence } from "../src/lib/domain/metrics";
import { buildInsights } from "../src/lib/domain/insights";
import { eveningSchema } from "../src/lib/domain/validation";

describe("timezone boundaries", () => {
  it("uses the Africa/Casablanca calendar date rather than a hardcoded offset", () => {
    const zone = "Africa/Casablanca";
    const sample = new Date("2026-01-15T23:30:00.000Z");
    const expected = DateTime.fromJSDate(sample, { zone: "utc" }).setZone(zone).toISODate();
    expect(localDateISO(sample, zone)).toBe(expected);
    expect(localDateISO(sample, zone)).toBe("2026-01-16");
  });

  it("keeps the correct local date across a daylight-saving transition", () => {
    const before = localDateISO(new Date("2026-03-08T06:30:00.000Z"), "America/New_York");
    const after = localDateISO(new Date("2026-03-08T07:30:00.000Z"), "America/New_York");
    expect(before).toBe("2026-03-08");
    expect(after).toBe("2026-03-08");
    const beforeLocal = DateTime.fromISO("2026-03-08T06:30:00.000Z").setZone("America/New_York");
    const afterLocal = DateTime.fromISO("2026-03-08T07:30:00.000Z").setZone("America/New_York");
    expect(afterLocal.hour - beforeLocal.hour).toBe(2);
  });

  it("rolls the visible day after local midnight", () => {
    expect(todayISO("Africa/Casablanca", new Date("2026-04-01T22:30:00.000Z"))).toBe("2026-04-01");
    expect(todayISO("Africa/Casablanca", new Date("2026-04-01T23:30:00.000Z"))).toBe("2026-04-02");
  });
});

describe("recurrence", () => {
  const base: ScheduleSnapshot = {
    recurrenceType: "weekdays",
    recurrenceConfig: { days: [1, 3, 5] },
    startDate: "2026-04-01",
    endDate: null,
  };
  it("schedules only selected weekdays", () => {
    expect(isScheduledOn(base, "2026-04-06")).toBe(true);
    expect(isScheduledOn(base, "2026-04-07")).toBe(false);
  });
  it("respects an end date", () => {
    expect(isScheduledOn({ ...base, endDate: "2026-04-05" }, "2026-04-06")).toBe(false);
  });
});

describe("metrics", () => {
  const items: ScoreOccurrence[] = [
    { habitId: "a", date: "2026-04-01", status: "completed", recurrenceType: "daily", targetCount: null, categoryId: "c" },
    { habitId: "b", date: "2026-04-01", status: "skipped", recurrenceType: "daily", targetCount: null, categoryId: "c" },
    { habitId: "c", date: "2026-04-01", status: "not_applicable", recurrenceType: "daily", targetCount: null, categoryId: "c" },
    { habitId: "d", date: "2026-04-01", status: "pending", recurrenceType: "daily", targetCount: null, categoryId: "c" },
  ];
  it("excludes skipped and not applicable from the denominator", () => {
    const score = scoreDay("2026-04-01", items, 70, 1);
    expect(score.eligible).toBe(2);
    expect(score.completed).toBe(1);
    expect(score.percentage).toBe(50);
    expect(score.outcome).toBe("below");
  });
  it("treats a day with no eligible habits as neutral", () => {
    const score = scoreDay("2026-04-02", [], 70, 1);
    expect(score.outcome).toBe("neutral");
  });
  it("does not break the current streak on an unfinished today", () => {
    const days = [
      scoreDay("2026-04-01", [{ habitId: "a", date: "2026-04-01", status: "completed", recurrenceType: "daily", targetCount: null, categoryId: null }], 70, 1),
      scoreDay("2026-04-02", [{ habitId: "a", date: "2026-04-02", status: "pending", recurrenceType: "daily", targetCount: null, categoryId: null }], 70, 1),
    ];
    expect(calculateStreaks(days, "2026-04-02", 70).current).toBe(1);
    expect(calculateStreaks(days, "2026-04-02", 70).todayIncluded).toBe(false);
  });
  it("stops counting a weekly habit after its target is met", () => {
    const weekly: ScoreOccurrence[] = [
      { habitId: "w", date: "2026-04-06", status: "completed", recurrenceType: "weekly", targetCount: 1, categoryId: null },
      { habitId: "w", date: "2026-04-07", status: "pending", recurrenceType: "weekly", targetCount: 1, categoryId: null },
    ];
    expect(eligibleOccurrences(weekly, 1).map((item) => item.date)).toEqual(["2026-04-06"]);
  });
});

describe("insights and validation", () => {
  it("does not invent an insight without enough observations", () => {
    expect(buildInsights([{ date: "2026-04-01", peace: 8, confidence: null, reflected: true, habitCompletion: 80 }])[0]?.text)
      .toBe("Keep recording your days to unlock meaningful insights.");
  });
  it("rejects peace ratings outside 1 to 10", () => {
    expect(eveningSchema.safeParse({ localDate: "2026-04-01", peaceRating: 0, confidenceRating: 5, whatWentWell: "", energyDrainers: "", tomorrowAdjustment: "" }).success).toBe(false);
    expect(eveningSchema.safeParse({ localDate: "2026-04-01", peaceRating: 11, confidenceRating: 5 }).success).toBe(false);
  });
});

describe("quiet hours", () => {
  it("wraps overnight quiet hours", () => {
    expect(isInQuietHours(23 * 60, "22:00", "07:00")).toBe(true);
    expect(isInQuietHours(12 * 60, "22:00", "07:00")).toBe(false);
  });
  it("moves a date backward", () => {
    expect(addDays("2026-04-01", -1)).toBe("2026-03-31");
  });
});
