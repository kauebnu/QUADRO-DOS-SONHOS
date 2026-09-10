import type { Checkin, Deposit, Dream } from './types'

export type Achievement = {
  code: string
  emoji: string
  title: string
  description: string
  /** 0..1 */
  progress: number
  unlocked: boolean
}

export type Level = {
  index: number
  name: string
  emoji: string
  min: number
  next: number | null
}

/** Níveis de jornada — sobem com pontos de manifestação. */
const LEVELS: Omit<Level, 'index' | 'next'>[] = [
  { name: 'Sonhador', emoji: '🌱', min: 0 },
  { name: 'Visionário', emoji: '🔭', min: 60 },
  { name: 'Manifestador', emoji: '🔮', min: 180 },
  { name: 'Realizador', emoji: '⚡', min: 400 },
  { name: 'Magnético', emoji: '🧲', min: 750 },
  { name: 'Lenda', emoji: '👑', min: 1300 },
]

export type Stats = {
  points: number
  level: Level
  levelProgress: number
  streak: number
  bestStreak: number
  realized: number
  active: number
  totalSaved: number
  achievements: Achievement[]
}

/** Sequência de dias consecutivos com check-in, terminando hoje ou ontem. */
export function computeStreak(checkins: Checkin[]): { current: number; best: number } {
  if (checkins.length === 0) return { current: 0, best: 0 }

  const days = [...new Set(checkins.map((c) => c.day))].sort()
  const asNum = (d: string) => Math.floor(new Date(`${d}T12:00:00`).getTime() / 86_400_000)

  let best = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    if (asNum(days[i]) - asNum(days[i - 1]) === 1) {
      run++
      best = Math.max(best, run)
    } else {
      run = 1
    }
  }

  const todayNum = Math.floor(Date.now() / 86_400_000)
  const lastNum = asNum(days[days.length - 1])
  if (todayNum - lastNum > 1) return { current: 0, best }

  let current = 1
  for (let i = days.length - 1; i > 0; i--) {
    if (asNum(days[i]) - asNum(days[i - 1]) === 1) current++
    else break
  }
  return { current, best }
}

export function computeStats(dreams: Dream[], deposits: Deposit[], checkins: Checkin[]): Stats {
  const realized = dreams.filter((d) => d.status === 'realized').length
  const active = dreams.filter((d) => d.status === 'active').length
  const withPlan = dreams.filter((d) => d.plan.trim().length > 20).length
  const withPhoto = dreams.filter((d) => d.image_path).length
  const totalSaved = deposits.reduce((s, d) => s + Number(d.amount), 0)
  const { current: streak, best: bestStreak } = computeStreak(checkins)
  const visualizedTotal = checkins.reduce((s, c) => s + c.visualized_seconds, 0)

  const points =
    dreams.length * 10 +
    realized * 80 +
    withPlan * 15 +
    checkins.length * 6 +
    deposits.length * 12 +
    streak * 10

  let idx = 0
  for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i].min) idx = i
  const nextMin = idx + 1 < LEVELS.length ? LEVELS[idx + 1].min : null
  const level: Level = { ...LEVELS[idx], index: idx, next: nextMin }
  const levelProgress =
    nextMin === null ? 1 : Math.min(1, (points - level.min) / (nextMin - level.min))

  const def = (
    code: string,
    emoji: string,
    title: string,
    description: string,
    value: number,
    goal: number,
  ): Achievement => ({
    code,
    emoji,
    title,
    description,
    progress: Math.min(1, goal <= 0 ? 0 : value / goal),
    unlocked: value >= goal,
  })

  const achievements: Achievement[] = [
    def('first_dream', '🌟', 'O começo de tudo', 'Adicione seu primeiro sonho ao quadro', dreams.length, 1),
    def('board_of_5', '🖼️', 'Quadro montado', 'Tenha 5 sonhos no seu quadro', dreams.length, 5),
    def('board_of_12', '🏛️', 'Galeria dos sonhos', 'Tenha 12 sonhos no seu quadro', dreams.length, 12),
    def('photo_lover', '📸', 'Tudo com imagem', 'Adicione foto em 5 sonhos', withPhoto, 5),
    def('planner', '🗺️', 'Plano na mão', 'Escreva o projeto de 3 sonhos', withPlan, 3),
    def('first_realized', '🏆', 'Primeira conquista', 'Realize seu primeiro sonho', realized, 1),
    def('realizer_5', '👑', 'Realizadora em série', 'Realize 5 sonhos', realized, 5),
    def('first_deposit', '💰', 'Primeiro aporte', 'Registre um aporte no Banco dos Sonhos', deposits.length, 1),
    def('saver_10', '🏦', 'Disciplina financeira', 'Faça 10 aportes', deposits.length, 10),
    def('streak_7', '🔥', 'Uma semana firme', '7 dias seguidos de check-in', bestStreak, 7),
    def('streak_30', '💎', 'Um mês inteiro', '30 dias seguidos de check-in', bestStreak, 30),
    def('visualizer', '👁️', 'Mente treinada', 'Acumule 30 minutos de visualização', visualizedTotal, 1800),
    def('grateful', '🙏', 'Coração grato', 'Faça 20 check-ins de gratidão', checkins.length, 20),
  ]

  return { points, level, levelProgress, streak, bestStreak, realized, active, totalSaved, achievements }
}

/** Progresso financeiro de um sonho. */
export function dreamProgress(dream: Dream, deposits: Deposit[]): { saved: number; pct: number; missing: number } {
  const saved = deposits
    .filter((d) => d.dream_id === dream.id)
    .reduce((s, d) => s + Number(d.amount), 0)
  const goal = Number(dream.target_amount ?? 0)
  if (goal <= 0) return { saved, pct: 0, missing: 0 }
  return {
    saved,
    pct: Math.max(0, Math.min(100, Math.round((saved / goal) * 100))),
    missing: Math.max(0, goal - saved),
  }
}
