import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COACH,
  DAILY_QUOTES,
  buildDailyMessage,
  dayNumber,
  localDate,
  localHour,
  quoteForDay,
  saltFromId,
} from '../src/messages.js'

const base = {
  nome: 'Antonella Roweder',
  dayNumber: 20_000,
  saltUsuario: 42,
  diasSemCheckin: 0,
  sonhoAtrasado: null,
  sonhoProximo: null,
  sequencia: 0,
}

test('o conteúdo compartilhado foi carregado', () => {
  assert.ok(DAILY_QUOTES.length > 100, 'esperava mais de 100 frases')
  assert.ok(COACH.inativo.length > 0)
  assert.ok(COACH.prazo.length > 0)
})

test('a frase do dia percorre a lista inteira antes de repetir', () => {
  const vistas = new Set()
  for (let d = 0; d < DAILY_QUOTES.length; d++) vistas.add(quoteForDay(d, 0))
  assert.equal(
    vistas.size,
    DAILY_QUOTES.length,
    'todas as frases devem aparecer dentro de um ciclo completo',
  )
})

test('a frase muda a cada dia', () => {
  assert.notEqual(quoteForDay(100, 0), quoteForDay(101, 0))
  assert.notEqual(quoteForDay(101, 0), quoteForDay(102, 0))
})

test('pessoas diferentes recebem frases diferentes no mesmo dia', () => {
  const a = quoteForDay(500, saltFromId('11111111-1111-1111-1111-111111111111'))
  const b = quoteForDay(500, saltFromId('22222222-2222-2222-2222-222222222222'))
  assert.notEqual(a, b)
})

test('mensagem padrão usa o primeiro nome e traz a frase entre aspas', () => {
  const m = buildDailyMessage(base)
  assert.equal(m.kind, 'daily')
  assert.match(m.body, /“.+”/)
  assert.ok(!m.title.includes('Roweder'), 'deve usar só o primeiro nome')
  assert.ok(!m.title.includes('{'), 'não deve sobrar placeholder')
  assert.ok(!m.body.includes('{'), 'não deve sobrar placeholder')
})

test('cobra quem sumiu há 3 dias ou mais', () => {
  const m = buildDailyMessage({ ...base, diasSemCheckin: 5 })
  assert.equal(m.kind, 'inativo')
  assert.match(m.body, /5/)
})

test('sonho atrasado tem prioridade sobre prazo próximo', () => {
  const m = buildDailyMessage({
    ...base,
    sonhoAtrasado: { title: 'Reforma da cozinha', days: -20 },
    sonhoProximo: { title: 'Retiro', days: 10 },
  })
  assert.equal(m.kind, 'atrasado')
  assert.match(m.body, /Reforma da cozinha/)
})

test('avisa quando o prazo está chegando', () => {
  const m = buildDailyMessage({ ...base, sonhoProximo: { title: 'Retiro', days: 12 } })
  assert.equal(m.kind, 'prazo')
  assert.match(m.body, /Retiro/)
  assert.match(m.body, /12/)
})

test('celebra a sequência quando não há cobrança pendente', () => {
  const m = buildDailyMessage({ ...base, sequencia: 9 })
  assert.equal(m.kind, 'streak')
  assert.match(m.body, /9/)
})

test('a inatividade vence a sequência', () => {
  const m = buildDailyMessage({ ...base, diasSemCheckin: 4, sequencia: 9 })
  assert.equal(m.kind, 'inativo')
})

test('funciona sem nome cadastrado', () => {
  const m = buildDailyMessage({ ...base, nome: '' })
  assert.ok(m.title.length > 0)
  assert.ok(!m.title.startsWith(','), `título começou com vírgula: ${m.title}`)
})

test('o título varia ao longo dos dias', () => {
  const titulos = new Set()
  for (let d = 0; d < 12; d++) titulos.add(buildDailyMessage({ ...base, dayNumber: d }).title)
  assert.ok(titulos.size >= 4, `esperava variedade de títulos, veio ${titulos.size}`)
})

test('hora local respeita o fuso', () => {
  // 2026-06-15T12:00:00Z → 09:00 em São Paulo (UTC-3)
  const agora = new Date('2026-06-15T12:00:00Z')
  assert.equal(localHour('America/Sao_Paulo', agora), 9)
  assert.equal(localHour('UTC', agora), 12)
  assert.equal(localHour('Europe/Lisbon', agora), 13)
})

test('fuso inválido devolve null em vez de quebrar', () => {
  assert.equal(localHour('Marte/Olympus', new Date()), null)
})

test('data local vira o dia no fuso certo', () => {
  // 2026-06-16T01:00:00Z ainda é dia 15 em São Paulo
  const agora = new Date('2026-06-16T01:00:00Z')
  assert.equal(localDate('America/Sao_Paulo', agora), '2026-06-15')
  assert.equal(localDate('UTC', agora), '2026-06-16')
})

test('dayNumber avança de um em um por dia', () => {
  const a = dayNumber(new Date('2026-06-15T00:00:00Z'))
  const b = dayNumber(new Date('2026-06-16T00:00:00Z'))
  assert.equal(b - a, 1)
})
