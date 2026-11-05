-- Semester Planner merge, phase 1 (schema only -- no app code reads/writes
-- these yet). Adds course codes, sync metadata on assignments, and four
-- per-user planner tables. RLS on every new table matches the existing
-- auth.uid() = user_id pattern.

-- --- Courses ---

-- Short course code (e.g. 'CS 330'); used to match feed/syllabus items to a course.
alter table courses
  add column code text;

-- --- Assignments: sync metadata ---

alter table assignments
  add column source text not null default 'manual'
    check (source in ('manual', 'moodle', 'blackboard', 'syllabus')),
  add column external_id text,      -- the feed's id; null for manual rows
  add column due_at timestamptz,    -- exact due time; due_date stays the app's date
  add column item_type text
    check (item_type in ('exam', 'project', 'quiz', 'hw', 'reading', 'post', 'lab', 'other'));

-- One row per feed item per user, so re-syncing updates instead of duplicating.
-- A plain (non-partial) constraint on purpose: manual rows have a null
-- external_id and nulls never conflict, and supabase-js upsert(onConflict)
-- can't target a partial index.
alter table assignments
  add constraint assignments_user_id_external_id_key unique (user_id, external_id);

-- --- plan_tasks: the day-by-day plan ---

create table plan_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  assignment_id uuid references assignments(id) on delete set null,
  plan_date date not null,
  title text not null,
  note text,
  sort_order int not null default 0,
  rolled_count int not null default 0,   -- times carried over to a later day
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index plan_tasks_user_id_plan_date_idx on plan_tasks(user_id, plan_date);
create index plan_tasks_course_id_idx on plan_tasks(course_id);
create index plan_tasks_assignment_id_idx on plan_tasks(assignment_id);

-- --- work_shifts: synced work schedule ---

create table work_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'sling',
  unique (user_id, external_id)
);

create index work_shifts_user_id_starts_at_idx on work_shifts(user_id, starts_at);

-- --- planner_changes: activity log shown to the user ---

create table planner_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  happened_at timestamptz not null default now(),
  kind text not null
    check (kind in ('added', 'moved', 'removed', 'shift', 'info', 'syllabus')),
  message text not null
);

create index planner_changes_user_id_happened_at_idx on planner_changes(user_id, happened_at);

-- --- planner_meta: one row per user, last sync/plan timestamps ---

create table planner_meta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coursework_synced_at timestamptz,
  sling_synced_at timestamptz,
  plan_made_at timestamptz
);

-- --- RLS ---

alter table plan_tasks enable row level security;
alter table work_shifts enable row level security;
alter table planner_changes enable row level security;
alter table planner_meta enable row level security;

create policy "Users can view own plan_tasks" on plan_tasks
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own plan_tasks" on plan_tasks
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own plan_tasks" on plan_tasks
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own plan_tasks" on plan_tasks
  for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can view own work_shifts" on work_shifts
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own work_shifts" on work_shifts
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own work_shifts" on work_shifts
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own work_shifts" on work_shifts
  for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can view own planner_changes" on planner_changes
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own planner_changes" on planner_changes
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own planner_changes" on planner_changes
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own planner_changes" on planner_changes
  for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can view own planner_meta" on planner_meta
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own planner_meta" on planner_meta
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own planner_meta" on planner_meta
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own planner_meta" on planner_meta
  for delete to authenticated
  using (auth.uid() = user_id);
