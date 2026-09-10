#!/usr/bin/env bash
# =====================================================================
# Aplica as migrations do WE DREAM no Supabase self-hosted.
#
#   ./scripts/aplicar-migrations.sh
#
# É seguro rodar mais de uma vez: as migrations usam "create ... if not
# exists" e "drop policy if exists", então repetir não quebra nada.
# =====================================================================
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
CONTAINER="${CONTAINER_DB:-wedream-supabase-db}"
MIGRATIONS="$RAIZ/supabase/migrations"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "✗ O container $CONTAINER não está rodando."
  echo "  Suba a pilha primeiro:  cd $(dirname "$AQUI") && docker compose up -d"
  exit 1
fi

echo "▸ Esperando o Postgres aceitar conexões…"
for i in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null; then
    echo "  pronto."
    break
  fi
  [ "$i" = 60 ] && { echo "✗ O banco não respondeu em 60s."; exit 1; }
  sleep 1
done

shopt -s nullglob
arquivos=("$MIGRATIONS"/*.sql)
if [ ${#arquivos[@]} -eq 0 ]; then
  echo "✗ Nenhuma migration encontrada em $MIGRATIONS"
  exit 1
fi

echo "▸ Aplicando ${#arquivos[@]} migration(s):"
for f in "${arquivos[@]}"; do
  echo "   · $(basename "$f")"
  if ! docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -q < "$f"; then
    echo "✗ Falhou em $(basename "$f") — nada além disso foi aplicado."
    exit 1
  fi
done

echo
echo "▸ Conferindo o resultado:"
docker exec -i "$CONTAINER" psql -U postgres -d postgres -tA <<'SQL'
select '   tabelas do WE DREAM: ' || count(*)
  from pg_tables
 where schemaname = 'public'
   and tablename in ('profiles','couples','couple_members','categories','dreams',
                     'dream_deposits','daily_checkins','affirmations',
                     'user_achievements','dream_cheers','push_subscriptions',
                     'notification_log');

select '   tabelas com RLS ligado: ' || count(*)
  from pg_tables
 where schemaname = 'public' and rowsecurity;

select '   políticas de segurança: ' || count(*)
  from pg_policies where schemaname in ('public','storage');

select '   bucket de fotos: ' || coalesce(
         (select 'ok (privado=' || (not public)::text || ')' from storage.buckets where id = 'dream-images'),
         'AUSENTE');

select '   gatilho de novo usuário: ' || coalesce(
         (select 'ok' from pg_trigger where tgname = 'on_auth_user_created'), 'AUSENTE');
SQL

echo
echo "✅ Banco pronto. São esperadas 12 tabelas, todas com RLS."
