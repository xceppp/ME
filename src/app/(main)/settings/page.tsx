import { SettingsPanels } from "@/components/client-forms";
import { PageTitle } from "@/components/shell";
import { requireViewer } from "@/lib/session";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const reminders = await viewer.store.listReminders(viewer.user.id);
  const morning = reminders.find((item) => item.reminderType === "morning_planning");
  const evening = reminders.find((item) => item.reminderType === "evening_reflection");
  return (
    <>
      <PageTitle title="Settings" text="Your preferences stay on this device." />
      <SettingsPanels
        profile={{
          displayName: viewer.profile.displayName,
          email: viewer.user.email,
          timezone: viewer.profile.timezone,
          preferences: viewer.profile.preferences,
        }}
        reminders={{
          morning: { enabled: morning?.isEnabled ?? false, time: morning?.reminderTime ?? "08:00" },
          evening: { enabled: evening?.isEnabled ?? false, time: evening?.reminderTime ?? "21:00" },
        }}
      singleUser
      />
    </>
  );
}
