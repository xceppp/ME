import { AuthPanel } from "@/components/client-forms";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return (
    <main id="content" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-4 text-3xl font-semibold">Choose a new password</h1>
      {params.token ? <AuthPanel mode="reset" token={params.token} /> : <p>This reset link is missing its token.</p>}
    </main>
  );
}
