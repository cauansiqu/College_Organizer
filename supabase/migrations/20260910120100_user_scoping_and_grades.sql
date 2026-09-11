-- Scopes courses/assignments to their owning user, adds the RLS policies
-- that were missing (RLS itself was already on as of the baseline), and
-- lays down schema for the upcoming Grades page and assignment categories
-- (both unused by the app until those features ship).
--
-- STEP 1 CLEARS EXISTING DATA. Existing rows predate any user_id column
-- and would become permanently invisible under the new RLS policies below
-- (auth.uid() = user_id can never match a null user_id). Starting fresh is
-- intentional here -- confirm this is still wanted before running this
-- file against the live database.

delete from assignments;
delete from courses;

-- --- Ownership ---

alter table courses
  add column user_id uuid not null references auth.users(id) on delete cascade;

alter table assignments
  add column user_id uuid not null references auth.users(id) on delete cascade;

create index courses_user_id_idx on courses(user_id);
create index assignments_user_id_idx on assignments(user_id);

-- --- RLS policies (RLS already enabled by the baseline migration) ---

create policy "Users can view own courses" on courses
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own courses" on courses
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own courses" on courses
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own courses" on courses
  for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can view own assignments" on assignments
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own assignments" on assignments
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own assignments" on assignments
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own assignments" on assignments
  for delete to authenticated
  using (auth.uid() = user_id);

-- --- Grades (schema only -- no UI reads/writes these yet) ---

alter table assignments
  add column points_earned numeric,
  add column points_possible numeric;

alter table courses
  add column grade_a_min numeric not null default 90,
  add column grade_b_min numeric not null default 80,
  add column grade_c_min numeric not null default 70,
  add column grade_d_min numeric not null default 60;

-- --- Categories (schema only -- no UI reads/writes these yet) ---

create table categories (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  name varchar not null,
  weight numeric,
  user_id uuid not null references auth.users(id) on delete cascade
);

create index categories_course_id_idx on categories(course_id);
create index categories_user_id_idx on categories(user_id);

alter table categories enable row level security;

create policy "Users can view own categories" on categories
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own categories" on categories
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own categories" on categories
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own categories" on categories
  for delete to authenticated
  using (auth.uid() = user_id);

alter table assignments
  add column category_id uuid references categories(id) on delete set null;

create index assignments_category_id_idx on assignments(category_id);
