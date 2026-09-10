#!/usr/bin/env bash
# =====================================================================
# Vistoria da VPS — SOMENTE LEITURA
#
# Este script NÃO instala, NÃO altera, NÃO para e NÃO reinicia nada.
# Ele só olha o que já está rodando, para o WE DREAM ser instalado sem
# esbarrar nos projetos que já estão no ar.
#
# Como usar, dentro da VPS:
#   bash vistoria-vps.sh
#
# Depois copie a saída inteira e cole na conversa.
# =====================================================================
set -uo pipefail

# ss, netstat e ufw moram em sbin, que some do PATH em shells não-login
export PATH="$PATH:/usr/sbin:/sbin:/usr/local/sbin"

titulo() { printf '\n\033[1m── %s\033[0m\n' "$1"; }
tem()    { command -v "$1" >/dev/null 2>&1; }

echo "════════════════════════════════════════════════"
echo " VISTORIA DA VPS — $(date '+%d/%m/%Y %H:%M')"
echo "════════════════════════════════════════════════"

titulo "Sistema"
if [ -r /etc/os-release ]; then . /etc/os-release; echo "SO:      ${PRETTY_NAME:-desconhecido}"; fi
echo "Kernel:  $(uname -r)"
echo "CPUs:    $(nproc 2>/dev/null || echo '?')"
echo "Memória: $(free -h 2>/dev/null | awk '/^Mem:/{print $3" usados de "$2}')"
echo "Disco /: $(df -h / 2>/dev/null | awk 'NR==2{print $3" usados de "$2" ("$5"), "$4" livres"}')"

titulo "Docker"
if tem docker; then
  docker --version
  docker compose version 2>/dev/null || echo "(plugin compose não encontrado)"
  echo
  echo "Containers em execução:"
  docker ps --format '  {{.Names}}  │  {{.Image}}  │  {{.Ports}}' 2>/dev/null || echo "  (sem permissão para listar)"
  echo
  echo "Redes:"
  docker network ls --format '  {{.Name}} ({{.Driver}})' 2>/dev/null
  echo
  echo "Espaço usado pelo Docker:"
  docker system df 2>/dev/null | sed 's/^/  /'
else
  echo "Docker NÃO está instalado."
fi

titulo "Proxy reverso (quem atende as portas 80/443)"
for s in nginx apache2 caddy traefik haproxy; do
  if tem systemctl && systemctl is-active --quiet "$s" 2>/dev/null; then
    echo "  ✔ $s está ATIVO (serviço do sistema)"
  fi
done
if tem docker; then
  docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' 2>/dev/null \
    | grep -Ei 'traefik|nginx|caddy|proxy' | sed 's/^/  ✔ (container) /' || true
fi
echo "  — se nada apareceu acima, não há proxy reverso instalado —"

titulo "Portas em escuta"
FERRAMENTA=""
if   tem ss;      then FERRAMENTA=ss
elif tem netstat; then FERRAMENTA=netstat
elif tem lsof;    then FERRAMENTA=lsof
fi

case "$FERRAMENTA" in
  ss)      ss -lptnH 2>/dev/null | awk '{print $4, $6}' | sort -u | sed 's/^/  /' ;;
  netstat) netstat -lptn 2>/dev/null | tail -n +3 | sed 's/^/  /' ;;
  lsof)    lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | sed 's/^/  /' ;;
  *)       echo "  ⚠ ss, netstat e lsof indisponíveis — não deu para listar" ;;
esac

titulo "As portas que o WE DREAM quer usar"
if [ -z "$FERRAMENTA" ]; then
  # Sem ferramenta não dá para afirmar nada. Dizer "livre" aqui seria mentira
  # capaz de derrubar outro projeto que já usa a porta.
  echo "  ⚠ NÃO FOI POSSÍVEL VERIFICAR (instale iproute2: apt install -y iproute2)"
  echo "    Confira à mão antes de subir."
else
  for p in 8080 8081; do
    case "$FERRAMENTA" in
      ss)      ocupada=$(ss -lptnH "sport = :$p" 2>/dev/null) ;;
      netstat) ocupada=$(netstat -lptn 2>/dev/null | awk -v p=":$p\$" '$4 ~ p') ;;
      lsof)    ocupada=$(lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null | tail -n +2) ;;
    esac
    if [ -n "$ocupada" ]; then
      echo "  ✗ $p OCUPADA:"
      printf '%s\n' "$ocupada" | sed 's/^/      /'
    else
      echo "  ✔ $p livre"
    fi
  done
fi

titulo "Sites configurados no nginx (se houver)"
if [ -d /etc/nginx/sites-enabled ]; then
  ls -1 /etc/nginx/sites-enabled 2>/dev/null | sed 's/^/  /' || echo "  (vazio)"
  echo
  echo "  Domínios atendidos:"
  grep -rhoP '^\s*server_name\s+\K[^;]+' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null \
    | tr ' ' '\n' | grep -v '^$' | sort -u | sed 's/^/    /'
else
  echo "  (sem /etc/nginx/sites-enabled)"
fi

titulo "Certificados HTTPS existentes"
if [ -d /etc/letsencrypt/live ]; then
  ls -1 /etc/letsencrypt/live 2>/dev/null | grep -v README | sed 's/^/  /'
  tem certbot && echo "  certbot: $(certbot --version 2>&1 | head -1)"
else
  echo "  (nenhum certificado do Let's Encrypt)"
fi

titulo "Firewall"
if tem ufw; then ufw status 2>/dev/null | head -12 | sed 's/^/  /'; else echo "  ufw não instalado"; fi

titulo "O subdomínio já aponta para cá?"
MEU_IP=$(curl -s --max-time 8 https://api.ipify.org 2>/dev/null || echo '?')
echo "  IP público desta VPS: ${MEU_IP}"
if tem dig; then
  echo "  quadrodossonhos.antonellaroweder.com.br → $(dig +short quadrodossonhos.antonellaroweder.com.br | tr '\n' ' ')"
elif tem host; then
  host quadrodossonhos.antonellaroweder.com.br 2>&1 | head -2 | sed 's/^/  /'
else
  echo "  (dig/host indisponíveis)"
fi

titulo "Pastas em /opt"
ls -1 /opt 2>/dev/null | sed 's/^/  /' || echo "  (vazio)"

echo
echo "════════════════════════════════════════════════"
echo " Fim. Copie tudo acima e cole na conversa."
echo " Nada foi alterado nesta máquina."
echo "════════════════════════════════════════════════"
