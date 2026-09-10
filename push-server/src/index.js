import { createClient } from '@supabase/supabase-js'
import express from 'express'
import webpush from 'web-push'
import { criarRodada } from './runner.js'

/* ------------------------------------------------------------- ambiente */

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = 'mailto:contato@antonellaroweder.com.br',
  ADMIN_TOKEN,
  PORT = '8081',
  TICK_MINUTES = '15',
  DRY_RUN = 'false',
} = process.env

const dryRun = DRY_RUN === 'true'

for (const [nome, valor] of Object.entries({
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
})) {
  if (!valor) {
    console.error(`✗ Variável de ambiente obrigatória ausente: ${nome}`)
    console.error('  Veja .env.example para o conjunto completo.')
    process.exit(1)
  }
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// A service role key ignora RLS — este processo NUNCA deve ficar exposto
// diretamente na internet (veja deploy/DEPLOY-CONTABO.md).
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const log = (...args) => console.log(new Date().toISOString(), ...args)

const { rodada } = criarRodada({
  sb,
  enviarPush: (sub, payload, opts) => webpush.sendNotification(sub, payload, opts),
  dryRun,
  log,
})

/* ------------------------------------------------------------- servidor */

const app = express()
app.use(express.json({ limit: '64kb' }))
app.disable('x-powered-by')

app.get('/health', (_req, res) => {
  res.json({ ok: true, servico: 'we-dream-push', dryRun, agora: new Date().toISOString() })
})

app.get('/vapid-public-key', (_req, res) => {
  res.json({ key: VAPID_PUBLIC_KEY })
})

/** Dispara uma rodada manualmente — protegido por token. */
app.post('/run', async (req, res) => {
  if (!ADMIN_TOKEN || req.get('x-admin-token') !== ADMIN_TOKEN) {
    return res.status(401).json({ erro: 'não autorizado' })
  }
  res.json(await rodada())
})

const server = app.listen(Number(PORT), '0.0.0.0', () => {
  log(`WE DREAM push no ar na porta ${PORT}${dryRun ? ' (DRY RUN)' : ''}`)
  log(`Verificando a cada ${TICK_MINUTES} min quem está no horário escolhido`)
})

/* Um tique periódico: cada pessoa recebe na hora que escolheu, no fuso dela. */
const tick = setInterval(() => void rodada(), Number(TICK_MINUTES) * 60 * 1000)
setTimeout(() => void rodada(), 10_000) // primeira verificação logo após subir

function encerrar(sinal) {
  log(`${sinal} recebido, encerrando…`)
  clearInterval(tick)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 8000).unref()
}
process.on('SIGTERM', () => encerrar('SIGTERM'))
process.on('SIGINT', () => encerrar('SIGINT'))
