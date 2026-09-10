#!/usr/bin/env bash
# Recria um banco limpo, aplica as migrations e roda os testes de RLS.
#
#   ./supabase/tests/run.sh
#
# Variáveis: PGHOST, PGPORT, PGUSER, TEST_DB
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

export PGHOST="${PGHOST:-/tmp}"
export PGPORT="${PGPORT:-55432}"
export PGUSER="${PGUSER:-postgres}"
TEST_DB="${TEST_DB:-wedream_test}"

echo "▸ recriando banco $TEST_DB"
psql -q -d postgres -c "drop database if exists $TEST_DB;" >/dev/null
psql -q -d postgres -c "create database $TEST_DB;" >/dev/null

echo "▸ shim do ambiente Supabase"
psql -q -v ON_ERROR_STOP=1 -d "$TEST_DB" -f "$HERE/00_supabase_shim.sql" >/dev/null

echo "▸ migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   · $(basename "$f")"
  psql -q -v ON_ERROR_STOP=1 -d "$TEST_DB" -f "$f" >/dev/null
done

echo "▸ testes de RLS"
psql -v ON_ERROR_STOP=1 -q -d "$TEST_DB" -f "$HERE/01_rls_test.sql" 2>&1 \
  | sed -e 's/^psql:.*NOTICE:  //' -e 's/^psql:.*ERROR:  /ERRO: /' \
  | grep -Ev '^\s*$|^ (test_login|assert|set_config)\s*$|^ [0-9a-f-]{36}\s*$|^ [A-Z0-9]{6}\s*$'

echo ""
echo "✔ suíte concluída"
