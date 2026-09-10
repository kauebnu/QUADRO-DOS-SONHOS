# Subindo o WE DREAM na sua VPS da Contabo

Guia passo a passo, do zero até `https://quadrodossonhos.antonellaroweder.com.br`.

> **Seus outros projetos não são tocados.** O WE DREAM sobe com nome de projeto
> próprio (`we-dream`), rede Docker própria (`we-dream-net`) e publica as portas
> só em `127.0.0.1`. Nada de mexer nos containers, redes ou portas que já existem.

---

## Antes de começar, tenha em mãos

| O quê | Onde consegue |
|---|---|
| Acesso SSH à VPS | `ssh -i ssh-key-2026-03-21.key root@158.220.116.153` — a chave fica **só na sua máquina**, nunca no repositório nem colada em chat |
| Projeto no Supabase | https://supabase.com/dashboard |
| Acesso ao DNS do domínio | painel da HostGator |

---

## 1. Criar o projeto no Supabase

1. Entre em https://supabase.com/dashboard e crie um projeto novo.
   - **Nome:** `we-dream`
   - **Região:** `South America (São Paulo)` — menor latência para o Brasil
   - Guarde a senha do banco.
2. Aguarde ficar verde (uns 2 minutos).
3. Em **Project Settings → API**, anote:
   - **Project URL** → vira `SUPABASE_URL`
   - **anon / publishable key** → vira `SUPABASE_ANON_KEY`
   - **service_role key** → vira `SUPABASE_SERVICE_ROLE_KEY`
     *(essa ignora todas as regras de segurança — só no servidor, nunca no app)*

### Aplicar o banco de dados

No painel do Supabase, **SQL Editor → New query**, e rode **na ordem**:

1. cole todo o conteúdo de `supabase/migrations/20260910000000_init_we_dream.sql` → **Run**
2. cole todo o conteúdo de `supabase/migrations/20260910000001_functions_and_rls.sql` → **Run**

Ou, se preferir a linha de comando:

```bash
npm i -g supabase
supabase link --project-ref SEU_REF
supabase db push
```

### Ajustes de autenticação

**Authentication → URL Configuration:**

- **Site URL:** `https://quadrodossonhos.antonellaroweder.com.br`
- **Redirect URLs:** adicione
  - `https://quadrodossonhos.antonellaroweder.com.br/**`

**Authentication → Providers → Email:** deixe **Confirm email** ligado
(a pessoa confirma o e-mail antes de entrar — mais seguro).

### Conferir a segurança

**Advisors → Security**: não deve haver nenhum aviso de tabela sem RLS.
Todas as tabelas do WE DREAM já sobem com RLS ligado pela migration.

---

## 2. Apontar o subdomínio (HostGator)

No painel da HostGator → **Zona de DNS** do domínio `antonellaroweder.com.br`:

| Tipo | Nome | Aponta para | TTL |
|---|---|---|---|
| A | `quadrodossonhos` | `IP_DA_SUA_VPS_CONTABO` | 14400 |

O domínio principal continua onde está. Só o subdomínio novo vai para a Contabo.

Confira a propagação (leva de minutos a algumas horas):

```bash
dig +short quadrodossonhos.antonellaroweder.com.br
```

Só siga quando aparecer o IP da Contabo.

---

## 3. Preparar a VPS

> ### ⚠ Esta VPS é compartilhada
>
> O mesmo servidor já roda o **AtendimentoPRO**: webhook na porta **3000**,
> deploy-server na **9001** e a Evolution API em Docker. Nada disso pode ser
> tocado. Por isso o WE DREAM sobe com projeto Docker próprio (`we-dream`),
> rede própria (`we-dream-net`), pasta própria (`/opt/we-dream`) e portas
> publicadas só em `127.0.0.1`.
>
> **Nunca** rode `docker compose down` fora de `/opt/we-dream`, nem
> `docker system prune -a` (o `-a` apaga imagens de outros projetos).

### Primeiro: a vistoria

Antes de instalar qualquer coisa, rode a vistoria — ela **só lê**, não altera nada:

```bash
ssh -i ssh-key-2026-03-21.key root@158.220.116.153
curl -fsSL https://raw.githubusercontent.com/kauebnu/QUADRO-DOS-SONHOS/claude/peaceful-franklin-d0a3qj/deploy/vistoria-vps.sh -o /tmp/vistoria.sh
bash /tmp/vistoria.sh
```

Ela informa: portas ocupadas, se há nginx/Traefik/Caddy em 80/443, quais
domínios já são atendidos, certificados existentes e se o subdomínio já
aponta para a VPS. Guarde essa saída — ela define os dois pontos abaixo.

### Depois: preparar a pasta

```bash
# Docker (pule se já tiver — a vistoria mostra a versão)
docker --version || curl -fsSL https://get.docker.com | sh

# pasta do projeto, separada dos outros
mkdir -p /opt/we-dream && cd /opt/we-dream
git clone -b claude/peaceful-franklin-d0a3qj \
  https://github.com/kauebnu/QUADRO-DOS-SONHOS.git .
```

### Se 8080 ou 8081 estiverem ocupadas

A vistoria avisa. Nesse caso escolha outras no `.env` (`WEB_PORT` /
`PUSH_PORT`) e ajuste o `proxy_pass` em
`deploy/nginx-host-quadrodossonhos.conf` para a mesma porta.

---

## 4. Gerar as chaves das notificações

```bash
cd /opt/we-dream/push-server
npm install
npm run vapid
```

Copie as duas chaves que aparecerem — vão para o `.env` no próximo passo.

---

## 5. Configurar o `.env`

```bash
cd /opt/we-dream
cp .env.example .env
nano .env
```

Preencha:

```ini
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
VAPID_PUBLIC_KEY=BN...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contato@antonellaroweder.com.br
WEB_PORT=8080
PUSH_PORT=8081
ADMIN_TOKEN=cole-aqui-o-resultado-de-openssl-rand-hex-24
TZ=America/Sao_Paulo
```

Proteja o arquivo:

```bash
chmod 600 .env
```

> **Dica para o primeiro dia:** deixe `DRY_RUN=true`. O servidor registra no log
> quem receberia notificação, sem enviar nada. Depois de conferir, mude para
> `false` e rode `docker compose up -d`.

---

## 6. Subir os containers

```bash
cd /opt/we-dream
docker compose up -d --build
docker compose ps
```

Você deve ver `we-dream-web` e `we-dream-push` como `healthy`.

Teste por dentro da VPS:

```bash
curl -s http://127.0.0.1:8080/health   # {"ok":true,"servico":"we-dream-web"}
curl -s http://127.0.0.1:8081/health   # {"ok":true,"servico":"we-dream-push"}
curl -s http://127.0.0.1:8080/config.js  # deve mostrar a URL do seu Supabase
```

Logs:

```bash
docker compose logs -f web
docker compose logs -f push
```

---

## 7. Publicar o domínio com HTTPS

### Se a VPS usa **nginx** no host

```bash
# 1. instala o certbot (pule se já tiver)
apt update && apt install -y certbot python3-certbot-nginx

# 2. copia a configuração do site
cp /opt/we-dream/deploy/nginx-host-quadrodossonhos.conf \
   /etc/nginx/sites-available/quadrodossonhos.conf
ln -s /etc/nginx/sites-available/quadrodossonhos.conf \
      /etc/nginx/sites-enabled/quadrodossonhos.conf

# 3. emite o certificado (o certbot ajusta o arquivo sozinho)
certbot --nginx -d quadrodossonhos.antonellaroweder.com.br

# 4. valida e recarrega — só este site é afetado
nginx -t && systemctl reload nginx
```

A renovação do certificado já vem automática (`systemctl status certbot.timer`).

### Se a VPS usa **Traefik**

Não precisa do nginx do host. Adicione ao serviço `web` no `docker-compose.yml`:

```yaml
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=NOME_DA_SUA_REDE_TRAEFIK"
      - "traefik.http.routers.wedream.rule=Host(`quadrodossonhos.antonellaroweder.com.br`)"
      - "traefik.http.routers.wedream.entrypoints=websecure"
      - "traefik.http.routers.wedream.tls.certresolver=SEU_RESOLVER"
      - "traefik.http.services.wedream.loadbalancer.server.port=80"
```

E conecte **apenas o serviço `web`** à rede externa do Traefik:

```yaml
    networks:
      - wedream
      - traefik

networks:
  traefik:
    external: true
    name: NOME_DA_SUA_REDE_TRAEFIK
```

O serviço `push` fica só na rede interna — ele nunca deve ser publicado.

### Se a VPS usa **Caddy**

No `Caddyfile`:

```
quadrodossonhos.antonellaroweder.com.br {
    reverse_proxy 127.0.0.1:8080
}
```

---

## 8. Testar tudo funcionando

1. Abra `https://quadrodossonhos.antonellaroweder.com.br` no celular.
2. Crie sua conta e confirme o e-mail.
3. Adicione um sonho com foto → confirme que a imagem aparece.
4. **Instalar o app:**
   - **Android/Chrome:** menu ⋮ → *Adicionar à tela inicial*
   - **iPhone/Safari:** botão compartilhar → *Adicionar à Tela de Início*
     *(no iPhone as notificações só funcionam depois de instalado assim)*
5. Em **Perfil → Lembrete diário**, ligue as notificações e toque em
   *Ver como fica a notificação*.
6. Force uma rodada de verdade para conferir o envio:

```bash
curl -X POST -H "x-admin-token: SEU_ADMIN_TOKEN" http://127.0.0.1:8081/run
```

> A rodada só envia para quem está **na hora escolhida** e ainda não recebeu
> nas últimas 20 horas. Para testar na hora, mude o horário no seu perfil para
> a hora atual e rode o comando de novo.

---

## 9. Atualizar o app depois

```bash
cd /opt/we-dream
git pull
docker compose up -d --build
```

O service worker atualiza os celulares sozinho na próxima abertura.

---

## 10. Backup

O que importa está no Supabase (banco + fotos):

- **Banco:** Supabase → *Database → Backups* (o plano gratuito guarda alguns dias).
  Para um backup manual:
  ```bash
  supabase db dump --db-url "postgresql://postgres:SENHA@db.SEU_REF.supabase.co:5432/postgres" \
    -f backup-$(date +%F).sql
  ```
- **Fotos:** Supabase → *Storage → dream-images*.
- **`.env`:** guarde uma cópia em local seguro. É o único arquivo da VPS
  que não dá para recriar a partir do repositório.

---

## Comandos do dia a dia

```bash
cd /opt/we-dream

docker compose ps                    # como estão os containers
docker compose logs -f push          # acompanhar as notificações
docker compose restart push          # reiniciar só o coach
docker compose down                  # derrubar o WE DREAM (só ele)
docker compose up -d --build         # subir de novo
docker stats we-dream-web we-dream-push   # consumo de recursos
```

---

## Se algo der errado

| Sintoma | O que olhar |
|---|---|
| Site não abre | `docker compose ps`, `nginx -t`, `dig +short quadrodossonhos...` |
| Abre em "modo demonstração" | `curl 127.0.0.1:8080/config.js` — as chaves do Supabase estão lá? |
| Login não funciona | Supabase → Authentication → **Site URL** e **Redirect URLs** |
| Fotos não aparecem | Supabase → Storage → o bucket `dream-images` existe? A migration 2 rodou? |
| Notificação não chega | `docker compose logs push`; conferir VAPID; no iPhone, o app precisa estar instalado na tela de início |
| Porta ocupada | mude `WEB_PORT`/`PUSH_PORT` no `.env` e o `proxy_pass` do nginx |
| Sem espaço em disco | `docker system prune -f` (remove só imagens sem uso) |
