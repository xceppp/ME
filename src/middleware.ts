import { NextResponse, type NextRequest } from "next/server";
import { dataMode } from "@/lib/config";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (dataMode() === "supabase") {
    const { updateSupabaseSession } = await import("@/lib/supabase/middleware");
    return updateSupabaseSession(request);
  }

  if (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/verify-email") {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|icon.svg|sw.js|manifest.webmanifest).*)"],
};
