import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session-cookie";
import { dataMode } from "@/lib/config";

const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/manifest.webmanifest" || pathname === "/sw.js" || pathname === "/icon.svg" || pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/icons/")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (dataMode() === "supabase") {
    const { updateSupabaseSession } = await import("@/lib/supabase/middleware");
    return updateSupabaseSession(request);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;
  const session = token && secret ? await verifySession(token, secret) : null;

  if (!session && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|icon.svg|sw.js|manifest.webmanifest).*)"],
};
