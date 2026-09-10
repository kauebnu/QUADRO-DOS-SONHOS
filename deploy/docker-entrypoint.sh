#!/bin/sh
# =====================================================================
# Escreve /config.js a partir das variáveis de ambiente.
#
# Assim a MESMA imagem serve produção, homologação e testes: nada de
# chave embutida no bundle, e trocar de projeto Supabase é só reiniciar
# o container.
# =====================================================================
set -eu

CONFIG_FILE=/usr/share/nginx/html/config.js

escape_js() {
  # escapa \ e ' para não quebrar a string do JavaScript
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e "s/'/\\\\'/g"
}

cat > "$CONFIG_FILE" <<EOF
// Gerado pelo container em $(date -u +%Y-%m-%dT%H:%M:%SZ). Não edite à mão.
window.__WE_DREAM_CONFIG__ = {
  supabaseUrl: '$(escape_js "${WEB_SUPABASE_URL:-}")',
  supabaseAnonKey: '$(escape_js "${WEB_SUPABASE_ANON_KEY:-}")',
  vapidPublicKey: '$(escape_js "${WEB_VAPID_PUBLIC_KEY:-}")',
  pushApiUrl: '$(escape_js "${WEB_PUSH_API_URL:-}")',
};
EOF

if [ -z "${WEB_SUPABASE_URL:-}" ] || [ -z "${WEB_SUPABASE_ANON_KEY:-}" ]; then
  echo "AVISO: WEB_SUPABASE_URL/WEB_SUPABASE_ANON_KEY não definidos."
  echo "       O app vai subir em MODO DEMONSTRAÇÃO (sem contas de verdade)."
else
  echo "WE DREAM configurado para ${WEB_SUPABASE_URL}"
fi

exec "$@"
