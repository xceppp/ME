import Link from "next/link";
import { DeleteTaskButton, HabitStatus, TaskForm, TaskStatus } from "@/components/client-forms";
import { PageTitle } from "@/components/shell";
import { addDays, formatLongDate, todayISO } from "@/lib/domain/dates";
import { loadSpan } from "@/lib/services/history";
import { requireViewer } from "@/lib/session";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const today = todayISO(viewer.profile.timezone);
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const future = date > today;
  const span = await loadSpan(viewer.store, viewer.user.id, date, date, today);
  const checkin = span.checkins.find((item) => item.localDate === date);
  const occurrences = span.occurrences.filter((item) => item.date === date);
  const tasks = span.tasks.filter((item) => item.scheduledDate === date);
  const categories = span.categories.filter((category) => !category.isArchived).map((category) => ({ id: category.id, name: category.name }));

  return (
    <>
      <PageTitle kicker={future ? "Upcoming" : date === today ? "Today" : "History"} title={formatLongDate(date)} text={future ? "You can look ahead. Completion opens when the day arrives." : "Complete, skip, or mark a habit not applicable. Rest is allowed."} />
      <div className="mb-4 flex gap-2">
        <Link className="btn btn-ghost" href={`/today?date=${addDays(date, -1)}`}>Previous</Link>
        <Link className="btn btn-ghost" href="/today">Today</Link>
        <Link className="btn btn-ghost" href={`/today?date=${addDays(date, 1)}`}>Next</Link>
      </div>
      <section className="card mb-4 p-4 text-sm text-muted">
        <p>Intention: {checkin?.morningIntentionCustom || checkin?.morningIntention || "Not set"}</p>
        <p className="mt-1">Peace commitment: {checkin?.personalCommitment || "Not set"}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl">Habits</h2>
        {occurrences.length === 0 ? <p className="text-sm text-muted">No habits are scheduled for this date.</p> : occurrences.map((item) => (
          <article key={item.id} className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px]">{item.title}</h3>
                <p className="text-sm text-muted">{labelStatus(item.status)}{item.targetQuantity ? ` · target ${item.targetQuantity} ${item.targetUnit ?? ""}` : ""}</p>
              </div>
            </div>
            {future ? <p className="text-sm text-muted">Scheduled</p> : <HabitStatus id={item.id} status={item.status} />}
          </article>
        ))}
      </section>
      <section className="mt-6 space-y-3">
        <h2 className="text-xl">Custom tasks</h2>
        {tasks.length === 0 ? <p className="text-sm text-muted">No one-time tasks on this date.</p> : tasks.map((task) => (
          <article key={task.id} className="card space-y-3 p-4">
            <h3 className="text-[17px]">{task.title}</h3>
            {task.description ? <p className="text-sm text-muted">{task.description}</p> : null}
            <p className="text-sm text-muted">{task.priority} priority{task.targetTime ? ` · ${task.targetTime}` : ""} · {task.status}</p>
            <div className="flex flex-wrap gap-2">
              {future ? null : <TaskStatus id={task.id} status={task.status} />}
              <DeleteTaskButton id={task.id} />
            </div>
          </article>
        ))}
        <TaskForm date={date} categories={categories} />
      </section>
    </>
  );
}

function labelStatus(status: string): string {
  if (status === "not_applicable") return "Not applicable";
  if (status === "completed") return "Completed";
  if (status === "skipped") return "Skipped";
  return "Pending";
}
