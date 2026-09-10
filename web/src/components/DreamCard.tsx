import { CalendarClock, Check, Heart, Lock, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dreamProgress } from '../lib/achievements'
import { cn, deadlineLabel, moneyShort } from '../lib/format'
import type { Category, Deposit, Dream } from '../lib/types'
import { DreamImage } from './DreamImage'
import { ProgressBar } from './ui'

export function DreamCard({
  dream,
  category,
  deposits,
  isPartner,
  index = 0,
}: {
  dream: Dream
  category: Category | null
  deposits: Deposit[]
  isPartner: boolean
  index?: number
}) {
  const realized = dream.status === 'realized'
  const { saved, pct } = dreamProgress(dream, deposits)
  const hasGoal = Number(dream.target_amount ?? 0) > 0
  const deadline = deadlineLabel(dream.target_date)
  const showDeadline = !realized && Boolean(dream.target_date)

  return (
    <Link
      to={`/sonho/${dream.id}`}
      className="card card-hover group block overflow-hidden animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
    >
      <div className="relative aspect-[4/5]">
        <DreamImage
          dream={dream}
          emoji={category?.emoji ?? '✨'}
          className="absolute inset-0"
          imgClassName="group-hover:scale-[1.06] transition-transform duration-[900ms]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/45 to-transparent" />

        {/* etiquetas superiores */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start gap-1.5">
          {dream.scope === 'couple' && (
            <span className="badge bg-ink-950/80 text-gold-200 border border-gold-500/35 backdrop-blur">
              <Users size={11} /> Casal
            </span>
          )}
          {isPartner && (
            <span className="badge bg-ink-950/80 text-pink-200 border border-pink-400/35 backdrop-blur">
              <Heart size={11} /> Do seu par
            </span>
          )}
          {!isPartner && dream.scope === 'individual' && dream.share_with_partner && (
            <span className="badge bg-ink-950/80 text-gold-200/80 border border-gold-500/25 backdrop-blur">
              Compartilhado
            </span>
          )}
          {!isPartner && dream.scope === 'individual' && !dream.share_with_partner && (
            <span className="badge bg-ink-950/70 text-gold-100/50 border border-gold-500/15 backdrop-blur">
              <Lock size={10} /> Só seu
            </span>
          )}
          {realized && (
            <span className="badge ml-auto bg-emerald-500/90 text-emerald-950 border border-emerald-300/40">
              <Check size={11} /> Realizado
            </span>
          )}
        </div>

        {/* conteúdo inferior */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          {category && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-300/80">
              {category.emoji} {category.name}
            </span>
          )}
          <h3 className="mt-1 font-display text-xl leading-tight text-gold-50 line-clamp-2">
            {dream.title}
          </h3>

          {showDeadline && (
            <p
              className={cn(
                'mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium',
                deadline.tone === 'late'
                  ? 'text-red-300/90'
                  : deadline.tone === 'soon'
                    ? 'text-amber-200/90'
                    : 'text-gold-100/55',
              )}
            >
              <CalendarClock size={12} />
              {deadline.text}
            </p>
          )}

          {hasGoal && !realized && (
            <div className="mt-3">
              <div className="flex items-baseline justify-between text-[11px] mb-1.5">
                <span className="text-gold-200/70 font-semibold">
                  {moneyShort(saved)}{' '}
                  <span className="text-gold-100/35 font-normal">de {moneyShort(dream.target_amount)}</span>
                </span>
                <span className="font-bold text-gold-300">{pct}%</span>
              </div>
              <ProgressBar value={pct} className="h-1.5" />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
