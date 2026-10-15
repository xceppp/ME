import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session-cookie";
import { authSecret, dataMode } from "@/lib/config";
import { openStore } from "@/lib/db/sqlite";

export async function POST() {
  if (dataMode() === "supabase") {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  }
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const session = await verifySession(token, authSecret());
      if (session) openStore().deleteSession(session.sid);
    } catch {
      // Clearing the cookie is still the right outcome.
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
