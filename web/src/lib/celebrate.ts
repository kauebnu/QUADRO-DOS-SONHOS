import confetti from 'canvas-confetti'

const GOLD = ['#F6EDC8', '#E8D07C', '#D4AF37', '#B8912F', '#FFFFFF']

/** Chuva dourada para quando um sonho sai do quadro e vira vida. */
export function celebrate() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const end = Date.now() + 1800

  confetti({ particleCount: 140, spread: 78, origin: { y: 0.6 }, colors: GOLD, scalar: 1.1 })

  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.65 },
      colors: GOLD,
    })
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.65 },
      colors: GOLD,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/** Brilho discreto — usado em aportes e conquistas menores. */
export function sparkle() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  confetti({ particleCount: 45, spread: 55, origin: { y: 0.7 }, colors: GOLD, scalar: 0.9 })
}
