-- =====================================================================
-- Testes de RLS do WE DREAM
-- Rode com: psql -v ON_ERROR_STOP=1 -d wedream_test -f 01_rls_test.sql
-- Qualquer asserção falha aborta o script.
-- =====================================================================

\set QUIET on
\pset pager off

create or replace function public.assert(p_cond boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_cond then
    raise notice '  OK   %', p_label;
  else
    raise exception 'FALHOU: %', p_label;
  end if;
end $$;

-- ---------------------------------------------------------------------
\echo '== 1. Cadastro cria perfil + categorias padrao =='
-- ---------------------------------------------------------------------
begin;
  select set_config('test.ana',  public.test_signup('ana@wedream.app',  'Ana')::text,  false);
  select set_config('test.bruno',public.test_signup('bruno@wedream.app','Bruno')::text,false);
  select set_config('test.carla',public.test_signup('carla@wedream.app','Carla')::text,false);
commit;

do $$
declare a uuid := current_setting('test.ana')::uuid;
begin
  perform public.assert((select count(*) from public.profiles where id = a) = 1, 'perfil da Ana criado');
  perform public.assert((select display_name from public.profiles where id = a) = 'Ana', 'display_name veio do metadata');
  perform public.assert((select count(*) from public.categories where user_id = a) = 10, '10 categorias padrao');
end $$;

-- ---------------------------------------------------------------------
\echo '== 2. Sonho individual e invisivel para estranhos =='
-- ---------------------------------------------------------------------
begin;
  select public.test_login(current_setting('test.ana')::uuid);
  insert into public.dreams (owner_id, title, description, plan, target_amount, target_date)
  values (current_setting('test.ana')::uuid, 'Casa na praia', 'Frente para o mar', 'Guardar 20% por mes', 850000, current_date + 900);
  select public.assert((select count(*) from public.dreams) = 1, 'Ana ve o proprio sonho');
commit;

begin;
  select public.test_login(current_setting('test.bruno')::uuid);
  select public.assert((select count(*) from public.dreams) = 0, 'Bruno (sem casal) nao ve o sonho da Ana');
commit;

-- ---------------------------------------------------------------------
\echo '== 3. Casal: criar e entrar por codigo =='
-- ---------------------------------------------------------------------
begin;
  select public.test_login(current_setting('test.ana')::uuid);
  select set_config('test.couple', (public.create_couple('Ana & Bruno')).id::text, false);
commit;

begin;
  select public.test_login(current_setting('test.ana')::uuid);
  select set_config('test.code', (select invite_code from public.couples where id = current_setting('test.couple')::uuid), false);
commit;

begin;
  select public.test_login(current_setting('test.bruno')::uuid);
  select public.assert(public.join_couple(current_setting('test.code')) = current_setting('test.couple')::uuid, 'Bruno entrou no casal pelo codigo');
commit;

do $$
begin
  perform public.assert((select count(*) from public.couple_members where couple_id = current_setting('test.couple')::uuid) = 2, 'casal com 2 membros');
end $$;

\echo '-- codigo invalido deve falhar --'
begin;
  select public.test_login(current_setting('test.carla')::uuid);
  do $$
  begin
    begin
      perform public.join_couple('ZZZZZZ');
      raise exception 'FALHOU: codigo invalido foi aceito';
    exception when others then
      if sqlerrm like 'FALHOU:%' then raise; end if;
      raise notice '  OK   codigo invalido rejeitado (%)', sqlerrm;
    end;
  end $$;
commit;

\echo '-- terceiro nao entra em casal cheio --'
begin;
  select public.test_login(current_setting('test.carla')::uuid);
  do $$
  begin
    begin
      perform public.join_couple(current_setting('test.code'));
      raise exception 'FALHOU: terceira pessoa entrou no casal';
    exception when others then
      if sqlerrm like 'FALHOU:%' then raise; end if;
      raise notice '  OK   casal cheio rejeitou terceiro (%)', sqlerrm;
    end;
  end $$;
commit;

-- ---------------------------------------------------------------------
\echo '== 4. Sonho individual continua privado dentro do casal =='
-- ---------------------------------------------------------------------
begin;
  select public.test_login(current_setting('test.ana')::uuid);
  -- vincula o sonho existente ao casal, mas mantem individual e nao compartilhado
  update public.dreams set couple_id = current_setting('test.couple')::uuid
   where owner_id = current_setting('test.ana')::uuid;
commit;

begin;
  select public.test_login(current_setting('test.bruno')::uuid);
  select public.assert((select count(*) from public.dreams) = 0, 'Bruno NAO ve sonho individual nao compartilhado da Ana');
commit;

-- ---------------------------------------------------------------------
\echo '== 5. Botao "compartilhar este sonho" =='
-- ---------------------------------------------------------------------
begin;
  select public.test_login(current_setting('test.ana')::uuid);
  update public.dreams set share_with_partner = true where owner_id = current_setting('test.ana')::uuid;
commit;

begin;
  select public.test_login(current_setting('test.bruno')::uuid);
  select public.assert((select count(*) from public.dreams) = 1, 'Bruno ve o sonho individual compartilhado');
commit;

-- ---------------------------------------------------------------------
\echo '== 6. Botao global "ver todos os meus individuais" =='
-- ---------------------------------------------------------------------
begin;
  select public.test_login(current_setting('test.ana')::uuid);
  update public.dreams set share_with_partner = false where owner_id = current_setting('test.ana')::uuid;
  insert into public.dreams (owner_id, couple_id, title) values
    (current_setting('test.ana')::uuid, current_setting('test.couple')::uuid, 'Mestrado fora'),
    (current_setting('test.ana')::uuid, current_setting('test.couple')::uuid, 'Maratona de NY');
commit;

begin;
  select public.test_login(current_setting('test.bruno')::uuid);
  select public.assert((select count(*) from public.dreams) = 0, 'sem compartilhar, Bruno nao ve nenhum dos 3');
commit;

begin;
  select public.test_login(current_setting('test.ana')::uuid);
  update public.couple_members set share_all_individual = true
   where user_id = current_setting('test.ana')::uuid;
commit;

begin;
  select public.test_login(current_setting('test.bruno')::uuid);
  select public.assert((select count(*) from public.dreams) = 3, 'com o botao global, Bruno ve os 3 sonhos individuais');
commit;

begin;
  select public.test_login(current_setting('test.ana')::uuid);
  update public.couple_members set share_all_individual = false where user_id = current_setting('test.ana')::uuid;
commit;

-- ---------------------------------------------------------------------
\echo '== 7. Sonho do casal: visivel e editavel pelos dois =='
-- ---------------------------------------------------------------------
begin;
  select public.test_login(current_setting('test.bruno')::uuid);
  insert into public.dreams (owner_id, couple_id, scope, title, plan, target_amount)
  values (current_setting('test.bruno')::uuid, current_setting('test.couple')::uuid, 'couple',
          'Lua de mel na Grecia', 'Reservar 1.500/mes', 60000);
commit;

begin;
  select public.test_login(current_setting('test.ana')::uuid);
  select public.assert((select count(*) from public.dreams where scope = 'couple') = 1, 'Ana ve o sonho do casal');
  update public.dreams set description = 'Santorini + Mykonos' where scope = 'couple';
  select public.assert((select description from public.dreams where scope = 'couple') = 'Santorini + Mykonos', 'Ana edita o sonho do casal');
commit;

\echo '-- mas nao pode apagar o sonho do parceiro --'
begin;
  select public.test_login(current_setting('test.ana')::uuid);
  delete from public.dreams where scope = 'couple';
  select public.assert((select count(*) from public.dreams where scope = 'couple') = 1, 'delete do sonho do parceiro foi bloqueado pelo RLS');
commit;

-- ---------------------------------------------------------------------
\echo '== 8. Banco dos sonhos: aportes e progresso =='
-- ---------------------------------------------------------------------
begin;
  select public.test_login(current_setting('test.bruno')::uuid);
  insert into public.dream_deposits (dream_id, user_id, amount, note)
  select id, current_setting('test.bruno')::uuid, 5000, 'primeiro aporte' from public.dreams where scope = 'couple';
  insert into public.dream_deposits (dream_id, user_id, amount, note)
  select id, current_setting('test.bruno')::uuid, 1500, 'novembro' from public.dreams where scope = 'couple';
  insert into public.dream_deposits (dream_id, user_id, amount, note)
  select id, current_setting('test.bruno')::uuid, -500, 'retirada' from public.dreams where scope = 'couple';
commit;

begin;
  select public.test_login(current_setting('test.ana')::uuid);
  select public.assert((select coalesce(sum(amount),0) from public.dream_deposits) = 6000, 'Ana ve o saldo do sonho do casal (6000)');
  insert into public.dream_deposits (dream_id, user_id, amount, note)
  select id, current_setting('test.ana')::uuid, 4000, 'aporte da Ana' from public.dreams where scope = 'couple';
  select public.assert((select coalesce(sum(amount),0) from public.dream_deposits) = 10000, 'os dois alimentam o mesmo cofre');
commit;

begin;
  select public.test_login(current_setting('test.carla')::uuid);
  select public.assert((select count(*) from public.dream_deposits) = 0, 'Carla nao ve aporte nenhum');
commit;

-- ---------------------------------------------------------------------
\echo '== 9. Realizar e arquivar =='
-- ---------------------------------------------------------------------
begin;
  select public.test_login(current_setting('test.ana')::uuid);
  update public.dreams set realized_at = current_date where title = 'Maratona de NY';
  select public.assert((select status from public.dreams where title = 'Maratona de NY') = 'realized', 'trigger marcou status=realized');
  update public.dreams set archived = true where title = 'Maratona de NY';
  select public.assert((select archived from public.dreams where title = 'Maratona de NY'), 'sonho realizado foi arquivado');
  -- desfazer a realizacao volta para ativo e desarquiva
  update public.dreams set realized_at = null where title = 'Maratona de NY';
  select public.assert((select status = 'active' and not archived from public.dreams where title = 'Maratona de NY'), 'desfazer realizacao volta para ativo');
commit;

-- ---------------------------------------------------------------------
\echo '== 10. Storage: pastas por usuario =='
-- ---------------------------------------------------------------------
begin;
  select public.test_login(current_setting('test.ana')::uuid);
  insert into storage.objects (bucket_id, name)
  values ('dream-images', current_setting('test.ana') || '/abc/foto.jpg');
  select public.assert((select count(*) from storage.objects) = 1, 'Ana envia foto na propria pasta');
commit;

\echo '-- Ana nao pode gravar na pasta do Bruno --'
begin;
  select public.test_login(current_setting('test.ana')::uuid);
  do $$
  begin
    begin
      insert into storage.objects (bucket_id, name)
      values ('dream-images', current_setting('test.bruno') || '/xyz/roubo.jpg');
      raise exception 'FALHOU: Ana gravou na pasta do Bruno';
    exception when others then
      if sqlerrm like 'FALHOU:%' then raise; end if;
      raise notice '  OK   gravacao na pasta alheia bloqueada';
    end;
  end $$;
commit;

begin;
  select public.test_login(current_setting('test.bruno')::uuid);
  select public.assert((select count(*) from storage.objects) = 1, 'Bruno (parceiro) le a foto da Ana');
commit;

begin;
  select public.test_login(current_setting('test.carla')::uuid);
  select public.assert((select count(*) from storage.objects) = 0, 'Carla nao le foto de ninguem');
commit;

-- ---------------------------------------------------------------------
\echo '== 11. Sair do casal devolve os sonhos =='
-- ---------------------------------------------------------------------
begin;
  select public.test_login(current_setting('test.ana')::uuid);
  select public.leave_couple();
commit;

do $$
begin
  perform public.assert((select count(*) from public.couple_members where user_id = current_setting('test.ana')::uuid) = 0, 'Ana saiu do casal');
  perform public.assert((select count(*) from public.dreams
                          where owner_id = current_setting('test.ana')::uuid
                            and (couple_id is not null or scope <> 'individual')) = 0,
                        'sonhos da Ana voltaram a ser individuais');
end $$;

begin;
  select public.test_login(current_setting('test.bruno')::uuid);
  select public.assert((select count(*) from public.dreams) = 1, 'Bruno segue vendo apenas o proprio sonho');
commit;

-- ---------------------------------------------------------------------
\echo '== 12. Check-ins, afirmacoes e push sao privados =='
-- ---------------------------------------------------------------------
begin;
  select public.test_login(current_setting('test.ana')::uuid);
  insert into public.daily_checkins (user_id, mood, gratitude, action_taken, visualized_seconds)
  values (current_setting('test.ana')::uuid, 'otimo', 'Grata pela familia', 'Liguei para o corretor', 60);
  insert into public.affirmations (user_id, text) values (current_setting('test.ana')::uuid, 'Eu sou um ima de prosperidade');
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (current_setting('test.ana')::uuid, 'https://push.example/ana', 'k', 'a');
commit;

begin;
  select public.test_login(current_setting('test.bruno')::uuid);
  select public.assert((select count(*) from public.daily_checkins) = 0,     'check-in e privado');
  select public.assert((select count(*) from public.affirmations) = 0,       'afirmacao e privada');
  select public.assert((select count(*) from public.push_subscriptions) = 0, 'inscricao de push e privada');
commit;

\echo ''
\echo '======================================'
\echo ' TODOS OS TESTES DE RLS PASSARAM  ✅'
\echo '======================================'
