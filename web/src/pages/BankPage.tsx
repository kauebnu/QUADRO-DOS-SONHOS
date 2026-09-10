import { Plus, Trash2, TrendingUp, Vault } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DepositModal } from '../components/DepositModal'
import { ConfirmDialog, EmptyState, ProgressBar, ProgressRing } from '../components/ui'
import { dreamProgress } from '../lib/achievements'
import { cn, money, moneyShort, shortDate } from '../lib/format'
import { useApp } from '../store/AppProvider'

export function BankPage() {
  const { data, removeDeposit, user } = useApp()
  const [open, setOpen] = useState(false)
  const [toDelete, setToDelete] = useState<string | null>(null)

  const mine = useMemo(
    () => data.dreams.filter((d) => d.owner_id === user?.id || d.scope === 'couple'),
    [data.dreams, user],
  )

  const withGoal = useMemo(
    () =>
      mine
        .filter((d) => Number(d.target_amount ?? 0) > 0 && d.status === 'active' && !d.archived)
        .map((d) => ({ dream: d, ...dreamProgress(d, data.deposits) }))
        .sort((a, b) => b.pct - a.pct),
    [mine, data.deposits],
  )

  const totals = useMemo(() => {
    const all = data.deposits.reduce((s, d) => s + Number(d.amount), 0)
    const vault = data.deposits
      .filter((d) => !d.dream_id)
      .reduce((s, d) => s + Number(d.amount), 0)
    const goal = withGoal.reduce((s, x) => s + Number(x.dream.target_amount ?? 0), 0)
    const savedForGoals = withGoal.reduce((s, x) => s + x.saved, 0)
    const thisMonth = data.deposits
      .filter((d) => d.occurred_on.slice(0, 7) === new Date().toISOString().slice(0, 7))
      .reduce((s, d) => s + Number(d.amount), 0)
    return {
      all,
      vault,
      goal,
      savedForGoals,
      thisMonth,
      pct: goal > 0 ? Math.round((savedForGoals / goal) * 100) : 0,
    }
  }, [data.deposits, withGoal])

  const timeline = useMemo(
    () => [...data.deposits].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)).slice(0, 40),
    [data.deposits],
  )

  const dreamName = (id: string | null) =>
    id ? (data.dreams.find((d) => d.id === id)?.title ?? 'Sonho removido') : 'Cofre geral'

  return (
    <div className="space-y-6 stack-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title text-3xl">Banco dos Sonhos</h1>
          <p className="text-xs muted mt-1.5">
            Dinheiro com nome e destino deixa de ser número e vira tijolo.
          </p>
        </div>
        <button className="btn-gold" onClick={() => setOpen(true)}>
          <Plus size={16} /> Novo aporte
        </button>
      </header>

      {/* -------------------------------------------------------- resumo */}
      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-7">
          <ProgressRing value={totals.pct} size={124} stroke={8}>
            <div className="text-center">
              <div className="font-display text-3xl gold-text leading-none">{totals.pct}%</div>
              <div className="text-[9px] uppercase tracking-widest text-gold-200/45 mt-1">conquistado</div>
            </div>
          </ProgressRing>

          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gold-200/45">Total guardado</p>
              <p className="font-display text-4xl gold-text leading-tight">{money(totals.all)}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-gold-200/40">Neste mês</p>
                <p className="mt-1 font-semibold text-emerald-300">{money(totals.thisMonth)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-gold-200/40">Cofre geral</p>
                <p className="mt-1 font-semibold text-gold-100">{money(totals.vault)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-gold-200/40">Meta total</p>
                <p className="mt-1 font-semibold text-gold-100">{moneyShort(totals.goal)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------- progresso por sonho */}
      <section>
        <h2 className="section-title mb-4">Progresso de cada sonho</h2>
        {withGoal.length === 0 ? (
          <EmptyState
            emoji="💰"
            title="Nenhum sonho com valor ainda"
            message="Defina um valor nos seus sonhos para acompanhar a porcentagem conquistada e saber quanto guardar por mês."
            action={
              <Link to="/quadro" className="btn-ghost">
                Ir para o quadro
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {withGoal.map(({ dream, saved, pct, missing }) => (
              <Link
                key={dream.id}
                to={`/sonho/${dream.id}`}
                className="card card-hover p-5 flex items-center gap-5"
              >
                <ProgressRing value={pct} size={62} stroke={5}>
                  <span className="font-display text-sm gold-text">{pct}%</span>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gold-50 truncate">
                    {dream.scope === 'couple' && <span className="mr-1">💞</span>}
                    {dream.title}
                  </p>
                  <p className="text-xs muted mt-0.5">
                    {money(saved)} de {money(dream.target_amount)}
                    {missing > 0 && ` · faltam ${moneyShort(missing)}`}
                  </p>
                  <ProgressBar value={pct} className="mt-2.5 h-1.5" />
                </div>
                <TrendingUp size={16} className="shrink-0 text-gold-400/50" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------- lançamentos */}
      <section>
        <h2 className="section-title mb-4">Últimos lançamentos</h2>
        {timeline.length === 0 ? (
          <EmptyState
            emoji="🏦"
            title="O cofre está vazio"
            message="Todo império começa com o primeiro aporte. Mesmo pequeno, ele muda quem você é."
            action={
              <button className="btn-gold" onClick={() => setOpen(true)}>
                <Plus size={16} /> Fazer o primeiro aporte
              </button>
            }
          />
        ) : (
          <div className="card divide-y divide-gold-500/[0.08]">
            {timeline.map((d) => {
              const positive = Number(d.amount) >= 0
              return (
                <div key={d.id} className="flex items-center gap-4 p-4">
                  <span
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-xl border',
                      positive
                        ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'
                        : 'border-red-400/25 bg-red-500/10 text-red-300',
                    )}
                  >
                    <Vault size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gold-50 truncate">{dreamName(d.dream_id)}</p>
                    <p className="text-[11px] muted truncate">
                      {shortDate(d.occurred_on)}
                      {d.note && ` · ${d.note}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'font-semibold tabular-nums shrink-0 text-sm',
                      positive ? 'text-emerald-300' : 'text-red-300',
                    )}
                  >
                    {positive ? '+' : ''}
                    {money(d.amount)}
                  </span>
                  {d.user_id === user?.id && (
                    <button
                      className="btn-quiet p-2 shrink-0"
                      onClick={() => setToDelete(d.id)}
                      aria-label="Excluir lançamento"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <DepositModal open={open} onClose={() => setOpen(false)} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir lançamento?"
        danger
        confirmLabel="Excluir"
        message="O valor sairá do total guardado deste sonho."
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const id = toDelete
          setToDelete(null)
          if (id) await removeDeposit(id)
        }}
      />
    </div>
  )
}
