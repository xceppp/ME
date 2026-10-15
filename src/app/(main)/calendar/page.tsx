import Link from "next/link";
import { PageTitle } from "@/components/shell";
import { DateTime } from "luxon";
import { monthBounds, shiftMonth, todayISO } from "@/lib/domain/dates";
import { dayScores, loadSpan } from "@/lib/services/history";
import { requireViewer } from "@/lib/session";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; date?: string }> }) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const today = todayISO(viewer.profile.timezone);
  const now = DateTime.fromISO(today);
  const year = Number(params.year ?? now.year);
  const month = Number(params.month ?? now.month);
  const bounds = monthBounds(year, month);
  const span = await loadSpan(viewer.store, viewer.user.id, bounds.start, bounds.end, today);
  const scores = dayScores(span.occurrences, bounds.start, bounds.end, today, viewer.profile.preferences.streakThreshold, viewer.profile.preferences.startOfWeek);
  const scoreMap = new Map(scores.map((score) => [score.date, score]));
  const selected = params.date && params.date >= bounds.start && params.date <= bounds.end ? params.date : null;
  const firstWeekday = DateTime.fromISO(bounds.start).weekday;
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const cells = [...Array(firstWeekday - 1).fill(null), ...Array.from({ length: DateTime.fromISO(bounds.end).day }, (_, index) => `${bounds.start.slice(0, 8)}${String(index + 1).padStart(2, "0")}`)];

  return (
    <>
      <PageTitle title="Calendar" text="Each day keeps its own record. Empty days stay empty, and future days cannot be checked off early." />
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link className="btn btn-ghost" href={`/calendar?year=${prev.year}&month=${prev.month}`}>Previous</Link>
        <h2 className="text-lg">{DateTime.fromObject({ year, month }).toFormat("LLLL yyyy")}</h2>
        <Link className="btn btn-ghost" href={`/calendar?year=${next.year}&month=${next.month}`}>Next</Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((date, index) => date ? (
          <Link key={date} href={`/calendar?year=${year}&month=${month}&date=${date}`} className="card flex min-h-16 flex-col items-center justify-center p-1 text-sm" aria-label={`${date}, ${scoreMap.get(date)?.percentage ?? "no"} percent`}>
            <span>{Number(date.slice(8))}</span>
            <span className="text-[11px] text-muted">{scoreMap.get(date)?.eligible ? `${scoreMap.get(date)?.percentage}%` : "–"}</span>
          </Link>
        ) : <span key={`empty-${index}`} />)}
      </div>
      {selected ? <DayDetail date={selected} span={span} today={today} /> : <p className="mt-4 text-sm text-muted">Select a day to see its record.</p>}
    </>
  );
}

function DayDetail({ date, span, today }: { date: string; span: Awaited<ReturnType<typeof loadSpan>>; today: string }) {
  const checkin = span.checkins.find((item) => item.localDate === date);
  const occurrences = span.occurrences.filter((item) => item.date === date);
  const tasks = span.tasks.filter((item) => item.scheduledDate === date);
  return (
    <section className="card mt-4 space-y-2 p-4 text-sm">
      <h2 className="text-lg">{date}{date > today ? " · upcoming" : ""}</h2>
      <p>Morning intention: {checkin?.morningIntentionCustom || checkin?.morningIntention || "None recorded"}</p>
      <p>Peace: {checkin?.peaceRating ?? "Not recorded"} · Confidence: {checkin?.confidenceRating ?? "Not recorded"}</p>
      <p>What went well: {checkin?.whatWentWell || "Not recorded"}</p>
      <p>Energy: {checkin?.energyDrainers || "Not recorded"}</p>
      <p>Tomorrow: {checkin?.tomorrowAdjustment || "Not recorded"}</p>
      <p>Habits: {occurrences.length === 0 ? "None recorded" : occurrences.map((item) => `${item.title} (${item.status})`).join("; ")}</p>
      <p>Tasks: {tasks.length === 0 ? "None" : tasks.map((task) => `${task.title} (${task.status})`).join("; ")}</p>
      <Link className="btn btn-ghost mt-2" href={`/today?date=${date}`}>Open this day</Link>
    </section>
  );
}
