import { NextResponse } from "next/server";
import { z } from "zod";
import { randomToken } from "@/lib/auth/password";
import { sendEmail } from "@/lib/auth/mail";
import { appUrl, dataMode } from "@/lib/config";
import { openStore } from "@/lib/db/sqlite";
import { emailSchema, formatZodError } from "@/lib/domain/validation";

export async function POST(request: Request) {
  try {
    const body = z.object({ email: emailSchema }).parse(await request.json());
    if (dataMode() === "supabase") {
      const { createSupabaseServer } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServer();
      await supabase.auth.resetPasswordForEmail(body.email, { redirectTo: `${appUrl()}/reset-password` });
      return NextResponse.json({ ok: true });
    }
    const store = openStore();
    if (!store.consumeRateLimit(`reset:${body.email.toLowerCase()}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Too many attempts. Please wait and try again." }, { status: 429 });
    }
    const user = store.findUserByEmail(body.email);
    let devLink: string | undefined;
    if (user) {
      const token = randomToken();
      store.createAuthToken(user.id, "reset_password", token, new Date(Date.now() + 1000 * 60 * 30).toISOString());
      const url = `${appUrl()}/reset-password?token=${token}`;
      const sent = await sendEmail(user.email, "Reset your PEACE MODE password", `Reset your password: ${url}`);
      if (!sent && process.env.NODE_ENV !== "production") devLink = url;
    }
    return NextResponse.json({ ok: true, devLink });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ ok: false, error: formatZodError(error) }, { status: 400 });
    console.error("[peace-mode] forgot");
    return NextResponse.json({ ok: false, error: "We couldn't start the reset." }, { status: 500 });
  }
}
