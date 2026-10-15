# PEACE MODE

Private personal growth and daily goals. One person at a time, with accounts kept separate.

**Protect your peace. Build your discipline. Become your best self.**

## What it does

- Email and password accounts, with verification and password reset when email delivery is configured
- Morning planning, habits, one-time tasks, and evening reflection
- Calendar history that stays put when a habit changes
- Analytics, streaks, and cautious insights computed only from saved records
- Private journal, data export, and account deletion
- Installable PWA shell. Offline editing is not supported. The service worker caches only static icons, not private pages

## Local runtime

Docker and a hosted Supabase project are not required to use the app. The default `DATA_MODE=local` stores data in SQLite at `data/peace.db` using Node's built-in database. Passwords are hashed with scrypt. Sessions are HMAC-signed HTTP-only cookies checked again against the session table.

Historical dates are stored as calendar dates. Event timestamps are UTC. The default timezone is `Africa/Casablanca`, resolved with the IANA database, so the app does not assume a permanent UTC offset.

Changing timezone does not rewrite old local dates. New days use the new zone.

### Habit rules

- Every day, selected weekdays, a weekly completion target, or one date
- Statuses: pending, completed, skipped, not applicable
- Consistency counts pending and completed only. Skipped and not applicable are excluded
- A weekly habit stops counting on later days once its weekly target is already met
- A successful day meets your threshold (default 70%). A day with nothing eligible is neutral
- Today extends a streak only after it reaches the threshold, so an open morning does not break it
- Future dates can be viewed and planned. They cannot be completed
- Editing a schedule starts a new version today. Existing occurrence snapshots stay as they were
- Archiving stops future occurrences and keeps history

Peace and confidence ratings are personal notes from 1 to 10. They are not a clinical assessment.

## Setup

```bash
npm install
copy .env.example .env.local
```

Set `AUTH_SECRET` to a long random string. Then:

```bash
npm run dev
```

Open http://localhost:3000.

Without SMTP, local accounts can sign in immediately. In development, verification and reset links are printed in the server log and shown once on the confirmation screen. Set `SMTP_HOST` and `SMTP_FROM` when you want real email. With SMTP configured, sign-in waits for verification.

## Supabase production

1. Create a Supabase project.
2. Run `supabase/migrations/001_init.sql` in the SQL editor or with the Supabase CLI.
3. In Authentication, enable email/password and your site URL.
4. Set:

```
DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_SECRET=
APP_URL=https://your-domain
```

The service role key is server-only and is used for account deletion. Do not expose it to the browser. Row Level Security is enabled on every private table. The anon key still cannot read another user's rows.

The Supabase data adapter is implemented and typechecked. It was not executed against a live project in this environment because no Supabase credentials or local Postgres were available.

## Deploy

The app is a standard Next.js project and can be hosted on Vercel.

- Set the environment variables above
- Do not enable shared caching of authenticated routes
- Push notifications are intentionally not wired. Reminder settings only control in-app banners
- Confirm email delivery in the provider you choose before treating verification as live

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Privacy

There are no public profiles, feeds, or leaderboards. Journal text and reflection answers are not written to application logs. Export downloads a JSON file of your own records. Deletion removes the user and related rows after password confirmation (local mode) or the Supabase admin API (hosted mode).
