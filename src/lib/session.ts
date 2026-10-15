import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "./auth/session-cookie";
import { authSecret, dataMode } from "./config";
import type { DataStore } from "./db/data-store";
import { openStore, type ProfileRecord, type UserRecord } from "./db/sqlite";

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
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let payload: Awaited<ReturnType<typeof verifySession>>;
  try {
    payload = await verifySession(token, authSecret());
  } catch {
    return null;
  }
  if (!payload) return null;
  const store = openStore();
  if (!store.sessionIsActive(payload.sid, payload.uid)) return null;
  const user = store.findUserById(payload.uid);
  const profile = store.getProfile(payload.uid);
  if (!user || !profile) return null;
  return { user, profile, store, sessionId: payload.sid };
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}
