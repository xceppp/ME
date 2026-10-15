import { MorningWizard } from "@/components/client-forms";
import { PageTitle } from "@/components/shell";
import { todayISO } from "@/lib/domain/dates";
import { requireViewer } from "@/lib/session";

export default async function PlanPage() {
  const viewer = await requireViewer();
  const today = todayISO(viewer.profile.timezone);
  const checkin = await viewer.store.getCheckin(viewer.user.id, today);
  const priorities = await viewer.store.listPriorities(viewer.user.id, today);
  const categories = (await viewer.store.listCategories(viewer.user.id)).map((category) => ({ id: category.id, name: category.name }));
  return (
    <>
      <PageTitle title="Plan my day" text="About two quiet minutes. You can come back and edit this plan; it will not create a second check-in." />
      <MorningWizard
        date={today}
        categories={categories}
        initial={{
          intention: checkin?.morningIntention ?? "",
          custom: checkin?.morningIntentionCustom ?? "",
          commitment: checkin?.personalCommitment ?? "",
          priorities: priorities.map((priority) => ({
            id: priority.id,
            title: priority.title,
            description: priority.description ?? "",
            categoryId: priority.categoryId ?? "",
            targetTime: priority.targetTime ?? "",
          })),
        }}
      />
    </>
  );
}
