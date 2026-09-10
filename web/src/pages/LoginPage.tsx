import { ArrowRight, Mail, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Logo, Spinner } from '../components/ui'
import { hasSupabase } from '../lib/config'
import { quoteOfTheDay } from '../lib/quotes'
import { useApp } from '../store/AppProvider'

type Tab = 'entrar' | 'criar'

const PILLARS = [
  { emoji: '🖼️', title: 'Seu quadro vivo', text: 'Fotos, categorias, prazos e o projeto de como realizar.' },
  { emoji: '🏦', title: 'Banco dos Sonhos', text: 'Guarde dinheiro por sonho e veja a porcentagem subir.' },
  { emoji: '💞', title: 'Sonhem juntos', text: 'Quadro em casal, com privacidade individual respeitada.' },
  { emoji: '🔔', title: 'Coach diário', text: 'Uma frase nova por dia para não deixar você desistir.' },
]

export function LoginPage() {
  const { signIn, signUp, requestPasswordReset, enterDemo } = useApp()
  const [tab, setTab] = useState<Tab>('entrar')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      if (tab === 'entrar') {
        await signIn(email, password)
      } else {
        const { needsConfirmation } = await signUp(email, password, name)
        if (needsConfirmation) setSent(true)
      }
    } catch {
      /* o toast já mostrou o erro */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ------------------------------------------------------- vitrine */}
      <section className="relative lg:w-1/2 flex items-center justify-center px-6 py-14 lg:py-0 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(700px 420px at 30% 20%, rgba(212,175,55,.20), transparent 62%), radial-gradient(560px 420px at 78% 82%, rgba(212,175,55,.13), transparent 60%)',
          }}
        />
        <div className="relative max-w-md w-full text-center lg:text-left animate-fade-up">
          <div className="lg:text-left">
            <div className="font-display font-semibold gold-text text-5xl sm:text-6xl tracking-[0.3em] leading-none">
              WE DREAM
            </div>
            <p className="mt-4 text-[11px] sm:text-xs uppercase tracking-[0.24em] text-gold-200/60">
              We dreams, we work, we conquer!
            </p>
          </div>

          <p className="mt-8 font-display text-2xl sm:text-[26px] leading-snug text-gold-50/95">
            “{quoteOfTheDay()}”
          </p>

          <div className="mt-10 grid sm:grid-cols-2 gap-3 text-left">
            {PILLARS.map((p) => (
              <div key={p.title} className="card p-4">
                <div className="text-2xl mb-2">{p.emoji}</div>
                <p className="text-sm font-semibold text-gold-50">{p.title}</p>
                <p className="text-xs muted mt-1 leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- formulário */}
      <section className="lg:w-1/2 flex items-center justify-center px-6 pb-16 lg:py-0 lg:border-l lg:border-gold-500/10">
        <div className="w-full max-w-md animate-fade-up">
          <div className="card p-7 sm:p-9">
            {!hasSupabase && (
              <div className="mb-6 rounded-xl border border-gold-500/30 bg-gold-500/[0.07] p-4">
                <p className="text-xs text-gold-100/80 leading-relaxed">
                  <strong className="text-gold-200">Modo demonstração.</strong> O servidor de contas
                  ainda não está configurado — explore o app à vontade, os dados ficam só neste
                  aparelho.
                </p>
              </div>
            )}

            {sent ? (
              <div className="text-center py-6">
                <Mail className="mx-auto mb-4 text-gold-400" size={40} />
                <h2 className="section-title mb-3">Confirme seu e-mail</h2>
                <p className="text-sm muted leading-relaxed">
                  Enviamos um link para <strong className="text-gold-100">{email}</strong>. Clique nele
                  para ativar sua conta e começar a manifestar.
                </p>
                <button className="btn-quiet mt-6" onClick={() => { setSent(false); setTab('entrar') }}>
                  Voltar para o login
                </button>
              </div>
            ) : (
              <>
                <div className="mb-7 text-center lg:hidden">
                  <Logo size="md" />
                </div>

                <div className="flex rounded-xl bg-ink-800/70 p-1 border border-gold-500/15 mb-7">
                  {(['entrar', 'criar'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={
                        'flex-1 rounded-lg py-2.5 text-sm font-semibold transition ' +
                        (tab === t
                          ? 'bg-gold-gradient text-ink-950 shadow-[0_6px_18px_-8px_rgba(212,175,55,.8)]'
                          : 'text-gold-100/55 hover:text-gold-50')
                      }
                    >
                      {t === 'entrar' ? 'Entrar' : 'Criar conta'}
                    </button>
                  ))}
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                  {tab === 'criar' && (
                    <div className="space-y-2">
                      <label className="field-label" htmlFor="nome">Como quer ser chamada(o)?</label>
                      <input
                        id="nome"
                        className="w-full"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        autoComplete="name"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="field-label" htmlFor="email">E-mail</label>
                    <input
                      id="email"
                      type="email"
                      className="w-full"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@email.com"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="field-label" htmlFor="senha">Senha</label>
                    <input
                      id="senha"
                      type="password"
                      className="w-full"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo de 6 caracteres"
                      autoComplete={tab === 'entrar' ? 'current-password' : 'new-password'}
                      minLength={6}
                      required
                    />
                  </div>

                  <button type="submit" className="btn-gold w-full !py-3.5 mt-2" disabled={busy}>
                    {busy ? <Spinner className="border-ink-950/30 border-t-ink-950" /> : null}
                    {tab === 'entrar' ? 'Entrar no meu quadro' : 'Começar a sonhar'}
                    {!busy && <ArrowRight size={16} />}
                  </button>
                </form>

                {tab === 'entrar' && hasSupabase && (
                  <button
                    className="mt-4 w-full text-center text-xs text-gold-100/45 hover:text-gold-200 transition"
                    onClick={() => email ? requestPasswordReset(email) : undefined}
                    disabled={!email}
                  >
                    {email ? 'Esqueci minha senha' : 'Digite seu e-mail para recuperar a senha'}
                  </button>
                )}

                <div className="my-7 flex items-center gap-4">
                  <span className="h-px flex-1 bg-gold-500/12" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gold-200/35">ou</span>
                  <span className="h-px flex-1 bg-gold-500/12" />
                </div>

                <button className="btn-ghost w-full" onClick={() => void enterDemo()}>
                  <Sparkles size={16} />
                  Explorar demonstração
                </button>
                <p className="mt-3 text-center text-[11px] muted leading-relaxed">
                  Veja o app completo com sonhos de exemplo, sem criar conta.
                </p>
              </>
            )}
          </div>

          <p className="mt-8 text-center text-[10px] uppercase tracking-[0.22em] text-gold-200/25">
            Para quem pensa grande
          </p>
        </div>
      </section>
    </div>
  )
}
