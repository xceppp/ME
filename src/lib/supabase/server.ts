import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfigured } from "../config";

export async function createSupabaseServer() {
  if (!supabasePublicConfigured()) {
    throw new Error("Supabase URL and anon key are required when DATA_MODE=supabase.");
  }
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(items) {
          try {
            items.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            // Server Components cannot always write cookies. Middleware refreshes the session.
          }
        },
      },
    },
  );
}
