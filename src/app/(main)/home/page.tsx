import Link from "next/link";
import { Dumbbell, Leaf, Shield, Sparkles, Target } from "lucide-react";
import { PriorityToggle } from "@/components/client-forms";
import { Meter, PageTitle } from "@/components/shell";
import { formatLongDate, greeting, isInQuietHours, localMinutes, todayISO } from "@/lib/domain/dates";
import { messageForDate } from "@/lib/domain/defaults";
import { buildStreak, categoryCards, commitmentSummary, loadSpan } from "@/lib/services/history";
import { requireViewer } from "@/lib/session";

const icons = { shield: Shield, sparkles: Sparkles, dumbbell: Dumbbell, target: Target, leaf: Leaf };

export default async function HomePage() {
  const viewer = await requireViewer();
  const today = todayISO(viewer.profile.timezone);
  const historyFrom = shift(today);
  const span = await loadSpan(viewer.store, viewer.user.id, historyFrom, today, today);
  const todayOccurrences = span.occurrences.filter((item) => item.date === today);
  const todayTasks = span.tasks.filter((item) => item.scheduledDate === today);
  const todayPriorities = span.priorities.filter((item) => item.localDate === today);
  const checkin = span.checkins.find((item) => item.localDate === today) ?? null;
  const summary = commitmentSummary({
    occurrences: todayOccurrences,
    tasks: todayTasks,
    priorities: todayPriorities,
    date: today,
    startOfWeek: viewer.profile.preferences.startOfWeek,
  });
  const cards = categoryCards({
    categories: span.categories,
    occurrences: todayOccurrences,
    tasks: todayTasks,
    priorities: todayPriorities,
    date: today,
    startOfWeek: viewer.profile.preferences.startOfWeek,
  });
  const streak = buildStreak(span.occurrences, today, viewer.profile.preferences.streakThreshold, viewer.profile.preferences.startOfWeek);
  const reminders = await viewer.store.listReminders(viewer.user.id);
  const nowMinutes = localMinutes(viewer.profile.timezone);
  const quiet = isInQuietHours(nowMinutes, viewer.profile.preferences.quietHoursStart, viewer.profile.preferences.quietHoursEnd);
  const due = quiet ? [] : reminders.filter((reminder) => {
    if (!reminder.isEnabled || !reminder.reminderTime) return false;
    const [hour, minute] = reminder.reminderTime.split(":").map(Number);
    const start = (hour ?? 0) * 60 + (minute ?? 0);
    return nowMinutes >= start && nowMinutes < start + 90;
  });
  const status = checkin?.eveningCompletedAt ? "You showed up for yourself today." : checkin?.morningCompletedAt ? "In progress" : "Plan still open";

  return (
    <>
      <PageTitle
        kicker={formatLongDate(today)}
        title={`${greeting(viewer.profile.timezone)}${viewer.profile.displayName ? `, ${viewer.profile.displayName}` : ""}.`}
        text={viewer.profile.preferences.dashboardMission}
      />
      <p className="mb-6 text-sm text-muted">Status: {status}</p>
      {due.length > 0 ? (
        <div className="card mb-4 p-4 text-sm">
          In-app reminder: {due.map((item) => item.reminderType.replaceAll("_", " ")).join(", ")}. Push notifications are not enabled.
        </div>
      ) : null}
      {summary.total === 0 && !checkin ? <p className="card mb-4 p-5">Your next chapter starts with one small action.</p> : null}
      <section className="grid gap-4 md:grid-cols-2">
        <article className="card p-5">
          <h2 className="text-lg">Today&apos;s completion</h2>
          <p className="mt-3 text-2xl">{summary.total === 0 ? "Nothing scheduled yet" : `${summary.completed} of ${summary.total} completed — ${summary.percentage}%`}</p>
          <div className="mt-4"><Meter value={summary.percentage} label="Today's completion" /></div>
          <p className="mt-3 text-sm text-muted">{summary.remaining} remaining. Skipped and not-applicable habits are excluded.</p>
        </article>
        <article className="card p-5">
          <h2 className="text-lg">Daily peace check</h2>
          {checkin?.peaceRating ? <p className="mt-3 text-2xl">{checkin.peaceRating} / 10</p> : <p className="mt-3 text-muted">No peace rating yet. This is a personal note, not an assessment.</p>}
          <Link className="btn btn-ghost mt-4" href="/reflect">Complete check-in</Link>
        </article>
      </section>
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = icons[card.category.icon as keyof typeof icons] ?? Leaf;
          return (
            <Link key={card.category.id} href={`/habits?category=${card.category.id}`} className="card p-4">
              <Icon aria-hidden className="h-4 w-4 text-accent" />
              <h2 className="mt-3 text-[17px]">{card.category.name}</h2>
              <p className="mt-2 text-sm text-muted">{card.total === 0 ? "No items today" : `${card.completed}/${card.total} · ${card.percentage}%`}</p>
              <div className="mt-3"><Meter value={card.percentage} label={`${card.category.name} completion`} /></div>
            </Link>
          );
        })}
      </section>
      <section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="card p-5">
          <h2 className="text-lg">Three main priorities</h2>
          {todayPriorities.length === 0 ? <p className="mt-3 text-sm text-muted">Plan up to three priorities for today.</p> : <ul className="mt-3 space-y-2">{todayPriorities.map((priority) => <li key={priority.id}><PriorityToggle id={priority.id} status={priority.status} title={priority.title} /></li>)}</ul>}
        </article>
        <article className="card p-5">
          <h2 className="text-lg">Daily consistency</h2>
          <p className="mt-3 text-2xl">{streak.current} day{streak.current === 1 ? "" : "s"}</p>
          <p className="mt-3 text-sm leading-6 text-muted">{streak.rule}</p>
        </article>
      </section>
      <section className="mt-4 flex flex-wrap gap-2">
        <Link className="btn btn-primary" href="/plan">Plan My Day</Link>
        <Link className="btn btn-ghost" href="/reflect">Complete Check-in</Link>
        <Link className="btn btn-ghost" href="/today">Add a Goal</Link>
        <Link className="btn btn-ghost" href="/journal">Write Reflection</Link>
        <Link className="btn btn-ghost" href="/analytics">View Insights</Link>
      </section>
      {viewer.profile.preferences.motivationalEnabled ? <p className="mt-6 text-sm text-muted">{messageForDate(today)}</p> : null}
    </>
  );
}

function shift(today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day));
  date.setUTCDate(date.getUTCDate() - 120);
  return date.toISOString().slice(0, 10);
}
