-- COLLEGE TIMETABLE SUPABASE SETUP
-- Run this entire file in Supabase -> SQL Editor -> New query -> Run.

create extension if not exists pgcrypto;

do $$ begin create type public.user_role as enum ('student','professor','admin'); exception when duplicate_object then null; end $$;

do $$ begin create type public.absence_status as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  created_at timestamptz not null default now()
);
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete set null,
  name text not null,
  year int not null default 1,
  section text,
  student_count int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  building text,
  capacity int not null default 0,
  room_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  role public.user_role not null default 'student',
  department_id uuid references public.departments(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  credits int not null default 0,
  department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.timetable (
  id uuid primary key default gen_random_uuid(),
  day text not null,
  start_time time not null,
  end_time time not null,
  subject_id uuid references public.subjects(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  professor_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.professor_absences (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  absence_date date not null,
  reason text,
  status public.absence_status not null default 'pending',
  created_at timestamptz not null default now()
);
create table if not exists public.substitutions (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid references public.timetable(id) on delete cascade,
  absent_professor_id uuid references public.profiles(id) on delete set null,
  substitute_professor_id uuid references public.profiles(id) on delete set null,
  substitution_date date not null,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  target_role text not null default 'all',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Automatically create a profile after signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email,
          case when new.raw_user_meta_data->>'role' in ('student','professor','admin') then (new.raw_user_meta_data->>'role')::public.user_role else 'student'::public.user_role end)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Helper: current user's role.
create or replace function public.my_role() returns public.user_role language sql stable security definer set search_path=public as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.departments enable row level security;
alter table public.classes enable row level security;
alter table public.classrooms enable row level security;
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.timetable enable row level security;
alter table public.professor_absences enable row level security;
alter table public.substitutions enable row level security;
alter table public.notifications enable row level security;

-- Read access for signed-in users.
drop policy if exists departments_read on public.departments; create policy departments_read on public.departments for select to authenticated using (true);
drop policy if exists classes_read on public.classes; create policy classes_read on public.classes for select to authenticated using (true);
drop policy if exists classrooms_read on public.classrooms; create policy classrooms_read on public.classrooms for select to authenticated using (true);
drop policy if exists subjects_read on public.subjects; create policy subjects_read on public.subjects for select to authenticated using (true);
drop policy if exists timetable_read on public.timetable; create policy timetable_read on public.timetable for select to authenticated using (true);
drop policy if exists notifications_read on public.notifications; create policy notifications_read on public.notifications for select to authenticated using (true);

-- Profiles: users can read profiles; users can update only themselves; admins can manage.
drop policy if exists profiles_read on public.profiles; create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_self_update on public.profiles; create policy profiles_self_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
drop policy if exists profiles_admin_insert on public.profiles; create policy profiles_admin_insert on public.profiles for insert to authenticated with check (public.my_role()='admin');
drop policy if exists profiles_admin_update on public.profiles; create policy profiles_admin_update on public.profiles for update to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');

-- Admin writes for master data.
drop policy if exists classes_admin_write on public.classes; create policy classes_admin_write on public.classes for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');
drop policy if exists classrooms_admin_write on public.classrooms; create policy classrooms_admin_write on public.classrooms for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');
drop policy if exists departments_admin_write on public.departments; create policy departments_admin_write on public.departments for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');
drop policy if exists subjects_admin_write on public.subjects; create policy subjects_admin_write on public.subjects for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');
drop policy if exists timetable_admin_write on public.timetable; create policy timetable_admin_write on public.timetable for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');

-- Absences: professors manage their own; admins manage all.
drop policy if exists absences_read on public.professor_absences; create policy absences_read on public.professor_absences for select to authenticated using (professor_id=auth.uid() or public.my_role()='admin');
drop policy if exists absences_insert on public.professor_absences; create policy absences_insert on public.professor_absences for insert to authenticated with check (professor_id=auth.uid() and public.my_role()='professor');
drop policy if exists absences_admin on public.professor_absences; create policy absences_admin on public.professor_absences for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');

-- Substitutions: authenticated read; admins write.
drop policy if exists substitutions_read on public.substitutions; create policy substitutions_read on public.substitutions for select to authenticated using (true);
drop policy if exists substitutions_admin on public.substitutions; create policy substitutions_admin on public.substitutions for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');

-- Notifications: authenticated read; admins create/update/delete.
drop policy if exists notifications_admin_write on public.notifications; create policy notifications_admin_write on public.notifications for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');

-- Useful sample master data.
insert into public.departments(name,code) values ('Computer Science','CSE'),('Electronics','ECE'),('Mechanical Engineering','ME') on conflict do nothing;
insert into public.classrooms(name,building,capacity,room_type) values ('Room 101','Main Block',60,'Lecture'),('Room 202','Main Block',40,'Lecture'),('Lab 1','Technology Block',35,'Computer Lab') on conflict(name) do nothing;
insert into public.subjects(code,name,credits,department_id)
select 'CS101','Programming Fundamentals',4,id from public.departments where code='CSE' on conflict(code) do nothing;
insert into public.subjects(code,name,credits,department_id)
select 'CS102','Database Systems',4,id from public.departments where code='CSE' on conflict(code) do nothing;

-- IMPORTANT: To make yourself an admin after your first signup, run:
-- update public.profiles set role='admin' where email='YOUR_EMAIL_HERE';
