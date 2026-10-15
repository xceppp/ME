import "server-only";
import type { Viewer } from "../session";

export async function getSupabaseViewer(): Promise<Viewer | null> {
  const { SupabaseStore } = await import("../db/supabase-store");
  const store = await SupabaseStore.connect();
  const session = await store.currentSession();
  if (!session) return null;
  return session;
}
