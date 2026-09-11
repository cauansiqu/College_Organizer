# College Organizer

College Organizer is a personal course and assignment tracker for students
juggling multiple classes, due dates, and priorities — built to actually use
day to day, not just as a demo. It runs on iOS, Android, and the web from one
Expo/React Native codebase.

**Live app:** https://college-organizer-virid.vercel.app

## Tech stack

- **Framework:** Expo (React Native) + Expo Router, file-based routing
- **Language:** TypeScript, strict mode
- **Data:** AsyncStorage locally today; Supabase (Postgres) is connected but
  not yet wired to app data — see [Current status](#current-status)
- **Hosting:** Vercel (web build)
- **CI:** GitHub Actions — type-check + lint on every push/PR to `main`
  [![CI](https://github.com/cauansiqu/College_Organizer/actions/workflows/CI.yml/badge.svg)](https://github.com/cauansiqu/College_Organizer/actions/workflows/CI.yml)

## Running it locally

```bash
git clone https://github.com/cauansiqu/College_Organizer.git
cd College_Organizer
npm install
```

Create a `.env` file in the project root with your Supabase project's
credentials (Project Settings → API in the Supabase dashboard):

```
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

These aren't used for app data yet, but the app connects to Supabase on
startup and will crash without them.

Then start the dev server:

```bash
npx expo start        # prints a QR code + options for iOS/Android/web
npm run web           # or open straight in a browser
npm run ios           # or iOS simulator (macOS only)
npm run android       # or Android emulator
```

## Architecture

```
app/            Screens (Expo Router — folder names become routes)
components/     Shared UI: assignment form modal, calendar, date picker
storage/        storage.ts — the single seam all screens go through for data
types/          Course and Assignment type definitions
utils/          Date parsing and cross-platform alert helpers
lib/            Supabase client
```

The important piece is **`storage/storage.ts`**: every screen reads and
writes course/assignment data exclusively through its exported functions
(`getCourses`, `saveAssignment`, `deleteCourse`, etc.), and it's the only file
that touches AsyncStorage directly. That single seam is what makes the
planned Supabase migration tractable — swapping storage.ts's internals from
AsyncStorage calls to Supabase queries should let every screen keep working
unchanged, since none of them know or care where the data actually lives.

## Current status

**Working:** full CRUD for courses and assignments, a month calendar /
week-strip view with tap-to-preview day and assignment popups, dimmed
completed assignments on the calendar, a checklist sortable by date or
priority, priority indicators, and a dashboard with overdue / due-this-week /
high-priority summaries.

**Known limitations:**
- **Data is local-only.** Everything lives in AsyncStorage, per browser or
  device — there's no sync and no login, so switching devices means starting
  fresh. Supabase is connected (auth works, tables exist) but the app doesn't
  read or write app data to it yet.
- **No automated tests.** Correctness is currently verified by TypeScript's
  type-checker, ESLint, and manual testing.

## What's next

Roughly in order: login/signup screens, migrating `storage.ts` to Supabase
(with row-level security), a grades page, and due-date notifications. Full
roadmap detail is in [`CLAUDE.md`](./CLAUDE.md#roadmap-in-order).

## Contributing / development notes

This is a solo learning project, developed in part with AI pairing (Claude
Code). [`CLAUDE.md`](./CLAUDE.md) has the fuller technical picture: a list of
hard-won gotchas (date parsing, web-only alert bugs, SSR guards, etc.) worth
reading before touching date handling, alerts, or the Supabase client.
