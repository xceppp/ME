import Link from "next/link";
import { AuthPanel } from "@/components/client-forms";

export default function SignupPage() {
  return (
    <main id="content" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-4 text-3xl font-semibold">Create your private space</h1>
      <AuthPanel mode="signup" />
      <p className="mt-4 text-sm text-muted"><Link href="/login">Already have an account</Link></p>
    </main>
  );
}
