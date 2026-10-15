import Link from "next/link";
import { openStore } from "@/lib/db/sqlite";
import { dataMode } from "@/lib/config";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  let message = "Email verification is handled by your authentication provider.";
  if (dataMode() !== "supabase" && params.token) {
    const store = openStore();
    const userId = store.consumeAuthToken(params.token, "verify_email");
    if (userId) {
      store.markEmailVerified(userId);
      message = "Email verified. You can sign in.";
    } else message = "This verification link is invalid or already used.";
  }
  return (
    <main id="content" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-semibold">Email verification</h1>
      <p className="mt-3 text-muted">{message}</p>
      <Link className="btn btn-primary mt-6" href="/login">Continue to sign in</Link>
    </main>
  );
}
