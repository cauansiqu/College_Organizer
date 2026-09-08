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
| Local storage | AsyncStorage (currently holds all app data) |
| Backend | Supabase — connected and tested, **not yet storing app data** |
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
  _layout.tsx              Root layout — wraps everything, checks Supabase session
  (tabs)/
    _layout.tsx            The bottom tab bar itself
    index.tsx              HOME tab — dashboard: stats, overdue, due-this-week,
                           high priority, course chips
    courses.tsx            COURSES tab — list/add/delete courses
    assignments.tsx        ASSIGNMENTS tab — calendar + sortable checklist
  course/
    [id].tsx               Course detail screen (dynamic route)

components/
  AssignmentFormModal.tsx  Shared Add/Edit assignment popup (used by BOTH
                           assignments.tsx and course/[id].tsx — edit here once)
  CalendarMonth.tsx        Month grid (wide screens) / 7-day strip (phones)
  DatePickerField.tsx      Due-date input; native picker on mobile, text input on web
  AssignmentCard.tsx       EMPTY, unused — safe to delete
  CourseCard.tsx           EMPTY, unused — safe to delete

storage/storage.ts         ALL data reads/writes. Every screen goes through this
                           file — nothing touches AsyncStorage directly.
types/index.ts             Course and Assignment type definitions
constants/theme.ts         All colors and fonts, defined once
utils/dates.ts             parseLocalDate() — the ONLY correct way to parse dates
utils/alerts.ts            notify() / confirmDestructive() — cross-platform alerts
lib/subapase.ts            Supabase client (note: filename is misspelled)
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
crashing the build. `lib/subapase.ts` wraps it in an `isServerRender` check —
don't remove that guard.

### 6. Web flex containers need `minHeight: 0` to scroll
A flex child won't shrink below its content size by default in browsers, which
silently disables internal scrolling. The Assignments checklist needs
`minHeight: 0` on both its wrapper and its FlatList.

### 7. `.env` is gitignored — Vercel needs env vars set separately
Because `.env` never reaches GitHub, Vercel can't read it. Supabase vars must
be added in the Vercel project's environment variable settings, then redeployed.

### 8. The database schema lives only in Supabase's dashboard, not in this repo
There's no `supabase/` migrations folder or `.sql` file checked into git — the
`courses`/`assignments` tables were created by hand in the Supabase dashboard.
The schema block below is a manual snapshot and can silently drift out of
sync with the real database. If you change the schema, update this file by
hand at the same time.

---

## Current state

**Working:** courses and assignments CRUD, calendar view, sortable checklist,
priority dots, delete-from-edit-modal, clickable dashboard sections,
independently scrollable checklist, Supabase connection (tested, session
returns null since there's no login UI yet).

**Data still lives in AsyncStorage** — meaning it does NOT sync between
devices or browsers. Each browser/device has its own separate copy. This is
the main thing the Supabase migration will fix.

---

## Database schema (Supabase — created, but not yet used by the app)

```sql
create table courses (
  id uuid primary key default gen_random_uuid(),
  name varchar not null,
  professor varchar,
  color varchar(7)
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete set null,
  title varchar not null,
  due_date date not null,
  priority varchar(6) not null default 'Medium',
  completed boolean not null default false,
  notes text
);
```

`on delete set null` is deliberate: deleting a course must NOT delete its
assignments (the app's own confirmation dialog promises this).

**Still to add during migration:** a `user_id` column on both tables, Row
Level Security policies scoping rows to the logged-in user, and a `grade`
column on `assignments` for the planned Grades feature.

---

## Roadmap (in order)

1. ~~Clickable "High priority" section~~ — done
2. ~~Show priority in the checklist~~ — done
3. ~~Scrollable checklist~~ — done
4. Dim completed assignments on the calendar (lighter course color)
5. Calendar event preview popup (Google Calendar style) — `CalendarMonth`
   already accepts an `onDayPress` prop and wires it up on every day cell;
   `assignments.tsx` just never passes a handler yet, so tapping a day
   currently does nothing
6. Login/signup screens (Supabase Auth)
7. Migrate `storage.ts` to Supabase (add `user_id` + RLS + `grade` column)
8. Grades page (per-assignment grades, computed course averages)
9. Due-date notifications (3 days / 1 day before)
10. Full visual redesign pass (do this LAST, once all screens exist)
