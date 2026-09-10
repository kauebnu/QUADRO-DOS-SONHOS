# Supabase do WE DREAM, na sua VPS

Em vez do supabase.com, o WE DREAM usa um Supabase rodando no seu próprio
servidor — **no mesmo padrão do aulingo**, que já está nessa VPS.

---

## Por que só 4 containers

A pilha oficial do Supabase são **11 containers e 3–4 GB de RAM**. Sua VPS tem
8 GB e já roda AtendimentoPRO, Evolution API, aulingo e rachajusto. Instalar a
pilha completa deixaria tudo no limite — e, faltando memória, o Postgres é o
primeiro que o sistema derruba.

Aqui ficam só os serviços que o WE DREAM realmente usa (**~1 GB**):

| Serviço | Para quê | Porta (só em `127.0.0.1`) |
|---|---|---|
| `db` | Postgres com os schemas e papéis do Supabase | 5434 |
| `auth` | cadastro e login por e-mail/senha (GoTrue) | 4001 |
| `rest` | responde às consultas do app (PostgREST) | 4002 |
| `storage` | fotos dos sonhos, com links assinados | 4003 |

**Ficou de fora:** Realtime (o app não assina mudanças ao vivo), Edge Functions,
Supavisor, Analytics, imgproxy (o app já comprime a foto no celular) e o
gateway Envoy — **o nginx do host faz esse papel**, exatamente como no aulingo.

O painel visual é opcional e não fica ligado à toa:

```bash
docker compose --profile studio up -d     # sobe meta + studio
docker compose stop studio meta           # desliga quando terminar
```

---

## O preço de hospedar você mesma

| | supabase.com | aqui |
|---|---|---|
| Limite de projetos | 2 no plano free | nenhum |
| Backup | automático | **por sua conta** |
| Atualização | automática | **por sua conta** |
| Se o servidor cair | não afeta | o app sai do ar |
| Dados | nos EUA | na sua máquina |

O passo 6 abaixo resolve o backup. Não pule.

---

## Passo a passo

### 1. Dois subdomínios no DNS

| Tipo | Nome | Aponta para |
|---|---|---|
| A | `quadrodossonhos` | `158.220.116.153` |
| A | `api.quadrodossonhos` | `158.220.116.153` |

Confirme antes de seguir — o certbot falha se o DNS ainda não propagou:

```bash
dig +short api.quadrodossonhos.antonellaroweder.com.br
```

### 2. Gerar as chaves

```bash
cd /opt/we-dream/supabase-selfhost
node scripts/gerar-env.mjs --app quadrodossonhos.antonellaroweder.com.br
```

Ele recusa portas já usadas nesta VPS e imprime:

- as três linhas para colar no `.env` do WE DREAM;
- a senha do Postgres.

**Guarde fora da VPS.** Perder o `JWT_SECRET` invalida todas as sessões.

```bash
node scripts/verificar-env.mjs      # só siga com ✅
```

### 3. Subir

```bash
docker compose up -d
docker compose ps        # os 4 devem ficar healthy (~1 min)
```

### 4. Criar as tabelas

```bash
./scripts/aplicar-migrations.sh
```

Confere sozinho ao final: 12 tabelas, todas com RLS, bucket de fotos privado e
gatilho de novo usuário. Pode rodar de novo quando quiser.

### 5. Publicar a API

O nginx faz o papel de gateway, encaminhando cada prefixo:

```bash
sudo cp ../deploy/nginx-proxy-comum.conf /etc/nginx/wedream-proxy-comum.conf
sudo cp ../deploy/nginx-host-api-supabase.conf \
        /etc/nginx/sites-available/api-quadrodossonhos.conf
sudo ln -s /etc/nginx/sites-available/api-quadrodossonhos.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.quadrodossonhos.antonellaroweder.com.br
```

Teste os três caminhos:

```bash
curl -s https://api.quadrodossonhos.antonellaroweder.com.br/auth/v1/health
curl -s -o /dev/null -w '%{http_code}\n' \
     https://api.quadrodossonhos.antonellaroweder.com.br/rest/v1/
curl -s https://api.quadrodossonhos.antonellaroweder.com.br/storage/v1/status
```

### 6. Backup — configure hoje

```bash
mkdir -p /root/backups/wedream
crontab -e
```

```cron
0 3 * * * /opt/we-dream/supabase-selfhost/scripts/backup.sh >> /var/log/wedream-backup.log 2>&1
```

Guarda banco, fotos e chaves, com 14 dias de rotação. **Copie para fora da
VPS** — backup no mesmo servidor não protege contra perder o servidor.

---

## O painel (Studio)

Não fica exposto na internet. Para usar, abra um túnel da sua máquina:

```bash
ssh -i ssh-key-2026-03-21.key -L 4004:127.0.0.1:4004 root@158.220.116.153
```

E acesse `http://localhost:4004` no navegador. Para ver dados rapidamente sem
o Studio:

```bash
docker exec -it wedream-db psql -U postgres -c "select display_name, created_at from profiles;"
docker exec -it wedream-db psql -U postgres -c "select title, status from dreams;"
```

---

## E-mail

O gerador deixa `ENABLE_EMAIL_AUTOCONFIRM=true`: a conta é criada e já entra,
sem confirmar. É o único jeito de funcionar sem servidor de e-mail — **mas
assim a recuperação de senha não funciona**.

Para resolver, preencha o SMTP no `.env` (Resend, Brevo, SES ou o SMTP do seu
e-mail), mude `ENABLE_EMAIL_AUTOCONFIRM=false` e rode
`docker compose up -d auth`.

---

## Comandos do dia a dia

```bash
cd /opt/we-dream/supabase-selfhost

docker compose ps                 # estado dos 4
docker compose logs -f auth       # login com problema
docker compose logs -f rest       # consulta com problema
docker compose logs -f storage    # foto com problema
docker compose restart auth
docker compose down               # derruba SÓ o Supabase do WE DREAM

docker stats $(docker ps --filter name=wedream- -q)
```

> **Nunca** rode `docker system prune -a` nesta VPS: o `-a` apaga imagens de
> outros projetos, incluindo a Evolution API e o aulingo.

---

## Se algo der errado

| Sintoma | Onde olhar |
|---|---|
| "Invalid API key" no app | a `ANON_KEY` do `/opt/we-dream/.env` tem de ser a do mesmo `.env` daqui. Rode `node scripts/verificar-env.mjs` |
| Cadastro não conclui | `docker compose logs auth`; conferir `SITE_URL` e `ADDITIONAL_REDIRECT_URLS` |
| Consultas com 401 | o `JWT_SECRET` mudou depois de gerar as chaves — regere as duas juntas |
| Foto envia mas não aparece | `docker compose logs storage`; o `aplicar-migrations.sh` rodou? o bucket `dream-images` existe? |
| Foto com link quebrado | conferir `SUPABASE_PUBLIC_URL` e se o nginx está limpando `X-Forwarded-Path` |
| `rest` não fica healthy | `PGRST_DB_SCHEMAS` precisa conter `public,storage` |
| Postgres reiniciando | falta de memória: `free -h` e `docker stats` |

---

## Atualizar depois

```bash
cd /opt/we-dream/supabase-selfhost
./scripts/backup.sh                       # sempre antes
# edite as tags de imagem no docker-compose.yml
docker compose pull && docker compose up -d
docker compose ps
```

As versões estão fixadas de propósito — nada muda sozinho debaixo de você.
Confira as notas de versão do Supabase antes de subir de versão.
