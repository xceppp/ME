import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "Sign in again to continue." }, { status: 401 });
  const data = await viewer.store.exportUser(viewer.user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=peace-mode-export.json",
      "Cache-Control": "no-store",
    },
  });
}
