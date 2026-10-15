import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { dataMode } from "@/lib/config";
import { openStore } from "@/lib/db/sqlite";
import { getViewer } from "@/lib/session";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "Sign in again to continue." }, { status: 401 });
  const body = await request.json().catch(() => null) as { password?: string; confirmation?: string } | null;
  if (!body || body.confirmation !== "DELETE") {
    return NextResponse.json({ ok: false, error: "Type DELETE to confirm account deletion." }, { status: 400 });
  }
  try {
    if (dataMode() === "supabase") {
      await viewer.store.deleteUser(viewer.user.id);
    } else {
      const store = openStore();
      const user = store.findUserById(viewer.user.id);
      if (!user || !body.password || !verifyPassword(body.password, user.passwordHash)) {
        return NextResponse.json({ ok: false, error: "The password doesn't match." }, { status: 403 });
      }
      store.deleteUser(viewer.user.id);
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set("pm_session", "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("[peace-mode] delete");
    const message = error instanceof Error ? error.message : "We couldn't delete the account.";
    return NextResponse.json({ ok: false, error: message.includes("service role") ? message : "We couldn't delete the account." }, { status: 500 });
  }
}
