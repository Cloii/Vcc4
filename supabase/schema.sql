-- Supabase schema for VCC (Postgres)
-- Run this in Supabase SQL editor.

-- ── Profiles / roles ─────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text,
  role text not null default 'student' check (role in ('public','student','staff','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    'student'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute procedure public.touch_updated_at();

-- ── Core tables ──────────────────────────────────────────────────────────────
create table if not exists public.buildings (
  id text primary key,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  description text,
  category text not null default 'academic',
  sensitivity_level text not null default 'public' check (sensitivity_level in ('public','student','staff','admin')),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.panoramas (
  id text primary key,
  building_id text not null references public.buildings(id) on delete cascade,
  name text not null,
  image_url text not null,
  hotspots jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists panoramas_building_order_idx
  on public.panoramas (building_id, sort_order, name);

create table if not exists public.paths (
  id text primary key,
  from_building text not null references public.buildings(id) on delete cascade,
  to_building text not null references public.buildings(id) on delete cascade,
  status text not null default 'open',
  accessible boolean not null default true,
  distance double precision not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resources (
  id text primary key,
  name text not null,
  building_id text references public.buildings(id) on delete set null,
  location text,
  contact_info text,
  operating_hours text,
  category text not null default 'services',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id text primary key,
  action text not null,
  user_id uuid references auth.users(id) on delete set null,
  building_id text,
  details jsonb,
  ip_address text,
  timestamp timestamptz not null default now()
);

create table if not exists public.security_alerts (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  description text,
  severity text not null default 'medium',
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  timestamp timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text,
  action text not null,
  resource_type text,
  resource_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  timestamp timestamptz not null default now()
);

create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- touch updated_at triggers
drop trigger if exists buildings_touch_updated_at on public.buildings;
create trigger buildings_touch_updated_at
before update on public.buildings
for each row execute procedure public.touch_updated_at();

drop trigger if exists panoramas_touch_updated_at on public.panoramas;
create trigger panoramas_touch_updated_at
before update on public.panoramas
for each row execute procedure public.touch_updated_at();

drop trigger if exists paths_touch_updated_at on public.paths;
create trigger paths_touch_updated_at
before update on public.paths
for each row execute procedure public.touch_updated_at();

drop trigger if exists resources_touch_updated_at on public.resources;
create trigger resources_touch_updated_at
before update on public.resources
for each row execute procedure public.touch_updated_at();

-- ── Helper: current user role ────────────────────────────────────────────────
create or replace function public.current_role()
returns text
language sql stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'public');
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.buildings enable row level security;
alter table public.panoramas enable row level security;
alter table public.paths enable row level security;
alter table public.resources enable row level security;
alter table public.activity_logs enable row level security;
alter table public.security_alerts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.site_content enable row level security;

-- profiles: user can read own profile, admin/staff can read all
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
using (id = auth.uid() or public.current_role() in ('admin','staff'));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- buildings: public can read public buildings; staff/admin can read all
drop policy if exists "buildings_select" on public.buildings;
create policy "buildings_select"
on public.buildings for select
using (sensitivity_level = 'public' or public.current_role() in ('admin','staff'));

-- buildings write: staff/admin
drop policy if exists "buildings_write_admin_staff" on public.buildings;
create policy "buildings_write_admin_staff"
on public.buildings for all
using (public.current_role() in ('admin','staff'))
with check (public.current_role() in ('admin','staff'));

-- panoramas: same visibility as building
drop policy if exists "panoramas_select" on public.panoramas;
create policy "panoramas_select"
on public.panoramas for select
using (
  exists (
    select 1 from public.buildings b
    where b.id = panoramas.building_id
      and (b.sensitivity_level = 'public' or public.current_role() in ('admin','staff'))
  )
);

drop policy if exists "panoramas_write_admin_staff" on public.panoramas;
create policy "panoramas_write_admin_staff"
on public.panoramas for all
using (public.current_role() in ('admin','staff'))
with check (public.current_role() in ('admin','staff'));

-- paths/resources: public read, staff/admin write
drop policy if exists "paths_select" on public.paths;
create policy "paths_select" on public.paths for select using (true);
drop policy if exists "paths_write_admin_staff" on public.paths;
create policy "paths_write_admin_staff" on public.paths for all
using (public.current_role() in ('admin','staff'))
with check (public.current_role() in ('admin','staff'));

drop policy if exists "resources_select" on public.resources;
create policy "resources_select" on public.resources for select using (true);
drop policy if exists "resources_write_admin_staff" on public.resources;
create policy "resources_write_admin_staff" on public.resources for all
using (public.current_role() in ('admin','staff'))
with check (public.current_role() in ('admin','staff'));

-- site_content: public read, staff/admin write
drop policy if exists "site_content_select" on public.site_content;
create policy "site_content_select" on public.site_content for select using (true);
drop policy if exists "site_content_write_admin_staff" on public.site_content;
create policy "site_content_write_admin_staff" on public.site_content for all
using (public.current_role() in ('admin','staff'))
with check (public.current_role() in ('admin','staff'));

-- logs: insert allowed for authenticated users; select only admin/staff
drop policy if exists "activity_logs_insert_auth" on public.activity_logs;
create policy "activity_logs_insert_auth" on public.activity_logs for insert
with check (auth.uid() is not null);
drop policy if exists "activity_logs_select_admin_staff" on public.activity_logs;
create policy "activity_logs_select_admin_staff" on public.activity_logs for select
using (public.current_role() in ('admin','staff'));

drop policy if exists "audit_logs_select_admin_staff" on public.audit_logs;
create policy "audit_logs_select_admin_staff" on public.audit_logs for select
using (public.current_role() in ('admin','staff'));
drop policy if exists "audit_logs_insert_admin_staff" on public.audit_logs;
create policy "audit_logs_insert_admin_staff" on public.audit_logs for insert
with check (public.current_role() in ('admin','staff'));

drop policy if exists "security_alerts_select_admin_staff" on public.security_alerts;
create policy "security_alerts_select_admin_staff" on public.security_alerts for select
using (public.current_role() in ('admin','staff'));
drop policy if exists "security_alerts_insert_admin_staff" on public.security_alerts;
create policy "security_alerts_insert_admin_staff" on public.security_alerts for insert
with check (public.current_role() in ('admin','staff'));
drop policy if exists "security_alerts_update_admin_staff" on public.security_alerts;
create policy "security_alerts_update_admin_staff" on public.security_alerts for update
using (public.current_role() in ('admin','staff'))
with check (public.current_role() in ('admin','staff'));

