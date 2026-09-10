import { Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { DreamImage } from '../components/DreamImage'
import { EmptyState, ProgressBar } from '../components/ui'
import { money, prettyDate } from '../lib/format'
import { useApp } from '../store/AppProvider'

export function ArchivePage() {
  const { data, categoryOf, stats } = useApp()

  const realized = useMemo(
    () =>
      data.dreams
        .filter((d) => d.status === 'realized')
        .sort((a, b) => (b.realized_at ?? '').localeCompare(a.realized_at ?? '')),
    [data.dreams],
  )

  /** Agrupado por ano — vira uma linha do tempo das suas conquistas. */
  const byYear = useMemo(() => {
    const groups = new Map<string, typeof realized>()
    for (const d of realized) {
      const year = (d.realized_at ?? '').slice(0, 4) || 'Sem data'
      if (!groups.has(year)) groups.set(year, [])
      groups.get(year)!.push(d)
    }
    return [...groups.entries()]
  }, [realized])

  const totalValue = realized.reduce((s, d) => s + Number(d.target_amount ?? 0), 0)
  const unlocked = stats.achievements.filter((a) => a.unlocked)

  return (
    <div className="space-y-7 stack-in">
      <header>
        <h1 className="section-title text-3xl">Sonhos realizados</h1>
        <p className="text-xs muted mt-1.5">
          A prova viva de que funciona. Volte aqui sempre que a dúvida bater.
        </p>
      </header>

      {realized.length === 0 ? (
        <EmptyState
          emoji="🏆"
          title="Seu arquivo de conquistas espera o primeiro"
          message="Quando você marcar um sonho como realizado, ele vem para cá — para você lembrar do que é capaz."
          action={
            <Link to="/quadro" className="btn-ghost">
              Ver meu quadro
            </Link>
          }
        />
      ) : (
        <>
          {/* -------------------------------------------------- números */}
          <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="card p-5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-gold-200/45">Conquistados</p>
              <p className="mt-1.5 font-display text-3xl gold-text">{realized.length}</p>
            </div>
            <div className="card p-5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-gold-200/45">Valor realizado</p>
              <p className="mt-1.5 font-display text-3xl text-gold-50">
                {totalValue > 0 ? money(totalValue) : '—'}
              </p>
            </div>
            <div className="card p-5 col-span-2 sm:col-span-1">
              <p className="text-[10px] uppercase tracking-[0.14em] text-gold-200/45">Seu nível</p>
              <p className="mt-1.5 font-display text-2xl text-gold-50">
                {stats.level.emoji} {stats.level.name}
              </p>
            </div>
          </section>

          {/* ---------------------------------------------- linha do tempo */}
          {byYear.map(([year, list]) => (
            <section key={year}>
              <div className="flex items-center gap-4 mb-4">
                <h2 className="font-display text-2xl gold-text">{year}</h2>
                <span className="h-px flex-1 bg-gold-500/12" />
                <span className="text-xs muted">
                  {list.length} {list.length === 1 ? 'conquista' : 'conquistas'}
                </span>
              </div>

              <div className="space-y-3">
                {list.map((d, i) => {
                  const cat = categoryOf(d)
                  return (
                    <Link
                      key={d.id}
                      to={`/sonho/${d.id}`}
                      className="card card-hover flex items-center gap-4 p-3 pr-5 animate-fade-up"
                      style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                    >
                      <DreamImage
                        dream={d}
                        emoji={cat?.emoji ?? '🏆'}
                        className="h-20 w-20 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0 flex-1">
                        {cat && (
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-300/70">
                            {cat.emoji} {cat.name}
                          </p>
                        )}
                        <p className="mt-0.5 font-display text-lg text-gold-50 truncate">{d.title}</p>
                        <p className="text-[11px] muted">
                          Realizado em {prettyDate(d.realized_at, "d 'de' MMMM")}
                          {d.target_amount ? ` · ${money(d.target_amount)}` : ''}
                        </p>
                      </div>
                      <Trophy size={18} className="shrink-0 text-emerald-400/70" />
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </>
      )}

      {/* --------------------------------------------------- conquistas */}
      <section>
        <h2 className="section-title mb-1">Suas medalhas</h2>
        <p className="text-xs muted mb-4">
          {unlocked.length} de {stats.achievements.length} desbloqueadas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {stats.achievements.map((a) => (
            <div
              key={a.code}
              className={
                'card p-4 text-center transition ' +
                (a.unlocked ? 'border-gold-500/40 bg-gold-500/[0.06]' : 'opacity-60')
              }
            >
              <div className={'text-3xl mb-2 ' + (a.unlocked ? '' : 'grayscale opacity-50')}>
                {a.emoji}
              </div>
              <p className="text-xs font-semibold text-gold-50 leading-tight">{a.title}</p>
              <p className="mt-1 text-[10px] muted leading-snug">{a.description}</p>
              {!a.unlocked && <ProgressBar value={a.progress * 100} className="mt-2.5 h-1" />}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
