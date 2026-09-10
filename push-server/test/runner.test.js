import assert from 'node:assert/strict'
import test from 'node:test'
import { criarRodada } from '../src/runner.js'
import { fakeSupabase } from './fakeSupabase.js'

/** 2026-06-15T12:00:00Z = 09:00 em São Paulo, 13:00 em Lisboa. */
const AGORA = new Date('2026-06-15T12:00:00Z')

const perfil = (over = {}) => ({
  id: 'u1',
  display_name: 'Antonella',
  timezone: 'America/Sao_Paulo',
  notification_hour: 9,
  notifications_on: true,
  ...over,
})

const inscricao = (over = {}) => ({
  user_id: 'u1',
  endpoint: 'https://push.exemplo/u1',
  p256dh: 'chave',
  auth: 'auth',
  ...over,
})

function montar(dados, opts = {}) {
  const enviados = []
  const sb = fakeSupabase(dados)
  const enviarPush =
    opts.enviarPush ??
    (async (sub, payload) => {
      enviados.push({ sub, payload: JSON.parse(payload) })
    })
  const { rodada } = criarRodada({ sb, enviarPush, ...opts })
  return { sb, rodada, enviados }
}

/* ------------------------------------------------------------- horário */

test('envia para quem está na hora escolhida, no fuso da pessoa', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
  })
  const r = await rodada(AGORA)
  assert.equal(r.usuarios, 1)
  assert.equal(enviados.length, 1)
  assert.match(enviados[0].payload.body, /“.+”/)
})

test('não envia fora do horário escolhido', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil({ notification_hour: 20 })],
    push_subscriptions: [inscricao()],
  })
  const r = await rodada(AGORA)
  assert.equal(r.candidatos, 0)
  assert.equal(enviados.length, 0)
})

test('o mesmo instante atinge fusos diferentes na hora certa de cada um', async () => {
  const { rodada, enviados } = montar({
    profiles: [
      perfil({ id: 'br', timezone: 'America/Sao_Paulo', notification_hour: 9 }),
      perfil({ id: 'pt', timezone: 'Europe/Lisbon', notification_hour: 13 }),
      perfil({ id: 'jp', timezone: 'Asia/Tokyo', notification_hour: 9 }),
    ],
    push_subscriptions: [
      inscricao({ user_id: 'br', endpoint: 'e-br' }),
      inscricao({ user_id: 'pt', endpoint: 'e-pt' }),
      inscricao({ user_id: 'jp', endpoint: 'e-jp' }),
    ],
  })
  await rodada(AGORA)
  const alvos = enviados.map((e) => e.sub.endpoint).sort()
  assert.deepEqual(alvos, ['e-br', 'e-pt'], 'Tóquio (21h) não deve receber')
})

test('respeita quem desligou as notificações', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil({ notifications_on: false })],
    push_subscriptions: [inscricao()],
  })
  await rodada(AGORA)
  assert.equal(enviados.length, 0)
})

test('fuso inválido não derruba a rodada dos outros', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil({ id: 'quebrado', timezone: 'Marte/Olympus' }), perfil({ id: 'ok' })],
    push_subscriptions: [inscricao({ user_id: 'ok', endpoint: 'e-ok' })],
  })
  const r = await rodada(AGORA)
  assert.equal(enviados.length, 1)
  assert.equal(enviados[0].sub.endpoint, 'e-ok')
  assert.equal(r.erros, 1)
})

/* ------------------------------------------------- uma vez por dia só */

test('não repete no mesmo dia', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
  })
  await rodada(AGORA)
  await rodada(AGORA)
  await rodada(AGORA)
  assert.equal(enviados.length, 1, 'só um envio por dia')
})

test('volta a enviar no dia seguinte', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
  })
  await rodada(AGORA)
  await rodada(new Date('2026-06-16T12:00:00Z'))
  assert.equal(enviados.length, 2)
  assert.notEqual(
    enviados[0].payload.body,
    enviados[1].payload.body,
    'a frase precisa mudar de um dia para o outro',
  )
})

test('registra o envio no histórico', async () => {
  const { rodada, sb } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
  })
  await rodada(AGORA)
  assert.equal(sb.db.notification_log.length, 1)
  assert.equal(sb.db.notification_log[0].user_id, 'u1')
  assert.ok(sb.db.notification_log[0].title.length > 0)
})

/* ------------------------------------------------- vários aparelhos */

test('envia para todos os aparelhos da pessoa', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [
      inscricao({ endpoint: 'celular' }),
      inscricao({ endpoint: 'tablet' }),
      inscricao({ endpoint: 'notebook' }),
    ],
  })
  const r = await rodada(AGORA)
  assert.equal(enviados.length, 3)
  assert.equal(r.enviados, 3)
})

test('sem inscrição, ninguém é notificado', async () => {
  const { rodada, enviados } = montar({ profiles: [perfil()], push_subscriptions: [] })
  await rodada(AGORA)
  assert.equal(enviados.length, 0)
})

/* ------------------------------------------- limpeza de inscrições mortas */

test('remove inscrições expiradas (410) e mantém as boas', async () => {
  const sb = fakeSupabase({
    profiles: [perfil()],
    push_subscriptions: [inscricao({ endpoint: 'morta' }), inscricao({ endpoint: 'viva' })],
  })
  const { rodada } = criarRodada({
    sb,
    enviarPush: async (sub) => {
      if (sub.endpoint === 'morta') {
        const e = new Error('Gone')
        e.statusCode = 410
        throw e
      }
    },
  })

  await rodada(AGORA)
  const restantes = sb.db.push_subscriptions.map((s) => s.endpoint)
  assert.deepEqual(restantes, ['viva'])
})

test('erro temporário (500) não remove a inscrição', async () => {
  const sb = fakeSupabase({ profiles: [perfil()], push_subscriptions: [inscricao()] })
  const { rodada } = criarRodada({
    sb,
    enviarPush: async () => {
      const e = new Error('Service Unavailable')
      e.statusCode = 503
      throw e
    },
  })
  await rodada(AGORA)
  assert.equal(sb.db.push_subscriptions.length, 1)
  assert.equal(sb.db.notification_log.length, 0, 'nada entregue, nada registrado')
})

/* ------------------------------------------------------ conteúdo do coach */

test('cobra quem está há dias sem check-in', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
    daily_checkins: [{ user_id: 'u1', day: '2026-06-05' }], // 10 dias atrás
  })
  await rodada(AGORA)
  assert.equal(enviados[0].payload.kind, 'inativo')
  assert.match(enviados[0].payload.body, /10/)
})

test('avisa sobre sonho atrasado', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
    daily_checkins: [{ user_id: 'u1', day: '2026-06-15' }],
    dreams: [
      {
        owner_id: 'u1',
        title: 'Reforma da cozinha',
        target_date: '2026-05-20',
        status: 'active',
        archived: false,
      },
    ],
  })
  await rodada(AGORA)
  assert.equal(enviados[0].payload.kind, 'atrasado')
  assert.match(enviados[0].payload.body, /Reforma da cozinha/)
})

test('avisa sobre prazo chegando', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
    daily_checkins: [{ user_id: 'u1', day: '2026-06-15' }],
    dreams: [
      {
        owner_id: 'u1',
        title: 'Retiro de silêncio',
        target_date: '2026-07-01',
        status: 'active',
        archived: false,
      },
    ],
  })
  await rodada(AGORA)
  assert.equal(enviados[0].payload.kind, 'prazo')
  assert.match(enviados[0].payload.body, /Retiro de silêncio/)
  assert.match(enviados[0].payload.body, /16/) // 16 dias até 01/07
})

test('celebra a sequência de dias seguidos', async () => {
  const dias = ['2026-06-15', '2026-06-14', '2026-06-13', '2026-06-12', '2026-06-11']
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
    daily_checkins: dias.map((day) => ({ user_id: 'u1', day })),
  })
  await rodada(AGORA)
  assert.equal(enviados[0].payload.kind, 'streak')
  assert.match(enviados[0].payload.body, /5/)
})

test('sonho arquivado ou realizado não gera cobrança', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
    daily_checkins: [{ user_id: 'u1', day: '2026-06-15' }],
    dreams: [
      {
        owner_id: 'u1',
        title: 'Já realizado',
        target_date: '2026-05-01',
        status: 'realized',
        archived: true,
      },
    ],
  })
  await rodada(AGORA)
  assert.equal(enviados[0].payload.kind, 'daily')
})

test('sonhos de outra pessoa não entram na cobrança', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
    daily_checkins: [{ user_id: 'u1', day: '2026-06-15' }],
    dreams: [
      {
        owner_id: 'outra-pessoa',
        title: 'Sonho alheio atrasado',
        target_date: '2026-01-01',
        status: 'active',
        archived: false,
      },
    ],
  })
  await rodada(AGORA)
  assert.equal(enviados[0].payload.kind, 'daily')
})

/* ---------------------------------------------------------------- modos */

test('modo DRY RUN não envia nem registra', async () => {
  const { rodada, enviados, sb } = montar(
    { profiles: [perfil()], push_subscriptions: [inscricao()] },
    { dryRun: true },
  )
  const r = await rodada(AGORA)
  assert.equal(enviados.length, 0)
  assert.equal(sb.db.notification_log.length, 0)
  assert.equal(r.usuarios, 1, 'ainda assim conta quem seria notificado')
})

test('a notificação aponta para a raiz do app', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
  })
  await rodada(AGORA)
  assert.equal(enviados[0].payload.url, '/')
  assert.equal(enviados[0].payload.tag, 'wedream-diario')
})

test('não repete entre os tiques da mesma hora', async () => {
  const { rodada, enviados } = montar({
    profiles: [perfil()],
    push_subscriptions: [inscricao()],
  })
  await rodada(new Date('2026-06-15T12:00:00Z'))
  await rodada(new Date('2026-06-15T12:15:00Z'))
  await rodada(new Date('2026-06-15T12:45:00Z'))
  assert.equal(enviados.length, 1)
})

test('a deduplicação sobrevive à virada do horário de verão', async () => {
  // Lisboa entra no horário de verão: o relógio local anda 1h,
  // mas a pessoa não pode receber duas notificações.
  const { rodada, enviados } = montar({
    profiles: [perfil({ timezone: 'Europe/Lisbon', notification_hour: 8 })],
    push_subscriptions: [inscricao()],
  })
  await rodada(new Date('2026-03-28T08:00:00Z')) // 08:00 em Lisboa (inverno)
  await rodada(new Date('2026-03-29T07:00:00Z')) // 08:00 em Lisboa (verão), 23h depois
  assert.equal(enviados.length, 2, 'deve enviar nos dois dias')
})
