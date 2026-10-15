import Link from "next/link";
import { JournalEditor } from "@/components/client-forms";
import { PageTitle } from "@/components/shell";
import { todayISO } from "@/lib/domain/dates";
import { requireViewer } from "@/lib/session";

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ q?: string; date?: string; category?: string; id?: string }> }) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const today = todayISO(viewer.profile.timezone);
  const categories = await viewer.store.listCategories(viewer.user.id, true);
  const entries = await viewer.store.listJournal(viewer.user.id, {
    query: params.q,
    date: params.date,
    categoryId: params.category,
    limit: 20,
  });
  const selected = params.id ? await viewer.store.getJournal(viewer.user.id, params.id) : null;
  const options = categories.filter((category) => !category.isArchived).map((category) => ({ id: category.id, name: category.name }));
  return (
    <>
      <PageTitle title="Journal" text="A private space for your thoughts." />
      <form className="mb-4 grid gap-2 sm:grid-cols-4" action="/journal">
        <input className="field" name="q" placeholder="Search" defaultValue={params.q} aria-label="Search entries" />
        <input className="field" type="date" name="date" defaultValue={params.date} aria-label="Filter by date" />
        <select className="field" name="category" defaultValue={params.category ?? ""} aria-label="Filter by category"><option value="">All categories</option>{options.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <button className="btn btn-ghost">Filter</button>
      </form>
      <div className="mb-4 space-y-2">
        {entries.length === 0 ? <p className="text-sm text-muted">A private space for your thoughts.</p> : entries.map((entry) => (
          <Link key={entry.id} href={`/journal?id=${entry.id}`} className="card block p-4">
            <p className="text-sm text-muted">{entry.localDate}{entry.moodTag ? ` · ${entry.moodTag}` : ""}</p>
            <h2 className="text-[17px]">{entry.title}</h2>
          </Link>
        ))}
      </div>
      <JournalEditor date={today} categories={options} entry={selected ? { id: selected.id, title: selected.title, body: selected.body, localDate: selected.localDate, categoryId: selected.categoryId ?? "", moodTag: selected.moodTag ?? "" } : undefined} />
    </>
  );
}
