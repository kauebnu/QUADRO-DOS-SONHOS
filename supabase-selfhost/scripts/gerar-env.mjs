/**
 * Gera o .env do Supabase self-hosted com todas as senhas e chaves.
 *
 *   node scripts/gerar-env.mjs \
 *     --app quadrodossonhos.antonellaroweder.com.br \
 *     --api api.quadrodossonhos.antonellaroweder.com.br
 *
 * Opções:
 *   --app <domínio>     domínio do WE DREAM            (obrigatório)
 *   --api <domínio>     domínio da API do Supabase     (padrão: api.<app>)
 *   --porta-api <n>     porta local do gateway         (padrão: 8000)
 *   --porta-db <n>      porta local do Postgres        (padrão: 5433)
 *   --porta-pool <n>    porta local do pooler          (padrão: 6544)
 *   --forcar            sobrescreve um .env existente
 *
 * As chaves usam o esquema simétrico HS256 — o mesmo do supabase.com,
 * que o app já consome sem nenhuma alteração de código.
 */
import { createHmac, randomInt } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* ------------------------------------------------------------ argumentos */

const args = process.argv.slice(2)
const opt = (nome, padrao = null) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : padrao
}
const flag = (nome) => args.includes(`--${nome}`)

const dominioApp = opt('app')
if (!dominioApp) {
  console.error(`
Falta o domínio do app.

  node scripts/gerar-env.mjs --app quadrodossonhos.antonellaroweder.com.br
`)
  process.exit(1)
}
const dominioApi = opt('api', `api.${dominioApp}`)
const portaApi = opt('porta-api', '8000')
const portaDb = opt('porta-db', '5433')
const portaPool = opt('porta-pool', '6544')

const destino = resolve(raiz, '.env')
if (existsSync(destino) && !flag('forcar')) {
  console.error(`
Já existe um .env em ${destino}.

Sobrescrever TROCA todas as chaves — o que invalida as sessões abertas e,
se o banco já tiver dados, quebra o acesso a ele.

Se é isso mesmo que você quer, rode de novo com --forcar (e guarde uma
cópia do .env atual antes).
`)
  process.exit(1)
}

/* -------------------------------------------------------------- segredos */

// Apenas letras e números: evita brigas com aspas no .env, no shell e nas
// strings de conexão do Postgres.
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const segredo = (n) =>
  Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** JWT assinado em HS256 — o mesmo formato das chaves do supabase.com. */
function assinarJwt(payload, chave) {
  const cabecalho = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const corpo = b64url(JSON.stringify(payload))
  const assinatura = b64url(createHmac('sha256', chave).update(`${cabecalho}.${corpo}`).digest())
  return `${cabecalho}.${corpo}.${assinatura}`
}

const agora = Math.floor(Date.now() / 1000)
const daquiADezAnos = agora + 60 * 60 * 24 * 365 * 10

const jwtSecret = segredo(48)
const anonKey = assinarJwt({ role: 'anon', iss: 'supabase', iat: agora, exp: daquiADezAnos }, jwtSecret)
const serviceKey = assinarJwt(
  { role: 'service_role', iss: 'supabase', iat: agora, exp: daquiADezAnos },
  jwtSecret,
)

const senhaPostgres = segredo(32)
const senhaPainel = segredo(24)

const valores = {
  // isolamento — sem isto o override não é lido e o Postgres sobe exposto
  COMPOSE_FILE: 'docker-compose.yml:docker-compose.override.yml',
  COMPOSE_PROJECT_NAME: 'we-dream-supabase',

  POSTGRES_PASSWORD: senhaPostgres,
  JWT_SECRET: jwtSecret,
  ANON_KEY: anonKey,
  SERVICE_ROLE_KEY: serviceKey,

  DASHBOARD_USERNAME: 'wedream',
  DASHBOARD_PASSWORD: senhaPainel,

  SECRET_KEY_BASE: segredo(64),
  VAULT_ENC_KEY: segredo(32),
  REALTIME_DB_ENC_KEY: segredo(16), // precisa ter exatamente 16
  PG_META_CRYPTO_KEY: segredo(32),
  LOGFLARE_PUBLIC_ACCESS_TOKEN: segredo(40),
  LOGFLARE_PRIVATE_ACCESS_TOKEN: segredo(40),
  MINIO_ROOT_USER: 'wedreamstorage',
  MINIO_ROOT_PASSWORD: segredo(24),

  POOLER_TENANT_ID: 'wedream',
  POSTGRES_PORT: portaDb,
  POOLER_PROXY_PORT_TRANSACTION: portaPool,
  API_GW_HTTP_PORT: portaApi,
  KONG_HTTP_PORT: portaApi,

  SUPABASE_PUBLIC_URL: `https://${dominioApi}`,
  API_EXTERNAL_URL: `https://${dominioApi}`,
  SITE_URL: `https://${dominioApp}`,
  ADDITIONAL_REDIRECT_URLS: `https://${dominioApp}/**`,

  STUDIO_DEFAULT_ORGANIZATION: 'Antonella Roweder',
  STUDIO_DEFAULT_PROJECT: 'WE DREAM',

  // Sem servidor de e-mail configurado, exigir confirmação impediria
  // qualquer cadastro. Ligue a confirmação depois de configurar o SMTP.
  ENABLE_EMAIL_SIGNUP: 'true',
  ENABLE_EMAIL_AUTOCONFIRM: 'true',
  DISABLE_SIGNUP: 'false',
  ENABLE_ANONYMOUS_USERS: 'false',
  ENABLE_PHONE_SIGNUP: 'false',
  ENABLE_PHONE_AUTOCONFIRM: 'false',
}

/* ------------------------------------------- escreve preservando o modelo */

const modelo = readFileSync(resolve(raiz, '.env.example'), 'utf8')
const pendentes = new Set(Object.keys(valores))

const saida = modelo
  .split('\n')
  .map((linha) => {
    const m = linha.match(/^([A-Z0-9_]+)=/)
    if (!m || !(m[1] in valores)) return linha
    pendentes.delete(m[1])
    return `${m[1]}=${valores[m[1]]}`
  })
  .join('\n')

const extras = [...pendentes].map((k) => `${k}=${valores[k]}`)
const conteudo =
  `# Gerado por scripts/gerar-env.mjs em ${new Date().toISOString()}\n` +
  `# NUNCA versione este arquivo — ele contém todas as chaves.\n\n` +
  saida +
  (extras.length ? `\n\n# ---- acrescentado pelo WE DREAM ----\n${extras.join('\n')}\n` : '')

writeFileSync(destino, conteudo, { mode: 0o600 })

/* ------------------------------------------------------------- resultado */

console.log(`
✓ .env criado em ${destino} (somente leitura para o dono)

────────────────────────────────────────────────────────────────
 COLE ISTO NO .env DO WE DREAM  (/opt/we-dream/.env)
────────────────────────────────────────────────────────────────

SUPABASE_URL=https://${dominioApi}
SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceKey}

────────────────────────────────────────────────────────────────
 PAINEL DO SUPABASE (Studio)
────────────────────────────────────────────────────────────────

  endereço: https://${dominioApi}
  usuário:  wedream
  senha:    ${senhaPainel}

────────────────────────────────────────────────────────────────
 GUARDE EM LUGAR SEGURO
────────────────────────────────────────────────────────────────

  senha do Postgres: ${senhaPostgres}

  Perder o JWT_SECRET invalida todas as sessões e chaves.
  Perder a senha do Postgres tira seu acesso ao banco.
  Faça uma cópia do .env fora da VPS.

 Falta ainda: o subdomínio ${dominioApi} precisa apontar para a VPS
 e ter um bloco no proxy reverso. Veja supabase-selfhost/README.md
`)
