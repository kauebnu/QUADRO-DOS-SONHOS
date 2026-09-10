import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DemoRepo } from '../data/demoRepo'
import { humanizeError, type Repo, type Snapshot } from '../data/repo'
import { SupabaseRepo } from '../data/supabaseRepo'
import { computeStats, type Stats } from '../lib/achievements'
import { hasSupabase } from '../lib/config'
import type {
  Affirmation,
  AppUser,
  Category,
  Checkin,
  CoupleInfo,
  Deposit,
  Dream,
  DreamInput,
  Mood,
  Profile,
} from '../lib/types'

type Mode = 'supabase' | 'demo'
const MODE_KEY = 'wd:mode'

const EMPTY: Snapshot = {
  profile: {
    id: '',
    display_name: '',
    avatar_url: null,
    timezone: 'America/Sao_Paulo',
    notification_hour: 8,
    notifications_on: true,
    onboarding_done: false,
  },
  categories: [],
  dreams: [],
  deposits: [],
  checkins: [],
  affirmations: [],
  couple: null,
}

export type Toast = { id: number; text: string; tone: 'ok' | 'erro' | 'info' }

type AppContextValue = {
  mode: Mode
  repo: Repo
  ready: boolean
  user: AppUser | null
  data: Snapshot
  stats: Stats
  loading: boolean
  toasts: Toast[]
  notify: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void

  enterDemo: () => Promise<void>
  exitDemo: () => void
  resetDemo: () => Promise<void>

  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>

  refresh: () => Promise<void>
  saveProfile: (patch: Partial<Profile>) => Promise<void>

  addCategory: (input: { name: string; emoji: string; color: string }) => Promise<Category>
  editCategory: (id: string, patch: Partial<Category>) => Promise<void>
  removeCategory: (id: string) => Promise<void>

  addDream: (input: DreamInput & { title: string }) => Promise<Dream>
  editDream: (id: string, patch: DreamInput) => Promise<Dream>
  removeDream: (id: string) => Promise<void>
  uploadImage: (dreamId: string, file: Blob, ext: string) => Promise<string>

  addDeposit: (input: { dream_id: string | null; amount: number; note: string; occurred_on: string }) => Promise<void>
  removeDeposit: (id: string) => Promise<void>

  saveCheckin: (input: { mood: Mood; gratitude: string; action_taken: string; visualized_seconds: number }) => Promise<void>

  addAffirmation: (text: string) => Promise<void>
  removeAffirmation: (id: string) => Promise<void>

  createCouple: (name: string) => Promise<void>
  joinCouple: (code: string) => Promise<void>
  leaveCouple: () => Promise<void>
  setShareAll: (value: boolean) => Promise<void>

  /** true quando o sonho pertence ao par, não a mim */
  isPartnerDream: (d: Dream) => boolean
  categoryOf: (d: Dream) => Category | null
  partner: CoupleInfo['members'][number] | null
  me: CoupleInfo['members'][number] | null
}

const AppContext = createContext<AppContextValue | null>(null)

function initialMode(): Mode {
  if (!hasSupabase) return 'demo'
  try {
    return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'supabase'
  } catch {
    return 'supabase'
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [user, setUser] = useState<AppUser | null>(null)
  const [data, setData] = useState<Snapshot>(EMPTY)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastSeq = useRef(0)

  // o nonce permite recriar o repositório (e reavaliar a sessão) sem trocar de modo
  const [repoNonce, setRepoNonce] = useState(0)

  const repo = useMemo<Repo>(
    () => (mode === 'demo' || !hasSupabase ? new DemoRepo() : new SupabaseRepo()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, repoNonce],
  )

  const notify = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastSeq.current
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  /** Executa uma ação tratando erro + toast, devolvendo o resultado. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, successMsg?: string): Promise<T> => {
      try {
        const out = await fn()
        if (successMsg) notify(successMsg, 'ok')
        return out
      } catch (err) {
        notify(humanizeError(err), 'erro')
        throw err
      }
    },
    [notify],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setData(await repo.loadAll())
    } catch (err) {
      notify(humanizeError(err), 'erro')
    } finally {
      setLoading(false)
    }
  }, [repo, notify])

  /* Sessão -------------------------------------------------------------- */
  useEffect(() => {
    let alive = true
    setReady(false)
    repo
      .currentUser()
      .then((u) => {
        if (alive) setUser(u)
      })
      .finally(() => {
        if (alive) setReady(true)
      })
    const off = repo.onAuthChange((u) => {
      if (alive) setUser(u)
    })
    return () => {
      alive = false
      off()
    }
  }, [repo])

  useEffect(() => {
    if (user) void refresh()
    else setData(EMPTY)
  }, [user, refresh])

  /* Modo ---------------------------------------------------------------- */
  const enterDemo = useCallback(async () => {
    try {
      localStorage.setItem(MODE_KEY, 'demo')
    } catch {
      /* ignora */
    }
    // grava a demonstração já logada e força a recriação do repositório,
    // para que o efeito de sessão encontre o usuário de demonstração
    DemoRepo.startFreshSession()
    setMode('demo')
    setRepoNonce((n) => n + 1)
  }, [])

  const exitDemo = useCallback(() => {
    // sem Supabase configurado não há para onde voltar: apenas encerra a sessão
    if (!hasSupabase) {
      void repo.signOut()
      setUser(null)
      return
    }
    try {
      localStorage.setItem(MODE_KEY, 'supabase')
    } catch {
      /* ignora */
    }
    setUser(null)
    setMode('supabase')
    setRepoNonce((n) => n + 1)
  }, [repo])

  const resetDemo = useCallback(async () => {
    if (repo instanceof DemoRepo) {
      repo.reset()
      await refresh()
      notify('Demonstração restaurada.', 'ok')
    }
  }, [repo, refresh, notify])

  /* Auth ---------------------------------------------------------------- */
  const signIn = useCallback(
    async (email: string, password: string) => {
      await run(async () => {
        await repo.signIn(email, password)
        setUser(await repo.currentUser())
      })
    },
    [repo, run],
  )

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      return run(async () => {
        const out = await repo.signUp(email, password, name)
        if (!out.needsConfirmation) setUser(await repo.currentUser())
        return out
      })
    },
    [repo, run],
  )

  const signOut = useCallback(async () => {
    await repo.signOut()
    setUser(null)
    setData(EMPTY)
  }, [repo])

  const requestPasswordReset = useCallback(
    async (email: string) => {
      await run(
        () => repo.requestPasswordReset(email),
        'Enviamos um link de recuperação para o seu e-mail.',
      )
    },
    [repo, run],
  )

  /* Perfil e categorias -------------------------------------------------- */
  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      const profile = await run(() => repo.updateProfile(patch))
      setData((d) => ({ ...d, profile }))
    },
    [repo, run],
  )

  const addCategory = useCallback(
    async (input: { name: string; emoji: string; color: string }) => {
      const cat = await run(() => repo.createCategory(input), 'Categoria criada!')
      setData((d) => ({ ...d, categories: [...d.categories, cat] }))
      return cat
    },
    [repo, run],
  )

  const editCategory = useCallback(
    async (id: string, patch: Partial<Category>) => {
      const cat = await run(() => repo.updateCategory(id, patch))
      setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? cat : c)) }))
    },
    [repo, run],
  )

  const removeCategory = useCallback(
    async (id: string) => {
      await run(() => repo.deleteCategory(id), 'Categoria removida.')
      setData((d) => ({
        ...d,
        categories: d.categories.filter((c) => c.id !== id),
        dreams: d.dreams.map((x) => (x.category_id === id ? { ...x, category_id: null } : x)),
      }))
    },
    [repo, run],
  )

  /* Sonhos --------------------------------------------------------------- */
  const addDream = useCallback(
    async (input: DreamInput & { title: string }) => {
      const dream = await run(() => repo.createDream(input), 'Sonho adicionado ao quadro! ✨')
      setData((d) => ({ ...d, dreams: [dream, ...d.dreams] }))
      return dream
    },
    [repo, run],
  )

  const editDream = useCallback(
    async (id: string, patch: DreamInput) => {
      const dream = await run(() => repo.updateDream(id, patch))
      setData((d) => ({ ...d, dreams: d.dreams.map((x) => (x.id === id ? dream : x)) }))
      return dream
    },
    [repo, run],
  )

  const removeDream = useCallback(
    async (id: string) => {
      await run(() => repo.deleteDream(id), 'Sonho removido.')
      setData((d) => ({
        ...d,
        dreams: d.dreams.filter((x) => x.id !== id),
        deposits: d.deposits.filter((x) => x.dream_id !== id),
      }))
    },
    [repo, run],
  )

  const uploadImage = useCallback(
    (dreamId: string, file: Blob, ext: string) => run(() => repo.uploadDreamImage(dreamId, file, ext)),
    [repo, run],
  )

  /* Banco dos sonhos ----------------------------------------------------- */
  const addDeposit = useCallback(
    async (input: { dream_id: string | null; amount: number; note: string; occurred_on: string }) => {
      const dep = await run(
        () => repo.addDeposit(input),
        input.amount >= 0 ? 'Aporte registrado! 💰' : 'Retirada registrada.',
      )
      setData((d) => ({ ...d, deposits: [dep, ...d.deposits] }))
    },
    [repo, run],
  )

  const removeDeposit = useCallback(
    async (id: string) => {
      await run(() => repo.deleteDeposit(id), 'Lançamento removido.')
      setData((d) => ({ ...d, deposits: d.deposits.filter((x) => x.id !== id) }))
    },
    [repo, run],
  )

  /* Check-in e afirmações ------------------------------------------------ */
  const saveCheckin = useCallback(
    async (input: { mood: Mood; gratitude: string; action_taken: string; visualized_seconds: number }) => {
      const c = await run(() => repo.saveCheckin(input), 'Check-in do dia registrado! 🙏')
      setData((d) => {
        const rest = d.checkins.filter((x) => x.day !== c.day)
        return { ...d, checkins: [c, ...rest] as Checkin[] }
      })
    },
    [repo, run],
  )

  const addAffirmation = useCallback(
    async (text: string) => {
      const a = await run(() => repo.addAffirmation(text), 'Afirmação adicionada.')
      setData((d) => ({ ...d, affirmations: [a, ...d.affirmations] as Affirmation[] }))
    },
    [repo, run],
  )

  const removeAffirmation = useCallback(
    async (id: string) => {
      await run(() => repo.deleteAffirmation(id))
      setData((d) => ({ ...d, affirmations: d.affirmations.filter((x) => x.id !== id) }))
    },
    [repo, run],
  )

  /* Casal ---------------------------------------------------------------- */
  const createCouple = useCallback(
    async (name: string) => {
      await run(() => repo.createCouple(name), 'Quadro em casal criado! Compartilhe o código. 💞')
      await refresh()
    },
    [repo, run, refresh],
  )

  const joinCouple = useCallback(
    async (code: string) => {
      await run(() => repo.joinCouple(code), 'Vocês estão conectados! 💞')
      await refresh()
    },
    [repo, run, refresh],
  )

  const leaveCouple = useCallback(async () => {
    await run(() => repo.leaveCouple(), 'Você saiu do quadro em casal.')
    await refresh()
  }, [repo, run, refresh])

  const setShareAll = useCallback(
    async (value: boolean) => {
      await run(
        () => repo.setShareAllIndividual(value),
        value
          ? 'Seu par agora vê todos os seus sonhos individuais.'
          : 'Seus sonhos individuais voltaram a ser privados.',
      )
      setData((d) =>
        d.couple
          ? {
              ...d,
              couple: {
                ...d.couple,
                members: d.couple.members.map((m) =>
                  m.user_id === user?.id ? { ...m, share_all_individual: value } : m,
                ),
              },
            }
          : d,
      )
    },
    [repo, run, user],
  )

  /* Derivados ------------------------------------------------------------ */
  const stats = useMemo(
    () => computeStats(data.dreams.filter((d) => d.owner_id === user?.id), data.deposits, data.checkins),
    [data.dreams, data.deposits, data.checkins, user],
  )

  const isPartnerDream = useCallback((d: Dream) => Boolean(user) && d.owner_id !== user!.id, [user])

  const categoryOf = useCallback(
    (d: Dream) => data.categories.find((c) => c.id === d.category_id) ?? null,
    [data.categories],
  )

  const partner = useMemo(
    () => data.couple?.members.find((m) => m.user_id !== user?.id) ?? null,
    [data.couple, user],
  )
  const me = useMemo(
    () => data.couple?.members.find((m) => m.user_id === user?.id) ?? null,
    [data.couple, user],
  )

  const value: AppContextValue = {
    mode,
    repo,
    ready,
    user,
    data,
    stats,
    loading,
    toasts,
    notify,
    dismissToast,
    enterDemo,
    exitDemo,
    resetDemo,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    refresh,
    saveProfile,
    addCategory,
    editCategory,
    removeCategory,
    addDream,
    editDream,
    removeDream,
    uploadImage,
    addDeposit,
    removeDeposit,
    saveCheckin,
    addAffirmation,
    removeAffirmation,
    createCouple,
    joinCouple,
    leaveCouple,
    setShareAll,
    isPartnerDream,
    categoryOf,
    partner,
    me,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp precisa estar dentro de <AppProvider>')
  return ctx
}

/** Depósitos somados por sonho. */
export function useDepositTotals(deposits: Deposit[]): Map<string, number> {
  return useMemo(() => {
    const m = new Map<string, number>()
    for (const d of deposits) {
      if (!d.dream_id) continue
      m.set(d.dream_id, (m.get(d.dream_id) ?? 0) + Number(d.amount))
    }
    return m
  }, [deposits])
}
