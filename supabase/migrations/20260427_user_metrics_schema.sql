-- Decision Engine: user-scoped metrics schema + RLS

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  workspace_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  revenue numeric(14,2) not null check (revenue >= 0),
  customers integer not null check (customers >= 0),
  conversion_rate numeric(6,4) not null check (conversion_rate >= 0 and conversion_rate <= 1),
  churn_rate numeric(6,4) not null check (churn_rate >= 0 and churn_rate <= 1),
  avg_order_value numeric(12,2) not null check (avg_order_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

create index if not exists idx_daily_metrics_user_date
  on public.daily_metrics (user_id, date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_metrics_updated_at on public.daily_metrics;
create trigger trg_daily_metrics_updated_at
before update on public.daily_metrics
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.daily_metrics enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "daily_metrics_select_own" on public.daily_metrics;
create policy "daily_metrics_select_own"
on public.daily_metrics
for select
using (auth.uid() = user_id);

drop policy if exists "daily_metrics_insert_own" on public.daily_metrics;
create policy "daily_metrics_insert_own"
on public.daily_metrics
for insert
with check (auth.uid() = user_id);

drop policy if exists "daily_metrics_update_own" on public.daily_metrics;
create policy "daily_metrics_update_own"
on public.daily_metrics
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "daily_metrics_delete_own" on public.daily_metrics;
create policy "daily_metrics_delete_own"
on public.daily_metrics
for delete
using (auth.uid() = user_id);
