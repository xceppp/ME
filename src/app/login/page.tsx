import Link from "next/link";
import { AuthPanel } from "@/components/client-forms";

export default function LoginPage() {
  return (
    <main id="content" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <p className="mb-6 text-sm text-muted">PEACE MODE</p>
      <h1 className="mb-4 text-3xl font-semibold">Sign in</h1>
      <AuthPanel mode="login" />
      <p className="mt-4 text-sm text-muted"><Link href="/forgot-password">Forgot password</Link> · <Link href="/signup">Create an account</Link></p>
    </main>
  );
}
