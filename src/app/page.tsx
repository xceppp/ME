import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";

export default async function LandingPage() {
  const viewer = await getViewer();
  if (viewer) redirect("/home");
  return (
    <main id="content" className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-5 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-accent">PEACE MODE</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Protect your peace. Build your discipline.</h1>
      <p className="mt-4 max-w-xl text-lg leading-8 text-muted">A private place to plan the day, keep healthy boundaries, and see your progress without turning growth into a competition.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="btn btn-primary" href="/signup">Create your space</Link>
        <Link className="btn btn-ghost" href="/login">Sign in</Link>
      </div>
    </main>
  );
}
