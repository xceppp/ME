import { AuthPanel } from "@/components/client-forms";

export default function ForgotPage() {
  return (
    <main id="content" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-4 text-3xl font-semibold">Reset password</h1>
      <p className="mb-4 text-sm text-muted">If the email matches an account, we&apos;ll prepare a reset. The response is the same either way.</p>
      <AuthPanel mode="forgot" />
    </main>
  );
}
