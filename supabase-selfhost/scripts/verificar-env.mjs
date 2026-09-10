/**
 * Confere o .env do Supabase ANTES de subir a pilha.
 *
 *   node scripts/verificar-env.mjs
 *
 * Verifica o que costuma quebrar um self-hosted:
 *   · chaves anon/service_role realmente assinadas pelo JWT_SECRET
 *   · nenhum segredo em branco ou de exemplo
 *   · portas livres nesta VPS e sem repetição
 *   · URLs coerentes, em HTTPS, com API em domínio próprio
 *   · "storage" presente em PGRST_DB_SCHEMAS (sem isso as fotos não funcionam)
 *
 * Sai com código 1 se algo estiver errado.
 */
import { createHmac } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const caminho = resolve(raiz, '.env')

/** Portas usadas por outros apps desta VPS. */
const PORTAS_OCUPADAS = new Set([22, 80, 443, 3000, 3100, 5432, 5433, 6379, 8080, 9001, 9998, 9999])

if (!existsSync(caminho)) {
  console.error(`✗ Não existe ${caminho}\n  Rode antes: node scripts/gerar-env.mjs --app SEU.DOMINIO`)
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync(caminho, 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)

let falhas = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const erro = (m) => {
  console.log(`  ✗ ${m}`)
  falhas++
}
const aviso = (m) => console.log(`  ⚠ ${m}`)

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
    erro(`${nome}: papel "${carga.role}", deveria ser "${papel}"`)
  } else if (carga.exp <= Date.now() / 1000) {
    erro(`${nome} está EXPIRADA`)
  } else {
    const anos = ((carga.exp - Date.now() / 1000) / (60 * 60 * 24 * 365)).toFixed(1)
    ok(`${nome}: assinatura confere, papel correto, expira em ${anos} anos`)
  }
}

console.log('\n── Segredos ──')
for (const chave of ['POSTGRES_PASSWORD', 'JWT_SECRET']) {
  const v = env[chave] ?? ''
  if (!v) erro(`${chave} vazia`)
  else if (v.length < 32) erro(`${chave} tem ${v.length} caracteres — use pelo menos 32`)
  else ok(`${chave}: ${v.length} caracteres`)
}
if (/your-super-secret|this_password|change-me|senha123/i.test(JSON.stringify(env))) {
  erro('ainda há valores de exemplo no .env — troque todos')
}

console.log('\n── Portas ──')
const portas = ['POSTGRES_PORT', 'AUTH_PORT', 'REST_PORT', 'STORAGE_PORT']
const usadas = new Map()
for (const p of portas) {
  const v = Number(env[p])
  if (!v) {
    erro(`${p} não definida`)
    continue
  }
  if (PORTAS_OCUPADAS.has(v)) {
    erro(`${p} = ${v} — já usada por outro app desta VPS`)
  } else if (usadas.has(v)) {
    erro(`${p} = ${v} — mesma porta de ${usadas.get(v)}`)
  } else {
    usadas.set(v, p)
    ok(`${p} = ${v}`)
  }
}

console.log('\n── Endereços ──')
for (const chave of ['SITE_URL', 'API_EXTERNAL_URL', 'SUPABASE_PUBLIC_URL']) {
  const v = env[chave] ?? ''
  if (!v) erro(`${chave} vazia`)
  else if (!v.startsWith('https://')) erro(`${chave} não usa https: ${v}`)
  else ok(`${chave} = ${v}`)
}
if (env.API_EXTERNAL_URL && env.SITE_URL && env.API_EXTERNAL_URL === env.SITE_URL) {
  erro('API_EXTERNAL_URL e SITE_URL são iguais — a API precisa de domínio próprio')
}
if (env.API_EXTERNAL_URL !== env.SUPABASE_PUBLIC_URL) {
  erro('API_EXTERNAL_URL e SUPABASE_PUBLIC_URL precisam ser iguais')
}
if (env.ADDITIONAL_REDIRECT_URLS && env.SITE_URL) {
  if (env.ADDITIONAL_REDIRECT_URLS.includes(env.SITE_URL.replace(/^https:\/\//, ''))) {
    ok('ADDITIONAL_REDIRECT_URLS aponta para o domínio do app')
  } else {
    erro('ADDITIONAL_REDIRECT_URLS não bate com o SITE_URL — o login vai recusar o retorno')
  }
}

console.log('\n── Fotos dos sonhos ──')
const esquemas = (env.PGRST_DB_SCHEMAS ?? '').split(',').map((s) => s.trim())
if (esquemas.includes('storage')) ok('PGRST_DB_SCHEMAS inclui "storage"')
else erro('PGRST_DB_SCHEMAS precisa incluir "storage", senão as fotos não funcionam')
if (esquemas.includes('public')) ok('PGRST_DB_SCHEMAS inclui "public"')
else erro('PGRST_DB_SCHEMAS precisa incluir "public" — é onde ficam os sonhos')
if (env.GLOBAL_S3_BUCKET && env.GLOBAL_S3_BUCKET !== 'dream-images') {
  aviso(`GLOBAL_S3_BUCKET é "${env.GLOBAL_S3_BUCKET}"; o app usa "dream-images"`)
}

console.log('\n── E-mail ──')
if (env.ENABLE_EMAIL_AUTOCONFIRM === 'true') {
  aviso(
    'confirmação de e-mail DESLIGADA. É o certo enquanto não há SMTP, ' +
      'mas sem SMTP a recuperação de senha não funciona.',
  )
} else if (!env.SMTP_HOST) {
  erro('confirmação de e-mail LIGADA sem SMTP — ninguém conseguirá se cadastrar')
} else {
  ok(`SMTP configurado: ${env.SMTP_HOST}`)
}

console.log(
  falhas === 0
    ? '\n✅ .env pronto. Suba com: docker compose up -d\n'
    : `\n❌ ${falhas} problema(s) — corrija antes de subir\n`,
)
process.exit(falhas === 0 ? 0 : 1)
