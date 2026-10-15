import { NextResponse } from "next/server";
import { z } from "zod";
import { randomToken } from "@/lib/auth/password";
import { sendEmail } from "@/lib/auth/mail";
import { appUrl, dataMode, smtpConfigured } from "@/lib/config";
import { AppError, openStore } from "@/lib/db/sqlite";
import { emailSchema, formatZodError, passwordSchema } from "@/lib/domain/validation";
import { isValidTimeZone, DEFAULT_TIMEZONE } from "@/lib/domain/dates";

const schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80),
  timezone: z.string().optional(),
});

function clientBucket(request: Request, action: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `${action}:${ip}`;
}

export async function POST(request: Request) {
  try {
    if (dataMode() === "supabase") {
      const body = schema.parse(await request.json());
      const { createSupabaseServer } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServer();
      const { error } = await supabase.auth.signUp({
        email: body.email,
        password: body.password,
        options: {
          emailRedirectTo: `${appUrl()}/verify-email`,
          data: {
            display_name: body.displayName,
            timezone: body.timezone && isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE,
          },
        },
      });
      if (error) return NextResponse.json({ ok: false, error: "We couldn't create the account." }, { status: 400 });
      return NextResponse.json({ ok: true, verification: "email" });
    }

    const body = schema.parse(await request.json());
    const store = openStore();
    if (!store.consumeRateLimit(clientBucket(request, "signup"), 5, 60 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Too many attempts. Please wait and try again." }, { status: 429 });
    }
    const timezone = body.timezone && isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE;
    const user = store.createUser({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      timezone,
    });
    const token = randomToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    store.createAuthToken(user.id, "verify_email", token, expires);
    const verifyUrl = `${appUrl()}/verify-email?token=${token}`;
    const sent = await sendEmail(user.email, "Verify your PEACE MODE email", `Verify your email: ${verifyUrl}`);
    return NextResponse.json({
      ok: true,
      verification: smtpConfigured() && sent ? "email" : "unconfigured",
      devLink: process.env.NODE_ENV !== "production" && !sent ? verifyUrl : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ ok: false, error: formatZodError(error) }, { status: 400 });
    if (error instanceof AppError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("[peace-mode] signup");
    return NextResponse.json({ ok: false, error: "We couldn't create the account." }, { status: 500 });
  }
}
