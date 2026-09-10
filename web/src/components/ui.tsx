import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/format'

/* ----------------------------------------------------------------- logo */

export function Logo({ size = 'md', showSlogan = false, together = false }: {
  size?: 'sm' | 'md' | 'lg'
  showSlogan?: boolean
  together?: boolean
}) {
  const sizes = {
    sm: 'text-lg tracking-[0.34em]',
    md: 'text-2xl tracking-[0.38em]',
    lg: 'text-4xl sm:text-5xl tracking-[0.34em]',
  }
  return (
    <div className="text-center">
      <div className={cn('font-display font-semibold gold-text leading-none', sizes[size])}>
        WE DREAM
      </div>
      {showSlogan && (
        <p className="mt-3 text-[10px] sm:text-xs uppercase tracking-[0.22em] text-gold-200/55">
          We dreams, we work, we conquer!
          {together && <span className="text-gold-400"> — together</span>}
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- spinner */

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={cn(
        'inline-block h-4 w-4 rounded-full border-2 border-gold-500/25 border-t-gold-400 animate-spin',
        className,
      )}
    />
  )
}

export function FullScreenLoader({ label = 'Preparando seus sonhos…' }: { label?: string }) {
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="text-center animate-fade-in">
        <div className="mx-auto mb-6 h-14 w-14 rounded-full border-2 border-gold-500/20 border-t-gold-400 animate-spin" />
        <Logo size="sm" />
        <p className="mt-4 text-sm muted">{label}</p>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        className={cn(
          'relative w-full card p-6 sm:p-7 animate-fade-up max-h-[92vh] overflow-y-auto',
          'rounded-b-none sm:rounded-b-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
        style={{ paddingBottom: 'calc(1.5rem + var(--safe-b))' }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          {title ? <h2 className="section-title text-xl sm:text-2xl">{title}</h2> : <span />}
          <button onClick={onClose} className="btn-quiet -mr-2 -mt-2 p-2 rounded-lg" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap gap-3 justify-end">{footer}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- confirmar */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn-quiet" onClick={onCancel}>
            Cancelar
          </button>
          <button className={danger ? 'btn-danger' : 'btn-gold'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-gold-100/70 leading-relaxed">{message}</div>
    </Modal>
  )
}

/* -------------------------------------------------------------- progresso */

export function ProgressBar({
  value,
  className = '',
  tone = 'gold',
}: {
  value: number
  className?: string
  tone?: 'gold' | 'emerald'
}) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('h-2 w-full rounded-full bg-ink-700/80 overflow-hidden', className)}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-700 ease-out',
          tone === 'gold' ? 'bg-gold-gradient' : 'bg-gradient-to-r from-emerald-400 to-emerald-600',
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

export function ProgressRing({
  value,
  size = 72,
  stroke = 6,
  children,
}: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const id = useId()
  const v = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F6EDC8" />
            <stop offset="55%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#B8912F" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(212,175,55,.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.2,.7,.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------ estado vazio */

export function EmptyState({
  emoji,
  title,
  message,
  action,
}: {
  emoji: string
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="card p-10 text-center animate-fade-up">
      <div className="text-5xl mb-4 animate-float">{emoji}</div>
      <h3 className="font-display text-2xl text-gold-50 mb-2">{title}</h3>
      <p className="muted text-sm max-w-sm mx-auto leading-relaxed">{message}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}

/* -------------------------------------------------------------- segmentos */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; emoji?: string }[]
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-xl bg-ink-800/70 p-1 border border-gold-500/15', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'px-3.5 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap',
            value === o.value
              ? 'bg-gold-gradient text-ink-950 shadow-[0_6px_18px_-8px_rgba(212,175,55,.8)]'
              : 'text-gold-100/55 hover:text-gold-50',
          )}
        >
          {o.emoji && <span className="mr-1">{o.emoji}</span>}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------------- campos */

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  // O <label> envolve o controle: isso cria a associação implícita exigida
  // por leitores de tela (e permite clicar no rótulo para focar o campo).
  return (
    <label className="block space-y-2">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="block text-xs muted leading-relaxed">{hint}</span>}
    </label>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-start gap-4 text-left group"
    >
      <span
        className={cn(
          'mt-0.5 relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300',
          checked ? 'bg-gold-gradient' : 'bg-ink-600',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-ink-950 shadow transition-transform duration-300',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-gold-50 group-hover:text-white transition">
          {label}
        </span>
        {description && <span className="block text-xs muted mt-1 leading-relaxed">{description}</span>}
      </span>
    </button>
  )
}

/* ----------------------------------------------------------------- toasts */

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: { id: number; text: string; tone: 'ok' | 'erro' | 'info' }[]
  onDismiss: (id: number) => void
}) {
  return (
    <div className="fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
         style={{ top: 'calc(var(--safe-t) + 12px)' }}>
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={cn(
            'pointer-events-auto max-w-md w-full sm:w-auto text-left animate-fade-up',
            'rounded-xl px-4 py-3 text-sm font-medium backdrop-blur-xl border shadow-deep',
            t.tone === 'erro'
              ? 'bg-red-950/85 border-red-500/40 text-red-100'
              : t.tone === 'ok'
                ? 'bg-ink-850/90 border-gold-500/45 text-gold-50'
                : 'bg-ink-850/90 border-gold-500/20 text-gold-100/85',
          )}
        >
          {t.text}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------- copiar para área */

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn-ghost text-xs px-3 py-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          // navegadores sem permissão de clipboard: seleção manual
          const ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          try {
            document.execCommand('copy')
          } catch {
            /* ignora */
          }
          ta.remove()
        }
        setDone(true)
        setTimeout(() => setDone(false), 1800)
      }}
    >
      {done ? '✓ Copiado' : label}
    </button>
  )
}
