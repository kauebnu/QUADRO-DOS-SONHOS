import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DreamImage } from '../components/DreamImage'
import { EmptyState, Modal, Segmented, Switch } from '../components/ui'
import { cn, money, prettyDate } from '../lib/format'
import { DAILY_QUOTES } from '../lib/quotes'
import { useApp } from '../store/AppProvider'

type Filter = 'ativos' | 'realizados' | 'todos'

const INTERVALS = [
  { value: '5', label: '5s' },
  { value: '8', label: '8s' },
  { value: '12', label: '12s' },
  { value: '20', label: '20s' },
]

/**
 * Modo apresentação: transforma o celular (ou uma TV) num porta-retrato
 * digital rodando os sonhos com frases motivacionais.
 */
export function PresentationPage() {
  const navigate = useNavigate()
  const { data, categoryOf } = useApp()

  const [filter, setFilter] = useState<Filter>('ativos')
  const [catId, setCatId] = useState<string | null>(null)
  const [interval, setIntervalSec] = useState('8')
  const [showQuotes, setShowQuotes] = useState(true)
  const [showInfo, setShowInfo] = useState(true)
  const [shuffle, setShuffle] = useState(true)

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const hideTimer = useRef<number | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)

  /* ------------------------------------------------------------- slides */
  const slides = useMemo(() => {
    let list = data.dreams.filter((d) => {
      if (filter === 'ativos' && (d.status !== 'active' || d.archived)) return false
      if (filter === 'realizados' && d.status !== 'realized') return false
      if (catId && d.category_id !== catId) return false
      return true
    })

    if (shuffle) {
      // embaralhamento estável por sessão (não repica a cada render)
      list = [...list].sort((a, b) => a.id.localeCompare(b.id))
      const seed = Math.floor(Date.now() / 3_600_000)
      const offset = seed % Math.max(list.length, 1)
      list = [...list.slice(offset), ...list.slice(0, offset)]
    }
    return list
  }, [data.dreams, filter, catId, shuffle])

  useEffect(() => {
    setIndex(0)
  }, [filter, catId, shuffle])

  const total = slides.length
  const current = slides[index % Math.max(total, 1)]

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return
      setIndex((i) => (i + delta + total) % total)
    },
    [total],
  )

  /* ---------------------------------------------------- auto-avanço */
  useEffect(() => {
    if (!playing || total <= 1) return
    const ms = Number(interval) * 1000
    const t = window.setTimeout(() => go(1), ms)
    return () => window.clearTimeout(t)
  }, [playing, index, interval, total, go])

  /* -------------------------------------------- esconder os controles */
  const wakeControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3200)
  }, [])

  useEffect(() => {
    wakeControls()
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [wakeControls])

  /* ------------------------------------------------ manter a tela ligada */
  useEffect(() => {
    let released = false
    const request = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock.current = await navigator.wakeLock.request('screen')
        }
      } catch {
        /* alguns navegadores negam — segue sem */
      }
    }
    void request()

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) void request()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      wakeLock.current?.release().catch(() => undefined)
      wakeLock.current = null
    }
  }, [])

  /* --------------------------------------------------------- teclado */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (e.key === 'Escape' && !document.fullscreenElement) navigate(-1)
      wakeControls()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, navigate, wakeControls])

  /* ------------------------------------------------------ tela cheia */
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      /* iOS não suporta em todos os contextos */
    }
  }

  const quote = useMemo(
    () => DAILY_QUOTES[(index * 7 + 3) % DAILY_QUOTES.length],
    [index],
  )

  if (total === 0) {
    return (
      <div className="max-w-lg mx-auto pt-10">
        <EmptyState
          emoji="🖼️"
          title="Nada para apresentar ainda"
          message="Adicione sonhos ao quadro e o modo apresentação transforma seu celular num porta-retrato digital."
          action={
            <button className="btn-ghost" onClick={() => navigate('/quadro')}>
              Ir para o quadro
            </button>
          }
        />
      </div>
    )
  }

  const cat = current ? categoryOf(current) : null

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950 select-none"
      onMouseMove={wakeControls}
      onTouchStart={wakeControls}
    >
      {/* ------------------------------------------------------- slide */}
      <div className="absolute inset-0">
        {current && (
          <DreamImage
            key={current.id}
            dream={current}
            emoji={cat?.emoji ?? '✨'}
            className="absolute inset-0"
            kenBurns={playing}
            eager
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/25 to-ink-950/55" />
      </div>

      {/*
        Zonas de toque para navegar. Ficam ocultas para leitores de tela
        (aria-hidden) porque duplicam os controles visíveis logo abaixo.
      */}
      <div
        className="absolute inset-y-0 left-0 w-1/4 z-10"
        onClick={() => go(-1)}
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-0 right-0 w-1/4 z-10"
        onClick={() => go(1)}
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-0 left-1/4 right-1/4 z-10"
        onClick={() => setPlaying((p) => !p)}
        aria-hidden="true"
      />

      {/* ------------------------------------------------------ conteúdo */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 p-7 sm:p-12 pointer-events-none"
        style={{ paddingBottom: 'calc(2.5rem + var(--safe-b))' }}
      >
        {showQuotes && (
          <p className="mb-6 max-w-2xl font-display text-xl sm:text-3xl leading-snug text-gold-100/90 animate-fade-up">
            “{quote}”
          </p>
        )}

        {showInfo && current && (
          <div key={current.id} className="animate-fade-up max-w-3xl">
            {cat && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300/80">
                {cat.emoji} {cat.name}
              </p>
            )}
            <h2 className="mt-2 font-display text-4xl sm:text-6xl leading-[1.05] text-gold-50">
              {current.title}
            </h2>
            {current.description && (
              <p className="mt-3 text-sm sm:text-base text-gold-100/65 line-clamp-2 max-w-2xl leading-relaxed">
                {current.description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] sm:text-xs text-gold-200/55">
              {current.target_amount ? <span>{money(current.target_amount)}</span> : null}
              {current.target_date && !current.realized_at && (
                <span>Para {prettyDate(current.target_date, "MMMM 'de' yyyy")}</span>
              )}
              {current.realized_at && (
                <span className="text-emerald-300/90">
                  ✓ Realizado em {prettyDate(current.realized_at, "MMMM 'de' yyyy")}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------- progresso */}
      <div className="absolute top-0 inset-x-0 z-30 flex gap-1 p-2">
        {slides.slice(0, 30).map((s, i) => (
          <span
            key={s.id}
            className={cn(
              'h-0.5 flex-1 rounded-full transition-colors duration-500',
              i === index % 30 ? 'bg-gold-400' : 'bg-gold-100/15',
            )}
          />
        ))}
      </div>

      {/* -------------------------------------------------- controles */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-30 flex items-center gap-2 p-4 transition-opacity duration-500',
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        style={{ paddingTop: 'calc(1.25rem + var(--safe-t))' }}
      >
        <button
          className="grid h-11 w-11 place-items-center rounded-full bg-ink-950/70 backdrop-blur border border-gold-500/20 text-gold-100"
          onClick={() => navigate(-1)}
          aria-label="Sair da apresentação"
        >
          <X size={18} />
        </button>

        <span className="ml-auto text-xs text-gold-100/50 tabular-nums bg-ink-950/60 backdrop-blur rounded-full px-3 py-1.5">
          {index + 1} / {total}
        </span>

        <button
          className="grid h-11 w-11 place-items-center rounded-full bg-ink-950/70 backdrop-blur border border-gold-500/20 text-gold-100"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        >
          {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
        </button>
        <button
          className="grid h-11 w-11 place-items-center rounded-full bg-ink-950/70 backdrop-blur border border-gold-500/20 text-gold-100"
          onClick={() => setSettingsOpen(true)}
          aria-label="Ajustes da apresentação"
        >
          <Settings2 size={17} />
        </button>
      </div>

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-3 p-5 transition-opacity duration-500',
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        style={{ paddingBottom: 'calc(1.25rem + var(--safe-b))' }}
      >
        <button
          className="grid h-12 w-12 place-items-center rounded-full bg-ink-950/70 backdrop-blur border border-gold-500/20 text-gold-100"
          onClick={() => go(-1)}
          aria-label="Anterior"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          className="grid h-14 w-14 place-items-center rounded-full bg-gold-gradient text-ink-950 shadow-gold"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pausar' : 'Continuar'}
        >
          {playing ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button
          className="grid h-12 w-12 place-items-center rounded-full bg-ink-950/70 backdrop-blur border border-gold-500/20 text-gold-100"
          onClick={() => go(1)}
          aria-label="Próximo"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* ---------------------------------------------------- ajustes */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Ajustes da apresentação">
        <div className="space-y-6">
          <div>
            <p className="field-label mb-2.5">Quais sonhos</p>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ativos', label: 'Em construção' },
                { value: 'realizados', label: 'Realizados' },
                { value: 'todos', label: 'Todos' },
              ]}
            />
          </div>

          <div>
            <p className="field-label mb-2.5">Categoria</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCatId(null)} className={cn('chip', !catId && 'chip-active')}>
                Todas
              </button>
              {data.categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCatId(catId === c.id ? null : c.id)}
                  className={cn('chip', catId === c.id && 'chip-active')}
                >
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="field-label mb-2.5">Tempo de cada sonho</p>
            <Segmented value={interval} onChange={setIntervalSec} options={INTERVALS} />
          </div>

          <div className="space-y-4 hairline pt-5">
            <Switch
              checked={showQuotes}
              onChange={setShowQuotes}
              label="Mostrar frases motivacionais"
              description="Uma frase diferente a cada sonho."
            />
            <Switch
              checked={showInfo}
              onChange={setShowInfo}
              label="Mostrar título e detalhes"
              description="Desligue para uma experiência só de imagens."
            />
            <Switch
              checked={shuffle}
              onChange={setShuffle}
              label="Ordem embaralhada"
              description="Cada sessão começa em um sonho diferente."
            />
          </div>

          <p className="text-[11px] muted leading-relaxed hairline pt-5">
            Dica: deixe em tela cheia e apoie o celular num suporte. A tela fica acesa enquanto a
            apresentação roda — seu quadro dos sonhos vira decoração viva.
          </p>
        </div>
      </Modal>
    </div>
  )
}
