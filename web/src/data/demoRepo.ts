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
import { RepoError, type Repo, type Snapshot } from './repo'

/**
 * Modo demonstração — roda 100% no navegador (localStorage), sem backend.
 *
 * Serve para (a) experimentar o app antes de criar conta e (b) manter o
 * WE DREAM utilizável mesmo se o Supabase ainda não estiver configurado.
 */

const KEY = 'wd:demo:v1'
const DEMO_USER: AppUser = { id: 'demo-user', email: 'demo@wedream.app' }
const PARTNER_ID = 'demo-partner'

type DemoDB = {
  profile: Profile
  categories: Category[]
  dreams: Dream[]
  deposits: Deposit[]
  checkins: Checkin[]
  affirmations: Affirmation[]
  cheers: Cheer[]
  couple: CoupleInfo | null
  loggedIn: boolean
}

const uid = () => `d${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
const iso = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)
const now = () => new Date().toISOString()

const CATS: [string, string, string][] = [
  ['Casa', '🏠', '#D4AF37'],
  ['Carro', '🚗', '#C9A227'],
  ['Viagens', '✈️', '#E6C767'],
  ['Prosperidade', '💰', '#F0D77B'],
  ['Negócios', '💼', '#B8912F'],
  ['Saúde & Corpo', '💪', '#D9B44A'],
  ['Amor & Família', '❤️', '#E8C46A'],
  ['Conhecimento', '🎓', '#CBA135'],
  ['Espiritualidade', '🙏', '#DFC078'],
  ['Estilo de Vida', '✨', '#F2E2A8'],
]

function seed(): DemoDB {
  const categories: Category[] = CATS.map(([name, emoji, color], i) => ({
    id: `cat-${i}`,
    user_id: DEMO_USER.id,
    name,
    emoji,
    color,
    sort_order: i + 1,
  }))

  const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null

  const dream = (d: Partial<Dream> & { title: string }): Dream => ({
    id: uid(),
    owner_id: DEMO_USER.id,
    couple_id: 'demo-couple',
    scope: 'individual',
    share_with_partner: false,
    description: '',
    plan: '',
    category_id: null,
    image_path: null,
    date_added: iso(-30),
    target_date: null,
    realized_at: null,
    status: 'active',
    archived: false,
    target_amount: null,
    priority: 2,
    created_at: now(),
    updated_at: now(),
    ...d,
  })

  const dreams: Dream[] = [
    dream({
      title: 'Casa dos sonhos frente ao mar',
      description: 'Três suítes, varanda gourmet e o som do mar todas as manhãs.',
      plan: '1) Guardar 20% de cada faturamento. 2) Falar com a corretora em janeiro. 3) Visitar 3 imóveis por trimestre para calibrar o preço real.',
      category_id: cat('Casa'),
      target_amount: 850_000,
      target_date: iso(900),
      date_added: iso(-120),
      priority: 1,
      scope: 'couple',
    }),
    dream({
      title: 'Lua de mel em Santorini',
      description: 'Pôr do sol em Oia, hotel com piscina privativa e um jantar inesquecível.',
      plan: 'Reservar R$ 1.500 por mês. Comprar passagem na promoção de baixa temporada.',
      category_id: cat('Viagens'),
      target_amount: 60_000,
      target_date: iso(420),
      date_added: iso(-90),
      priority: 1,
      scope: 'couple',
    }),
    dream({
      title: 'Faturar 7 dígitos no meu negócio',
      description: 'Marca reconhecida, time enxuto e produto que transforma vidas.',
      plan: 'Lançar 4 vezes no ano. Estruturar funil perene. Contratar uma gestora de tráfego.',
      category_id: cat('Negócios'),
      target_amount: 1_000_000,
      target_date: iso(365),
      date_added: iso(-200),
      priority: 1,
      share_with_partner: true,
    }),
    dream({
      title: 'Porsche 911 branco perolado',
      description: 'O carro que eu desenhava no caderno quando criança.',
      plan: 'Comprar à vista com o lucro do segundo semestre. Sem financiamento.',
      category_id: cat('Carro'),
      target_amount: 900_000,
      target_date: iso(1200),
      date_added: iso(-60),
      priority: 3,
    }),
    dream({
      title: 'Corpo forte e saudável',
      description: 'Disposição de sobra, sono bom e me sentir linda em qualquer roupa.',
      plan: 'Treino 5x na semana + acompanhamento nutricional mensal.',
      category_id: cat('Saúde & Corpo'),
      target_date: iso(180),
      date_added: iso(-45),
      priority: 2,
      share_with_partner: true,
    }),
    dream({
      title: 'MBA internacional',
      description: 'Estudar fora, aprender com os melhores e expandir a rede.',
      plan: 'Estudar inglês 40min/dia. Prova em outubro. Aplicar para 3 escolas.',
      category_id: cat('Conhecimento'),
      target_amount: 180_000,
      target_date: iso(700),
      date_added: iso(-30),
      priority: 2,
    }),
    dream({
      title: 'Reforma da cozinha',
      description: 'Ilha central, iluminação quente e espaço para receber quem eu amo.',
      plan: 'Orçar com 3 marcenarias. Executar em duas etapas.',
      category_id: cat('Casa'),
      target_amount: 75_000,
      target_date: iso(-20),
      date_added: iso(-260),
      priority: 2,
      scope: 'couple',
    }),
    dream({
      title: 'Primeira viagem internacional',
      description: 'Buenos Aires: tango, livraria El Ateneo e muito vinho.',
      plan: 'Feito! Guardamos por 8 meses e realizamos.',
      category_id: cat('Viagens'),
      target_amount: 18_000,
      date_added: iso(-400),
      realized_at: iso(-95),
      status: 'realized',
      archived: true,
      scope: 'couple',
    }),
    dream({
      title: 'Notebook novo para trabalhar',
      description: 'A ferramenta certa muda a produtividade.',
      plan: 'Comprei com o lucro do primeiro lançamento.',
      category_id: cat('Negócios'),
      target_amount: 14_000,
      date_added: iso(-300),
      realized_at: iso(-160),
      status: 'realized',
      archived: true,
    }),
    dream({
      title: 'Retiro de silêncio',
      description: 'Cinco dias sem celular, só eu e o que realmente importa.',
      plan: 'Reservar a vaga do retiro de julho.',
      category_id: cat('Espiritualidade'),
      target_amount: 6_500,
      target_date: iso(120),
      date_added: iso(-15),
      priority: 3,
    }),
  ]

  const byTitle = (t: string) => dreams.find((d) => d.title.startsWith(t))!.id

  const deposits: Deposit[] = [
    { dream_id: byTitle('Casa dos sonhos'), amount: 45_000, note: 'Bônus do ano', occurred_on: iso(-100) },
    { dream_id: byTitle('Casa dos sonhos'), amount: 12_000, note: 'Aporte mensal', occurred_on: iso(-60) },
    { dream_id: byTitle('Casa dos sonhos'), amount: 12_000, note: 'Aporte mensal', occurred_on: iso(-30) },
    { dream_id: byTitle('Casa dos sonhos'), amount: 15_500, note: 'Venda extra', occurred_on: iso(-5) },
    { dream_id: byTitle('Lua de mel'), amount: 9_000, note: 'Reserva inicial', occurred_on: iso(-75) },
    { dream_id: byTitle('Lua de mel'), amount: 1_500, note: 'Aporte mensal', occurred_on: iso(-45) },
    { dream_id: byTitle('Lua de mel'), amount: 1_500, note: 'Aporte mensal', occurred_on: iso(-14) },
    { dream_id: byTitle('MBA'), amount: 22_000, note: 'Poupança dedicada', occurred_on: iso(-25) },
    { dream_id: byTitle('Reforma'), amount: 41_000, note: 'Guardado ao longo do ano', occurred_on: iso(-40) },
    { dream_id: byTitle('Retiro'), amount: 2_000, note: 'Primeira parcela', occurred_on: iso(-10) },
    { dream_id: null, amount: 8_400, note: 'Cofre geral dos sonhos', occurred_on: iso(-20) },
  ].map((d) => ({ ...d, id: uid(), user_id: DEMO_USER.id, created_at: now() }))

  const moods: Mood[] = ['otimo', 'bom', 'bom', 'neutro', 'otimo', 'dificil', 'bom']
  const checkins: Checkin[] = Array.from({ length: 7 }, (_, i) => ({
    id: uid(),
    user_id: DEMO_USER.id,
    day: iso(-i),
    mood: moods[i],
    gratitude: [
      'Grata pela minha família e pela saúde',
      'Grata pelo cliente novo que fechou hoje',
      'Grata pelo café da manhã sem pressa',
      'Grata por ter conseguido treinar',
      'Grata pelas pessoas que acreditam em mim',
      'Grata por ter forças mesmo num dia pesado',
      'Grata pelo lar que construí',
    ][i],
    action_taken: [
      'Liguei para a corretora',
      'Fechei uma parceria',
      'Estudei 40 minutos de inglês',
      'Fiz o aporte do mês',
      'Gravei 3 conteúdos',
      'Só descansei — e tudo bem',
      'Revisei o plano da casa',
    ][i],
    visualized_seconds: [90, 60, 60, 45, 120, 30, 60][i],
  }))

  const affirmations: Affirmation[] = [
    'Eu sou um ímã de prosperidade e oportunidades',
    'Tudo que é meu me encontra no tempo certo',
    'Eu mereço uma vida extraordinária',
  ].map((text) => ({ id: uid(), user_id: DEMO_USER.id, text, created_at: now() }))

  return {
    profile: {
      id: DEMO_USER.id,
      display_name: 'Você',
      avatar_url: null,
      timezone: 'America/Sao_Paulo',
      notification_hour: 8,
      notifications_on: true,
      onboarding_done: true,
    },
    categories,
    dreams,
    deposits,
    checkins,
    affirmations,
    cheers: [
      {
        id: uid(),
        dream_id: byTitle('Faturar 7'),
        user_id: PARTNER_ID,
        body: 'Você vai conseguir, eu tenho certeza. Estou aqui pra tudo! 💛',
        created_at: now(),
      },
    ],
    couple: {
      id: 'demo-couple',
      name: 'Nosso Quadro',
      invite_code: 'DEMO24',
      members: [
        { user_id: DEMO_USER.id, share_all_individual: false, display_name: 'Você', avatar_url: null },
        { user_id: PARTNER_ID, share_all_individual: true, display_name: 'Seu par', avatar_url: null },
      ],
    },
    loggedIn: false,
  }
}

export class DemoRepo implements Repo {
  readonly kind = 'demo' as const
  private db: DemoDB
  private listeners = new Set<(u: AppUser | null) => void>()

  constructor() {
    this.db = this.read()
  }

  private read(): DemoDB {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw) as DemoDB
    } catch {
      /* dados corrompidos — recomeça */
    }
    const fresh = seed()
    this.write(fresh)
    return fresh
  }

  private write(db: DemoDB = this.db) {
    this.db = db
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      throw new RepoError('O modo demonstração ficou sem espaço. Use menos fotos ou crie uma conta.')
    }
  }

  /** Zera a demonstração e volta aos dados de exemplo. */
  reset() {
    localStorage.removeItem(KEY)
    this.db = this.read()
    this.db.loggedIn = true
    this.write()
  }

  /**
   * Prepara uma demonstração nova JÁ logada, antes de qualquer instância
   * existir. Usado ao entrar no modo demonstração pela tela de login.
   */
  static startFreshSession() {
    const db = seed()
    db.loggedIn = true
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      /* modo privado — a demonstração roda só em memória */
    }
  }

  /* ------------------------------------------------------------- sessão */

  async currentUser(): Promise<AppUser | null> {
    return this.db.loggedIn ? DEMO_USER : null
  }

  onAuthChange(cb: (u: AppUser | null) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private emit() {
    const u = this.db.loggedIn ? DEMO_USER : null
    this.listeners.forEach((cb) => cb(u))
  }

  async signIn(): Promise<void> {
    this.db.loggedIn = true
    this.write()
    this.emit()
  }

  async signUp(_email: string, _password: string, displayName: string) {
    this.db.loggedIn = true
    if (displayName.trim()) this.db.profile.display_name = displayName.trim()
    this.write()
    this.emit()
    return { needsConfirmation: false }
  }

  async signOut(): Promise<void> {
    this.db.loggedIn = false
    this.write()
    this.emit()
  }

  async requestPasswordReset(): Promise<void> {
    /* nada a fazer na demonstração */
  }

  /* --------------------------------------------------------------- dados */

  async loadAll(): Promise<Snapshot> {
    const { profile, categories, dreams, deposits, checkins, affirmations, couple } = this.db
    // IMPORTANTE: devolvemos cópias. Se entregássemos as arrays internas, uma
    // inserção no repositório mutaria o estado do React na mesma referência e
    // o item apareceria duas vezes (uma pela mutação, outra pelo setState).
    return {
      profile: { ...profile },
      categories: [...categories],
      dreams: [...dreams].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      deposits: [...deposits],
      checkins: [...checkins],
      affirmations: [...affirmations],
      couple: couple ? { ...couple, members: couple.members.map((m) => ({ ...m })) } : null,
    }
  }

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    this.db.profile = { ...this.db.profile, ...patch }
    this.write()
    return this.db.profile
  }

  async createCategory(input: { name: string; emoji: string; color: string }): Promise<Category> {
    if (this.db.categories.some((c) => c.name.toLowerCase() === input.name.trim().toLowerCase())) {
      throw new RepoError('Já existe uma categoria com esse nome.')
    }
    const cat: Category = {
      id: uid(),
      user_id: DEMO_USER.id,
      name: input.name.trim(),
      emoji: input.emoji,
      color: input.color,
      sort_order: 99,
    }
    this.db.categories.push(cat)
    this.write()
    return cat
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<Category> {
    const i = this.db.categories.findIndex((c) => c.id === id)
    if (i < 0) throw new RepoError('Categoria não encontrada.')
    this.db.categories[i] = { ...this.db.categories[i], ...patch }
    this.write()
    return this.db.categories[i]
  }

  async deleteCategory(id: string): Promise<void> {
    this.db.categories = this.db.categories.filter((c) => c.id !== id)
    this.db.dreams = this.db.dreams.map((d) =>
      d.category_id === id ? { ...d, category_id: null } : d,
    )
    this.write()
  }

  /* ------------------------------------------------------------- sonhos */

  async createDream(input: DreamInput & { title: string }): Promise<Dream> {
    const d: Dream = {
      id: uid(),
      owner_id: DEMO_USER.id,
      couple_id: this.db.couple?.id ?? null,
      scope: 'individual',
      share_with_partner: false,
      description: '',
      plan: '',
      category_id: null,
      image_path: null,
      date_added: iso(),
      target_date: null,
      realized_at: null,
      status: 'active',
      archived: false,
      target_amount: null,
      priority: 2,
      created_at: now(),
      updated_at: now(),
      ...input,
    }
    d.status = d.realized_at ? 'realized' : 'active'
    this.db.dreams.unshift(d)
    this.write()
    return d
  }

  async updateDream(id: string, patch: DreamInput): Promise<Dream> {
    const i = this.db.dreams.findIndex((d) => d.id === id)
    if (i < 0) throw new RepoError('Sonho não encontrado.')
    const merged = { ...this.db.dreams[i], ...patch, updated_at: now() }
    // espelha o trigger sync_dream_status do banco
    if (merged.realized_at) {
      merged.status = 'realized'
    } else {
      merged.status = 'active'
      merged.archived = false
    }
    this.db.dreams[i] = merged
    this.write()
    return merged
  }

  async deleteDream(id: string): Promise<void> {
    this.db.dreams = this.db.dreams.filter((d) => d.id !== id)
    this.db.deposits = this.db.deposits.filter((d) => d.dream_id !== id)
    this.db.cheers = this.db.cheers.filter((c) => c.dream_id !== id)
    this.write()
  }

  async uploadDreamImage(_dreamId: string, file: Blob): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(new RepoError('Não consegui ler a imagem.'))
      fr.readAsDataURL(file)
    })
    return dataUrl
  }

  async imageUrl(path: string | null): Promise<string | null> {
    return path
  }

  /* ------------------------------------------------------------- aportes */

  async addDeposit(input: {
    dream_id: string | null
    amount: number
    note: string
    occurred_on: string
  }): Promise<Deposit> {
    const dep: Deposit = { ...input, id: uid(), user_id: DEMO_USER.id, created_at: now() }
    this.db.deposits.unshift(dep)
    this.write()
    return dep
  }

  async deleteDeposit(id: string): Promise<void> {
    this.db.deposits = this.db.deposits.filter((d) => d.id !== id)
    this.write()
  }

  /* ------------------------------------------------------------ check-in */

  async saveCheckin(input: {
    mood: Mood
    gratitude: string
    action_taken: string
    visualized_seconds: number
  }): Promise<Checkin> {
    const day = iso()
    const existing = this.db.checkins.find((c) => c.day === day)
    if (existing) {
      Object.assign(existing, input)
      this.write()
      return existing
    }
    const c: Checkin = { ...input, id: uid(), user_id: DEMO_USER.id, day }
    this.db.checkins.unshift(c)
    this.write()
    return c
  }

  /* --------------------------------------------------------- afirmações */

  async addAffirmation(text: string): Promise<Affirmation> {
    const a: Affirmation = { id: uid(), user_id: DEMO_USER.id, text, created_at: now() }
    this.db.affirmations.unshift(a)
    this.write()
    return a
  }

  async deleteAffirmation(id: string): Promise<void> {
    this.db.affirmations = this.db.affirmations.filter((a) => a.id !== id)
    this.write()
  }

  /* --------------------------------------------------------------- casal */

  async createCouple(name: string): Promise<CoupleInfo> {
    this.db.couple = {
      id: 'demo-couple',
      name: name || 'Nosso Quadro',
      invite_code: 'DEMO24',
      members: [
        { user_id: DEMO_USER.id, share_all_individual: false, display_name: this.db.profile.display_name, avatar_url: null },
      ],
    }
    this.write()
    return this.db.couple
  }

  async joinCouple(code: string): Promise<CoupleInfo> {
    if (code.trim().toUpperCase() !== 'DEMO24') {
      throw new RepoError('Código de convite inválido. Na demonstração use DEMO24.')
    }
    this.db.couple = seed().couple
    this.write()
    return this.db.couple!
  }

  async leaveCouple(): Promise<void> {
    this.db.couple = null
    this.db.dreams = this.db.dreams.map((d) => ({
      ...d,
      couple_id: null,
      scope: 'individual' as const,
      share_with_partner: false,
    }))
    this.write()
  }

  async setShareAllIndividual(value: boolean): Promise<void> {
    const me = this.db.couple?.members.find((m) => m.user_id === DEMO_USER.id)
    if (me) me.share_all_individual = value
    this.write()
  }

  async listCheers(dreamId: string): Promise<Cheer[]> {
    return this.db.cheers.filter((c) => c.dream_id === dreamId)
  }

  async addCheer(dreamId: string, body: string): Promise<Cheer> {
    const c: Cheer = { id: uid(), dream_id: dreamId, user_id: DEMO_USER.id, body, created_at: now() }
    this.db.cheers.push(c)
    this.write()
    return c
  }

  /* ----------------------------------------------------------------- push */

  async savePushSubscription(): Promise<void> {
    /* a demonstração usa notificação local, sem servidor */
  }

  async removePushSubscription(): Promise<void> {
    /* idem */
  }
}
