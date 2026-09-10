import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
})

export function money(v: number | null | undefined): string {
  return brl.format(Number(v ?? 0))
}

/** Formata um valor compacto: R$ 1,2 mil / R$ 850 mil / R$ 1,3 mi */
export function moneyShort(v: number | null | undefined): string {
  const n = Number(v ?? 0)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  // sem casa decimal inútil: "R$ 2 mil", não "R$ 2,0 mil"
  const dec = (value: number, casas: number) =>
    value.toFixed(casas).replace(/[.,]0$/, '').replace('.', ',')
  if (abs >= 1_000_000) return `${sign}R$ ${dec(abs / 1_000_000, 1)} mi`
  if (abs >= 1_000) return `${sign}R$ ${dec(abs / 1_000, abs >= 100_000 ? 0 : 1)} mil`
  return brl.format(n)
}

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  try {
    return parseISO(iso)
  } catch {
    return null
  }
}

export function prettyDate(iso: string | null | undefined, pattern = "d 'de' MMMM 'de' yyyy"): string {
  const d = toDate(iso)
  return d ? format(d, pattern, { locale: ptBR }) : '—'
}

export function shortDate(iso: string | null | undefined): string {
  const d = toDate(iso)
  return d ? format(d, 'dd/MM/yy') : '—'
}

/** Dias até a data alvo. Negativo = atrasado. */
export function daysUntil(iso: string | null | undefined): number | null {
  const d = toDate(iso)
  if (!d) return null
  return differenceInCalendarDays(d, new Date())
}

/** Texto humano do prazo. */
export function deadlineLabel(iso: string | null | undefined): { text: string; tone: 'calm' | 'soon' | 'late' } {
  const days = daysUntil(iso)
  if (days === null) return { text: 'Sem data definida', tone: 'calm' }
  if (days < 0) {
    const n = Math.abs(days)
    return { text: `${n} ${n === 1 ? 'dia' : 'dias'} de atraso`, tone: 'late' }
  }
  if (days === 0) return { text: 'É hoje!', tone: 'soon' }
  if (days === 1) return { text: 'Falta 1 dia', tone: 'soon' }
  if (days <= 30) return { text: `Faltam ${days} dias`, tone: 'soon' }
  if (days <= 365) return { text: `Faltam ${Math.round(days / 30)} meses`, tone: 'calm' }
  const anos = (days / 365).toFixed(1).replace('.0', '').replace('.', ',')
  return { text: `Faltam ${anos} anos`, tone: 'calm' }
}

export function pct(part: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)))
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
