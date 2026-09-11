#!/usr/bin/env bash
# =====================================================================
# WE DREAM — insiste no certificado HTTPS até conseguir.
#
# Existe porque a Let's Encrypt pode recusar a emissão por um motivo
# passageiro que não é culpa da nossa configuração:
#
#     During secondary validation: DNS problem: networking error
#
# A Let's Encrypt valida de vários pontos do mundo. Quando o domínio
# acabou de ser criado, alguns desses pontos ainda não enxergam os
# nameservers — e não há nada a corrigir, só esperar.
#
# Este script tenta de novo de tempos em tempos. Assim que os dois
# certificados existirem, ele TIRA A SI MESMO do cron e para.
#
# Instalar (o instalador já faz isso sozinho quando precisa):
#   (crontab -l 2>/dev/null | grep -v tentar-https.sh;
#    echo '17 */2 * * * /opt/we-dream/deploy/tentar-https.sh') | crontab -
#
# Acompanhar:  tail -f /var/log/wedream-https.log
# Desistir:    crontab -l | grep -v tentar-https.sh | crontab -
# =====================================================================
set -uo pipefail
export PATH="$PATH:/usr/sbin:/sbin:/usr/local/sbin"

DOMINIO_APP="${DOMINIO_APP:-quadrodossonhos.antonellaroweder.com.br}"
DOMINIO_API="${DOMINIO_API:-api.quadrodossonhos.antonellaroweder.com.br}"
EMAIL_CERT="${EMAIL_CERT:-kauebnu@gmail.com}"
LOG="${LOG:-/var/log/wedream-https.log}"
ESTADO="${ESTADO:-/var/lib/wedream}"
CONTADOR="$ESTADO/tentativas-https"

# de 2 em 2 horas, 84 tentativas dão 7 dias. Se em uma semana não saiu,
# o problema não é passageiro: é hora de trocar o DNS de lugar.
MAX_TENTATIVAS="${MAX_TENTATIVAS:-84}"

mkdir -p "$ESTADO"
registrar() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG"; }

tem_cert() { [ -d "/etc/letsencrypt/live/$1" ]; }

# Tira este script do cron. Usado tanto na vitória quanto na desistência.
sair_do_cron() {
  local atual
  atual="$(crontab -l 2>/dev/null)" || atual=""
  printf '%s\n' "$atual" | grep -v 'tentar-https.sh' | crontab - 2>/dev/null
}

# ------------------------------------------------- já está tudo pronto?
if tem_cert "$DOMINIO_APP" && tem_cert "$DOMINIO_API"; then
  registrar "os dois certificados já existem — nada a fazer, saindo do cron"
  sair_do_cron
  exit 0
fi

# ------------------------------------------------------- limite de tentativas
N=$(( $(cat "$CONTADOR" 2>/dev/null || echo 0) + 1 ))
echo "$N" > "$CONTADOR"

if [ "$N" -gt "$MAX_TENTATIVAS" ]; then
  registrar "desisti depois de $MAX_TENTATIVAS tentativas. O site continua no ar por HTTP."
  registrar "A saída agora é mover o DNS para a Cloudflare (grátis) e rodar este script de novo."
  sair_do_cron
  exit 0
fi

command -v certbot >/dev/null 2>&1 || {
  registrar "certbot não está instalado — nada a fazer"
  exit 0
}

# --------------------------------------------------------------- tentar
# Um domínio por vez, de propósito: se só um deles falhar na validação,
# o outro ainda sai. Num pedido único, a falha de um derruba os dois.
for d in "$DOMINIO_APP" "$DOMINIO_API"; do
  tem_cert "$d" && continue

  if certbot --nginx -d "$d" \
       --non-interactive --agree-tos -m "$EMAIL_CERT" --redirect \
       >/tmp/wd-cert-$$.log 2>&1
  then
    registrar "✓ certificado emitido para $d (tentativa $N)"
  else
    registrar "tentativa $N falhou para $d: $(grep -m1 -i 'problem\|error\|detail' /tmp/wd-cert-$$.log | tr -d '\r' | cut -c1-160)"
  fi
  rm -f /tmp/wd-cert-$$.log
done

# --------------------------------------------------------------- fechar
if tem_cert "$DOMINIO_APP" && tem_cert "$DOMINIO_API"; then
  nginx -t >/dev/null 2>&1 && systemctl reload nginx 2>/dev/null
  registrar "✓ HTTPS no ar nos dois domínios. Saindo do cron — não preciso mais rodar."
  sair_do_cron
fi

exit 0
