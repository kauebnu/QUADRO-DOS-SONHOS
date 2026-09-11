#!/usr/bin/env bash
# =====================================================================
# Backup do WE DREAM: banco + fotos dos sonhos.
#
#   ./scripts/backup.sh [pasta-destino]
#
# Para uma cópia sem as chaves, própria para enviar a nuvem de terceiros:
#   INCLUIR_ENV=0 ./scripts/backup.sh /pasta/para/enviar
#
# No cron, todo dia às 3h:
#   0 3 * * * /opt/we-dream/supabase-selfhost/scripts/backup.sh >> /var/log/wedream-backup.log 2>&1
#
# Guarda os últimos 14 dias. COPIE para fora da VPS — backup que mora no
# mesmo servidor não protege contra perder o servidor.
#
# ATENÇÃO: a pasta de destino passa a conter dados sensíveis — o dump do
# banco (com os dados e os hashes de senha das contas) e uma cópia do
# .env do Supabase (com as chaves). Por isso tudo aqui nasce fechado.
# =====================================================================
set -euo pipefail

# Tudo que este script criar fica legível só pelo dono (o root).
# Sem isto, o dump do banco e o tar das fotos nasciam com a permissão
# padrão, legíveis por qualquer conta do servidor.
umask 077

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="$(cd "$AQUI/.." && pwd)"
DESTINO="${1:-/root/backups/wedream}"
CONTAINER="${CONTAINER_DB:-wedream-db}"
DIAS=14
HOJE="$(date +%F)"

mkdir -p "$DESTINO"
chmod 700 "$DESTINO"   # vale também para uma pasta criada antes desta correção

echo "── Backup WE DREAM — $(date '+%d/%m/%Y %H:%M') ──"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "✗ $CONTAINER não está rodando — backup ABORTADO"
  exit 1
fi

# ------------------------------------------------------------------ banco
ARQ_DB="$DESTINO/banco-$HOJE.sql.gz"
echo "▸ Banco → $ARQ_DB"
if docker exec "$CONTAINER" pg_dump -U postgres --clean --if-exists postgres \
     | gzip > "$ARQ_DB.parcial"; then
  mv "$ARQ_DB.parcial" "$ARQ_DB"
  echo "  ok ($(du -h "$ARQ_DB" | cut -f1))"
else
  # não deixa um arquivo pela metade parecendo backup bom
  rm -f "$ARQ_DB.parcial"
  echo "✗ falhou o dump do banco"
  exit 1
fi

# ------------------------------------------------------------------ fotos
ARQ_FOTOS="$DESTINO/fotos-$HOJE.tar.gz"
if [ -d "$BASE/volumes/storage" ]; then
  echo "▸ Fotos → $ARQ_FOTOS"
  if tar czf "$ARQ_FOTOS.parcial" -C "$BASE/volumes" storage; then
    mv "$ARQ_FOTOS.parcial" "$ARQ_FOTOS"
    echo "  ok ($(du -h "$ARQ_FOTOS" | cut -f1))"
  else
    rm -f "$ARQ_FOTOS.parcial"
    echo "✗ falhou o backup das fotos"
    exit 1
  fi
else
  echo "⚠ $BASE/volumes/storage não existe — nenhuma foto enviada ainda"
fi

# --------------------------------------------------------- chaves (.env)
#
# As chaves fazem parte do backup porque sem elas o dump do banco é quase
# inútil: o JWT_SECRET precisa ser o MESMO na restauração, senão todos os
# logins e todos os links assinados das fotos param de valer.
#
# Mas é este arquivo que impede o backup de ser jogado em nuvem de
# terceiros sem pensar. Para gerar uma cópia sem segredos:
#     INCLUIR_ENV=0 ./scripts/backup.sh /caminho/para/enviar
if [ "${INCLUIR_ENV:-1}" = "1" ] && [ -f "$BASE/.env" ]; then
  cp "$BASE/.env" "$DESTINO/env-supabase-$HOJE.txt"
  chmod 600 "$DESTINO/env-supabase-$HOJE.txt"
  echo "▸ Chaves do Supabase copiadas (contém segredos — proteja esta pasta)"
elif [ "${INCLUIR_ENV:-1}" != "1" ]; then
  echo "▸ Chaves NÃO incluídas (INCLUIR_ENV=0)"
  echo "  Guarde o JWT_SECRET em outro lugar: sem ele este backup não restaura."
fi

# ------------------------------------------------------------- limpeza
echo "▸ Removendo backups com mais de $DIAS dias"
find "$DESTINO" -maxdepth 1 -type f \
  \( -name 'banco-*.sql.gz' -o -name 'fotos-*.tar.gz' -o -name 'env-supabase-*.txt' \) \
  -mtime +$DIAS -print -delete | sed 's/^/  apagado: /' || true

echo
echo "✅ Backup concluído. Conteúdo de $DESTINO:"
ls -lh "$DESTINO" | tail -n +2 | sed 's/^/  /'
echo
echo "⚠ Copie estes arquivos para fora da VPS — backup que mora no mesmo"
echo "  servidor não protege contra perder o servidor."
if [ -f "$DESTINO/env-supabase-$HOJE.txt" ]; then
  echo
  echo "⚠ ATENÇÃO ao enviar para nuvem de terceiros (Drive, Dropbox, S3):"
  echo "  env-supabase-$HOJE.txt tem as chaves do Supabase em texto puro."
  echo "  Ou criptografe antes, ou gere a cópia de envio sem ele:"
  echo "      INCLUIR_ENV=0 $0 /pasta/para/enviar"
fi
