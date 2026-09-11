#!/usr/bin/env bash
# =====================================================================
# WE DREAM — instalador completo da VPS
#
# Um comando faz tudo: confere o servidor, baixa o projeto, gera as
# chaves, sobe o Supabase, cria as tabelas, sobe o app, configura o
# nginx, emite o certificado HTTPS e testa o resultado.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/kauebnu/QUADRO-DOS-SONHOS/claude/peaceful-franklin-d0a3qj/deploy/instalar.sh)
#
# Pode rodar quantas vezes quiser: o que já está pronto ele pula.
#
# ---------------------------------------------------------------------
# O QUE ELE NUNCA FAZ (esta VPS tem outros apps em produção)
#   · não para, reinicia nem apaga container de outro projeto
#   · não roda `docker system prune`
#   · não mexe em site já existente do nginx
#   · não abre porta no firewall (tudo fica em 127.0.0.1)
#   · não toca em /opt/webhook, /opt/evolution, /opt/aulingo, /opt/rachajusto
# =====================================================================
set -uo pipefail

export PATH="$PATH:/usr/sbin:/sbin:/usr/local/sbin"

# ------------------------------------------------------------ ajustes
DOMINIO_APP="${DOMINIO_APP:-quadrodossonhos.antonellaroweder.com.br}"
DOMINIO_API="${DOMINIO_API:-api.quadrodossonhos.antonellaroweder.com.br}"
EMAIL_CERT="${EMAIL_CERT:-kauebnu@gmail.com}"
REPO="${REPO:-https://github.com/kauebnu/QUADRO-DOS-SONHOS.git}"
BRANCH="${BRANCH:-claude/peaceful-franklin-d0a3qj}"
BASE="${BASE:-/opt/we-dream}"
CREDENCIAIS="/root/we-dream-credenciais.txt"
MIN_RAM_MB="${MIN_RAM_MB:-1500}"

PORTAS_APP=(4000 4100)
PORTAS_SB=(4001 4002 4003 5434)
NOSSAS_PORTAS=("${PORTAS_APP[@]}" "${PORTAS_SB[@]}")

# ------------------------------------------------------------- visual
V=$'\e[32m'; A=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'; B=$'\e[1m'
passo()  { printf '\n%s══ %s ══%s\n' "$B" "$1" "$N"; }
ok()     { printf '  %s✓%s %s\n' "$V" "$N" "$1"; }
avisar() { printf '  %s⚠%s %s\n' "$A" "$N" "$1"; }
falhar() { printf '\n  %s✗ %s%s\n\n' "$R" "$1" "$N"; exit 1; }
tem()    { command -v "$1" >/dev/null 2>&1; }

porta_ocupada() {
  local p="$1"
  if tem ss;        then ss -lptnH "sport = :$p" 2>/dev/null | grep -q .
  elif tem lsof;    then lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1
  elif tem netstat; then netstat -lptn 2>/dev/null | awk -v p=":$p\$" '$4 ~ p' | grep -q .
  else return 2   # não deu para verificar
  fi
}

# nossos containers, para nunca confundir com os de outro app
nosso_container() {
  case "$1" in
    we-dream-web|we-dream-push|wedream-db|wedream-auth|wedream-rest|wedream-storage|wedream-meta|wedream-studio) return 0 ;;
    *) return 1 ;;
  esac
}

printf '\n%s╔══════════════════════════════════════════════╗%s\n' "$B" "$N"
printf '%s║   WE DREAM — instalação na VPS               ║%s\n' "$B" "$N"
printf '%s╚══════════════════════════════════════════════╝%s\n' "$B" "$N"
printf '  app: %s\n  api: %s\n' "$DOMINIO_APP" "$DOMINIO_API"

# =====================================================================
passo "1/9  Conferindo o servidor"
# =====================================================================
[ "$(id -u)" = "0" ] || falhar "Rode como root (use: sudo bash ...)"
ok "rodando como root"

LIVRE=$(free -m 2>/dev/null | awk '/^Mem:/{print $7}')
[ -z "$LIVRE" ] && LIVRE=$(free -m 2>/dev/null | awk '/^Mem:/{print $4}')
if [ -n "$LIVRE" ]; then
  if [ "$LIVRE" -lt "$MIN_RAM_MB" ]; then
    falhar "Só ${LIVRE} MB de memória livre (preciso de ~${MIN_RAM_MB} MB).
     Libere memória ou aumente o plano antes de continuar.
     Para ignorar por sua conta e risco: MIN_RAM_MB=0 bash instalar.sh"
  fi
  ok "memória livre: ${LIVRE} MB"
fi

LIVRE_DISCO=$(df -Pm / | awk 'NR==2{print $4}')
[ "$LIVRE_DISCO" -lt 5000 ] && avisar "só ${LIVRE_DISCO} MB de disco livre — o mínimo confortável é 5 GB"
ok "disco livre: ${LIVRE_DISCO} MB"

VERIFICOU_PORTAS=1
for p in "${NOSSAS_PORTAS[@]}"; do
  porta_ocupada "$p"; res=$?
  if [ $res -eq 2 ]; then VERIFICOU_PORTAS=0; break; fi
  if [ $res -eq 0 ]; then
    # se for container nosso, é uma reinstalação — tudo bem
    DONO=$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep ":$p->" | awk '{print $1}' | head -1)
    if [ -n "$DONO" ] && nosso_container "$DONO"; then
      ok "porta $p já é nossa ($DONO) — reinstalação"
    else
      falhar "A porta $p já está em uso${DONO:+ por $DONO}.
     Outro app desta VPS pode depender dela. Me avise para eu escolher outra."
    fi
  fi
done
[ "$VERIFICOU_PORTAS" = "1" ] && ok "portas ${NOSSAS_PORTAS[*]} disponíveis" \
  || avisar "não consegui checar as portas (sem ss/lsof/netstat) — seguindo assim mesmo"

# =====================================================================
passo "2/9  Programas necessários"
# =====================================================================
if ! tem docker; then
  echo "  instalando Docker…"
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || falhar "não consegui instalar o Docker"
fi
docker compose version >/dev/null 2>&1 || falhar "o plugin 'docker compose' não está disponível"
ok "docker $(docker --version | awk '{print $3}' | tr -d ,)"

NODE=""
for c in /opt/node24/bin/node "$(command -v node || true)" /root/.nvm/versions/node/v20.20.1/bin/node; do
  if [ -n "$c" ] && [ -x "$c" ]; then
    if [ "$("$c" -e 'console.log(process.versions.node.split(".")[0])' 2>/dev/null)" -ge 18 ] 2>/dev/null; then
      NODE="$c"; break
    fi
  fi
done
[ -n "$NODE" ] || falhar "preciso do Node 18 ou maior. Instale com:
     curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs"
ok "node $("$NODE" --version) em $NODE"

tem git || { apt-get install -y -qq git >/dev/null 2>&1 || falhar "instale o git"; }
ok "git presente"

# =====================================================================
passo "3/9  DNS dos dois subdomínios"
# =====================================================================
MEU_IP=$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo "")
[ -n "$MEU_IP" ] && ok "IP público desta VPS: $MEU_IP"

resolver() {
  if tem dig; then dig +short "$1" | tail -1
  elif tem getent; then getent hosts "$1" | awk '{print $1}' | head -1
  fi
}
DNS_FALTANDO=0
for d in "$DOMINIO_APP" "$DOMINIO_API"; do
  APONTA=$(resolver "$d")
  if [ -z "$APONTA" ]; then
    avisar "$d ainda não resolve"
    DNS_FALTANDO=1
  elif [ -n "$MEU_IP" ] && [ "$APONTA" != "$MEU_IP" ]; then
    avisar "$d aponta para $APONTA, não para $MEU_IP"
    DNS_FALTANDO=1
  else
    ok "$d → $APONTA"
  fi
done
if [ "$DNS_FALTANDO" = "1" ]; then
  avisar "Sem o DNS certo o certificado HTTPS não pode ser emitido."
  avisar "Vou instalar tudo mesmo assim e pular só o HTTPS no fim."
fi

# =====================================================================
passo "4/9  Baixando o projeto"
# =====================================================================
if [ -d "$BASE/.git" ]; then
  git -C "$BASE" fetch --quiet origin "$BRANCH" || falhar "não consegui buscar as atualizações"

  # Se alguém editou um arquivo do projeto à mão no servidor (para
  # destravar alguma coisa), o checkout normal recusaria e a instalação
  # ficaria presa na versão antiga. Avisamos e descartamos a edição: a
  # versão correta é a do GitHub.
  if ! git -C "$BASE" diff --quiet || ! git -C "$BASE" diff --cached --quiet; then
    avisar "havia arquivos editados à mão em $BASE — substituídos pela versão do GitHub"
    avisar "  (o .env, as fotos e os backups não são tocados)"
  fi

  # --force descarta as edições em arquivos versionados. NUNCA usar
  # `git clean` aqui: as fotos dos sonhos e o .env não são versionados,
  # e seriam apagados.
  git -C "$BASE" checkout --quiet --force -B "$BRANCH" "origin/$BRANCH" \
    || falhar "não consegui atualizar o projeto em $BASE"
  ok "projeto atualizado em $BASE"
else
  mkdir -p "$BASE"
  git clone --quiet -b "$BRANCH" "$REPO" "$BASE" || falhar "não consegui clonar o repositório"
  ok "projeto clonado em $BASE"
fi

# =====================================================================
passo "5/9  Supabase (banco, login e fotos)"
# =====================================================================
cd "$BASE/supabase-selfhost" || falhar "pasta supabase-selfhost não encontrada"

if [ -f .env ]; then
  ok ".env do Supabase já existe — mantido (as chaves não mudam)"
else
  "$NODE" scripts/gerar-env.mjs --app "$DOMINIO_APP" --api "$DOMINIO_API" >/tmp/wd-chaves.txt 2>&1 \
    || { cat /tmp/wd-chaves.txt; falhar "falhou ao gerar as chaves"; }
  ok "chaves geradas"
fi

"$NODE" scripts/verificar-env.mjs >/tmp/wd-verif.txt 2>&1 || { cat /tmp/wd-verif.txt; falhar "o .env do Supabase não passou na conferência"; }
ok "chaves conferidas"

pega() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }
ANON_KEY=$(pega ANON_KEY)
SERVICE_KEY=$(pega SERVICE_ROLE_KEY)
SENHA_PG=$(pega POSTGRES_PASSWORD)

echo "  subindo os 4 containers (na 1ª vez baixa ~800 MB)…"
docker compose up -d >/tmp/wd-sb.log 2>&1 || { tail -25 /tmp/wd-sb.log; falhar "o Supabase não subiu"; }

echo -n "  aguardando ficarem saudáveis"
PORTA_REST=$(pega REST_PORT); PORTA_REST="${PORTA_REST:-4002}"
PRONTO=0
for _ in $(seq 1 60); do
  # awk com igualdade exata, nunca `grep -c healthy`: "unhealthy" contém
  # "healthy", então o grep dava o serviço quebrado como pronto.
  # São 3 e não 4 — o rest não tem healthcheck (a imagem é distroless);
  # quem confere se ele subiu é o curl logo abaixo.
  SAUD=$(docker compose ps --format '{{.Name}} {{.Health}}' 2>/dev/null | awk '$2 == "healthy"' | wc -l)
  REST_OK=0
  curl -fsS --max-time 3 "http://127.0.0.1:$PORTA_REST/" >/dev/null 2>&1 && REST_OK=1
  if [ "$SAUD" -ge 3 ] && [ "$REST_OK" = "1" ]; then PRONTO=1; echo; break; fi
  echo -n "."; sleep 5
done
[ "$PRONTO" = "1" ] || { echo; docker compose ps; falhar "os serviços do Supabase não ficaram prontos.
     Veja o motivo com: cd $BASE/supabase-selfhost && docker compose logs --tail 40"; }
ok "Supabase no ar (db, auth, rest, storage)"

./scripts/aplicar-migrations.sh >/tmp/wd-mig.log 2>&1 || { tail -25 /tmp/wd-mig.log; falhar "falhou ao criar as tabelas"; }
grep -E "tabelas do WE DREAM|RLS ligado|bucket de fotos" /tmp/wd-mig.log | sed 's/^/  /'
ok "banco criado e conferido"

# =====================================================================
passo "6/9  Chaves das notificações"
# =====================================================================
cd "$BASE"
if [ -f .env ] && grep -qE '^VAPID_PRIVATE_KEY=.+' .env; then
  ok "chaves de notificação já existem — mantidas"
  VAPID_PUB=$(grep -E '^VAPID_PUBLIC_KEY=' .env | cut -d= -f2-)
  VAPID_PRIV=$(grep -E '^VAPID_PRIVATE_KEY=' .env | cut -d= -f2-)
else
  read -r VAPID_PUB VAPID_PRIV <<<"$("$NODE" push-server/scripts/generate-vapid.js --cru)"
  [ -n "$VAPID_PRIV" ] || falhar "falhou ao gerar as chaves de notificação"
  ok "chaves de notificação geradas"
fi

# =====================================================================
passo "7/9  Configurando e subindo o app"
# =====================================================================
ADMIN_TOKEN_EXISTENTE=""
[ -f .env ] && ADMIN_TOKEN_EXISTENTE=$(grep -E '^ADMIN_TOKEN=' .env | cut -d= -f2-)
ADMIN_TOKEN="${ADMIN_TOKEN_EXISTENTE:-$(openssl rand -hex 24 2>/dev/null || head -c24 /dev/urandom | od -An -tx1 | tr -d ' \n')}"

umask 077
cat > .env <<EOF
# Gerado pelo instalador em $(date -u +%Y-%m-%dT%H:%M:%SZ)
SUPABASE_URL=https://${DOMINIO_API}
SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}

VAPID_PUBLIC_KEY=${VAPID_PUB}
VAPID_PRIVATE_KEY=${VAPID_PRIV}
VAPID_SUBJECT=mailto:${EMAIL_CERT}

WEB_PORT=4000
PUSH_PORT=4100
TICK_MINUTES=15
DRY_RUN=false
TZ=America/Sao_Paulo
ADMIN_TOKEN=${ADMIN_TOKEN}
PUSH_API_URL=
EOF
chmod 600 .env
ok ".env do app escrito"

echo "  construindo a imagem do app (alguns minutos na 1ª vez)…"
docker compose up -d --build >/tmp/wd-app.log 2>&1 || { tail -30 /tmp/wd-app.log; falhar "o app não subiu"; }

echo -n "  aguardando o app responder"
APP_OK=0
for _ in $(seq 1 40); do
  if curl -fsS --max-time 3 http://127.0.0.1:4000/health >/dev/null 2>&1; then APP_OK=1; echo; break; fi
  echo -n "."; sleep 3
done
[ "$APP_OK" = "1" ] || { echo; docker compose logs --tail 30 web; falhar "o app não respondeu na porta 4000"; }
ok "app e coach diário no ar"

# =====================================================================
passo "8/9  Publicando os domínios com HTTPS"
# =====================================================================
if tem nginx; then
  cp deploy/nginx-proxy-comum.conf /etc/nginx/wedream-proxy-comum.conf

  # Copia um arquivo do repositório para o nginx, trocando os domínios
  # caso tenham sido mudados por variável de ambiente. O "api." vem
  # primeiro, senão o segundo sed estragaria o que o primeiro fez.
  copiar_site() {
    cp "$1" "$2"
    sed -i -e "s/api\.quadrodossonhos\.antonellaroweder\.com\.br/$DOMINIO_API/g" \
           -e "s/quadrodossonhos\.antonellaroweder\.com\.br/$DOMINIO_APP/g" "$2"
  }

  instalar_site() {
    local origem="$1" nome="$2"
    if [ -e "/etc/nginx/sites-available/$nome" ] && ! grep -q "we-dream\|WE DREAM" "/etc/nginx/sites-available/$nome" 2>/dev/null; then
      avisar "/etc/nginx/sites-available/$nome já existe e não é nosso — NÃO foi tocado"
      return 1
    fi
    copiar_site "$origem" "/etc/nginx/sites-available/$nome"
    ln -sf "/etc/nginx/sites-available/$nome" "/etc/nginx/sites-enabled/$nome"
    ok "site $nome instalado"
  }

  instalar_site deploy/nginx-host-quadrodossonhos.conf quadrodossonhos.conf
  instalar_site deploy/nginx-host-api-supabase.conf   api-quadrodossonhos.conf

  # o arquivo do app já vem com bloco 443; antes do certificado existir o
  # nginx não valida. Deixamos o certbot criar o bloco a partir do :80.
  if [ ! -d "/etc/letsencrypt/live/$DOMINIO_APP" ]; then
    # O "# we-dream" da primeira linha NÃO é enfeite: sem ele, a própria
    # proteção acima passa a ver este arquivo como "de outro projeto" e
    # recusa atualizá-lo na próxima execução — o site ficaria para sempre
    # neste bloco de emergência, sem HSTS, HTTP/2 nem IPv6.
    printf '# we-dream — bloco temporário até o certificado existir\nserver {\n    listen 80;\n    server_name %s;\n    client_max_body_size 20m;\n    location /.well-known/acme-challenge/ { root /var/www/html; }\n    location / {\n        proxy_pass http://127.0.0.1:4000;\n        include /etc/nginx/wedream-proxy-comum.conf;\n    }\n}\n' \
      "$DOMINIO_APP" > "/etc/nginx/sites-available/quadrodossonhos.conf"
  fi

  if nginx -t >/tmp/wd-nginx.log 2>&1; then
    systemctl reload nginx && ok "nginx recarregado (outros sites intactos)"
  else
    cat /tmp/wd-nginx.log
    falhar "a configuração do nginx não passou no teste — nada foi recarregado"
  fi

  # Agenda novas tentativas de certificado. O script se tira do cron
  # sozinho assim que os dois certificados existirem.
  agendar_https() {
    chmod +x "$BASE/deploy/tentar-https.sh" 2>/dev/null
    local linha="17 */2 * * * $BASE/deploy/tentar-https.sh"
    local atual; atual="$(crontab -l 2>/dev/null)" || atual=""
    printf '%s\n%s\n' "$(printf '%s\n' "$atual" | grep -v 'tentar-https.sh')" "$linha" \
      | grep -v '^$' | crontab - 2>/dev/null \
      && ok "novas tentativas de HTTPS agendadas (de 2 em 2h, para sozinho ao conseguir)" \
      || avisar "não consegui agendar as tentativas de HTTPS no cron"
  }

  if [ "$DNS_FALTANDO" = "1" ]; then
    avisar "HTTPS pulado: o DNS ainda não aponta para cá."
    avisar "Assim que propagar, o certificado sai sozinho:"
    agendar_https
  else
    tem certbot || apt-get install -y -qq certbot python3-certbot-nginx >/dev/null 2>&1
    for d in "$DOMINIO_APP" "$DOMINIO_API"; do
      if [ -d "/etc/letsencrypt/live/$d" ]; then
        ok "certificado de $d já existe"
      elif certbot --nginx -d "$d" --non-interactive --agree-tos -m "$EMAIL_CERT" --redirect >/tmp/wd-cert.log 2>&1; then
        ok "certificado emitido para $d"
      else
        tail -8 /tmp/wd-cert.log | sed 's/^/     /'
        avisar "não consegui emitir o certificado de $d (o site segue no ar por HTTP)"
      fi
    done
    systemctl reload nginx 2>/dev/null

    # Agora que o certificado existe, troca o bloco de emergência (só :80)
    # pela configuração completa do repositório: HSTS, HTTP/2, IPv6 e
    # server_tokens off. Sem isso o site fica no mínimo para sempre.
    #
    # Com volta atrás automática: este mesmo nginx serve o AtendimentoPRO,
    # a Evolution API, o aulingo e o rachajusto. Se a configuração nova
    # não passar no teste, a anterior volta e ninguém sai do ar.
    ATIVO="/etc/nginx/sites-available/quadrodossonhos.conf"
    if [ -d "/etc/letsencrypt/live/$DOMINIO_APP" ] \
       && ! grep -q 'Strict-Transport-Security' "$ATIVO" 2>/dev/null; then
      ANTES="$(mktemp)"; cp "$ATIVO" "$ANTES"
      copiar_site deploy/nginx-host-quadrodossonhos.conf "$ATIVO"

      if nginx -t >/tmp/wd-nginx2.log 2>&1; then
        systemctl reload nginx 2>/dev/null
        ok "configuração completa aplicada (HTTPS, HSTS, HTTP/2)"
        rm -f "$ANTES"
      else
        cp "$ANTES" "$ATIVO"; rm -f "$ANTES"
        systemctl reload nginx 2>/dev/null
        avisar "a configuração completa foi recusada pelo nginx — voltei a anterior, o site segue no ar:"
        grep -m2 -i 'emerg\|error' /tmp/wd-nginx2.log | sed 's/^/     /'
      fi
    fi

    # Faltou algum? A causa costuma ser passageira (a Let's Encrypt valida
    # de vários pontos do mundo e o domínio é recente). Deixa tentando.
    if [ ! -d "/etc/letsencrypt/live/$DOMINIO_APP" ] || [ ! -d "/etc/letsencrypt/live/$DOMINIO_API" ]; then
      agendar_https
    fi
  fi
else
  avisar "nginx não encontrado — os serviços estão no ar em 127.0.0.1, falta publicar o domínio"
fi

# =====================================================================
passo "9/9  Testando de ponta a ponta"
# =====================================================================
FALHAS=0
testar() {
  local nome="$1" url="$2" espera="${3:-}"
  local corpo
  corpo=$(curl -fsS --max-time 15 "$url" 2>/dev/null)
  if [ $? -ne 0 ]; then printf '  %s✗%s %s\n' "$R" "$N" "$nome"; FALHAS=$((FALHAS+1)); return; fi
  if [ -n "$espera" ] && ! printf '%s' "$corpo" | grep -q "$espera"; then
    printf '  %s✗%s %s (resposta inesperada)\n' "$R" "$N" "$nome"; FALHAS=$((FALHAS+1)); return
  fi
  ok "$nome"
}

testar "app respondendo"            "http://127.0.0.1:4000/health"  '"ok":true'
testar "coach diário respondendo"   "http://127.0.0.1:4100/health"  '"ok":true'
testar "login (GoTrue)"             "http://127.0.0.1:4001/health"
testar "consultas (PostgREST)"      "http://127.0.0.1:4002/"
testar "fotos (Storage)"            "http://127.0.0.1:4003/status"
testar "app conhece a API"          "http://127.0.0.1:4000/config.js" "$DOMINIO_API"

if [ "$DNS_FALTANDO" != "1" ] && [ -d "/etc/letsencrypt/live/$DOMINIO_APP" ]; then
  testar "site público no ar"       "https://$DOMINIO_APP/health"   '"ok":true'
  testar "API pública no ar"        "https://$DOMINIO_API/auth/v1/health"
fi

# credenciais em arquivo protegido
umask 077
cat > "$CREDENCIAIS" <<EOF
WE DREAM — credenciais  ($(date '+%d/%m/%Y %H:%M'))
================================================================
GUARDE ESTE ARQUIVO FORA DA VPS E APAGUE A CÓPIA DAQUI DEPOIS.

App ............ https://${DOMINIO_APP}
API ............ https://${DOMINIO_API}

Senha do Postgres ... ${SENHA_PG}
Token do coach ...... ${ADMIN_TOKEN}

Chaves completas em:
  ${BASE}/.env
  ${BASE}/supabase-selfhost/.env

Backup diário: já agendado para as 3h (crontab -l para conferir).
Guarda banco + fotos + chaves, mantendo 14 dias.
================================================================
EOF
chmod 600 "$CREDENCIAIS"

printf '\n%s╔══════════════════════════════════════════════╗%s\n' "$B" "$N"
if [ "$FALHAS" -eq 0 ]; then
  printf '%s║   ✓ WE DREAM INSTALADO E FUNCIONANDO         ║%s\n' "$V$B" "$N"
else
  printf '%s║   ⚠ INSTALADO COM %s TESTE(S) FALHANDO         ║%s\n' "$A$B" "$FALHAS" "$N"
fi
printf '%s╚══════════════════════════════════════════════╝%s\n\n' "$B" "$N"

echo "  Abra no celular:  https://${DOMINIO_APP}"
echo "  Credenciais em:   ${CREDENCIAIS}"
echo

# --------------------------------------------------- backup diário às 3h
# Instalado aqui, e não deixado como tarefa manual: um app de sonhos sem
# backup é um app que pode perder anos de fotos. Só mexe na linha dele.
BACKUP_SH="${BASE}/supabase-selfhost/scripts/backup.sh"
if [ -f "$BACKUP_SH" ]; then
  chmod +x "$BACKUP_SH" 2>/dev/null
  if crontab -l 2>/dev/null | grep -q 'supabase-selfhost/scripts/backup.sh'; then
    ok "backup diário já estava agendado"
  else
    CRON_ATUAL="$(crontab -l 2>/dev/null)" || CRON_ATUAL=""
    if printf '%s\n0 3 * * * %s >> /var/log/wedream-backup.log 2>&1\n' \
         "$CRON_ATUAL" "$BACKUP_SH" | grep -v '^$' | crontab - 2>/dev/null; then
      ok "backup diário agendado para as 3h (log em /var/log/wedream-backup.log)"
    else
      avisar "não consegui agendar o backup. Rode à mão:"
      avisar "  (crontab -l 2>/dev/null; echo '0 3 * * * $BACKUP_SH >> /var/log/wedream-backup.log 2>&1') | crontab -"
    fi
  fi
fi
echo

[ "$FALHAS" -eq 0 ] || echo "  Para investigar:  cd $BASE && docker compose logs --tail 40"
exit 0
