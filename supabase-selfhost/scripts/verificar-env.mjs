/**
 * Confere o .env do Supabase self-hosted ANTES de subir a pilha.
 *
 *   node scripts/verificar-env.mjs
 *
 * Verifica o que costuma quebrar um self-hosted:
 *   · as chaves ANON e SERVICE_ROLE realmente assinadas pelo JWT_SECRET
 *   · segredos com o tamanho exato que cada serviço exige
 *   · COMPOSE_FILE incluindo o override (sem ele o Postgres sobe exposto)
 *   · URLs coerentes e em HTTPS
 *
 * Sai com código 1 se algo estiver errado.
 */
import { createHmac } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const caminho = resolve(raiz, '.env')

if (!existsSync(caminho)) {
  console.error(`✗ Não existe ${caminho}. Rode antes: node scripts/gerar-env.mjs --app SEU.DOMINIO`)
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync(caminho, 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)

let falhas = 0
const ok = (msg) => console.log(`  ✓ ${msg}`)
const erro = (msg) => {
  console.log(`  ✗ ${msg}`)
  falhas++
}
const aviso = (msg) => console.log(`  ⚠ ${msg}`)

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

console.log('\n── Chaves de API ──')
for (const [nome, papel] of [
  ['ANON_KEY', 'anon'],
  ['SERVICE_ROLE_KEY', 'service_role'],
]) {
  const token = env[nome]
  if (!token) {
    erro(`${nome} está vazia`)
    continue
  }
  const partes = token.split('.')
  if (partes.length !== 3) {
    erro(`${nome} não parece um JWT`)
    continue
  }
  const [h, p, s] = partes
  const esperada = b64url(createHmac('sha256', env.JWT_SECRET ?? '').update(`${h}.${p}`).digest())
  if (s !== esperada) {
    erro(`${nome}: assinatura não confere com o JWT_SECRET deste .env`)
    continue
  }
  let carga
  try {
    carga = JSON.parse(Buffer.from(p, 'base64url').toString())
  } catch {
    erro(`${nome}: conteúdo ilegível`)
    continue
  }
  if (carga.role !== papel) {
    erro(`${nome}: papel é "${carga.role}", deveria ser "${papel}"`)
    continue
  }
  const anos = ((carga.exp - Date.now() / 1000) / (60 * 60 * 24 * 365)).toFixed(1)
  if (carga.exp <= Date.now() / 1000) erro(`${nome} está EXPIRADA`)
  else ok(`${nome}: assinatura confere, papel correto, expira em ${anos} anos`)
}

console.log('\n── Tamanhos exigidos ──')
for (const [chave, tamanho] of Object.entries({
  REALTIME_DB_ENC_KEY: 16,
  VAULT_ENC_KEY: 32,
  PG_META_CRYPTO_KEY: 32,
  SECRET_KEY_BASE: 64,
})) {
  const v = env[chave] ?? ''
  if (v.length === tamanho) ok(`${chave}: ${tamanho} caracteres`)
  else erro(`${chave}: tem ${v.length}, precisa de exatamente ${tamanho}`)
}

console.log('\n── Segredos obrigatórios preenchidos ──')
// As chaves assimétricas (ES256) ficam vazias de propósito: estamos no modo
// simétrico HS256, o mesmo do supabase.com.
const podemFicarVazias = new Set([
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'ANON_KEY_ASYMMETRIC',
  'SERVICE_ROLE_KEY_ASYMMETRIC',
  'JWT_KEYS',
  'JWT_JWKS',
  'OPENAI_API_KEY',
  'SMTP_USER',
  'SMTP_PASS',
  'GOOGLE_PROJECT_ID',
  'GOOGLE_PROJECT_NUMBER',
])
const vazias = Object.entries(env)
  .filter(([k, v]) => /PASSWORD|SECRET|_KEY|TOKEN/.test(k) && !v && !podemFicarVazias.has(k))
  .map(([k]) => k)
if (vazias.length) erro(`vazias: ${vazias.join(', ')}`)
else ok('nenhum segredo essencial em branco')

if (env.POSTGRES_PASSWORD && env.POSTGRES_PASSWORD.length < 20) {
  aviso('POSTGRES_PASSWORD está curta — use pelo menos 20 caracteres')
}
if (/insecure|your-super-secret|this_password/.test(JSON.stringify(env))) {
  erro('ainda há valores de exemplo do Supabase no .env — troque todos')
}

console.log('\n── Isolamento e portas ──')
if ((env.COMPOSE_FILE ?? '').includes('docker-compose.override.yml')) {
  ok('COMPOSE_FILE inclui o override (portas presas em 127.0.0.1)')
} else {
  erro(
    'COMPOSE_FILE NÃO inclui docker-compose.override.yml — sem ele o Postgres ' +
      'e o gateway sobem abertos para a internet',
  )
}
if (env.COMPOSE_PROJECT_NAME) ok(`projeto isolado: ${env.COMPOSE_PROJECT_NAME}`)
else aviso('COMPOSE_PROJECT_NAME não definido')

for (const p of ['POSTGRES_PORT', 'POOLER_PROXY_PORT_TRANSACTION', 'API_GW_HTTP_PORT']) {
  if (env[p]) ok(`${p} = ${env[p]}`)
  else erro(`${p} não definida`)
}
if (env.POSTGRES_PORT === '5432') {
  aviso('POSTGRES_PORT 5432 é a padrão — confira se nenhum outro projeto a usa')
}

console.log('\n── Endereços ──')
for (const chave of ['SUPABASE_PUBLIC_URL', 'API_EXTERNAL_URL', 'SITE_URL']) {
  const v = env[chave] ?? ''
  if (!v) erro(`${chave} vazia`)
  else if (!v.startsWith('https://')) erro(`${chave} não usa https: ${v}`)
  else ok(`${chave} = ${v}`)
}
if (env.API_EXTERNAL_URL && env.SITE_URL && env.API_EXTERNAL_URL === env.SITE_URL) {
  erro('API_EXTERNAL_URL e SITE_URL são iguais — a API precisa de um domínio próprio')
}

console.log('\n── E-mail ──')
if (env.ENABLE_EMAIL_AUTOCONFIRM === 'true') {
  aviso(
    'confirmação de e-mail DESLIGADA (autoconfirm). É o certo enquanto não há SMTP, ' +
      'mas sem SMTP a recuperação de senha não funciona.',
  )
} else if (!env.SMTP_HOST || env.SMTP_HOST.includes('supabase.io')) {
  erro('confirmação de e-mail ligada sem SMTP real — ninguém conseguirá se cadastrar')
} else {
  ok(`SMTP configurado: ${env.SMTP_HOST}`)
}

console.log(
  falhas === 0
    ? '\n✅ .env pronto para subir\n'
    : `\n❌ ${falhas} problema(s) — corrija antes de subir\n`,
)
process.exit(falhas === 0 ? 0 : 1)
