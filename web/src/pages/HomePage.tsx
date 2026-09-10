import {
  ArrowRight,
  Flame,
  Play,
  Plus,
  Sparkles,
  Target,
  Trophy,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DailyRitual } from '../components/DailyRitual'
import { DreamCard } from '../components/DreamCard'
import { EmptyState, ProgressBar, ProgressRing } from '../components/ui'
import { cn, daysUntil, moneyShort } from '../lib/format'
import { coachMessage, greeting, quoteOfTheDay } from '../lib/quotes'
import { useApp } from '../store/AppProvider'

export function HomePage() {
  const { data, stats, isPartnerDream, categoryOf, partner } = useApp()
  const [ritualOpen, setRitualOpen] = useState(false)

  const todayKey = new Date().toISOString().slice(0, 10)
  const checkedInToday = data.checkins.some((c) => c.day === todayKey)

  const active = useMemo(
    () => data.dreams.filter((d) => d.status === 'active' && !d.archived),
    [data.dreams],
  )

  /** Destaques: prazo mais próximo primeiro, depois prioridade. */
  const spotlight = useMemo(() => {
    return [...active]
      .sort((a, b) => {
        const da = daysUntil(a.target_date)
        const db = daysUntil(b.target_date)
        if (da === null && db === null) return a.priority - b.priority
        if (da === null) return 1
        if (db === null) return -1
        return da - db
      })
      .slice(0, 4)
  }, [active])

  /** Mensagem do coach conforme o comportamento recente. */
  const coach = useMemo(() => {
    const lastDay = data.checkins[0]?.day
    const gap = lastDay
      ? Math.floor((Date.now() - new Date(`${lastDay}T12:00:00`).getTime()) / 86_400_000)
      : null

    if (gap !== null && gap >= 3) {
      return { tone: 'alerta' as const, text: coachMessage('inativo', { dias: gap }) }
    }

    const late = active.find((d) => {
      const u = daysUntil(d.target_date)
      return u !== null && u < 0
    })
    if (late) return { tone: 'alerta' as const, text: coachMessage('atrasado', { sonho: late.title }) }

    const soon = active.find((d) => {
      const u = daysUntil(d.target_date)
      return u !== null && u >= 0 && u <= 45
    })
    if (soon) {
      return {
        tone: 'foco' as const,
        text: coachMessage('prazo', { sonho: soon.title, dias: daysUntil(soon.target_date) ?? 0 }),
      }
    }

    if (stats.streak >= 3) {
      return { tone: 'ok' as const, text: coachMessage('streak', { dias: stats.streak }) }
    }

    const mood = data.checkins.find((c) => c.day === todayKey)?.mood ?? 'bom'
    return { tone: 'ok' as const, text: coachMessage(mood) }
  }, [data.checkins, active, stats.streak, todayKey])

  const totalGoal = active.reduce((s, d) => s + Number(d.target_amount ?? 0), 0)
  const savedForGoals = data.deposits
    .filter((d) => d.dream_id && active.some((a) => a.id === d.dream_id))
    .reduce((s, d) => s + Number(d.amount), 0)
  const globalPct = totalGoal > 0 ? Math.round((savedForGoals / totalGoal) * 100) : 0

  const nextAchievement = stats.achievements.find((a) => !a.unlocked)

  return (
    <div className="space-y-6 stack-in">
      {/* ------------------------------------------------------- saudação */}
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-gold-300/60">
          {greeting()}
          {data.couple && <span className="text-gold-400"> · together</span>}
        </p>
        <h1 className="mt-1.5 section-title text-3xl sm:text-4xl">
          {data.profile.display_name || 'Sonhador(a)'}
        </h1>
        <p className="mt-2 text-sm muted">
          {stats.level.emoji} {stats.level.name}
          {stats.level.next !== null && (
            <>
              {' '}· faltam <strong className="text-gold-200">{stats.level.next - stats.points}</strong> pts
              para o próximo nível
            </>
          )}
        </p>
        {stats.level.next !== null && (
          <ProgressBar value={stats.levelProgress * 100} className="mt-3 max-w-xs h-1.5" />
        )}
      </header>

      {/* ---------------------------------------------------- frase do dia */}
      <section className="card p-6 sm:p-8 relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,.55), transparent 68%)' }}
        />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gold-300/60 mb-3">
            <Sparkles size={11} className="inline mr-1.5 -mt-0.5" />
            Sua frase de hoje
          </p>
          <p className="font-display text-2xl sm:text-[28px] leading-snug text-gold-50">
            “{quoteOfTheDay()}”
          </p>
        </div>
      </section>

      {/* -------------------------------------------------- coach + ritual */}
      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div
          className={cn(
            'card p-6 border-l-2',
            coach.tone === 'alerta'
              ? 'border-l-amber-400/70'
              : coach.tone === 'foco'
                ? 'border-l-gold-400/70'
                : 'border-l-emerald-400/60',
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-2.5">
            Seu coach diz
          </p>
          <p className="text-[15px] leading-relaxed text-gold-50/95">{coach.text}</p>
          {!checkedInToday && (
            <button className="btn-gold mt-5" onClick={() => setRitualOpen(true)}>
              Fazer o ritual do dia
            </button>
          )}
          {checkedInToday && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="chip chip-active">
                <Flame size={12} /> {stats.streak} {stats.streak === 1 ? 'dia' : 'dias'} seguidos
              </span>
              <button className="btn-quiet text-xs" onClick={() => setRitualOpen(true)}>
                Editar check-in de hoje
              </button>
            </div>
          )}
        </div>

        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <ProgressRing value={globalPct} size={104} stroke={7}>
            <div>
              <div className="font-display text-2xl gold-text leading-none">{globalPct}%</div>
              <div className="text-[9px] uppercase tracking-widest text-gold-200/45 mt-1">do total</div>
            </div>
          </ProgressRing>
          <p className="mt-4 text-sm font-semibold text-gold-50">
            {moneyShort(savedForGoals)} guardados
          </p>
          <p className="text-xs muted mt-0.5">
            {totalGoal > 0 ? `de ${moneyShort(totalGoal)} em sonhos` : 'defina valores nos seus sonhos'}
          </p>
          <Link to="/banco" className="btn-ghost mt-4 text-xs px-4 py-2">
            <Wallet size={14} /> Banco dos Sonhos
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------- números */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={<Target size={16} />} value={stats.active} label="sonhos ativos" to="/quadro" />
        <StatTile icon={<Trophy size={16} />} value={stats.realized} label="realizados" to="/realizados" />
        <StatTile icon={<Flame size={16} />} value={stats.streak} label="dias de foco" />
        <StatTile
          icon={<Wallet size={16} />}
          value={moneyShort(stats.totalSaved)}
          label="guardado"
          to="/banco"
        />
      </section>

      {/* ------------------------------------------------------- destaques */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="section-title">Em foco agora</h2>
            <p className="text-xs muted mt-1">Os sonhos com o prazo mais próximo</p>
          </div>
          <div className="flex gap-2">
            <Link to="/apresentacao" className="btn-ghost text-xs px-3 py-2" aria-label="Apresentação">
              <Play size={14} /> <span className="hidden sm:inline">Apresentação</span>
            </Link>
            <Link to="/quadro" className="btn-quiet text-xs px-3 py-2">
              Ver tudo <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {spotlight.length === 0 ? (
          <EmptyState
            emoji="✨"
            title="Seu quadro está esperando"
            message="Adicione o primeiro sonho, coloque uma foto e escreva o projeto de como vai realizar. É assim que começa."
            action={
              <Link to="/sonho/novo" className="btn-gold">
                <Plus size={16} /> Adicionar meu primeiro sonho
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {spotlight.map((d, i) => (
              <DreamCard
                key={d.id}
                dream={d}
                category={categoryOf(d)}
                deposits={data.deposits}
                isPartner={isPartnerDream(d)}
                index={i}
              />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------- próxima conquista */}
      {nextAchievement && (
        <section className="card p-6">
          <div className="flex items-center gap-4">
            <div className="text-3xl grayscale opacity-60">{nextAchievement.emoji}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60">Próxima conquista</p>
              <p className="mt-1 font-semibold text-gold-50">{nextAchievement.title}</p>
              <p className="text-xs muted">{nextAchievement.description}</p>
              <ProgressBar value={nextAchievement.progress * 100} className="mt-3 h-1.5" />
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ convite do casal */}
      {!data.couple && (
        <section className="card p-6 text-center">
          <p className="text-3xl mb-3">💞</p>
          <h3 className="font-display text-xl text-gold-50">Sonhar a dois multiplica</h3>
          <p className="text-sm muted mt-2 max-w-md mx-auto leading-relaxed">
            Conecte seu par e criem sonhos juntos — cada um mantém os individuais privados, e você
            decide o que quer compartilhar.
          </p>
          <Link to="/casal" className="btn-ghost mt-5">
            Criar quadro em casal
          </Link>
        </section>
      )}

      {partner && (
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-gold-200/30 pt-2">
          Você e {partner.display_name} · we dreams, we work, we conquer — together
        </p>
      )}

      <DailyRitual open={ritualOpen} onClose={() => setRitualOpen(false)} />
    </div>
  )
}

function StatTile({
  icon,
  value,
  label,
  to,
}: {
  icon: React.ReactNode
  value: React.ReactNode
  label: string
  to?: string
}) {
  const inner = (
    <>
      <span className="text-gold-400/80">{icon}</span>
      <span className="mt-2 block font-display text-2xl sm:text-3xl text-gold-50 leading-none">
        {value}
      </span>
      <span className="mt-1.5 block text-[10px] uppercase tracking-[0.14em] text-gold-200/45">
        {label}
      </span>
    </>
  )
  return to ? (
    <Link to={to} className="card card-hover p-4">
      {inner}
    </Link>
  ) : (
    <div className="card p-4">{inner}</div>
  )
}
