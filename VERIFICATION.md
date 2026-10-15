# PEACE MODE verification

Checked on 15 October 2026 in this workspace. Nothing here was deployed.

## Executed

- `npx tsc --noEmit` passed after the fixes below.
- `npx next lint` passed with no warnings or errors.
- `npx vitest run` passed: 2 files, 20 tests.
- `npx next build` passed on Next.js 15.5.28.
- Production server smoke test on `http://127.0.0.1:3456`:
  - Landing and login pages returned 200.
  - `/home` without a session redirected (307).
  - Signup succeeded.
  - A wrong password returned 401.
  - Sign-in set a session cookie.
  - `/api/local-date` returned `2026-10-15` for `Africa/Casablanca`.
  - A new account was redirected to `/onboarding` (200), which includes the welcome copy.
  - Manifest and service worker returned 200.
  - The onboarding HTML did not contain a service-role key.

## Tests cover

- Casablanca local dates and a New York daylight-saving transition, using IANA data rather than a fixed offset.
- Weekday recurrence, skipped and not-applicable exclusions, neutral empty days, and the unfinished-today streak rule.
- Weekly targets dropping later pending days from the denominator.
- Insights refusing to invent a result from too little data.
- Rating bounds of 1–10.
- One check-in per day, idempotent occurrence creation, cross-account reads, category ownership, archive and schedule history, task reschedule and delete, export, and account deletion.
- The Supabase migration enables row level security on every private table.
- Client components do not reference `SUPABASE_SERVICE_ROLE_KEY`.

## Not executed

- No browser viewport pass. Browser automation was not available. Layouts are written for 320px and a desktop sidebar, but they were not clicked through in a real browser.
- Playwright end-to-end tests were not added or run.
- The Supabase adapter and its RLS policies were not executed against a live Supabase project. This machine has no Docker, no local Postgres, and no Supabase credentials.
- SMTP email delivery was not sent to a real inbox.
- Push notifications are not implemented. Reminder settings only control in-app banners.
- `npm audit` still reports dependency vulnerabilities (9 high, 3 moderate at install time). Next.js was upgraded from the vulnerable 15.5.4 release to 15.5.28. That does not mean the rest of the tree is clean.

## Known limits

- Default runtime is local SQLite via Node's built-in `node:sqlite`, which prints an experimental warning.
- Offline editing is not supported. The service worker caches icons and the manifest only.
- Historical local dates are kept as recorded if the user changes timezone.
- A successful streak day is at least the configured percentage of eligible habits, default 70%. Skipped and not-applicable habits are excluded. Days with nothing eligible are neutral. Today counts only after it reaches the threshold.
