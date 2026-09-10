import { useEffect, useState } from 'react'
import { sparkle } from '../lib/celebrate'
import { cn, money, today } from '../lib/format'
import { useApp } from '../store/AppProvider'
import { Field, Modal } from './ui'

const QUICK = [50, 100, 250, 500, 1000, 5000]

/** Registra um aporte (ou retirada) no Banco dos Sonhos. */
export function DepositModal({
  open,
  onClose,
  defaultDreamId = null,
}: {
  open: boolean
  onClose: () => void
  defaultDreamId?: string | null
}) {
  const { data, addDeposit, notify, user } = useApp()
  const [dreamId, setDreamId] = useState<string>(defaultDreamId ?? '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [when, setWhen] = useState(today())
  const [kind, setKind] = useState<'aporte' | 'retirada'>('aporte')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setDreamId(defaultDreamId ?? '')
      setAmount('')
      setNote('')
      setWhen(today())
      setKind('aporte')
    }
  }, [open, defaultDreamId])

  const eligible = data.dreams.filter(
    (d) => d.status === 'active' && !d.archived && (d.owner_id === user?.id || d.scope === 'couple'),
  )

  const parsed = amount.trim() ? Number(amount.replace(/\./g, '').replace(',', '.')) : NaN

  async function submit() {
    if (busy) return
    if (!Number.isFinite(parsed) || parsed <= 0) {
      notify('Informe um valor maior que zero.', 'erro')
      return
    }
    setBusy(true)
    try {
      await addDeposit({
        dream_id: dreamId || null,
        amount: kind === 'aporte' ? parsed : -parsed,
        note: note.trim(),
        occurred_on: when || today(),
      })
      if (kind === 'aporte') sparkle()
      onClose()
    } catch {
      /* toast já mostrou */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === 'aporte' ? 'Novo aporte' : 'Registrar retirada'}
      footer={
        <>
          <button className="btn-quiet" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn-gold" onClick={submit} disabled={busy}>
            {kind === 'aporte' ? 'Guardar no sonho' : 'Registrar retirada'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['aporte', '💰', 'Guardei dinheiro'],
              ['retirada', '↩️', 'Retirei / usei'],
            ] as ['aporte' | 'retirada', string, string][]
          ).map(([v, emoji, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setKind(v)}
              className={cn(
                'rounded-xl border py-3 px-3 text-center transition',
                kind === v
                  ? 'border-gold-500/70 bg-gold-500/12'
                  : 'border-gold-500/15 bg-ink-800/50 hover:border-gold-500/35',
              )}
            >
              <span className="block text-xl">{emoji}</span>
              <span className="block mt-1 text-xs font-semibold text-gold-100/80">{label}</span>
            </button>
          ))}
        </div>

        <Field label="Valor">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold-200/45 text-sm pointer-events-none">
              R$
            </span>
            <input
              className="w-full !pl-11 !text-lg"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="500"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {QUICK.map((v) => (
              <button
                key={v}
                type="button"
                className="chip hover:border-gold-500/50"
                onClick={() => setAmount(String(v))}
              >
                {money(v).replace(/\s?,00$/, '')}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Para qual sonho?" hint="Sem sonho definido, entra no cofre geral.">
          <select className="w-full" value={dreamId} onChange={(e) => setDreamId(e.target.value)}>
            <option value="">🏦 Cofre geral dos sonhos</option>
            {eligible.map((d) => (
              <option key={d.id} value={d.id}>
                {d.scope === 'couple' ? '💞 ' : ''}
                {d.title}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Data">
            <input type="date" className="w-full" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field label="Observação">
            <input
              className="w-full"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: bônus do mês"
              maxLength={140}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
