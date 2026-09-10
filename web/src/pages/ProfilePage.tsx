import { Bell, Download, LogOut, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog, Field, Modal, ProgressBar, Switch } from '../components/ui'
import { cn } from '../lib/format'
import {
  getPushState,
  sendTestNotification,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from '../lib/push'
import { useApp } from '../store/AppProvider'

const EMOJIS = ['✨', '🏠', '🚗', '✈️', '💰', '💼', '💪', '❤️', '🎓', '🙏', '🌊', '🏔️', '🎨', '🎯', '🐾', '👑', '🍀', '🔥']
const COLORS = ['#D4AF37', '#E8D07C', '#B8912F', '#F0E1A4', '#CBA135', '#8F6F24']

export function ProfilePage() {
  const {
    data,
    stats,
    mode,
    user,
    repo,
    saveProfile,
    addCategory,
    removeCategory,
    signOut,
    exitDemo,
    resetDemo,
    notify,
  } = useApp()
  const navigate = useNavigate()

  const [name, setName] = useState(data.profile.display_name)
  const [pushState, setPushState] = useState<PushState>('default')
  const [pushBusy, setPushBusy] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [catName, setCatName] = useState('')
  const [catEmoji, setCatEmoji] = useState('✨')
  const [catColor, setCatColor] = useState(COLORS[0])
  const [catToDelete, setCatToDelete] = useState<string | null>(null)
  const [installEvent, setInstallEvent] = useState<Event | null>(null)

  useEffect(() => setName(data.profile.display_name), [data.profile.display_name])

  useEffect(() => {
    void getPushState().then(setPushState)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const myCategories = data.categories.filter((c) => c.user_id === user?.id)
  const usage = new Map<string, number>()
  for (const d of data.dreams) {
    if (d.category_id) usage.set(d.category_id, (usage.get(d.category_id) ?? 0) + 1)
  }

  async function togglePush(on: boolean) {
    setPushBusy(true)
    try {
      if (on) {
        const sub = await subscribeToPush()
        await repo.savePushSubscription(sub, navigator.userAgent)
        await saveProfile({ notifications_on: true })
        setPushState('granted')
        notify('Pronto! Você vai receber um lembrete por dia. 🔔', 'ok')
      } else {
        const endpoint = await unsubscribeFromPush()
        if (endpoint) await repo.removePushSubscription(endpoint)
        await saveProfile({ notifications_on: false })
        setPushState('default')
        notify('Lembretes diários desativados.', 'info')
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Não consegui alterar as notificações.', 'erro')
    } finally {
      setPushBusy(false)
    }
  }

  async function createCategory() {
    const clean = catName.trim()
    if (clean.length < 2) {
      notify('Dê um nome à categoria.', 'erro')
      return
    }
    try {
      await addCategory({ name: clean, emoji: catEmoji, color: catColor })
      setCatOpen(false)
      setCatName('')
      setCatEmoji('✨')
    } catch {
      /* toast */
    }
  }

  async function install() {
    if (!installEvent) return
    // @ts-expect-error API não tipada em lib.dom
    installEvent.prompt()
    setInstallEvent(null)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 stack-in">
      <header>
        <h1 className="section-title text-3xl">Perfil e ajustes</h1>
        <p className="text-xs muted mt-1.5">
          {stats.level.emoji} {stats.level.name} · {stats.points} pontos de manifestação
        </p>
        {stats.level.next !== null && (
          <ProgressBar value={stats.levelProgress * 100} className="mt-3 h-1.5 max-w-xs" />
        )}
      </header>

      {/* ------------------------------------------------------- perfil */}
      <section className="card p-6 space-y-4">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60">Seus dados</h2>
        <Field label="Como quer ser chamada(o)">
          <div className="flex gap-2">
            <input
              className="flex-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
            <button
              className="btn-ghost px-5"
              onClick={() => saveProfile({ display_name: name.trim() || 'Sonhador(a)' })}
              disabled={name.trim() === data.profile.display_name}
            >
              Salvar
            </button>
          </div>
        </Field>
        {user?.email && mode === 'supabase' && (
          <p className="text-xs muted">Conta: {user.email}</p>
        )}
      </section>

      {/* ------------------------------------------------- notificações */}
      <section className="card p-6 space-y-5">
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-1">
            Lembrete diário
          </h2>
          <p className="text-xs muted leading-relaxed">
            Uma notificação por dia com uma frase sempre diferente, para você olhar seus sonhos e agir.
          </p>
        </div>

        {pushState === 'unsupported' && (
          <p className="rounded-xl border border-gold-500/20 bg-ink-800/60 p-4 text-xs muted leading-relaxed">
            Este navegador não suporta notificações. No iPhone, adicione o WE DREAM à Tela de Início
            para ativá-las.
          </p>
        )}

        {pushState === 'unconfigured' && (
          <p className="rounded-xl border border-gold-500/20 bg-ink-800/60 p-4 text-xs muted leading-relaxed">
            O envio automático ainda não foi configurado neste servidor. Você pode testar como a
            notificação aparece abaixo.
          </p>
        )}

        {pushState === 'denied' && (
          <p className="rounded-xl border border-red-500/25 bg-red-950/30 p-4 text-xs text-red-200/80 leading-relaxed">
            As notificações foram bloqueadas para este site. Libere nas configurações do navegador e
            volte aqui.
          </p>
        )}

        {(pushState === 'granted' || pushState === 'default') && (
          <Switch
            checked={pushState === 'granted' && data.profile.notifications_on}
            onChange={(v) => void togglePush(v)}
            label="Receber o lembrete diário"
            description={pushBusy ? 'Atualizando…' : 'Você pode desligar quando quiser.'}
          />
        )}

        <Field label="Horário preferido">
          <select
            className="w-full"
            value={data.profile.notification_hour}
            onChange={(e) => saveProfile({ notification_hour: Number(e.target.value) })}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </Field>

        <button
          className="btn-ghost w-full text-xs"
          onClick={async () => {
            try {
              await sendTestNotification(data.profile.display_name)
            } catch (err) {
              notify(err instanceof Error ? err.message : 'Não consegui enviar o teste.', 'erro')
            }
          }}
        >
          <Bell size={14} /> Ver como fica a notificação
        </button>
      </section>

      {/* --------------------------------------------------- categorias */}
      <section className="card p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-1">
              Minhas categorias
            </h2>
            <p className="text-xs muted">Organize o quadro do seu jeito.</p>
          </div>
          <button className="btn-gold text-xs px-4 py-2" onClick={() => setCatOpen(true)}>
            <Plus size={14} /> Nova
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {myCategories.map((c) => (
            <span
              key={c.id}
              className="group chip"
              style={{ borderColor: `${c.color}44` }}
            >
              <span>{c.emoji}</span>
              {c.name}
              <span className="text-gold-200/35">{usage.get(c.id) ?? 0}</span>
              <button
                className="ml-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition text-gold-200/60 hover:text-red-300"
                onClick={() => setCatToDelete(c.id)}
                aria-label={`Remover categoria ${c.name}`}
              >
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- instalar PWA */}
      {installEvent && (
        <section className="card p-6">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold-300/60 mb-2">
            Instalar o app
          </h2>
          <p className="text-xs muted leading-relaxed mb-4">
            Instale o WE DREAM na tela de início: abre em tela cheia, funciona offline e recebe as
            notificações.
          </p>
          <button className="btn-gold w-full" onClick={install}>
            <Download size={16} /> Instalar WE DREAM
          </button>
        </section>
      )}

      {/* ------------------------------------------------------- sessão */}
      <section className="card p-6 space-y-3">
        {mode === 'demo' ? (
          <>
            <button className="btn-ghost w-full" onClick={() => void resetDemo()}>
              <RefreshCw size={16} /> Restaurar dados da demonstração
            </button>
            <button
              className="btn-danger w-full"
              onClick={() => {
                exitDemo()
                navigate('/')
              }}
            >
              <LogOut size={16} /> Sair da demonstração
            </button>
          </>
        ) : (
          <button
            className="btn-danger w-full"
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
          >
            <LogOut size={16} /> Sair da conta
          </button>
        )}
      </section>

      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-gold-200/25 pb-2">
        WE DREAM · we dreams, we work, we conquer!
      </p>

      {/* ---------------------------------------------- modal categoria */}
      <Modal
        open={catOpen}
        onClose={() => setCatOpen(false)}
        title="Nova categoria"
        footer={
          <>
            <button className="btn-quiet" onClick={() => setCatOpen(false)}>
              Cancelar
            </button>
            <button className="btn-gold" onClick={createCategory}>
              Criar categoria
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Nome">
            <input
              className="w-full"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Ex.: Maternidade, Arte, Aventura…"
              maxLength={40}
              autoFocus
            />
          </Field>

          <div>
            <p className="field-label mb-2.5">Ícone</p>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setCatEmoji(e)}
                  className={cn(
                    'h-11 w-11 rounded-xl border text-xl transition',
                    catEmoji === e
                      ? 'border-gold-500/70 bg-gold-500/12'
                      : 'border-gold-500/15 bg-ink-800/50 hover:border-gold-500/35',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="field-label mb-2.5">Cor</p>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCatColor(c)}
                  className={cn(
                    'h-9 w-9 rounded-full border-2 transition',
                    catColor === c ? 'border-gold-100 scale-110' : 'border-transparent',
                  )}
                  style={{ background: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(catToDelete)}
        title="Remover categoria?"
        danger
        confirmLabel="Remover"
        message="Os sonhos dessa categoria continuam no quadro, apenas ficam sem categoria."
        onCancel={() => setCatToDelete(null)}
        onConfirm={async () => {
          const id = catToDelete
          setCatToDelete(null)
          if (id) await removeCategory(id)
        }}
      />
    </div>
  )
}
