import { NextResponse } from "next/server";
import { z } from "zod";
import { dataMode } from "@/lib/config";
import { openStore } from "@/lib/db/sqlite";
import { formatZodError, passwordSchema } from "@/lib/domain/validation";

const schema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    if (dataMode() === "supabase") {
      const { createSupabaseServer } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServer();
      const { error } = await supabase.auth.updateUser({ password: body.password });
      if (error) return NextResponse.json({ ok: false, error: "The reset link is invalid or expired." }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    const store = openStore();
    const userId = store.consumeAuthToken(body.token, "reset_password");
    if (!userId) return NextResponse.json({ ok: false, error: "The reset link is invalid or expired." }, { status: 400 });
    store.updatePassword(userId, body.password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ ok: false, error: formatZodError(error) }, { status: 400 });
    console.error("[peace-mode] reset");
    return NextResponse.json({ ok: false, error: "We couldn't reset the password." }, { status: 500 });
  }
}
