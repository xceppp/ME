import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { DayRefresh, InstallHint } from "@/components/theme-sync";
import { todayISO } from "@/lib/domain/dates";
import { requireViewer } from "@/lib/session";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const path = (await headers()).get("x-pathname") ?? "";
  if (!viewer.profile.preferences.onboardingComplete && path !== "/onboarding") redirect("/onboarding");
  if (viewer.profile.preferences.onboardingComplete && path === "/onboarding") redirect("/home");
  return (
    <Shell>
      <DayRefresh date={todayISO(viewer.profile.timezone)} />
      <InstallHint />
      {children}
    </Shell>
  );
}
