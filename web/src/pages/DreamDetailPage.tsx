import {
  Archive,
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  Check,
  Heart,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trophy,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DepositModal } from '../components/DepositModal'
import { DreamImage } from '../components/DreamImage'
import { ConfirmDialog, ProgressBar, ProgressRing } from '../components/ui'
import { dreamProgress } from '../lib/achievements'
import { celebrate } from '../lib/celebrate'
import { cn, deadlineLabel, money, prettyDate, shortDate, today } from '../lib/format'
import { coachMessage } from '../lib/quotes'
import type { Cheer } from '../lib/types'
import { useApp } from '../store/AppProvider'

export function DreamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, user, editDream, categoryOf, isPartnerDream, repo, notify, partner } = useApp()

  const dream = useMemo(() => data.dreams.find((d) => d.id === id), [data.dreams, id])
  const [depositOpen, setDepositOpen] = useState(false)
  const [confirmRealize, setConfirmRealize] = useState(false)
  const [cheers, setCheers] = useState<Cheer[]>([])
  const [cheerText, setCheerText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!dream) return
    let alive = true
    repo
      .listCheers(dream.id)
      .then((c) => alive && setCheers(c))
      .catch(() => alive && setCheers([]))
    return () => {
      alive = false
    }
  }, [dream, repo])

  /**
   * Sugestão de quanto guardar por mês para bater o prazo.
   * Fica ANTES de qualquer return condicional: todos os hooks precisam
   * rodar na mesma ordem em todo render.
   */
  const monthlySuggestion = useMemo(() => {
    if (!dream || !dream.target_date || dream.status === 'realized') return null
    const goal = Number(dream.target_amount ?? 0)
    if (goal <= 0) return null
    const { missing } = dreamProgress(dream, data.deposits)
    if (missing <= 0) return 0
    const months = Math.max(
      1,
      Math.round((new Date(dream.target_date).getTime() - Date.now()) / (30 * 86_400_000)),
    )
    return missing / months
  }, [dream, data.deposits])

  if (!dream) {
    return (
      <div className="card p-10 text-center">
        <p className="muted">Este sonho não está mais no quadro.</p>
        <Link to="/quadro" className="btn-ghost mt-5">
          Voltar ao quadro
        </Link>
      </div>
    )
  }

  const category = categoryOf(dream)
  const isPartner = isPartnerDream(dream)
  const isOwner = dream.owner_id === user?.id
  const canEdit = isOwner || dream.scope === 'couple'
  const realized = dream.status === 'realized'
  const { saved, pct, missing } = dreamProgress(dream, data.deposits)
  const hasGoal = Number(dream.target_amount ?? 0) > 0
  const deadline = deadlineLabel(dream.target_date)

  const dreamDeposits = data.deposits
    .filter((d) => d.dream_id === dream.id)
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))

  async function markRealized() {
    setConfirmRealize(false)
    await editDream(dream!.id, { realized_at: today() })
    celebrate()
    notify(coachMessage('celebracao', { sonho: dream!.title }), 'ok')
  }

  async function sendCheer() {
    const body = cheerText.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const c = await repo.addCheer(dream!.id, body)
      setCheers((list) => [...list, c])
      setCheerText('')
    } catch {
      notify('Não consegui enviar o incentivo.', 'erro')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button className="btn-quiet -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        {canEdit && (
          <Link to={`/sonho/${dream.id}/editar`} className="btn-ghost text-xs px-4 py-2">
            <Pencil size={14} /> Editar
          </Link>
        )}
      </div>

      {/* ------------------------------------------------------------ capa */}
      <div className="card overflow-hidden animate-fade-up">
        <div className="relative aspect-[16/10] sm:aspect-[2/1]">
          <DreamImage
            dream={dream}
            emoji={category?.emoji ?? '✨'}
            className="absolute inset-0"
            eager
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />

          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            {dream.scope === 'couple' && (
              <span className="badge bg-ink-950/85 text-gold-200 border border-gold-500/35 backdrop-blur">
                <Users size={11} /> Sonho do casal
              </span>
            )}
            {isPartner && (
              <span className="badge bg-ink-950/85 text-pink-200 border border-pink-400/35 backdrop-blur">
                <Heart size={11} /> De {partner?.display_name ?? 'seu par'}
              </span>
            )}
            {isOwner && dream.scope === 'individual' && !dream.share_with_partner && data.couple && (
              <span className="badge bg-ink-950/75 text-gold-100/60 border border-gold-500/20 backdrop-blur">
                <Lock size={10} /> Privado
              </span>
            )}
            {realized && (
              <span className="badge bg-emerald-500/90 text-emerald-950 border border-emerald-300/40">
                <Trophy size={11} /> Realizado
              </span>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
            {category && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-300/85">
                {category.emoji} {category.name}
              </p>
            )}
            <h1 className="mt-1.5 font-display text-3xl sm:text-4xl leading-tight text-gold-50">
              {dream.title}
            </h1>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- datas */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <InfoTile
          icon={<CalendarPlus size={14} />}
          label="Entrou no quadro"
          value={shortDate(dream.date_added)}
        />
        <InfoTile
          icon={<CalendarClock size={14} />}
          label="Pretendo realizar"
          value={dream.target_date ? shortDate(dream.target_date) : '—'}
          hint={!realized && dream.target_date ? deadline.text : undefined}
          tone={deadline.tone}
        />
        <InfoTile
          icon={<Trophy size={14} />}
          label="Realizado em"
          value={dream.realized_at ? shortDate(dream.realized_at) : '—'}
          className="col-span-2 sm:col-span-1"
        />
      </section>

      {/* ------------------------------------------------------ realizar */}
      {canEdit && (
        <section className="card p-5 sm:p-6">
          {!realized ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-display text-xl text-gold-50">Já conquistou?</p>
                <p className="text-xs muted mt-1">
                  Marque como realizado e comemore — você merece esse momento.
                </p>
              </div>
              <button className="btn-gold" onClick={() => setConfirmRealize(true)}>
                <Check size={16} /> Marcar como realizado
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-display text-xl text-emerald-200">
                  Conquistado em {prettyDate(dream.realized_at)} 🏆
                </p>
                <p className="text-xs muted mt-1">
                  {dream.archived
                    ? 'Guardado no seu arquivo de conquistas.'
                    : 'Arquive para manter o quadro focado no que ainda vem.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-ghost text-xs px-4 py-2.5"
                  onClick={() => editDream(dream.id, { archived: !dream.archived })}
                >
                  <Archive size={14} /> {dream.archived ? 'Tirar do arquivo' : 'Arquivar'}
                </button>
                <button
                  className="btn-quiet text-xs px-4 py-2.5"
                  onClick={() => editDream(dream.id, { realized_at: null })}
                >
                  <RotateCcw size={14} /> Desfazer
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------- descrição */}
      {dream.description && (
        <section className="card p-6">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-3">
            Como é esse sonho
          </h2>
          <p className="text-[15px] leading-relaxed text-gold-50/90 whitespace-pre-wrap">
            {dream.description}
          </p>
        </section>
      )}

      {/* --------------------------------------------------------- projeto */}
      <section className="card p-6 border-l-2 border-l-gold-500/50">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-3">
          O projeto — como vou realizar
        </h2>
        {dream.plan ? (
          <p className="text-[15px] leading-relaxed text-gold-50/90 whitespace-pre-wrap">{dream.plan}</p>
        ) : (
          <div>
            <p className="text-sm muted leading-relaxed">
              Este sonho ainda não tem plano. Desejo sem plano continua desejo — escreva o primeiro
              passo concreto.
            </p>
            {canEdit && (
              <Link to={`/sonho/${dream.id}/editar`} className="btn-ghost mt-4 text-xs px-4 py-2">
                Escrever o projeto
              </Link>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ banco dos sonhos */}
      <section className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60">
            Banco dos Sonhos
          </h2>
          {hasGoal && !realized && (
            <button className="btn-gold text-xs px-4 py-2" onClick={() => setDepositOpen(true)}>
              <Plus size={14} /> Aportar
            </button>
          )}
        </div>

        {!hasGoal ? (
          <div>
            <p className="text-sm muted leading-relaxed">
              Este sonho não tem valor definido. Com um valor, você acompanha a porcentagem já
              conquistada e sabe quanto guardar por mês.
            </p>
            {canEdit && (
              <Link to={`/sonho/${dream.id}/editar`} className="btn-ghost mt-4 text-xs px-4 py-2">
                Definir valor
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-6">
              <ProgressRing value={pct} size={96} stroke={7}>
                <div className="text-center">
                  <div className="font-display text-xl gold-text leading-none">{pct}%</div>
                </div>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl text-gold-50">{money(saved)}</p>
                <p className="text-xs muted mt-0.5">de {money(dream.target_amount)}</p>
                <ProgressBar value={pct} className="mt-3" />
                {missing > 0 && (
                  <p className="mt-2.5 text-xs text-gold-100/60">
                    Faltam <strong className="text-gold-200">{money(missing)}</strong>
                    {monthlySuggestion !== null && monthlySuggestion > 0 && (
                      <>
                        {' '}· cerca de{' '}
                        <strong className="text-gold-200">{money(monthlySuggestion)}</strong>/mês para
                        chegar no prazo
                      </>
                    )}
                  </p>
                )}
                {missing === 0 && (
                  <p className="mt-2.5 text-xs font-semibold text-emerald-300">
                    Meta financeira batida! 🎉
                  </p>
                )}
              </div>
            </div>

            {dreamDeposits.length > 0 && (
              <div className="mt-6 hairline pt-5 space-y-2">
                {dreamDeposits.slice(0, 6).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="text-gold-100/80">{d.note || 'Aporte'}</span>
                      <span className="block text-[11px] muted">{shortDate(d.occurred_on)}</span>
                    </div>
                    <span
                      className={cn(
                        'font-semibold tabular-nums shrink-0',
                        Number(d.amount) >= 0 ? 'text-emerald-300' : 'text-red-300',
                      )}
                    >
                      {Number(d.amount) >= 0 ? '+' : ''}
                      {money(d.amount)}
                    </span>
                  </div>
                ))}
                {dreamDeposits.length > 6 && (
                  <Link to="/banco" className="inline-block pt-2 text-xs text-gold-300/70 hover:text-gold-200">
                    Ver todos os {dreamDeposits.length} lançamentos →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* -------------------------------------------------------- torcida */}
      {data.couple && (
        <section className="card p-6">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-4">
            Torcida
          </h2>
          {cheers.length > 0 && (
            <div className="space-y-3 mb-5">
              {cheers.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'rounded-xl p-3.5 text-sm leading-relaxed',
                    c.user_id === user?.id
                      ? 'bg-gold-500/[0.08] border border-gold-500/20 text-gold-50/90'
                      : 'bg-ink-800/60 border border-gold-500/12 text-gold-100/80',
                  )}
                >
                  <p className="text-[10px] uppercase tracking-wider text-gold-300/50 mb-1.5">
                    {c.user_id === user?.id ? 'Você' : partner?.display_name ?? 'Seu par'} ·{' '}
                    {shortDate(c.created_at.slice(0, 10))}
                  </p>
                  {c.body}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="flex-1"
              value={cheerText}
              onChange={(e) => setCheerText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCheer()}
              placeholder="Deixe um incentivo…"
              maxLength={280}
            />
            <button className="btn-gold px-4" onClick={sendCheer} disabled={!cheerText.trim() || sending}>
              <Send size={16} />
            </button>
          </div>
        </section>
      )}

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        defaultDreamId={dream.id}
      />

      <ConfirmDialog
        open={confirmRealize}
        title="Sonho realizado! 🏆"
        confirmLabel="Sim, realizei!"
        message={
          <>
            Vamos marcar <strong className="text-gold-100">{dream.title}</strong> como realizado hoje,{' '}
            {prettyDate(today())}. Guarde esse momento — ele é a prova de que funciona.
          </>
        }
        onCancel={() => setConfirmRealize(false)}
        onConfirm={markRealized}
      />
    </div>
  )
}

function InfoTile({
  icon,
  label,
  value,
  hint,
  tone,
  className = '',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: 'calm' | 'soon' | 'late'
  className?: string
}) {
  return (
    <div className={cn('card p-4', className)}>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-gold-200/45">
        <span className="text-gold-400/70">{icon}</span>
        {label}
      </p>
      <p className="mt-2 font-display text-xl text-gold-50">{value}</p>
      {hint && (
        <p
          className={cn(
            'mt-1 text-[11px] font-medium',
            tone === 'late' ? 'text-red-300/90' : tone === 'soon' ? 'text-amber-200/90' : 'muted',
          )}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
