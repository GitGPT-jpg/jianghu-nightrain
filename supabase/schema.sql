create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_exp integer not null default 0,
  coins integer not null default 0,
  active_title_id text,
  streak integer not null default 0,
  completed_task_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_snapshots_set_updated_at on public.user_snapshots;
create trigger user_snapshots_set_updated_at
before update on public.user_snapshots
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.user_snapshots enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.user_profiles;
create policy "Profiles are viewable by owner"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Profiles are editable by owner" on public.user_profiles;
create policy "Profiles are editable by owner"
on public.user_profiles
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Snapshots are viewable by owner" on public.user_snapshots;
create policy "Snapshots are viewable by owner"
on public.user_snapshots
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Snapshots are editable by owner" on public.user_snapshots;
create policy "Snapshots are editable by owner"
on public.user_snapshots
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('inspiration', 'inspiration', true)
on conflict (id) do nothing;

drop policy if exists "Public can read inspiration files" on storage.objects;
create policy "Public can read inspiration files"
on storage.objects
for select
to public
using (bucket_id = 'inspiration');

drop policy if exists "Authenticated users can upload inspiration files" on storage.objects;
create policy "Authenticated users can upload inspiration files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'inspiration');

drop policy if exists "Authenticated users can update inspiration files" on storage.objects;
create policy "Authenticated users can update inspiration files"
on storage.objects
for update
to authenticated
using (bucket_id = 'inspiration')
with check (bucket_id = 'inspiration');
