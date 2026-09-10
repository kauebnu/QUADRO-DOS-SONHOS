import type {
  Affirmation,
  AppUser,
  Category,
  Cheer,
  Checkin,
  CoupleInfo,
  Deposit,
  Dream,
  DreamInput,
  Mood,
  Profile,
} from '../lib/types'

export type Snapshot = {
  profile: Profile
  categories: Category[]
  dreams: Dream[]
  deposits: Deposit[]
  checkins: Checkin[]
  affirmations: Affirmation[]
  couple: CoupleInfo | null
}

export interface Repo {
  readonly kind: 'supabase' | 'demo'

  /* ------------------------------------------------------------- sessão */
  currentUser(): Promise<AppUser | null>
  onAuthChange(cb: (user: AppUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<void>

  /* --------------------------------------------------------------- dados */
  loadAll(): Promise<Snapshot>

  updateProfile(patch: Partial<Profile>): Promise<Profile>

  createCategory(input: { name: string; emoji: string; color: string }): Promise<Category>
  updateCategory(id: string, patch: Partial<Category>): Promise<Category>
  deleteCategory(id: string): Promise<void>

  createDream(input: DreamInput & { title: string }): Promise<Dream>
  updateDream(id: string, patch: DreamInput): Promise<Dream>
  deleteDream(id: string): Promise<void>
  uploadDreamImage(dreamId: string, file: Blob, ext: string): Promise<string>
  imageUrl(path: string | null): Promise<string | null>

  addDeposit(input: { dream_id: string | null; amount: number; note: string; occurred_on: string }): Promise<Deposit>
  deleteDeposit(id: string): Promise<void>

  saveCheckin(input: {
    mood: Mood
    gratitude: string
    action_taken: string
    visualized_seconds: number
  }): Promise<Checkin>

  addAffirmation(text: string): Promise<Affirmation>
  deleteAffirmation(id: string): Promise<void>

  /* ---------------------------------------------------------------- casal */
  createCouple(name: string): Promise<CoupleInfo>
  joinCouple(code: string): Promise<CoupleInfo>
  leaveCouple(): Promise<void>
  setShareAllIndividual(value: boolean): Promise<void>

  listCheers(dreamId: string): Promise<Cheer[]>
  addCheer(dreamId: string, body: string): Promise<Cheer>

  /* ----------------------------------------------------------------- push */
  savePushSubscription(sub: PushSubscriptionJSON, userAgent: string): Promise<void>
  removePushSubscription(endpoint: string): Promise<void>
}

export class RepoError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'RepoError'
  }
}

/** Traduz os erros mais comuns do Supabase para português. */
export function humanizeError(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Algo deu errado'

  const map: [RegExp, string][] = [
    [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [/email not confirmed/i, 'Confirme seu e-mail antes de entrar.'],
    [/user already registered|already been registered/i, 'Este e-mail já tem conta. Faça login.'],
    [/password should be at least (\d+)/i, 'A senha precisa ter pelo menos 6 caracteres.'],
    [/unable to validate email|invalid email/i, 'E-mail inválido.'],
    [/rate limit|too many requests/i, 'Muitas tentativas. Aguarde um minuto e tente de novo.'],
    [/código de convite inválido/i, 'Código de convite inválido. Confira as 6 letras.'],
    [/já faz parte de um quadro/i, 'Você já faz parte de um quadro em casal.'],
    [/já está completo/i, 'Este quadro em casal já tem duas pessoas.'],
    [/duplicate key.*categories/i, 'Já existe uma categoria com esse nome.'],
    [/row-level security|violates row-level/i, 'Você não tem permissão para essa ação.'],
    [/failed to fetch|networkerror|load failed/i, 'Sem conexão com o servidor. Verifique sua internet.'],
    [/payload too large|exceeded the maximum/i, 'Imagem muito grande. Tente uma foto menor.'],
    [/mime type/i, 'Formato de imagem não suportado. Use JPG, PNG ou WEBP.'],
  ]

  for (const [re, msg] of map) if (re.test(raw)) return msg
  return raw
}
