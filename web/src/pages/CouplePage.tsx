import { Heart, LogOut, Share2, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog, CopyButton, Field, Switch } from '../components/ui'
import { money } from '../lib/format'
import { useApp } from '../store/AppProvider'

export function CouplePage() {
  const { data, user, createCouple, joinCouple, leaveCouple, setShareAll, me, notify } = useApp()

  const [name, setName] = useState('Nosso Quadro')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const couple = data.couple

  const coupleStats = useMemo(() => {
    const shared = data.dreams.filter((d) => d.scope === 'couple')
    const realized = shared.filter((d) => d.status === 'realized').length
    const goal = shared.reduce((s, d) => s + Number(d.target_amount ?? 0), 0)
    const saved = data.deposits
      .filter((d) => shared.some((s) => s.id === d.dream_id))
      .reduce((s, d) => s + Number(d.amount), 0)
    return { total: shared.length, realized, goal, saved }
  }, [data.dreams, data.deposits])

  const mineIndividual = data.dreams.filter(
    (d) => d.owner_id === user?.id && d.scope === 'individual',
  ).length
  const sharedIndividually = data.dreams.filter(
    (d) => d.owner_id === user?.id && d.scope === 'individual' && d.share_with_partner,
  ).length

  async function handleCreate() {
    setBusy(true)
    try {
      await createCouple(name)
    } catch {
      /* toast */
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    if (code.trim().length < 4) {
      notify('Digite o código de 6 letras que seu par recebeu.', 'erro')
      return
    }
    setBusy(true)
    try {
      await joinCouple(code)
    } catch {
      /* toast */
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    const text = `Vem sonhar comigo no WE DREAM! Use o código ${couple?.invite_code} para entrar no nosso quadro dos sonhos. 💛`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'WE DREAM', text })
        return
      } catch {
        /* usuário cancelou */
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      notify('Convite copiado! Cole no WhatsApp do seu par.', 'ok')
    } catch {
      notify('Copie o código e envie para o seu par.', 'info')
    }
  }

  /* ------------------------------------------------------- sem casal */
  if (!couple) {
    return (
      <div className="max-w-xl mx-auto space-y-6 stack-in">
        <header className="text-center">
          <div className="text-5xl mb-4 animate-float">💞</div>
          <h1 className="section-title text-3xl">Quadro em casal</h1>
          <p className="mt-3 text-sm muted leading-relaxed max-w-md mx-auto">
            Sonhem juntos sem perder o que é só seu. Vocês criam sonhos do casal e cada um mantém os
            individuais — você escolhe quais compartilhar.
          </p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-gold-300/60">
            We dreams, we work, we conquer! — <span className="text-gold-400">together</span>
          </p>
        </header>

        <section className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-500/12 border border-gold-500/25 text-gold-300">
              <UserPlus size={17} />
            </span>
            <h2 className="font-display text-xl text-gold-50">Criar um quadro novo</h2>
          </div>
          <Field label="Nome do quadro" hint="Vocês recebem um código de 6 letras para convidar.">
            <input
              className="w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Ana & Bruno"
              maxLength={60}
            />
          </Field>
          <button className="btn-gold w-full" onClick={handleCreate} disabled={busy}>
            Criar e gerar convite
          </button>
        </section>

        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-gold-500/12" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-gold-200/35">ou</span>
          <span className="h-px flex-1 bg-gold-500/12" />
        </div>

        <section className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-500/12 border border-gold-500/25 text-gold-300">
              <Users size={17} />
            </span>
            <h2 className="font-display text-xl text-gold-50">Já tenho um convite</h2>
          </div>
          <Field label="Código do convite">
            <input
              className="w-full !text-center !text-2xl !tracking-[0.4em] font-display uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              maxLength={6}
              autoComplete="off"
            />
          </Field>
          <button className="btn-ghost w-full" onClick={handleJoin} disabled={busy}>
            Entrar no quadro
          </button>
        </section>
      </div>
    )
  }

  /* ------------------------------------------------------- com casal */
  const waiting = couple.members.length < 2

  return (
    <div className="max-w-2xl mx-auto space-y-6 stack-in">
      <header className="text-center">
        <div className="text-4xl mb-3">💞</div>
        <h1 className="section-title text-3xl">{couple.name}</h1>
        <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-gold-300/60">
          We dreams, we work, we conquer! — <span className="text-gold-400">together</span>
        </p>
      </header>

      {/* --------------------------------------------------- integrantes */}
      <section className="card p-6">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-4">Vocês dois</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {couple.members.map((m) => (
            <div
              key={m.user_id}
              className="rounded-xl border border-gold-500/15 bg-ink-800/50 p-4 flex items-center gap-3"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-gradient font-display text-lg text-ink-950">
                {m.display_name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-gold-50 truncate">
                  {m.user_id === user?.id ? 'Você' : m.display_name}
                </p>
                <p className="text-[11px] muted">
                  {m.share_all_individual ? 'Compartilha todos os individuais' : 'Individuais privados'}
                </p>
              </div>
            </div>
          ))}
          {waiting && (
            <div className="rounded-xl border border-dashed border-gold-500/25 p-4 flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold-500/25 text-gold-300/60">
                <Heart size={18} />
              </span>
              <div>
                <p className="font-semibold text-gold-100/60">Esperando seu par</p>
                <p className="text-[11px] muted">Envie o código abaixo</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------- convite */}
      {waiting && (
        <section className="card p-6 text-center">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-4">
            Código do convite
          </h2>
          <p className="font-display text-5xl gold-text tracking-[0.3em] mb-5">{couple.invite_code}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn-gold" onClick={share}>
              <Share2 size={16} /> Enviar convite
            </button>
            <CopyButton text={couple.invite_code} label="Copiar código" />
          </div>
          <p className="mt-4 text-xs muted leading-relaxed max-w-sm mx-auto">
            Seu par baixa o WE DREAM, cria a conta e digita este código em “Quadro em casal”.
          </p>
        </section>
      )}

      {/* -------------------------------------------------- privacidade */}
      <section className="card p-6 space-y-5">
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-1">
            Privacidade dos seus sonhos
          </h2>
          <p className="text-xs muted leading-relaxed">
            Sonhos marcados como <strong className="text-gold-200">Nosso</strong> sempre aparecem para
            os dois. Os <strong className="text-gold-200">individuais</strong> são privados até você
            liberar.
          </p>
        </div>

        <Switch
          checked={me?.share_all_individual ?? false}
          onChange={(v) => void setShareAll(v)}
          label="Deixar meu par ver TODOS os meus sonhos individuais"
          description="Um único botão libera tudo. Desligando, volta a valer a escolha sonho a sonho."
        />

        <div className="hairline pt-5 grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="font-display text-2xl text-gold-50">{mineIndividual}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-gold-200/45 mt-1">
              sonhos individuais
            </p>
          </div>
          <div>
            <p className="font-display text-2xl text-gold-50">
              {me?.share_all_individual ? mineIndividual : sharedIndividually}
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-gold-200/45 mt-1">
              visíveis para seu par
            </p>
          </div>
        </div>

        <Link to="/quadro" className="btn-ghost w-full text-xs">
          Escolher sonho a sonho no quadro
        </Link>
      </section>

      {/* --------------------------------------------------- números */}
      <section className="card p-6">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-4">
          O que vocês estão construindo
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <Stat value={coupleStats.total} label="sonhos do casal" />
          <Stat value={coupleStats.realized} label="já realizados" />
          <Stat value={money(coupleStats.saved)} label="guardados juntos" small />
          <Stat value={money(coupleStats.goal)} label="meta total" small />
        </div>
      </section>

      {/* ---------------------------------------------------------- sair */}
      <section className="card p-6">
        <button className="btn-danger w-full" onClick={() => setConfirmLeave(true)}>
          <LogOut size={16} /> Sair do quadro em casal
        </button>
        <p className="mt-3 text-[11px] muted text-center leading-relaxed">
          Seus sonhos continuam com você — os do casal voltam a ser individuais seus.
        </p>
      </section>

      <ConfirmDialog
        open={confirmLeave}
        title="Sair do quadro em casal?"
        danger
        confirmLabel="Sim, sair"
        message="Vocês deixarão de ver os sonhos um do outro. Seus sonhos individuais continuam intactos, e os do casal que você criou voltam a ser seus."
        onCancel={() => setConfirmLeave(false)}
        onConfirm={async () => {
          setConfirmLeave(false)
          await leaveCouple()
        }}
      />
    </div>
  )
}

function Stat({ value, label, small }: { value: React.ReactNode; label: string; small?: boolean }) {
  return (
    <div>
      <p className={small ? 'font-display text-lg text-gold-50' : 'font-display text-2xl text-gold-50'}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-[0.14em] text-gold-200/45 mt-1 leading-tight">
        {label}
      </p>
    </div>
  )
}
