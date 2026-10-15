import { EveningForm, HabitStatus, PriorityToggle } from "@/components/client-forms";
import { PageTitle } from "@/components/shell";
import { todayISO } from "@/lib/domain/dates";
import { loadSpan } from "@/lib/services/history";
import { requireViewer } from "@/lib/session";

export default async function ReflectPage() {
  const viewer = await requireViewer();
  const today = todayISO(viewer.profile.timezone);
  const span = await loadSpan(viewer.store, viewer.user.id, today, today, today);
  const checkin = span.checkins.find((item) => item.localDate === today);
  const completedHabits = span.occurrences.filter((item) => item.status === "completed");
  const openHabits = span.occurrences.filter((item) => item.status === "pending");
  const completedTasks = span.tasks.filter((item) => item.status === "completed");
  return (
    <>
      <PageTitle title="Close my day" text="A short reflection. Unfinished work stays where it is, and a difficult day is still a day you recorded." />
      <section className="card mb-4 space-y-2 p-4 text-sm">
        <p>Intention: {checkin?.morningIntentionCustom || checkin?.morningIntention || "Not set"}</p>
        <p>Commitment: {checkin?.personalCommitment || "Not set"}</p>
        <p>Completed habits: {completedHabits.map((item) => item.title).join(", ") || "None yet"}</p>
        <p>Completed tasks: {completedTasks.map((item) => item.title).join(", ") || "None yet"}</p>
        <p>Remaining: {openHabits.map((item) => item.title).join(", ") || "None"}</p>
        <ul className="space-y-2">{span.priorities.map((priority) => <li key={priority.id}><PriorityToggle id={priority.id} status={priority.status} title={priority.title} /></li>)}</ul>
        {openHabits.slice(0, 3).map((habit) => <HabitStatus key={habit.id} id={habit.id} status={habit.status} />)}
      </section>
      <EveningForm date={today} initial={{ peace: checkin?.peaceRating ?? 5, confidence: checkin?.confidenceRating ?? 5, well: checkin?.whatWentWell ?? "", drain: checkin?.energyDrainers ?? "", tomorrow: checkin?.tomorrowAdjustment ?? "", closed: Boolean(checkin?.eveningCompletedAt) }} />
    </>
  );
}
