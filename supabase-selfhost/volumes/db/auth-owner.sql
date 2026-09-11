-- =====================================================================
-- Dono do schema auth.
--
-- Na imagem supabase/postgres, o schema auth e as funções auth.uid(),
-- auth.role() e auth.email() nascem pertencendo ao papel postgres. Mas o
-- GoTrue conecta como supabase_auth_admin e, nas migrations dele,
-- recria essas funções — o que falha com
--
--     must be owner of function uid   (SQLSTATE 42501)
--
-- e deixa o cadastro e o login fora do ar. Passar a posse para
-- supabase_auth_admin é o que a pilha oficial do Supabase faz.
--
-- Este arquivo roda em DOIS momentos, de propósito:
--   · na criação do banco, via /docker-entrypoint-initdb.d — precisa ser
--     aqui, porque o GoTrue conecta assim que o Postgres abre;
--   · a cada aplicar-migrations.sh — para consertar também um banco que
--     já foi criado antes desta correção existir.
-- Rodar de novo não muda nada: quem já é dono continua dono.
-- =====================================================================
\set ON_ERROR_STOP on

DO $$
DECLARE r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    RAISE NOTICE 'schema auth ainda não existe — nada a fazer';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    RAISE EXCEPTION 'papel supabase_auth_admin não existe nesta imagem do Postgres';
  END IF;

  EXECUTE 'ALTER SCHEMA auth OWNER TO supabase_auth_admin';

  -- prokind 'f' = função, 'p' = procedure. Agregados e funções de janela
  -- ficam de fora: o schema auth não tem nenhum, e ALTER ROUTINE os recusa.
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'auth'
       AND p.prokind IN ('f', 'p')
  LOOP
    EXECUTE format('ALTER ROUTINE %s OWNER TO supabase_auth_admin', r.assinatura);
  END LOOP;
END $$;
