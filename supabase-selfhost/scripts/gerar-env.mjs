/**
 * Gera o .env do Supabase do WE DREAM: senhas fortes e chaves de API
 * já assinadas.
 *
 *   node scripts/gerar-env.mjs --app quadrodossonhos.antonellaroweder.com.br
 *
 * Opções:
 *   --app <domínio>    domínio do WE DREAM         (obrigatório)
 *   --api <domínio>    domínio da API              (padrão: api.<app>)
 *   --porta-db <n>     Postgres  (padrão 5434)
 *   --porta-auth <n>   login     (padrão 4001)
 *   --porta-rest <n>   consultas (padrão 4002)
 *   --porta-fotos <n>  fotos     (padrão 4003)
 *   --forcar           sobrescreve um .env existente
 *
 * As chaves usam HS256 — o mesmo esquema do supabase.com, que o app já
 * consome sem nenhuma mudança de código.
 */
import { createHmac, randomInt } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Portas já usadas por outros apps desta VPS (AtendimentoPRO, Evolution, aulingo, rachajusto). */
const PORTAS_OCUPADAS = new Set([22, 80, 443, 3000, 3100, 5432, 5433, 6379, 8080, 9001, 9998, 9999])

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

const portas = {
  POSTGRES_PORT: opt('porta-db', '5434'),
  AUTH_PORT: opt('porta-auth', '4001'),
  REST_PORT: opt('porta-rest', '4002'),
  STORAGE_PORT: opt('porta-fotos', '4003'),
  STUDIO_PORT: opt('porta-studio', '4004'),
}

const conflitos = Object.entries(portas).filter(([, v]) => PORTAS_OCUPADAS.has(Number(v)))
if (conflitos.length) {
  console.error(`
✗ Estas portas já são usadas por outros apps desta VPS:

${conflitos.map(([k, v]) => `    ${k} = ${v}`).join('\n')}

  Ocupadas: ${[...PORTAS_OCUPADAS].sort((a, b) => a - b).join(', ')}
  Escolha outras com --porta-db, --porta-auth, --porta-rest, --porta-fotos.
`)
  process.exit(1)
}
const repetidas = Object.values(portas).filter((v, i, a) => a.indexOf(v) !== i)
if (repetidas.length) {
  console.error(`✗ Porta repetida entre serviços: ${[...new Set(repetidas)].join(', ')}`)
  process.exit(1)
}

const destino = resolve(raiz, '.env')
if (existsSync(destino) && !flag('forcar')) {
  console.error(`
Já existe um .env em ${destino}.

Sobrescrever TROCA todas as chaves: as sessões abertas caem e, se o banco já
tiver dados, o acesso a ele quebra.

Se é isso mesmo, rode com --forcar (guarde uma cópia do .env atual antes).
`)
  process.exit(1)
}

/* -------------------------------------------------------------- segredos */

// Só letras e números: evita brigas com aspas no .env, no shell e nas
// strings de conexão do Postgres.
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const segredo = (n) =>
  Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** JWT HS256 — mesmo formato das chaves do supabase.com. */
function assinarJwt(payload, chave) {
  const cabecalho = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const corpo = b64url(JSON.stringify(payload))
  const assinatura = b64url(createHmac('sha256', chave).update(`${cabecalho}.${corpo}`).digest())
  return `${cabecalho}.${corpo}.${assinatura}`
}

const agora = Math.floor(Date.now() / 1000)
const dezAnos = agora + 60 * 60 * 24 * 365 * 10

const jwtSecret = segredo(48)
const anonKey = assinarJwt({ role: 'anon', iss: 'supabase', iat: agora, exp: dezAnos }, jwtSecret)
const serviceKey = assinarJwt(
  { role: 'service_role', iss: 'supabase', iat: agora, exp: dezAnos },
  jwtSecret,
)
const senhaPostgres = segredo(32)

const valores = {
  POSTGRES_PASSWORD: senhaPostgres,
  JWT_SECRET: jwtSecret,
  ANON_KEY: anonKey,
  SERVICE_ROLE_KEY: serviceKey,
  SITE_URL: `https://${dominioApp}`,
  API_EXTERNAL_URL: `https://${dominioApi}`,
  SUPABASE_PUBLIC_URL: `https://${dominioApi}`,
  ADDITIONAL_REDIRECT_URLS: `https://${dominioApp}/**`,
  ...portas,
}

/* ------------------------------------------- escreve a partir do modelo */

const modelo = readFileSync(resolve(raiz, '.env.example'), 'utf8')
const pendentes = new Set(Object.keys(valores))

const preenchido = modelo
  .split('\n')
  .map((linha) => {
    const m = linha.match(/^([A-Z0-9_]+)=/)
    if (!m || !(m[1] in valores)) return linha
    pendentes.delete(m[1])
    return `${m[1]}=${valores[m[1]]}`
  })
  .join('\n')

const faltantes = [...pendentes]
if (faltantes.length) {
  console.error(`✗ Estas chaves não existem no .env.example: ${faltantes.join(', ')}`)
  process.exit(1)
}

writeFileSync(
  destino,
  `# Gerado por scripts/gerar-env.mjs em ${new Date().toISOString()}\n` +
    `# NUNCA versione este arquivo.\n\n${preenchido}`,
  { mode: 0o600 },
)

/* ------------------------------------------------------------- resultado */

console.log(`
✓ .env criado em ${destino}

────────────────────────────────────────────────────────────────
 1) COLE ISTO NO .env DO WE DREAM  (/opt/we-dream/.env)
────────────────────────────────────────────────────────────────

SUPABASE_URL=https://${dominioApi}
SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceKey}

────────────────────────────────────────────────────────────────
 2) GUARDE FORA DA VPS
────────────────────────────────────────────────────────────────

  senha do Postgres: ${senhaPostgres}

  Perder o JWT_SECRET invalida todas as sessões e as duas chaves acima.
  Perder a senha do Postgres tira seu acesso ao banco.
  O jeito mais simples: copie o próprio arquivo .env.

────────────────────────────────────────────────────────────────
 3) PORTAS ESCOLHIDAS (todas em 127.0.0.1)
────────────────────────────────────────────────────────────────

${Object.entries(portas).map(([k, v]) => `  ${k.padEnd(15)} ${v}`).join('\n')}

 Confira agora:   node scripts/verificar-env.mjs
 Depois suba:     docker compose up -d
`)
