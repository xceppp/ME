"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card p-6">
      <h1 className="text-xl">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">The last action didn&apos;t finish. Your private notes were not shown here.</p>
      <button className="btn btn-primary mt-4" onClick={reset}>Try again</button>
    </div>
  );
}
