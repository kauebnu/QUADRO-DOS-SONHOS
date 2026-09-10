import {
  Archive,
  Heart,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Play,
  Plus,
  Sparkles,
  User,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../lib/format'
import { useApp } from '../store/AppProvider'
import { Logo } from './ui'

const MAIN = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/quadro', label: 'Quadro', icon: LayoutGrid },
  { to: '/banco', label: 'Banco', icon: Wallet },
]

// `short` é o rótulo do menu horizontal do desktop, que tem menos espaço
const MORE = [
  { to: '/realizados', label: 'Realizados', short: 'Realizados', icon: Archive, hint: 'Seu arquivo de conquistas' },
  { to: '/apresentacao', label: 'Modo apresentação', short: 'Apresentação', icon: Play, hint: 'Porta-retrato digital' },
  { to: '/dicas', label: 'Lei da Atração', short: 'Lei da Atração', icon: Sparkles, hint: 'Dicas para manifestar' },
  { to: '/casal', label: 'Quadro em casal', short: 'Casal', icon: Heart, hint: 'Sonhar a dois' },
  { to: '/perfil', label: 'Perfil e ajustes', short: 'Perfil', icon: User, hint: 'Categorias e notificações' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data, mode, signOut, exitDemo, stats } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const isCouple = Boolean(data.couple)

  return (
    <div className="min-h-screen flex flex-col">
      {/* ------------------------------------------------------------ topo */}
      <header
        className="sticky top-0 z-40 border-b border-gold-500/10 bg-ink-900/80 backdrop-blur-xl"
        style={{ paddingTop: 'var(--safe-t)' }}
      >
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-4">
          <Link to="/" className="shrink-0">
            <Logo size="sm" />
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-6">
            {[...MAIN, ...MORE.slice(0, 3)].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  cn(
                    'px-3 lg:px-3.5 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
                    isActive
                      ? 'text-gold-100 bg-gold-500/12 border border-gold-500/25'
                      : 'text-gold-100/50 hover:text-gold-50 hover:bg-white/5 border border-transparent',
                  )
                }
              >
                {'short' in item ? item.short : item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {mode === 'demo' && (
              <span className="hidden sm:inline-flex chip chip-active text-[10px] uppercase tracking-widest">
                Demonstração
              </span>
            )}
            <Link
              to="/sonho/novo"
              className="btn-gold px-3 py-2 text-xs sm:px-4 sm:text-sm"
              aria-label="Novo sonho"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Novo sonho</span>
            </Link>
            <button onClick={() => setMenuOpen(true)} className="btn-ghost p-2.5" aria-label="Abrir menu">
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------- conteúdo */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 pt-6 pb-32 md:pb-16">{children}</main>

      {/* ------------------------------------------------- navegação mobile */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gold-500/12 bg-ink-900/92 backdrop-blur-xl"
        style={{ paddingBottom: 'var(--safe-b)' }}
      >
        <div className="grid grid-cols-5 h-16">
          {MAIN.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition',
                  isActive ? 'text-gold-300' : 'text-gold-100/40',
                )
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/apresentacao"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition',
                isActive ? 'text-gold-300' : 'text-gold-100/40',
              )
            }
          >
            <Play size={20} />
            Ver
          </NavLink>
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-gold-100/40"
          >
            <Menu size={20} />
            Mais
          </button>
        </div>
      </nav>

      {/* ------------------------------------------------------------ menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm animate-fade-in"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="absolute right-0 top-0 h-full w-full max-w-sm card rounded-none sm:rounded-l-2xl
                       border-y-0 border-r-0 p-6 overflow-y-auto animate-fade-in"
            style={{ paddingTop: 'calc(1.5rem + var(--safe-t))', paddingBottom: 'calc(1.5rem + var(--safe-b))' }}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="font-display text-2xl text-gold-50">
                  {data.profile.display_name || 'Sonhador(a)'}
                </p>
                <p className="text-xs muted mt-1">
                  {stats.level.emoji} {stats.level.name} · {stats.points} pts
                </p>
              </div>
              <button onClick={() => setMenuOpen(false)} className="btn-quiet p-2" aria-label="Fechar menu">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-1.5">
              {MAIN.map((item) => (
                <MenuLink key={item.to} {...item} />
              ))}
              <div className="hairline my-3" />
              {MORE.map((item) => (
                <MenuLink key={item.to} {...item} />
              ))}
            </div>

            {isCouple && (
              <div className="mt-6 card p-4 bg-gold-500/[0.06]">
                <p className="text-xs uppercase tracking-[0.16em] text-gold-300/70 mb-1">Quadro em casal</p>
                <p className="font-display text-lg text-gold-50">{data.couple?.name}</p>
                <p className="text-[11px] muted mt-1">
                  We dreams, we work, we conquer! — <span className="text-gold-400">together</span>
                </p>
              </div>
            )}

            <div className="mt-8 hairline pt-6">
              {mode === 'demo' ? (
                <button
                  className="btn-ghost w-full"
                  onClick={() => {
                    exitDemo()
                    navigate('/')
                  }}
                >
                  <LogOut size={16} /> Sair da demonstração
                </button>
              ) : (
                <button
                  className="btn-ghost w-full"
                  onClick={async () => {
                    await signOut()
                    navigate('/')
                  }}
                >
                  <LogOut size={16} /> Sair da conta
                </button>
              )}
              <p className="mt-5 text-center text-[10px] uppercase tracking-[0.2em] text-gold-200/30">
                We dreams, we work, we conquer!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuLink({
  to,
  label,
  icon: Icon,
  hint,
  end,
}: {
  to: string
  label: string
  icon: LucideIcon
  hint?: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3.5 rounded-xl px-3.5 py-3 transition',
          isActive ? 'bg-gold-500/12 text-gold-100' : 'text-gold-100/65 hover:bg-white/5 hover:text-gold-50',
        )
      }
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-800/80 border border-gold-500/15">
        <Icon size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-[11px] muted truncate">{hint}</span>}
      </span>
    </NavLink>
  )
}
