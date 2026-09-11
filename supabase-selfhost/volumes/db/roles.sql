-- =====================================================================
-- Senha dos papéis internos do Supabase.
--
-- Roda uma única vez, na criação do banco.
--
-- Só altera os papéis que EXISTEM nesta imagem. A versão anterior fazia
-- um ALTER fixo em supabase_functions_admin, papel que a imagem
-- supabase/postgres:17.6.1.136 não traz mais. Como o entrypoint roda os
-- scripts com ON_ERROR_STOP, o psql abortava naquela linha e
-- supabase_storage_admin ficava SEM senha — o serviço de fotos entrava
-- em loop de reinício com "password authentication failed".
-- =====================================================================
\set ON_ERROR_STOP on
\set pgpass `echo "$POSTGRES_PASSWORD"`

SELECT format('ALTER USER %I WITH PASSWORD %L', rolname, :'pgpass')
  FROM pg_roles
 WHERE rolname IN (
         'authenticator',
         'pgbouncer',
         'supabase_auth_admin',
         'supabase_functions_admin',
         'supabase_storage_admin'
       )
\gexec

-- Estes três não são opcionais: sem senha, o login (auth), as consultas
-- (rest) e as fotos (storage) não conectam. Falhar aqui, na criação do
-- banco, é melhor do que descobrir depois num container reiniciando.
DO $$
DECLARE faltando text;
BEGIN
  SELECT string_agg(p, ', ')
    INTO faltando
    FROM unnest(ARRAY[
           'authenticator',
           'supabase_auth_admin',
           'supabase_storage_admin'
         ]) AS p
   WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p);

  IF faltando IS NOT NULL THEN
    RAISE EXCEPTION 'papéis obrigatórios ausentes nesta imagem do Postgres: %', faltando;
  END IF;
END $$;
