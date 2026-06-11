-- Life Board commercial schema

-- append-only ledger: every purchase or usage is a row
create table if not exists public.credits_ledger (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users(id) on delete cascade,
  delta              integer     not null,          -- positive=purchase  negative=usage
  reason             text        not null,          -- 'purchase' | 'deliberation' | 'admin_grant'
  stripe_payment_id  text,
  created_at         timestamptz not null default now()
);

-- fast balance lookup — sum of all deltas per user
create or replace view public.user_credits as
  select user_id, coalesce(sum(delta), 0)::integer as balance
  from public.credits_ledger
  group by user_id;

-- persisted deliberation sessions
create table if not exists public.sessions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  council_id   text        not null,
  title        text,
  question     text        not null,
  mode         text        not null default 'sequential'
                 check (mode in ('sequential', 'parallel')),
  responses    jsonb       not null default '[]'::jsonb,
  credits_used integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.touch_updated_at();

-- RLS
alter table public.credits_ledger enable row level security;
alter table public.sessions       enable row level security;

create policy "credits_select_own" on public.credits_ledger
  for select using (auth.uid() = user_id);

create policy "sessions_all_own" on public.sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- indexes
create index if not exists credits_ledger_user_id_idx on public.credits_ledger(user_id);
create index if not exists sessions_user_id_idx       on public.sessions(user_id);
create index if not exists sessions_created_at_idx    on public.sessions(created_at desc);

-- grant 10 free credits on every signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.credits_ledger (user_id, delta, reason)
  values (new.id, 10, 'admin_grant');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
