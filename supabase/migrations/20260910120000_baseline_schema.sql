-- Baseline migration: captures the courses/assignments schema exactly as it
-- exists today in the live Supabase project. These tables were originally
-- created by hand in the dashboard (see CLAUDE.md gotcha #8), so nothing
-- about them has ever been version-controlled until now.
--
-- Verified against the live database on 2026-09-10 via information_schema /
-- pg_constraint / pg_policies / pg_class queries before writing this file:
--   - Columns, types, and defaults below match the live tables exactly.
--   - The course_id -> courses(id) ON DELETE SET NULL foreign key matches.
--   - Row Level Security is ALREADY ENABLED on both tables live, but with
--     ZERO policies -- meaning both tables currently deny all access via
--     the REST API to every role. This file captures that real state
--     as-is; the next migration adds the missing policies.

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

alter table courses enable row level security;
alter table assignments enable row level security;
-- No policies yet -- none exist live. With RLS on and no policies, every
-- role is denied by default, which matches production today.
