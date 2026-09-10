# Subindo o WE DREAM na sua VPS da Contabo

Do zero até `https://quadrodossonhos.antonellaroweder.com.br`, na ordem certa.

> ### ⚠ Esta VPS é compartilhada
>
> O mesmo servidor já roda o **AtendimentoPRO**: webhook na porta **3000**,
> deploy-server na **9001** e a Evolution API em Docker. Nada disso pode ser
> tocado.
>
> Por isso tudo aqui sobe isolado: projeto Docker próprio, rede própria, pasta
> própria em `/opt/we-dream` e portas publicadas só em `127.0.0.1`.
>
> **Nunca** rode nesta VPS:
> - `docker compose down` fora de `/opt/we-dream` — derruba outro projeto
> - `docker system prune -a` — o `-a` apaga imagens de outros projetos,
>   incluindo a Evolution API

---

## Como fica montado

Três peças, cada uma isolada:

| Peça | Onde | Porta local | Domínio |
|---|---|---|---|
| **App** (PWA) | `/opt/we-dream` | 8080 | `quadrodossonhos.antonellaroweder.com.br` |
| **Coach diário** (notificações) | `/opt/we-dream` | 8081 | nenhum — só interno |
| **Supabase** (contas, banco, fotos) | `/opt/we-dream/supabase-selfhost` | 8000 | `api.quadrodossonhos.antonellaroweder.com.br` |

O Supabase roda **na sua VPS**, não no supabase.com: sem limite de projetos,
dados e fotos na sua máquina. Em troca, backup e atualização passam a ser sua
responsabilidade — veja `supabase-selfhost/README.md`.

---

## O que ter em mãos

| O quê | Onde |
|---|---|
| Acesso SSH | `ssh -i ssh-key-2026-03-21.key root@158.220.116.153` — a chave fica **só na sua máquina**, nunca no repositório nem colada em chat |
| DNS do domínio | painel da HostGator |
| Node.js na VPS | usado pelos scripts de chave (`node --version`) |

---

## 1. Vistoria (só leitura, não altera nada)

```bash
ssh -i ssh-key-2026-03-21.key root@158.220.116.153

curl -fsSL https://raw.githubusercontent.com/kauebnu/QUADRO-DOS-SONHOS/claude/peaceful-franklin-d0a3qj/deploy/vistoria-vps.sh -o /tmp/vistoria.sh
bash /tmp/vistoria.sh
```

Ela responde as perguntas que decidem o resto:

- **Memória livre.** O Supabase são 11 containers, de 3 a 4 GB de RAM, além do
  que já roda. Sem folga, o Postgres é o primeiro a ser morto pelo sistema — e
  o app cai junto. Se estiver apertado, pare aqui e me avise.
- **As portas 8000, 8080, 8081, 5433 e 6544 estão livres?**
- **Já existe nginx, Traefik ou Caddy em 80/443?**
- **Já existe outro Supabase rodando** (do aulingo, por exemplo)?

Guarde a saída.

---

## 2. DNS: dois subdomínios

HostGator → **Zona de DNS** de `antonellaroweder.com.br`:

| Tipo | Nome | Aponta para | TTL |
|---|---|---|---|
| A | `quadrodossonhos` | IP da VPS | 14400 |
| A | `api.quadrodossonhos` | IP da VPS | 14400 |

O primeiro é o app; o segundo é a API do Supabase. O domínio principal
continua onde está.

Confira antes de seguir (pode levar de minutos a horas):

```bash
dig +short quadrodossonhos.antonellaroweder.com.br
dig +short api.quadrodossonhos.antonellaroweder.com.br
```

Só continue quando os dois mostrarem o IP da Contabo.

---

## 3. Baixar o projeto

```bash
docker --version || curl -fsSL https://get.docker.com | sh
node --version   || curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs

mkdir -p /opt/we-dream && cd /opt/we-dream
git clone -b claude/peaceful-franklin-d0a3qj \
  https://github.com/kauebnu/QUADRO-DOS-SONHOS.git .
```

---

## 4. Subir o Supabase

```bash
cd /opt/we-dream/supabase-selfhost

# gera todas as senhas e chaves
node scripts/gerar-env.mjs --app quadrodossonhos.antonellaroweder.com.br
```

**Copie o que ele imprimir** — as três linhas do WE DREAM, a senha do painel e
a senha do Postgres. Guarde fora da VPS.

```bash
# confere assinatura das chaves, tamanhos, isolamento e URLs
node scripts/verificar-env.mjs

# sobe (na primeira vez baixa ~2 GB de imagens)
docker compose up -d
docker compose ps        # espere todos ficarem healthy, ~2 min

# cria as tabelas do WE DREAM
./scripts/aplicar-migrations.sh
```

O último comando confere sozinho: 12 tabelas, todas com RLS, bucket de fotos
privado e gatilho de novo usuário.

Detalhes, backup e atualização: **[../supabase-selfhost/README.md](../supabase-selfhost/README.md)**

---

## 5. Chaves das notificações

```bash
cd /opt/we-dream/push-server
npm install
npm run vapid
```

Copie as duas chaves.

---

## 6. Configurar o `.env` do WE DREAM

```bash
cd /opt/we-dream
cp .env.example .env
nano .env
chmod 600 .env
```

Preencha com o que você copiou nos passos 4 e 5:

```ini
# do passo 4 (gerar-env.mjs)
SUPABASE_URL=https://api.quadrodossonhos.antonellaroweder.com.br
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# do passo 5 (npm run vapid)
VAPID_PUBLIC_KEY=BN...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contato@antonellaroweder.com.br

WEB_PORT=8080
PUSH_PORT=8081
ADMIN_TOKEN=cole-o-resultado-de: openssl rand -hex 24
TZ=America/Sao_Paulo
```

> **No primeiro dia, deixe `DRY_RUN=true`.** O coach registra no log quem
> receberia notificação, sem enviar nada. Conferido, mude para `false` e rode
> `docker compose up -d`.

---

## 7. Subir o app

```bash
cd /opt/we-dream
docker compose up -d --build
docker compose ps
```

`we-dream-web` e `we-dream-push` devem ficar `healthy`. Teste por dentro:

```bash
curl -s http://127.0.0.1:8080/health     # {"ok":true,"servico":"we-dream-web"}
curl -s http://127.0.0.1:8081/health     # {"ok":true,"servico":"we-dream-push"}
curl -s http://127.0.0.1:8080/config.js  # deve mostrar a URL da sua API
curl -s http://127.0.0.1:8000/auth/v1/health   # Supabase respondendo
```

---

## 8. Publicar os dois domínios com HTTPS

### Se a VPS usa **nginx** (o mais provável)

```bash
apt update && apt install -y certbot python3-certbot-nginx

# app
cp /opt/we-dream/deploy/nginx-host-quadrodossonhos.conf \
   /etc/nginx/sites-available/quadrodossonhos.conf
ln -s /etc/nginx/sites-available/quadrodossonhos.conf /etc/nginx/sites-enabled/

# API do Supabase
cp /opt/we-dream/deploy/nginx-host-api-supabase.conf \
   /etc/nginx/sites-available/api-quadrodossonhos.conf
ln -s /etc/nginx/sites-available/api-quadrodossonhos.conf /etc/nginx/sites-enabled/

# certificados (o certbot ajusta os arquivos sozinho)
certbot --nginx -d quadrodossonhos.antonellaroweder.com.br
certbot --nginx -d api.quadrodossonhos.antonellaroweder.com.br

nginx -t && systemctl reload nginx
```

> Se o `nginx -t` reclamar de **`duplicate map "$http_upgrade"`**, é porque
> outro site já define esse mapa. Apague as 4 últimas linhas de
> `/etc/nginx/sites-available/api-quadrodossonhos.conf` e teste de novo.

A renovação é automática (`systemctl status certbot.timer`).

### Se a VPS usa **Traefik**

Adicione ao serviço `web` do `/opt/we-dream/docker-compose.yml`:

```yaml
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=NOME_DA_SUA_REDE_TRAEFIK"
      - "traefik.http.routers.wedream.rule=Host(`quadrodossonhos.antonellaroweder.com.br`)"
      - "traefik.http.routers.wedream.entrypoints=websecure"
      - "traefik.http.routers.wedream.tls.certresolver=SEU_RESOLVER"
      - "traefik.http.services.wedream.loadbalancer.server.port=80"
```

E o equivalente para o `api-gw` do Supabase, apontando para a porta 8000.
Conecte à rede do Traefik **apenas** esses dois serviços — o `push` e o banco
nunca devem ser publicados.

### Se a VPS usa **Caddy**

```
quadrodossonhos.antonellaroweder.com.br {
    reverse_proxy 127.0.0.1:8080
}
api.quadrodossonhos.antonellaroweder.com.br {
    reverse_proxy 127.0.0.1:8000
}
```

---

## 9. Testar de verdade

1. Abra `https://quadrodossonhos.antonellaroweder.com.br` no celular.
2. Crie sua conta. *(A confirmação por e-mail vem desligada — sem SMTP ela
   impediria qualquer cadastro. Para ligar, veja o README do Supabase.)*
3. Adicione um sonho **com foto** e confirme que a imagem aparece. Isso testa o
   caminho todo: login, banco e storage.
4. **Instale o app:**
   - **Android/Chrome:** menu ⋮ → *Adicionar à tela inicial*
   - **iPhone/Safari:** compartilhar → *Adicionar à Tela de Início*
     *(no iPhone, notificações só funcionam depois de instalado assim)*
5. **Perfil → Lembrete diário:** ligue e toque em *Ver como fica a notificação*.
6. Force uma rodada real:

```bash
curl -X POST -H "x-admin-token: SEU_ADMIN_TOKEN" http://127.0.0.1:8081/run
```

> A rodada só envia para quem está **na hora escolhida** e não recebeu nas
> últimas 20 horas. Para testar na hora, mude o horário no seu perfil para a
> hora atual e rode de novo.

---

## 10. Backup — agora é com você

Sem o supabase.com, ninguém faz backup automático. Configure hoje:

```bash
mkdir -p /root/backups/wedream
crontab -e
```

```cron
0 3 * * * /opt/we-dream/supabase-selfhost/scripts/backup.sh >> /var/log/wedream-backup.log 2>&1
```

Guarda banco, fotos e chaves dos últimos 14 dias. **Copie para fora da VPS** —
backup no mesmo servidor não protege contra perder o servidor.

---

## Atualizar o app depois

```bash
cd /opt/we-dream
git pull
docker compose up -d --build
```

O service worker atualiza os celulares na próxima abertura. O Supabase não é
afetado — são pilhas separadas.

---

## Comandos do dia a dia

```bash
cd /opt/we-dream

docker compose ps                     # app e coach
docker compose logs -f push           # acompanhar notificações
docker compose restart push
docker compose up -d --build          # depois de um git pull

cd /opt/we-dream/supabase-selfhost
docker compose ps                     # os 11 do Supabase
docker compose logs -f auth           # problema de login
docker compose logs -f db             # banco

docker stats $(docker ps --filter name=we-dream --filter name=wedream- -q)
```

---

## Se algo der errado

| Sintoma | Onde olhar |
|---|---|
| Site não abre | `docker compose ps`, `nginx -t`, `dig +short quadrodossonhos...` |
| Abre em "modo demonstração" | `curl 127.0.0.1:8080/config.js` — as chaves estão lá? |
| Login não funciona | `docker compose logs auth` no supabase-selfhost; conferir `SITE_URL` e `API_EXTERNAL_URL` no `.env` de lá |
| "Invalid API key" | a `ANON_KEY` do `/opt/we-dream/.env` precisa ser a do MESMO `.env` do Supabase. Rode `node scripts/verificar-env.mjs` |
| Fotos não aparecem | `docker compose logs storage`; o `aplicar-migrations.sh` rodou? |
| Notificação não chega | `docker compose logs push`; no iPhone o app precisa estar instalado na tela de início |
| Postgres reiniciando sozinho | falta de memória. `free -h` e `docker stats` |
| Porta ocupada | troque no `.env` e ajuste o `proxy_pass` do nginx |
| Sem espaço | `docker image prune` (**sem** o `-a`) |
