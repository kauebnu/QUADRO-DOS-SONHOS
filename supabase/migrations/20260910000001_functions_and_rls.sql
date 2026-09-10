-- =====================================================================
-- WE DREAM — Funções auxiliares, triggers, RLS e Storage
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers (SECURITY DEFINER para evitar recursão nas policies)
-- ---------------------------------------------------------------------

create or replace function public.my_couple_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select couple_id from public.couple_members where user_id = auth.uid() limit 1;
$$;

create or replace function public.partner_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select cm.user_id
    from public.couple_members cm
   where cm.couple_id = public.my_couple_id()
     and cm.user_id <> auth.uid()
   limit 1;
$$;

-- O parceiro `u` liberou todos os sonhos individuais dele para mim?
create or replace function public.partner_shares_all(u uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select cm.share_all_individual
       from public.couple_members cm
      where cm.user_id = u
        and cm.couple_id = public.my_couple_id()
      limit 1),
    false);
$$;

create or replace function public.can_see_dream(d uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.dreams dr
     where dr.id = d
       and (
         dr.owner_id = auth.uid()
         or (
           dr.couple_id is not null
           and dr.couple_id = public.my_couple_id()
           and (
             dr.scope = 'couple'
             or dr.share_with_partner
             or public.partner_shares_all(dr.owner_id)
           )
         )
       )
  );
$$;

-- Código de convite curto e legível (sem caracteres ambíguos)
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.couples c where c.invite_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dreams_touch on public.dreams;
create trigger dreams_touch before update on public.dreams
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Mantém status/realized_at coerentes
create or replace function public.sync_dream_status()
returns trigger
language plpgsql
as $$
begin
  if new.realized_at is not null then
    new.status := 'realized';
  else
    new.status := 'active';
    new.archived := false;
  end if;
  return new;
end;
$$;

drop trigger if exists dreams_sync_status on public.dreams;
create trigger dreams_sync_status before insert or update on public.dreams
  for each row execute function public.sync_dream_status();

-- Novo usuário: cria perfil + categorias padrão
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, emoji, color, sort_order) values
    (new.id, 'Casa',              '🏠', '#D4AF37', 1),
    (new.id, 'Carro',             '🚗', '#C9A227', 2),
    (new.id, 'Viagens',           '✈️', '#E6C767', 3),
    (new.id, 'Prosperidade',      '💰', '#F0D77B', 4),
    (new.id, 'Negócios',          '💼', '#B8912F', 5),
    (new.id, 'Saúde & Corpo',     '💪', '#D9B44A', 6),
    (new.id, 'Amor & Família',    '❤️', '#E8C46A', 7),
    (new.id, 'Conhecimento',      '🎓', '#CBA135', 8),
    (new.id, 'Espiritualidade',   '🙏', '#DFC078', 9),
    (new.id, 'Estilo de Vida',    '✨', '#F2E2A8', 10)
  on conflict (user_id, name) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- RPC: entrar em um casal pelo código de convite
-- ---------------------------------------------------------------------

create or replace function public.join_couple(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple  public.couples%rowtype;
  v_members int;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  select * into v_couple from public.couples
   where invite_code = upper(trim(p_code));

  if not found then
    raise exception 'Código de convite inválido';
  end if;

  if exists (select 1 from public.couple_members where user_id = auth.uid() and couple_id = v_couple.id) then
    return v_couple.id;
  end if;

  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'Você já faz parte de um quadro em casal';
  end if;

  select count(*) into v_members from public.couple_members where couple_id = v_couple.id;
  if v_members >= 2 then
    raise exception 'Este quadro em casal já está completo';
  end if;

  insert into public.couple_members (couple_id, user_id) values (v_couple.id, auth.uid());
  return v_couple.id;
end;
$$;

-- RPC: criar um casal já entrando nele
create or replace function public.create_couple(p_name text default 'Nosso Quadro')
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple public.couples%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'Você já faz parte de um quadro em casal';
  end if;

  insert into public.couples (name, invite_code, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Nosso Quadro'), public.generate_invite_code(), auth.uid())
  returning * into v_couple;

  insert into public.couple_members (couple_id, user_id) values (v_couple.id, auth.uid());
  return v_couple;
end;
$$;

-- RPC: sair do casal (os sonhos "couple" voltam a ser individuais do dono)
create or replace function public.leave_couple()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple uuid := public.my_couple_id();
begin
  if v_couple is null then
    return;
  end if;

  update public.dreams
     set scope = 'individual', couple_id = null, share_with_partner = false
   where couple_id = v_couple and owner_id = auth.uid();

  delete from public.couple_members where couple_id = v_couple and user_id = auth.uid();

  -- se ficou vazio, remove o casal
  if not exists (select 1 from public.couple_members where couple_id = v_couple) then
    delete from public.couples where id = v_couple;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.couples            enable row level security;
alter table public.couple_members     enable row level security;
alter table public.categories         enable row level security;
alter table public.dreams             enable row level security;
alter table public.dream_deposits     enable row level security;
alter table public.daily_checkins     enable row level security;
alter table public.affirmations       enable row level security;
alter table public.user_achievements  enable row level security;
alter table public.dream_cheers       enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log   enable row level security;

-- profiles: eu + meu par
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or id = public.partner_id());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- couples
drop policy if exists couples_select on public.couples;
create policy couples_select on public.couples for select to authenticated
  using (id = public.my_couple_id());

drop policy if exists couples_update on public.couples;
create policy couples_update on public.couples for update to authenticated
  using (id = public.my_couple_id()) with check (id = public.my_couple_id());

-- couple_members
drop policy if exists couple_members_select on public.couple_members;
create policy couple_members_select on public.couple_members for select to authenticated
  using (couple_id = public.my_couple_id());

drop policy if exists couple_members_update on public.couple_members;
create policy couple_members_update on public.couple_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists couple_members_delete on public.couple_members;
create policy couple_members_delete on public.couple_members for delete to authenticated
  using (user_id = auth.uid());

-- categories: leitura minha + do par (para exibir os sonhos dele com a categoria certa),
-- escrita só nas minhas
drop policy if exists categories_all on public.categories;
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (user_id = auth.uid() or user_id = public.partner_id());

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories for delete to authenticated
  using (user_id = auth.uid());

-- dreams
drop policy if exists dreams_select on public.dreams;
create policy dreams_select on public.dreams for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      couple_id is not null
      and couple_id = public.my_couple_id()
      and (scope = 'couple' or share_with_partner or public.partner_shares_all(owner_id))
    )
  );

drop policy if exists dreams_insert on public.dreams;
create policy dreams_insert on public.dreams for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists dreams_update on public.dreams;
create policy dreams_update on public.dreams for update to authenticated
  using (
    owner_id = auth.uid()
    or (scope = 'couple' and couple_id is not null and couple_id = public.my_couple_id())
  )
  with check (
    owner_id = auth.uid()
    or (scope = 'couple' and couple_id is not null and couple_id = public.my_couple_id())
  );

drop policy if exists dreams_delete on public.dreams;
create policy dreams_delete on public.dreams for delete to authenticated
  using (owner_id = auth.uid());

-- depósitos do banco dos sonhos
drop policy if exists deposits_select on public.dream_deposits;
create policy deposits_select on public.dream_deposits for select to authenticated
  using (user_id = auth.uid() or (dream_id is not null and public.can_see_dream(dream_id)));

drop policy if exists deposits_insert on public.dream_deposits;
create policy deposits_insert on public.dream_deposits for insert to authenticated
  with check (user_id = auth.uid() and (dream_id is null or public.can_see_dream(dream_id)));

drop policy if exists deposits_update on public.dream_deposits;
create policy deposits_update on public.dream_deposits for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists deposits_delete on public.dream_deposits;
create policy deposits_delete on public.dream_deposits for delete to authenticated
  using (user_id = auth.uid());

-- check-ins, afirmações, conquistas, push: privados do usuário
drop policy if exists checkins_all on public.daily_checkins;
create policy checkins_all on public.daily_checkins for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists affirmations_all on public.affirmations;
create policy affirmations_all on public.affirmations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists achievements_all on public.user_achievements;
create policy achievements_all on public.user_achievements for all to authenticated
  using (user_id = auth.uid() or user_id = public.partner_id())
  with check (user_id = auth.uid());

drop policy if exists push_all on public.push_subscriptions;
create policy push_all on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notif_select on public.notification_log;
create policy notif_select on public.notification_log for select to authenticated
  using (user_id = auth.uid());

-- incentivos: quem enxerga o sonho pode ler e comentar
drop policy if exists cheers_select on public.dream_cheers;
create policy cheers_select on public.dream_cheers for select to authenticated
  using (public.can_see_dream(dream_id));

drop policy if exists cheers_insert on public.dream_cheers;
create policy cheers_insert on public.dream_cheers for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_dream(dream_id));

drop policy if exists cheers_delete on public.dream_cheers;
create policy cheers_delete on public.dream_cheers for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Storage: bucket privado das fotos dos sonhos
-- Caminho: {owner_id}/{dream_id}/{arquivo}
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dream-images', 'dream-images', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists dream_images_select on storage.objects;
create policy dream_images_select on storage.objects for select to authenticated
  using (
    bucket_id = 'dream-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] = public.partner_id()::text
    )
  );

drop policy if exists dream_images_insert on storage.objects;
create policy dream_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dream-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists dream_images_update on storage.objects;
create policy dream_images_update on storage.objects for update to authenticated
  using (bucket_id = 'dream-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists dream_images_delete on storage.objects;
create policy dream_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dream-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
