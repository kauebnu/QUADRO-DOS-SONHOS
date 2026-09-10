# Supabase no seu servidor

Em vez de usar o supabase.com, o WE DREAM roda com um Supabase **na sua
própria VPS**. Seus dados e as fotos dos sonhos ficam com você, e não há
limite de projetos.

Esta pasta contém a pilha **oficial** do Supabase (copiada de
`supabase/supabase/docker`, sem alteração no `docker-compose.yml`) mais os
ajustes específicos desta VPS, isolados em `docker-compose.override.yml`.

---

## Antes de decidir: o preço disso

Vale saber no que você está entrando:

| | supabase.com | aqui, no seu servidor |
|---|---|---|
| Custo | grátis até um limite | usa a RAM e o disco da sua VPS |
| Limite de projetos | 2 no plano free | nenhum |
| Backup | automático | **por sua conta** |
| Atualização de versão | automática | **por sua conta** |
| Se o servidor cair | não afeta | o app sai do ar |
| Dados | nos EUA | na sua máquina |

**Consumo:** são 11 containers. Conte com **3 a 4 GB de RAM** e ~5 GB de disco
só para o Supabase — além do que o AtendimentoPRO e a Evolution API já usam.
Rode `deploy/vistoria-vps.sh` e confira a memória livre antes de subir. Se
sobrar pouco, o Postgres é o primeiro a ser morto pelo sistema, e aí o app
inteiro cai.

---

## O que já está resolvido aqui

O compose oficial, do jeito que vem, teria dois problemas nesta VPS. O
`docker-compose.override.yml` corrige os dois:

1. **Nomes de container colidiriam.** O oficial usa `supabase-db`,
   `supabase-auth`… Nome de container é global no Docker; se o aulingo já
   roda um Supabase aqui, sobe um por cima do outro. Renomeamos tudo para
   `wedream-supabase-*`.

2. **O banco subiria aberto para a internet.** O oficial publica o Postgres
   (5432), o pooler (6543) e o gateway (8000) em todas as interfaces.
   Prendemos os três em `127.0.0.1` — só o proxy reverso do host enxerga.

> ⚠ **O `COMPOSE_FILE` do `.env` precisa listar o override.** O `.env` oficial
> traz `COMPOSE_FILE=docker-compose.yml`, e isso **desliga** a descoberta
> automática do override — o banco subiria exposto sem nenhum aviso. O
> `gerar-env.mjs` já grava o valor certo, e o `verificar-env.mjs` reclama se
> estiver errado.

---

## Passo a passo

### 1. Os dois subdomínios

No DNS da HostGator, apontando para o IP da VPS:

| Tipo | Nome | Aponta para |
|---|---|---|
| A | `quadrodossonhos` | IP da VPS |
| A | `api.quadrodossonhos` | IP da VPS |

O segundo é a API do Supabase. Confirme com
`dig +short api.quadrodossonhos.antonellaroweder.com.br`.

### 2. Gerar as chaves

```bash
cd /opt/we-dream/supabase-selfhost
node scripts/gerar-env.mjs --app quadrodossonhos.antonellaroweder.com.br
```

Isso cria o `.env` com senhas e chaves novas e imprime na tela:

- as três linhas para colar no `.env` do WE DREAM;
- o usuário e a senha do painel (Studio);
- a senha do Postgres.

**Guarde isso fora da VPS.** Perder o `JWT_SECRET` invalida todas as sessões.

Confira antes de subir:

```bash
node scripts/verificar-env.mjs
```

Ele valida a assinatura das chaves, os tamanhos exatos que cada serviço
exige, o isolamento e as URLs. Só siga com `✅`.

### 3. Subir

```bash
docker compose up -d
docker compose ps          # espere todos ficarem healthy (~2 min na 1ª vez)
```

### 4. Criar as tabelas do WE DREAM

```bash
./scripts/aplicar-migrations.sh
```

Ao final confere sozinho: 12 tabelas, todas com RLS, o bucket de fotos
privado e o gatilho de novo usuário. Pode rodar de novo quando quiser.

### 5. Publicar a API com HTTPS

```bash
sudo cp ../deploy/nginx-host-api-supabase.conf \
        /etc/nginx/sites-available/api-quadrodossonhos.conf
sudo ln -s /etc/nginx/sites-available/api-quadrodossonhos.conf /etc/nginx/sites-enabled/
sudo certbot --nginx -d api.quadrodossonhos.antonellaroweder.com.br
sudo nginx -t && sudo systemctl reload nginx
```

Teste:

```bash
curl -s https://api.quadrodossonhos.antonellaroweder.com.br/auth/v1/health
```

### 6. Ligar o WE DREAM nele

Cole no `/opt/we-dream/.env` as três linhas que o `gerar-env.mjs` imprimiu e:

```bash
cd /opt/we-dream && docker compose up -d
```

---

## O painel (Studio)

`https://api.quadrodossonhos.antonellaroweder.com.br` abre o Studio, com o
usuário e a senha do `.env` (`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`).
De lá dá para ver as tabelas, os usuários cadastrados e as fotos.

---

## E-mail

O `gerar-env.mjs` deixa `ENABLE_EMAIL_AUTOCONFIRM=true`: a conta é criada e
já entra, sem passar por confirmação. É o único jeito de funcionar sem um
servidor de e-mail — **mas com isso a recuperação de senha não funciona**.

Para resolver, configure um SMTP no `.env` (Resend, Brevo, Amazon SES, ou o
SMTP do seu e-mail) e depois mude `ENABLE_EMAIL_AUTOCONFIRM=false`:

```ini
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_ADMIN_EMAIL=contato@antonellaroweder.com.br
SMTP_SENDER_NAME=WE DREAM
```

---

## Backup — isto é com você agora

Sem o supabase.com, ninguém faz backup por você. O mínimo:

```bash
# banco
docker exec wedream-supabase-db pg_dump -U postgres postgres \
  | gzip > /root/backups/wedream-$(date +%F).sql.gz

# fotos
tar czf /root/backups/wedream-fotos-$(date +%F).tar.gz \
  -C /opt/we-dream/supabase-selfhost/volumes storage
```

Coloque no cron (`crontab -e`) e **copie para fora da VPS** — backup que mora
no mesmo servidor não protege contra perder o servidor:

```cron
0 3 * * * /opt/we-dream/supabase-selfhost/scripts/backup.sh >> /var/log/wedream-backup.log 2>&1
```

---

## Comandos do dia a dia

```bash
cd /opt/we-dream/supabase-selfhost

docker compose ps                    # estado dos 11 containers
docker compose logs -f auth          # login com problema
docker compose logs -f db            # banco
docker compose restart auth          # reiniciar um serviço
docker compose down                  # derruba SÓ o Supabase do WE DREAM
docker stats $(docker ps --filter name=wedream- -q)   # consumo
```

> **Nunca** rode `docker system prune -a` nesta VPS: o `-a` apaga imagens de
> outros projetos, incluindo a Evolution API do AtendimentoPRO.

---

## Atualizar o Supabase depois

O `docker-compose.yml` é o oficial, sem modificação — dá para trocar por uma
versão nova e manter o `docker-compose.override.yml` como está:

```bash
cd /opt/we-dream/supabase-selfhost
cp docker-compose.yml docker-compose.yml.bak
curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/supabase/supabase/master/docker/docker-compose.yml
sed -i 's/^name: supabase$/name: we-dream-supabase/' docker-compose.yml
docker compose pull && docker compose up -d
```

Faça backup antes. E confira as notas de versão do Supabase — de vez em
quando há mudança que exige ajuste no `.env`.
