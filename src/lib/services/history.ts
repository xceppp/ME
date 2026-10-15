import { addDays, eachDate } from "../domain/dates";
import { buildInsights, type InsightDay } from "../domain/insights";
import {
  calculateStreaks,
  categoryRates,
  eligibleOccurrences,
  overallConsistency,
  scoreRange,
  weeklyBars,
  type ScoreOccurrence,
} from "../domain/metrics";
import type { DataStore } from "../db/data-store";
import type { CategoryRecord, CheckinRecord, OccurrenceRecord, PriorityRecord, TaskRecord } from "../db/sqlite";

export function toScore(item: OccurrenceRecord): ScoreOccurrence {
  return {
    habitId: item.habitId,
    date: item.date,
    status: item.status,
    recurrenceType: item.recurrenceType,
    targetCount: item.recurrenceType === "weekly" ? item.recurrenceConfig.targetCount ?? null : null,
    categoryId: item.categoryId,
  };
}

export async function loadSpan(store: DataStore, userId: string, from: string, to: string, today: string) {
  await store.materialize(userId, from, to, today);
  const [occurrences, tasks, priorities, checkins, categories] = await Promise.all([
    store.listOccurrences(userId, from, to),
    store.listTasks(userId, from, to),
    store.listPrioritiesBetween(userId, from, to),
    store.listCheckins(userId, from, to),
    store.listCategories(userId, true),
  ]);
  return { occurrences, tasks, priorities, checkins, categories };
}

export function clipEnd(to: string, today: string): string {
  return to < today ? to : today;
}

export function dayScores(occurrences: OccurrenceRecord[], from: string, to: string, today: string, threshold: number, startOfWeek: number) {
  const end = clipEnd(to, today);
  const dates = from > end ? [] : eachDate(from, end);
  return scoreRange(dates, occurrences.map(toScore), threshold, startOfWeek);
}

export function commitmentSummary(input: {
  occurrences: OccurrenceRecord[];
  tasks: TaskRecord[];
  priorities: PriorityRecord[];
  date: string;
  startOfWeek: number;
}) {
  const eligible = eligibleOccurrences(input.occurrences.filter((item) => item.date === input.date).map(toScore), input.startOfWeek);
  const tasks = input.tasks.filter((item) => item.scheduledDate === input.date);
  const priorities = input.priorities.filter((item) => item.localDate === input.date);
  const completed = eligible.filter((item) => item.status === "completed").length
    + tasks.filter((item) => item.status === "completed").length
    + priorities.filter((item) => item.status === "completed").length;
  const total = eligible.length + tasks.length + priorities.length;
  const percentage = total === 0 ? null : Math.round((completed / total) * 100);
  return { completed, total, percentage, remaining: total - completed };
}

export function categoryCards(input: {
  categories: CategoryRecord[];
  occurrences: OccurrenceRecord[];
  tasks: TaskRecord[];
  priorities: PriorityRecord[];
  date: string;
  startOfWeek: number;
}) {
  return input.categories.filter((category) => !category.isArchived).map((category) => {
    const summary = commitmentSummary({
      occurrences: input.occurrences.filter((item) => item.categoryId === category.id),
      tasks: input.tasks.filter((item) => item.categoryId === category.id),
      priorities: input.priorities.filter((item) => item.categoryId === category.id),
      date: input.date,
      startOfWeek: input.startOfWeek,
    });
    return { category, ...summary };
  });
}

export function buildStreak(occurrences: OccurrenceRecord[], today: string, threshold: number, startOfWeek: number) {
  const earliest = occurrences.reduce((min, item) => item.date < min ? item.date : min, today);
  const days = dayScores(occurrences, earliest, today, today, threshold, startOfWeek);
  return calculateStreaks(days, today, threshold);
}

export function analyticsModel(input: {
  occurrences: OccurrenceRecord[];
  checkins: CheckinRecord[];
  categories: CategoryRecord[];
  from: string;
  to: string;
  today: string;
  threshold: number;
  startOfWeek: number;
}) {
  const end = clipEnd(input.to, input.today);
  const scores = dayScores(input.occurrences, input.from, input.to, input.today, input.threshold, input.startOfWeek);
  const consistency = overallConsistency(scores);
  const rates = categoryRates(input.occurrences.filter((item) => item.date >= input.from && item.date <= end).map(toScore), input.startOfWeek);
  const categories = input.categories.map((category) => ({
    id: category.id,
    name: category.name,
    ...(rates.get(category.id) ?? { completed: 0, eligible: 0, percentage: null }),
  }));
  const checkinsByDate = new Map(input.checkins.map((item) => [item.localDate, item]));
  const peace = scores.map((day) => ({ date: day.date, value: checkinsByDate.get(day.date)?.peaceRating ?? null }));
  const confidence = scores.map((day) => ({ date: day.date, value: checkinsByDate.get(day.date)?.confidenceRating ?? null }));
  const insightDays: InsightDay[] = scores.map((day) => {
    const checkin = checkinsByDate.get(day.date);
    return {
      date: day.date,
      peace: checkin?.peaceRating ?? null,
      confidence: checkin?.confidenceRating ?? null,
      reflected: Boolean(checkin?.eveningCompletedAt),
      habitCompletion: day.percentage,
    };
  });
  return {
    scores,
    consistency,
    categories,
    peace: peace.filter((point) => point.value !== null),
    confidence: confidence.filter((point) => point.value !== null),
    weeks: weeklyBars(scores, input.startOfWeek),
    streaks: calculateStreaks(scores, input.today, input.threshold),
    insights: buildInsights(insightDays),
    recordedDays: scores.filter((day) => day.eligible > 0 || checkinsByDate.has(day.date)).length,
  };
}

export function shiftRange(today: string, days: number): { from: string; to: string } {
  return { from: addDays(today, -(days - 1)), to: today };
}
