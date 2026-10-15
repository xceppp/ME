import Link from "next/link";
import { TrendChart, WeekChart } from "@/components/charts";
import { PageTitle } from "@/components/shell";
import { addDays, todayISO } from "@/lib/domain/dates";
import { analyticsModel, loadSpan } from "@/lib/services/history";
import { requireViewer } from "@/lib/session";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const today = todayISO(viewer.profile.timezone);
  const range = params.range === "30" || params.range === "90" || params.range === "custom" ? params.range : "7";
  let from = addDays(today, range === "30" ? -29 : range === "90" ? -89 : -6);
  let to = today;
  if (range === "custom" && params.from && params.to && params.from <= params.to) {
    from = params.from;
    to = params.to;
  }
  const span = await loadSpan(viewer.store, viewer.user.id, from, to, today);
  const model = analyticsModel({
    occurrences: span.occurrences,
    checkins: span.checkins,
    categories: span.categories,
    from,
    to,
    today,
    threshold: viewer.profile.preferences.streakThreshold,
    startOfWeek: viewer.profile.preferences.startOfWeek,
  });
  const hasData = model.recordedDays > 0;

  return (
    <>
      <PageTitle title="Insights" text="Numbers describe your records. They do not judge a hard day, and they are not a clinical measure." />
      <div className="mb-4 flex flex-wrap gap-2">
        {["7", "30", "90"].map((value) => <Link key={value} className="btn btn-ghost" href={`/analytics?range=${value}`} aria-current={range === value ? "page" : undefined}>Last {value} days</Link>)}
      </div>
      <form className="mb-4 flex flex-wrap gap-2" action="/analytics">
        <input type="hidden" name="range" value="custom" />
        <input className="field" type="date" name="from" defaultValue={from} aria-label="From" />
        <input className="field" type="date" name="to" defaultValue={to} aria-label="To" />
        <button className="btn btn-primary">Apply range</button>
      </form>
      {!hasData ? <p className="card p-5">Your patterns will appear as you build your history.</p> : null}
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-4">
          <h2 className="text-lg">Overall consistency</h2>
          <p className="mt-2 text-3xl">{model.consistency.percentage === null ? "–" : `${model.consistency.percentage}%`}</p>
          <p className="mt-2 text-sm text-muted">{model.consistency.completed} completed of {model.consistency.eligible} eligible habit slots. Skipped and not applicable are excluded. Future dates are not in the denominator.</p>
        </article>
        <article className="card p-4">
          <h2 className="text-lg">Streaks</h2>
          <p className="mt-2">Current {model.streaks.current} · Longest {model.streaks.longest}</p>
          <p className="mt-2 text-sm text-muted">{model.streaks.rule}</p>
        </article>
        <article className="card p-4 lg:col-span-2">
          <h2 className="mb-3 text-lg">Category performance</h2>
          <ul className="space-y-2 text-sm">{model.categories.map((category) => <li key={category.id} className="flex justify-between gap-3"><span>{category.name}</span><span>{category.percentage === null ? "No eligible habits" : `${category.completed}/${category.eligible} · ${category.percentage}%`}</span></li>)}</ul>
        </article>
        <article className="card p-4"><h2 className="mb-3 text-lg">Peace trend</h2><TrendChart data={model.peace.map((point) => ({ date: point.date.slice(5), value: point.value! }))} label="Peace" /></article>
        <article className="card p-4"><h2 className="mb-3 text-lg">Confidence trend</h2><TrendChart data={model.confidence.map((point) => ({ date: point.date.slice(5), value: point.value! }))} label="Confidence" /></article>
        <article className="card p-4 lg:col-span-2"><h2 className="mb-3 text-lg">Weekly habit completion</h2><WeekChart data={model.weeks} /></article>
      </section>
      <section className="card mt-4 p-4">
        <h2 className="text-lg">Activity</h2>
        <div className="mt-3 flex flex-wrap gap-1" aria-label="Daily activity">
          {model.scores.map((day) => <span key={day.date} title={`${day.date}: ${day.percentage ?? "no eligible habits"}`} className="grid h-8 w-8 place-items-center rounded text-[10px]" style={{ background: heat(day.percentage) }}>{day.eligible ? day.percentage : "·"}</span>)}
        </div>
      </section>
      <section className="card mt-4 p-4">
        <h2 className="text-lg">Personal insights</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6">{model.insights.map((insight) => <li key={insight.id}>{insight.text}</li>)}</ul>
      </section>
    </>
  );
}

function heat(value: number | null): string {
  if (value === null) return "#121923";
  if (value >= 70) return "#3f6f5d";
  if (value >= 40) return "#2a463c";
  return "#243140";
}
