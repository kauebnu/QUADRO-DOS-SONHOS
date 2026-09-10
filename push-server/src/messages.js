import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * As frases vivem em shared/content.json — as mesmas que o app mostra.
 * No container o arquivo é copiado para ./shared/content.json.
 */
function loadContent() {
  const candidatos = [
    resolve(here, '../shared/content.json'),
    resolve(here, '../../shared/content.json'),
  ]
  for (const p of candidatos) {
    try {
      return JSON.parse(readFileSync(p, 'utf8'))
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error(
    `Não encontrei shared/content.json. Procurei em:\n  ${candidatos.join('\n  ')}`,
  )
}

const content = loadContent()
export const DAILY_QUOTES = content.dailyQuotes
export const COACH = content.coach

/** Rotação determinística: percorre a lista inteira antes de repetir. */
export function rotate(list, seed) {
  const step = list.length % 7 === 0 ? 5 : 7
  const i = ((Math.abs(Math.trunc(seed)) * step) % list.length + list.length) % list.length
  return list[i]
}

/** Frase do dia — a mesma que o app mostra naquele dia, com deslocamento por usuário. */
export function quoteForDay(dayNumber, salt = 0) {
  const step = 37
  const idx =
    ((dayNumber * step + salt) % DAILY_QUOTES.length + DAILY_QUOTES.length) % DAILY_QUOTES.length
  return DAILY_QUOTES[idx]
}

function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

const TITULOS = [
  '{nome}, olhe seus sonhos ✨',
  'Seu quadro está te esperando, {nome} 👑',
  '{nome}, um minuto pelos seus sonhos',
  'Lembrete de quem você está se tornando 🌟',
  '{nome}, hoje conta ⚡',
  'Seu coach do WE DREAM 💛',
]

/**
 * Decide o que dizer para o usuário hoje.
 *
 * @param {object} ctx
 * @param {string} ctx.nome
 * @param {number} ctx.dayNumber        dias desde a época (para variar por dia)
 * @param {number} ctx.saltUsuario      número estável derivado do id do usuário
 * @param {number|null} ctx.diasSemCheckin
 * @param {{title:string, days:number}|null} ctx.sonhoAtrasado
 * @param {{title:string, days:number}|null} ctx.sonhoProximo
 * @param {number} ctx.sequencia
 * @returns {{title:string, body:string, kind:string, url:string}}
 */
export function buildDailyMessage(ctx) {
  const {
    nome = '',
    dayNumber,
    saltUsuario = 0,
    diasSemCheckin = null,
    sonhoAtrasado = null,
    sonhoProximo = null,
    sequencia = 0,
  } = ctx

  const seed = dayNumber + saltUsuario
  const primeiroNome = String(nome).trim().split(/\s+/)[0] ?? ''
  const title = fill(rotate(TITULOS, seed), { nome: primeiroNome }).replace(/^,\s*/, '')

  // A frase do dia sempre acompanha — é o que a usuária pediu.
  const frase = quoteForDay(dayNumber, saltUsuario)

  let kind = 'daily'
  let cobranca = null

  if (diasSemCheckin !== null && diasSemCheckin >= 3) {
    kind = 'inativo'
    cobranca = fill(rotate(COACH.inativo, seed), { dias: diasSemCheckin })
  } else if (sonhoAtrasado) {
    kind = 'atrasado'
    cobranca = fill(rotate(COACH.atrasado, seed), { sonho: sonhoAtrasado.title })
  } else if (sonhoProximo) {
    kind = 'prazo'
    cobranca = fill(rotate(COACH.prazo, seed), {
      sonho: sonhoProximo.title,
      dias: sonhoProximo.days,
    })
  } else if (sequencia >= 3) {
    kind = 'streak'
    cobranca = fill(rotate(COACH.streak, seed), { dias: sequencia })
  }

  const body = cobranca ? `${cobranca}\n\n“${frase}”` : `“${frase}”`

  return { title, body, kind, url: '/' }
}

/** Número estável (0-999) a partir do id do usuário, para variar as frases entre pessoas. */
export function saltFromId(id) {
  let h = 2166136261
  for (let i = 0; i < String(id).length; i++) {
    h ^= String(id).charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % 1000
}

/** Dias desde a época (UTC), usado para a frase do dia. */
export function dayNumber(date = new Date()) {
  return Math.floor(date.getTime() / 86_400_000)
}

/**
 * Hora local de um usuário no fuso informado.
 * Retorna null se o fuso for inválido (o chamador decide o que fazer).
 */
export function localHour(timezone, now = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    })
    return Number(fmt.format(now))
  } catch {
    return null
  }
}

/** Data local (YYYY-MM-DD) de um usuário no fuso informado. */
export function localDate(timezone, now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}
