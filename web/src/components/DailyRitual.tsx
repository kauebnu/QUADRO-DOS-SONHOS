import { Check, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/format'
import { coachMessage } from '../lib/quotes'
import { RITUAL_STEPS } from '../lib/tips'
import type { Mood } from '../lib/types'
import { useApp } from '../store/AppProvider'
import { Modal, ProgressBar } from './ui'

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'otimo', emoji: '🔥', label: 'Ótimo' },
  { value: 'bom', emoji: '🙂', label: 'Bom' },
  { value: 'neutro', emoji: '😐', label: 'Neutro' },
  { value: 'dificil', emoji: '🌧️', label: 'Difícil' },
]

/**
 * Ritual diário guiado: gratidão → visualização cronometrada → ação.
 * Ao final grava o check-in, que alimenta a sequência e o nível.
 */
export function DailyRitual({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { saveCheckin, data } = useApp()
  const todayKey = new Date().toISOString().slice(0, 10)
  const existing = data.checkins.find((c) => c.day === todayKey)

  const [step, setStep] = useState(0)
  const [mood, setMood] = useState<Mood>(existing?.mood ?? 'bom')
  const [gratitude, setGratitude] = useState(existing?.gratitude ?? '')
  const [action, setAction] = useState(existing?.action_taken ?? '')
  const [seconds, setSeconds] = useState(existing?.visualized_seconds ?? 0)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const timer = useRef<number | null>(null)

  const target = RITUAL_STEPS[1].seconds

  useEffect(() => {
    if (!open) {
      setStep(0)
      setRunning(false)
    }
  }, [open])

  useEffect(() => {
    if (!running) {
      if (timer.current) window.clearInterval(timer.current)
      return
    }
    timer.current = window.setInterval(() => {
      setSeconds((s) => {
        const next = s + 1
        if (next >= target) setRunning(false)
        return next
      })
    }, 1000)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [running, target])

  const encouragement = useMemo(() => coachMessage(mood), [mood])

  async function finish() {
    setSaving(true)
    try {
      await saveCheckin({
        mood,
        gratitude: gratitude.trim(),
        action_taken: action.trim(),
        visualized_seconds: Math.max(seconds, existing?.visualized_seconds ?? 0),
      })
      onClose()
    } catch {
      /* toast já exibido */
    } finally {
      setSaving(false)
    }
  }

  const current = RITUAL_STEPS[step]

  return (
    <Modal open={open} onClose={onClose} title="Ritual do dia">
      <div className="flex items-center gap-2 mb-6">
        {RITUAL_STEPS.map((s, i) => (
          <div
            key={s.title}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-500',
              i <= step ? 'bg-gold-gradient' : 'bg-ink-600',
            )}
          />
        ))}
      </div>

      <div className="text-center mb-6">
        <div className="text-4xl mb-3">{current.emoji}</div>
        <h3 className="font-display text-2xl text-gold-50">{current.title}</h3>
        <p className="mt-2 text-sm muted leading-relaxed max-w-sm mx-auto">{current.text}</p>
      </div>

      {/* ------------------------------------------------------- 1. gratidão */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <p className="field-label mb-2.5">Como está o seu dia?</p>
            <div className="grid grid-cols-4 gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value)}
                  className={cn(
                    'rounded-xl border py-3 transition',
                    mood === m.value
                      ? 'border-gold-500/70 bg-gold-500/12'
                      : 'border-gold-500/15 bg-ink-800/50 hover:border-gold-500/35',
                  )}
                >
                  <span className="block text-2xl">{m.emoji}</span>
                  <span className="block mt-1 text-[10px] font-semibold text-gold-100/70">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gold-500/20 bg-gold-500/[0.06] p-4">
            <p className="text-sm text-gold-100/85 leading-relaxed">{encouragement}</p>
          </div>

          <div className="space-y-2">
            <label className="field-label" htmlFor="grat">Pelo que você é grata(o) hoje?</label>
            <textarea
              id="grat"
              className="w-full"
              value={gratitude}
              onChange={(e) => setGratitude(e.target.value)}
              placeholder="Três coisas específicas…"
            />
          </div>
        </div>
      )}

      {/* --------------------------------------------------- 2. visualização */}
      {step === 1 && (
        <div className="text-center space-y-6">
          <div className="font-display text-6xl gold-text tabular-nums">
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
          </div>
          <ProgressBar value={(Math.min(seconds, target) / target) * 100} />
          <p className="text-xs muted">
            {seconds >= target
              ? 'Meta do dia alcançada. Pode continuar se quiser. ✨'
              : `Meta: ${target} segundos sentindo que já é seu`}
          </p>
          <div className="flex justify-center gap-3">
            <button className={running ? 'btn-ghost' : 'btn-gold'} onClick={() => setRunning((r) => !r)}>
              {running ? <Pause size={16} /> : <Play size={16} />}
              {running ? 'Pausar' : seconds > 0 ? 'Continuar' : 'Começar'}
            </button>
            {seconds > 0 && (
              <button className="btn-quiet" onClick={() => { setSeconds(0); setRunning(false) }}>
                <RotateCcw size={16} /> Zerar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ 3. ação */}
      {step === 2 && (
        <div className="space-y-2">
          <label className="field-label" htmlFor="acao">Qual é a sua UMA ação de hoje?</label>
          <textarea
            id="acao"
            className="w-full"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Ex.: ligar para a corretora, fazer o aporte, estudar 30 minutos…"
          />
          <p className="text-xs muted leading-relaxed">
            Pequena e concreta vale mais que grandiosa e adiada.
          </p>
        </div>
      )}

      <div className="mt-7 flex gap-3 justify-between">
        <button
          className="btn-quiet"
          onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          disabled={saving}
        >
          {step === 0 ? 'Agora não' : 'Voltar'}
        </button>
        {step < RITUAL_STEPS.length - 1 ? (
          <button className="btn-gold" onClick={() => setStep((s) => s + 1)}>
            Continuar
          </button>
        ) : (
          <button className="btn-gold" onClick={finish} disabled={saving}>
            <Check size={16} /> Concluir ritual
          </button>
        )}
      </div>
    </Modal>
  )
}
