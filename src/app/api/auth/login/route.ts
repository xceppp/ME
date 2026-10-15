import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session-cookie";
import { authSecret, dataMode, smtpConfigured } from "@/lib/config";
import { openStore } from "@/lib/db/sqlite";
import { emailSchema, formatZodError, passwordSchema } from "@/lib/domain/validation";

const schema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    if (dataMode() === "supabase") {
      const { createSupabaseServer } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServer();
      const { error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
      if (error) return NextResponse.json({ ok: false, error: "Email or password is incorrect." }, { status: 401 });
      return NextResponse.json({ ok: true });
    }

    const store = openStore();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!store.consumeRateLimit(`login:${ip}:${body.email.toLowerCase()}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Too many attempts. Please wait and try again." }, { status: 429 });
    }
    const user = store.findUserByEmail(body.email);
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return NextResponse.json({ ok: false, error: "Email or password is incorrect." }, { status: 401 });
    }
    if (smtpConfigured() && !user.emailVerifiedAt) {
      return NextResponse.json({ ok: false, error: "Verify your email before signing in." }, { status: 403 });
    }
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const sid = store.createSession(user.id, user.id, expires.toISOString());
    const token = await signSession({ uid: user.id, sid, exp: expires.getTime() }, authSecret());
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(60 * 60 * 24 * 30));
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ ok: false, error: formatZodError(error) }, { status: 400 });
    if (error instanceof Error && error.message.includes("AUTH_SECRET")) {
      return NextResponse.json({ ok: false, error: "The server is missing AUTH_SECRET." }, { status: 500 });
    }
    console.error("[peace-mode] login");
    return NextResponse.json({ ok: false, error: "We couldn't sign you in." }, { status: 500 });
  }
}
