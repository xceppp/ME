import "server-only";
import { redirect } from "next/navigation";
import { dataMode } from "./config";
import type { DataStore } from "./db/data-store";
import { openStore, type ProfileRecord, type UserRecord } from "./db/sqlite";
import { ensureLocalOwner } from "./local-owner";

export type Viewer = {
  user: UserRecord;
  profile: ProfileRecord;
  store: DataStore;
  sessionId: string;
};

export async function getViewer(): Promise<Viewer | null> {
  if (dataMode() === "supabase") {
    const { getSupabaseViewer } = await import("./supabase/viewer");
    return getSupabaseViewer();
  }
  const owner = ensureLocalOwner();
  return { user: owner.user, profile: owner.profile, store: openStore(), sessionId: "local" };
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/home");
  return viewer;
}
