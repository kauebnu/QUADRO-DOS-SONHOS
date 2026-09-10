import { ChevronDown, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '../lib/format'
import { quoteOfTheDay } from '../lib/quotes'
import { TIPS, TIP_TRACKS, type Tip } from '../lib/tips'
import { useApp } from '../store/AppProvider'

export function TipsPage() {
  const { data, addAffirmation, removeAffirmation, notify } = useApp()
  const [track, setTrack] = useState<Tip['track'] | 'todos'>('todos')
  const [openId, setOpenId] = useState<string | null>(TIPS[0]?.id ?? null)
  const [newAffirmation, setNewAffirmation] = useState('')

  const list = useMemo(
    () => (track === 'todos' ? TIPS : TIPS.filter((t) => t.track === track)),
    [track],
  )

  async function submitAffirmation() {
    const text = newAffirmation.trim()
    if (text.length < 4) {
      notify('Escreva uma afirmação um pouco maior.', 'erro')
      return
    }
    await addAffirmation(text)
    setNewAffirmation('')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-7 stack-in">
      <header>
        <h1 className="section-title text-3xl">Lei da Atração</h1>
        <p className="text-xs muted mt-1.5">
          Não é sobre esperar. É sobre se tornar. Aqui está o método.
        </p>
      </header>

      {/* ----------------------------------------------------- frase */}
      <section className="card p-6 sm:p-7 relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,.55), transparent 68%)' }}
        />
        <p className="relative font-display text-2xl leading-snug text-gold-50">
          “{quoteOfTheDay()}”
        </p>
      </section>

      {/* ------------------------------------------------ afirmações */}
      <section className="card p-6">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-1">
          Suas afirmações
        </h2>
        <p className="text-xs muted mb-4 leading-relaxed">
          Escreva no formato “eu estou me tornando…” — o cérebro aceita o movimento mesmo quando
          rejeita o destino.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            className="flex-1"
            value={newAffirmation}
            onChange={(e) => setNewAffirmation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAffirmation()}
            placeholder="Eu sou um ímã de prosperidade…"
            maxLength={200}
          />
          <button className="btn-gold px-4" onClick={submitAffirmation} aria-label="Adicionar afirmação">
            <Plus size={18} />
          </button>
        </div>

        {data.affirmations.length === 0 ? (
          <p className="text-sm muted italic">
            Nenhuma afirmação ainda. Comece por uma que você quase acredita.
          </p>
        ) : (
          <div className="space-y-2">
            {data.affirmations.map((a) => (
              <div
                key={a.id}
                className="group flex items-center gap-3 rounded-xl border border-gold-500/15 bg-gold-500/[0.05] px-4 py-3"
              >
                <Sparkles size={14} className="shrink-0 text-gold-400/70" />
                <p className="flex-1 text-sm text-gold-50/90 leading-relaxed">{a.text}</p>
                <button
                  className="btn-quiet p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                  onClick={() => removeAffirmation(a.id)}
                  aria-label="Remover afirmação"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------- trilhas */}
      <section>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
          <button
            onClick={() => setTrack('todos')}
            className={cn('chip shrink-0', track === 'todos' && 'chip-active')}
          >
            Tudo
          </button>
          {TIP_TRACKS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTrack(t.id)}
              className={cn('chip shrink-0', track === t.id && 'chip-active')}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {track !== 'todos' && (
          <p className="mt-3 text-sm muted">
            {TIP_TRACKS.find((t) => t.id === track)?.blurb}
          </p>
        )}

        <div className="mt-4 space-y-3">
          {list.map((tip) => {
            const open = openId === tip.id
            return (
              <article key={tip.id} className="card overflow-hidden">
                <button
                  className="w-full flex items-center gap-4 p-5 text-left"
                  onClick={() => setOpenId(open ? null : tip.id)}
                  aria-expanded={open}
                >
                  <span className="text-2xl shrink-0">{tip.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-display text-lg leading-tight text-gold-50">
                      {tip.title}
                    </span>
                    <span className="block mt-0.5 text-[10px] uppercase tracking-[0.16em] text-gold-300/50">
                      {TIP_TRACKS.find((t) => t.id === tip.track)?.label}
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    className={cn(
                      'shrink-0 text-gold-300/60 transition-transform duration-300',
                      open && 'rotate-180',
                    )}
                  />
                </button>

                {open && (
                  <div className="px-5 pb-5 animate-fade-up">
                    <p className="text-[15px] leading-relaxed text-gold-50/85">{tip.body}</p>
                    <div className="mt-4 rounded-xl border border-gold-500/25 bg-gold-500/[0.07] p-4">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-gold-300/70 mb-1.5">
                        Pratique agora
                      </p>
                      <p className="text-sm text-gold-100/85 leading-relaxed">{tip.practice}</p>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-gold-200/25 pt-2">
        We dreams, we work, we conquer!
      </p>
    </div>
  )
}
