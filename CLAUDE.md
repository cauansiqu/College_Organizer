# College Organizer

A personal college organization app for tracking courses, assignments, due
dates, and priorities. Built with Expo (React Native) with web support, so it
runs on iOS, Android, and in a browser.

**Owner:** Cauan Siqueira — CS student at SIUE. Comfortable with Python,
newer to React Native/JavaScript. Learning as the project is built.

---

## How to work with me on this project

- **Explain the "why," not just the "what."** When suggesting a change,
  briefly say what problem it solves and what the tradeoffs are.
- **Add short comments to new code** so it's understandable later.
- **Point out potential bugs proactively**, including in code I've already
  written — don't just answer the narrow question asked.
- **Verify before claiming something works.** Run `npx tsc --noEmit` and
  `npx expo lint` after changes and report the actual result. Don't say a fix
  works without checking.
- **Keep dependencies minimal.** Don't add a library unless it's genuinely
  necessary and you've explained why.
- **Prefer small, reviewable changes** over large rewrites. I want to
  understand every change that lands in my repo.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Expo (React Native) + Expo Router (file-based routing) |
| Language | TypeScript (strict mode on) |
| Local storage | AsyncStorage (Supabase auth session only — app data lives in Supabase) |
| Backend | Supabase Postgres — courses/assignments/categories, scoped per user via RLS |
| Notifications | `expo-notifications` — local (on-device) scheduled reminders only, mobile only (iOS/Android); no push server |
| Web hosting | Vercel — live at college-organizer-virid.vercel.app (env vars and build config are set in Vercel's dashboard, not in this repo) |
| CI | GitHub Actions (type-check + lint on push to main) |

---

## Commands

```bash
npx expo start          # start dev server
npx expo start -c       # start with cache cleared (needed after env/config changes)
npx tsc --noEmit        # type-check — must pass with zero errors
npx expo lint           # lint — must pass with zero warnings
npx expo export -p web  # production web build (also runs the Node pre-render step)
```

---

## Project structure

```
app/                       Every screen (Expo Router: folder names = routes)
  _layout.tsx              Root layout — tracks the Supabase session and gates
                           (tabs)/course vs (auth) with Stack.Protected
  (auth)/
    _layout.tsx            Auth group layout — header hidden
    index.tsx              Login/signup screen (toggles between the two)
  (tabs)/
    _layout.tsx            The bottom tab bar itself
    index.tsx              HOME tab — dashboard: stats, overdue, due-this-week,
                           high priority, course chips, sign out
    courses.tsx            COURSES tab — list/add/delete courses
    assignments.tsx        ASSIGNMENTS tab — calendar + sortable checklist
    grades.tsx             GRADES tab — per-course weighted averages, letter
                           grades, category management
  course/
    [id].tsx               Course detail screen (dynamic route)

components/
  AssignmentFormModal.tsx  Shared Add/Edit assignment popup (used by BOTH
                           assignments.tsx and course/[id].tsx — edit here once)
  CalendarMonth.tsx        Month grid (wide screens) / 7-day strip (phones)
  DatePickerField.tsx      Due-date input; native picker on mobile, text input on web
  DayListSheet.tsx         Bottom sheet listing a day's assignments, opened by
                           tapping a calendar day
  AssignmentDetailModal.tsx  Single-assignment detail popup (opened from the
                           calendar or day list) — mark complete, edit, delete
  GradeThresholdsModal.tsx  Edit a course's letter-grade cutoffs and manage
                           its weighted grade categories (add/edit/delete)

storage/storage.ts         ALL data reads/writes. Every screen goes through this
                           file — queries Supabase, scoped to the logged-in user.
types/index.ts             Course, Assignment, and Category type definitions
constants/theme.ts         All colors and fonts, defined once
utils/dates.ts             parseLocalDate() — the ONLY correct way to parse dates
utils/alerts.ts            notify() / confirmDestructive() — cross-platform alerts
utils/grades.ts            Grade math — percentage/letter-grade calculation,
                           weighted category averaging
lib/supabase.ts            Supabase client (note: filename is misspelled)
lib/notifications.ts       Due-date reminder scheduling via expo-notifications
                           (mobile only — no-ops on web, see gotcha #10)

supabase/migrations/       Version-controlled schema — source of truth, see gotcha #8
```

---

## Critical gotchas (learned the hard way — don't regress these)

### 1. Never use `Alert.alert()` — it silently does nothing on web
`react-native-web` ships `Alert.alert()` as an empty no-op function. Any
confirm dialog or validation warning using it will fail silently in the
browser. **Always use `notify()` or `confirmDestructive()` from
`utils/alerts.ts`**, which fall back to `window.alert`/`window.confirm` on web.

### 2. Never parse dates with `new Date("YYYY-MM-DD")`
A date-only string is parsed as **UTC midnight**, which shifts back a day in
any timezone behind UTC (all of the US). This caused Home and Assignments to
disagree about whether something was due "today" or "tomorrow."
**Always use `parseLocalDate()` from `utils/dates.ts`.**

### 3. Due dates are stored as `YYYY-MM-DD`, displayed as `MM-DD-YYYY`
Storage format must stay ISO so string sorting (`localeCompare`) and date math
work correctly. `DatePickerField.tsx` converts in both directions at the UI
edge. Don't "simplify" this by storing the display format.

### 4. Env vars must be prefixed `EXPO_PUBLIC_`, not `NEXT_PUBLIC_`
Expo only inlines `EXPO_PUBLIC_*` into the client bundle. `NEXT_PUBLIC_*` is a
Next.js convention and is silently ignored, producing a confusing
"supabaseUrl is required" crash at runtime. The two variables this app
actually needs are `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

### 5. Supabase auth storage must be guarded for server-side rendering
Expo Router pre-renders pages in Node, where `window` doesn't exist. But
AsyncStorage's web implementation calls `window.localStorage` unconditionally,
crashing the build. `lib/supabase.ts` wraps it in an `isServerRender` check —
don't remove that guard.

### 6. Web flex containers need `minHeight: 0` to scroll
A flex child won't shrink below its content size by default in browsers, which
silently disables internal scrolling. The Assignments checklist needs
`minHeight: 0` on both its wrapper and its FlatList.

### 7. `.env` is gitignored — Vercel needs env vars set separately
Because `.env` never reaches GitHub, Vercel can't read it. Supabase vars must
be added in the Vercel project's environment variable settings, then redeployed.

### 8. The database schema is version-controlled — keep it that way
`courses`/`assignments` were originally created by hand in the Supabase
dashboard with nothing checked into git, which let this file's schema block
silently drift from reality (discovered and fixed when migrating `storage.ts`
to Supabase — see `supabase/migrations/`). Every schema change from here on
must go through a new migration file (imperative style: hand-authored
`<timestamp>_description.sql`, run manually via the Supabase SQL editor —
there's no local Supabase instance or linked CLI project). **Never make a
schema change only in the dashboard** — that's exactly how the drift
happened the first time. The schema block below is a summary; the migrations
folder is the source of truth.

### 9. CI pins Node 24 — don't relax it back to a default version
`npm ci` in GitHub Actions failed while `npm install` worked fine locally,
because the CI runner's default Node 20 bundles npm 10, which can't read a
`package-lock.json` written by npm 11 (the version installed locally).
`.github/workflows/CI.yml` pins `node-version: 24` to match the local npm
version — keep the two in sync if either one is upgraded.

### 10. Due-date reminders are local-only and mobile-only, on purpose
`lib/notifications.ts` schedules reminders via `expo-notifications`'
on-device scheduling — there's no push server or service worker involved.
It no-ops entirely on web (`Platform.OS === 'web'`): a true background push
on web would need standing up a push server, which is out of scope for a
personal project, and the Home tab's dashboard already surfaces due-soon
items when the page is open anyway. Don't "fix" the web no-op thinking it's
a bug. Each reminder uses a deterministic identifier
(`` `${assignmentId}-${days}d` ``) instead of a lookup table, so
`cancelAssignmentReminders()` can always cancel-by-id without first checking
what's scheduled — but this also means the app assumes it's the only thing
scheduling local notifications; a future feature that schedules its own
notifications must use different identifiers or it'll collide with these.

---

## Current state

**Working:** courses and assignments CRUD, calendar view, sortable checklist,
priority dots, delete-from-edit-modal, clickable dashboard sections,
independently scrollable checklist, calendar day-list and assignment-detail
popups, dimmed completed assignments on the calendar, login/signup screens
gating the whole app (Supabase Auth, email + password, email confirmation
required on signup), sign out from the Home tab, a Grades tab with per-course
weighted averages/letter grades and category management, and due-date
reminder notifications on mobile (5/3/1 days before, plus due-day morning).

**Data now lives in Supabase Postgres, scoped per user.** `storage.ts` reads
and writes `courses`/`assignments` through the logged-in user's session, and
Row Level Security policies (`auth.uid() = user_id`) enforce that scoping at
the database level, not just in the app. AsyncStorage is now only used for
the Supabase auth session itself (via `lib/supabase.ts`) — it no longer holds
any course/assignment data. Signing in as a different user now correctly
shows that user's own (empty, unless they've added data) courses and
assignments, not anyone else's.

---

## Database schema (Supabase — source of truth is `supabase/migrations/`)

```sql
create table courses (
  id uuid primary key default gen_random_uuid(),
  name varchar not null,
  professor varchar,
  color varchar(7),
  user_id uuid not null references auth.users(id) on delete cascade,
  grade_a_min numeric not null default 90,
  grade_b_min numeric not null default 80,
  grade_c_min numeric not null default 70,
  grade_d_min numeric not null default 60
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete set null,
  title varchar not null,
  due_date date not null,
  priority varchar(6) not null default 'Medium',
  completed boolean not null default false,
  notes text,
  user_id uuid not null references auth.users(id) on delete cascade,
  points_earned numeric,
  points_possible numeric,
  category_id uuid references categories(id) on delete set null
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  name varchar not null,
  weight numeric,
  user_id uuid not null references auth.users(id) on delete cascade
);
```

`assignments.course_id on delete set null` is deliberate: deleting a course
must NOT delete its assignments (the app's own confirmation dialog promises
this). `categories.course_id on delete cascade` is the opposite on purpose —
a category has no meaning without its course.

RLS is enabled on all three tables, with `select`/`insert`/`update`/`delete`
policies scoping every row to `auth.uid() = user_id`.

---

## Roadmap (in order)

1. ~~Clickable "High priority" section~~ — done
2. ~~Show priority in the checklist~~ — done
3. ~~Scrollable checklist~~ — done
4. ~~Dim completed assignments on the calendar (lighter course color)~~ — done
5. ~~Calendar event preview popup (Google Calendar style)~~ — done
6. ~~Login/signup screens (Supabase Auth)~~ — done
7. ~~Migrate `storage.ts` to Supabase (add `user_id` + RLS + `grade` column)~~ — done
8. ~~Grades page (per-assignment grades, computed course averages)~~ — done
9. ~~Due-date notifications (3 days / 1 day before)~~ — done
10. Full visual redesign pass (do this LAST, once all screens exist)
