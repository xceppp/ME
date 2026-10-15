import { ArchiveCategoryButton, HabitEditor, ReorderHabits } from "@/components/client-forms";
import { PageTitle } from "@/components/shell";
import { todayISO } from "@/lib/domain/dates";
import { requireViewer } from "@/lib/session";

export default async function HabitsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const today = todayISO(viewer.profile.timezone);
  const categories = await viewer.store.listCategories(viewer.user.id, true);
  const habits = (await viewer.store.listHabits(viewer.user.id, true)).filter((habit) => !params.category || habit.categoryId === params.category);
  const activeCategories = categories.filter((category) => !category.isArchived).map((category) => ({ id: category.id, name: category.name }));
  return (
    <>
      <PageTitle title="Habits" text="Reorder, edit, archive, or restore. Past completions keep the schedule they were recorded with." />
      <div className="mb-4"><ReorderHabits ids={habits.filter((habit) => !habit.isArchived).map((habit) => habit.id)} /></div>
      <div className="grid gap-3">
        {habits.map((habit) => (
          <article key={habit.id} className="card p-4">
            <h2 className="text-[17px]">{habit.title}</h2>
            <p className="mt-1 text-sm text-muted">{habit.recurrenceType}{habit.isArchived ? " · archived" : ""} · from {habit.startDate}</p>
          </article>
        ))}
        {habits.length === 0 ? <p>No habits in this view yet.</p> : null}
      </div>
      <div className="mt-6"><HabitEditor categories={activeCategories} today={today} /></div>
      <section className="mt-6 space-y-3">
        <h2 className="text-xl">Categories</h2>
        {categories.map((category) => (
          <article key={category.id} className="card flex items-center justify-between gap-3 p-4">
            <div>
              <h3>{category.name}</h3>
              <p className="text-sm text-muted">{category.description}</p>
            </div>
            <ArchiveCategoryButton id={category.id} archived={category.isArchived} />
          </article>
        ))}
      </section>
    </>
  );
}
