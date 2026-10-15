import { signOut } from "@/app/actions";
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
      <PageTitle title="Settings" text="Preferences stay with your account, so they follow you to another device." />
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
      />
      <form className="mt-6" action={signOut}><button className="btn btn-ghost">Sign out</button></form>
    </>
  );
}
