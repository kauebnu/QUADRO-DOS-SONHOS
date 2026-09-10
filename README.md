<div align="center">

# WE DREAM

**We dreams, we work, we conquer!**
*(no quadro em casal: **We dreams, we work, we conquer! — together**)*

Quadro dos sonhos digital para quem vive a Lei da Atração na prática.
PWA em preto e dourado, para instalar no celular.

</div>

---

## O que o app faz

| | |
|---|---|
| 🖼️ **O Quadro** | Galeria dos seus sonhos com foto, categoria, data de entrada, data prevista e data de realização. Busca e filtros por categoria, escopo e prazo. |
| 📝 **Projeto do sonho** | Cada sonho tem descrição *e* um campo de projeto — o passo a passo de como realizar. É o que separa desejo de plano. |
| 🏦 **Banco dos Sonhos** | Registre aportes e retiradas por sonho. O app mostra a porcentagem conquistada, quanto falta e quanto guardar por mês para bater o prazo. |
| 💞 **Quadro em casal** | Sonhos "nossos" visíveis para os dois, e sonhos individuais privados — com um botão para liberar tudo, ou escolher sonho a sonho. |
| 🏆 **Arquivo de realizados** | Linha do tempo das conquistas por ano, com medalhas e chuva dourada quando um sonho sai do quadro. |
| 📺 **Modo apresentação** | Porta-retrato digital: as fotos rodam em tela cheia com frases motivacionais, a tela fica acesa e dá para escolher tempo, categoria e trilha. |
| 🔔 **Coach diário** | Uma notificação por dia, no horário que você escolher, com uma frase **sempre diferente** — e cobrança carinhosa quando você some ou um prazo está chegando. |
| 🧘‍♀️ **Ritual do dia** | Gratidão → visualização cronometrada → uma ação concreta. Alimenta sua sequência de dias e o seu nível. |
| ✨ **Lei da Atração** | 24 lições em 5 trilhas, cada uma com uma prática para fazer na hora, mais suas afirmações pessoais. |
| 👑 **Níveis e medalhas** | De Sonhador a Lenda, com 13 conquistas para desbloquear. |

---

## Como está organizado

```
.
├── web/                    PWA (React + TypeScript + Vite + Tailwind)
│   ├── src/
│   │   ├── data/           camada de dados: Supabase e modo demonstração
│   │   ├── pages/          as telas
│   │   ├── components/     peças reutilizáveis
│   │   ├── lib/            regras, formatação, frases, push
│   │   └── store/          estado global do app
│   └── e2e/                testes de ponta a ponta (Playwright)
│
├── push-server/            coach diário (Node + web-push)
│   ├── src/runner.js       quem recebe, quando e o quê
│   └── test/               testes do agendamento e das mensagens
│
├── supabase/
│   ├── migrations/         banco, funções e políticas de segurança (RLS)
│   └── tests/              testes das regras de privacidade
│
├── supabase-selfhost/      Supabase rodando na SUA VPS (não no supabase.com)
│   ├── docker-compose.yml           pilha oficial, sem modificação
│   ├── docker-compose.override.yml  isolamento + portas presas em 127.0.0.1
│   └── scripts/            geração e conferência de chaves, migrations, backup
│
├── shared/content.json     as frases — app e servidor usam as mesmas
├── deploy/                 nginx, entrypoint e o guia da Contabo
└── docker-compose.yml      a pilha isolada
```

---

## Rodando na sua máquina

```bash
# 1. o app
cd web
npm install
cp .env.example .env.local     # deixe em branco para o modo demonstração
npm run dev                    # http://localhost:5173

# 2. o coach diário (opcional)
cd ../push-server
npm install
npm run vapid                  # gera as chaves das notificações
npm start
```

Sem chaves do Supabase, o app abre em **modo demonstração**: dados de exemplo
no próprio navegador, todas as telas funcionando, nada é enviado para fora.

Para rodar com um Supabase de verdade, veja
[supabase-selfhost/README.md](supabase-selfhost/README.md).

---

## Testes

```bash
# regras de privacidade no banco (precisa de um PostgreSQL local)
./supabase/tests/run.sh

# o coach diário
cd push-server && npm test

# o app, de ponta a ponta, no celular e no desktop
cd web && npm run build && npm run e2e
```

---

## Publicar

Passo a passo completo em **[deploy/DEPLOY-CONTABO.md](deploy/DEPLOY-CONTABO.md)**.

Resumo:

```bash
cp .env.example .env      # preencha com as chaves do Supabase e VAPID
docker compose up -d --build
```

A pilha sobe isolada (projeto `we-dream`, rede `we-dream-net`, portas só em
`127.0.0.1`) e o proxy reverso do host publica o domínio.

---

## Privacidade

- Cada pessoa só enxerga os próprios sonhos. As regras são aplicadas **no banco**
  (Row Level Security), não apenas na tela — mesmo com a chave pública em mãos,
  ninguém acessa o quadro de outra pessoa.
- No quadro em casal, sonhos individuais são privados por padrão. O par só vê o
  que você liberar, sonho a sonho ou por um botão geral.
- As fotos ficam em um bucket privado, servidas por links assinados temporários.
- A chave `service_role` fica só no servidor de notificações, que nunca é
  exposto à internet.
