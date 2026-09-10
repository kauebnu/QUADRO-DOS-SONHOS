-- =====================================================================
-- WE DREAM — Quadro dos Sonhos / Lei da Atração
-- Schema inicial: perfis, casais, categorias, sonhos, banco dos sonhos,
-- check-ins do coach, afirmações, conquistas e push notifications.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
do $$ begin
  create type dream_scope as enum ('individual', 'couple');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dream_status as enum ('active', 'realized');
exception when duplicate_object then null; end $$;

do $$ begin
  create type checkin_mood as enum ('otimo', 'bom', 'neutro', 'dificil');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text not null default 'Sonhador(a)',
  avatar_url        text,
  timezone          text not null default 'America/Sao_Paulo',
  notification_hour smallint not null default 8 check (notification_hour between 0 and 23),
  notifications_on  boolean not null default true,
  onboarding_done   boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -------------------------------------------------------------- couples
create table if not exists public.couples (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Nosso Quadro',
  invite_code text not null unique,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id             uuid not null references public.couples(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  -- "botão de seleção": libera TODOS os sonhos individuais para o par
  share_all_individual  boolean not null default false,
  joined_at             timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create unique index if not exists couple_members_one_couple_per_user
  on public.couple_members(user_id);

-- ----------------------------------------------------------- categories
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  emoji      text not null default '✨',
  color      text not null default '#D4AF37',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- --------------------------------------------------------------- dreams
create table if not exists public.dreams (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  couple_id           uuid references public.couples(id) on delete set null,
  scope               dream_scope not null default 'individual',
  share_with_partner  boolean not null default false,
  title               text not null,
  description         text not null default '',
  plan                text not null default '',      -- "projeto de como vai realizar"
  category_id         uuid references public.categories(id) on delete set null,
  image_path          text,                          -- caminho no storage
  date_added          date not null default current_date,
  target_date         date,
  realized_at         date,
  status              dream_status not null default 'active',
  archived            boolean not null default false,
  target_amount       numeric(14,2),                 -- valor do sonho (opcional)
  priority            smallint not null default 2 check (priority between 1 and 3),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists dreams_owner_idx    on public.dreams(owner_id);
create index if not exists dreams_couple_idx   on public.dreams(couple_id);
create index if not exists dreams_status_idx   on public.dreams(status, archived);
create index if not exists dreams_category_idx on public.dreams(category_id);

-- --------------------------------------------- banco dos sonhos (aportes)
create table if not exists public.dream_deposits (
  id          uuid primary key default gen_random_uuid(),
  dream_id    uuid references public.dreams(id) on delete cascade, -- null = cofre geral
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      numeric(14,2) not null,   -- negativo = retirada
  note        text not null default '',
  occurred_on date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists deposits_dream_idx on public.dream_deposits(dream_id);
create index if not exists deposits_user_idx  on public.dream_deposits(user_id);

-- ------------------------------------------------ check-ins diários (coach)
create table if not exists public.daily_checkins (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  day                date not null default current_date,
  mood               checkin_mood not null default 'bom',
  gratitude          text not null default '',
  action_taken       text not null default '',
  visualized_seconds integer not null default 0,
  created_at         timestamptz not null default now(),
  unique (user_id, day)
);

-- ---------------------------------------------------------- afirmações
create table if not exists public.affirmations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------- conquistas
create table if not exists public.user_achievements (
  user_id     uuid not null references auth.users(id) on delete cascade,
  code        text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);

-- ------------------------------------------- incentivos do par no sonho
create table if not exists public.dream_cheers (
  id         uuid primary key default gen_random_uuid(),
  dream_id   uuid not null references public.dreams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists cheers_dream_idx on public.dream_cheers(dream_id);

-- --------------------------------------------------- push notifications
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text not null default '',
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);

create table if not exists public.notification_log (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind    text not null default 'daily',
  title   text not null default '',
  body    text not null default '',
  sent_at timestamptz not null default now()
);

create index if not exists notif_log_user_idx on public.notification_log(user_id, sent_at desc);
