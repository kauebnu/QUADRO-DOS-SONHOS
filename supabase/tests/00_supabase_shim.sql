-- =====================================================================
-- Shim de teste: recria localmente o mínimo do ambiente Supabase
-- (schemas auth/storage, auth.uid(), roles) para validar a migration
-- e as políticas de RLS sem precisar do stack completo.
-- NÃO faz parte do deploy — use só em supabase/tests.
-- =====================================================================

create extension if not exists pgcrypto;

do $$ begin create role anon nologin;                exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin;       exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

grant anon, authenticated, service_role to postgres;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- auth.uid() lê o "sub" dos claims do JWT, igual ao Supabase
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', 'anon');
$$;

-- Storage mínimo
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text not null references storage.buckets(id) on delete cascade,
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)];
$$;

grant usage on schema auth, storage to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant all on storage.objects, storage.buckets to authenticated, service_role;

-- Helpers de teste -----------------------------------------------------

-- Loga como um usuário (simula o JWT do PostgREST)
create or replace function public.test_login(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end;
$$;

-- Cria um usuário como o GoTrue faria (dispara o trigger on_auth_user_created)
create or replace function public.test_signup(p_email text, p_name text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into auth.users (email, raw_user_meta_data)
  values (p_email, jsonb_build_object('display_name', p_name))
  returning id into v_id;
  return v_id;
end;
$$;
