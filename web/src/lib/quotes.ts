/**
 * Banco de frases do WE DREAM.
 *
 * O conteúdo vive em shared/content.json para que o app e o servidor de
 * notificações usem exatamente as mesmas frases.
 *
 * A rotação garante que nenhuma frase se repita até que TODAS tenham sido
 * mostradas — o ciclo só reinicia quando a lista se esgota.
 */
import content from '../../../shared/content.json'

export const DAILY_QUOTES: string[] = content.dailyQuotes

/** Mensagens do coach por contexto. */
export const COACH: Record<string, string[]> = content.coach

/** Saudação pelo horário. */
export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * Sorteia um item sem repetir até esgotar a lista.
 * O histórico fica no localStorage sob `wd:rot:{key}`.
 */
export function pickRotating<T>(list: T[], key: string, seedIndex?: number): T {
  if (list.length === 0) throw new Error('lista vazia')
  if (typeof window === 'undefined') return list[(seedIndex ?? 0) % list.length]

  const storeKey = `wd:rot:${key}`
  let used: number[] = []
  try {
    used = JSON.parse(localStorage.getItem(storeKey) ?? '[]')
    if (!Array.isArray(used)) used = []
  } catch {
    used = []
  }

  if (used.length >= list.length) used = []

  const available = list.map((_, i) => i).filter((i) => !used.includes(i))
  const chosen =
    seedIndex !== undefined
      ? available[seedIndex % available.length]
      : available[Math.floor(Math.random() * available.length)]

  used.push(chosen)
  try {
    localStorage.setItem(storeKey, JSON.stringify(used))
  } catch {
    /* modo privado — segue sem histórico */
  }
  return list[chosen]
}

/** Frase do dia: estável durante o mesmo dia, diferente a cada dia. */
export function quoteOfTheDay(date = new Date(), salt = 0): string {
  const day = Math.floor(date.getTime() / 86_400_000)
  // passo primo em relação ao tamanho da lista → percorre tudo antes de repetir
  const step = 37
  const idx = (((day * step + salt) % DAILY_QUOTES.length) + DAILY_QUOTES.length) % DAILY_QUOTES.length
  return DAILY_QUOTES[idx]
}

export function coachMessage(kind: keyof typeof COACH, vars: Record<string, string | number> = {}): string {
  const list = COACH[kind] ?? COACH.bom
  const raw = pickRotating(list, `coach:${kind}`)
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}
