import { NextResponse } from "next/server";
import { todayISO } from "@/lib/domain/dates";
import { getViewer } from "@/lib/session";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, date: todayISO(viewer.profile.timezone), timeZone: viewer.profile.timezone });
}
