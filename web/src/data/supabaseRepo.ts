import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '../lib/config'
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

const BUCKET = 'dream-images'

export function createSupabaseClient(): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'wedream.auth',
    },
  })
}

function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new RepoError(res.error.message, res.error)
  return res.data
}

export class SupabaseRepo implements Repo {
  readonly kind = 'supabase' as const
  private urlCache = new Map<string, { url: string; expires: number }>()

  constructor(private sb: SupabaseClient = createSupabaseClient()) {}

  /* ------------------------------------------------------------- sessão */

  async currentUser(): Promise<AppUser | null> {
    const { data } = await this.sb.auth.getSession()
    const u = data.session?.user
    return u ? { id: u.id, email: u.email ?? '' } : null
  }

  onAuthChange(cb: (user: AppUser | null) => void): () => void {
    const { data } = this.sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      cb(u ? { id: u.id, email: u.email ?? '' } : null)
    })
    return () => data.subscription.unsubscribe()
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new RepoError(error.message, error)
  }

  async signUp(email: string, password: string, displayName: string) {
    const { data, error } = await this.sb.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    })
    if (error) throw new RepoError(error.message, error)
    return { needsConfirmation: !data.session }
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut()
    this.urlCache.clear()
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    if (error) throw new RepoError(error.message, error)
  }

  private async uid(): Promise<string> {
    const u = await this.currentUser()
    if (!u) throw new RepoError('Sessão expirada. Entre novamente.')
    return u.id
  }

  /* --------------------------------------------------------------- dados */

  async loadAll(): Promise<Snapshot> {
    const uid = await this.uid()

    const [profileRes, catRes, dreamRes, depRes, checkRes, affRes] = await Promise.all([
      this.sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
      this.sb.from('categories').select('*').order('sort_order'),
      this.sb.from('dreams').select('*').order('created_at', { ascending: false }),
      this.sb.from('dream_deposits').select('*').order('occurred_on', { ascending: false }),
      this.sb.from('daily_checkins').select('*').order('day', { ascending: false }).limit(400),
      this.sb.from('affirmations').select('*').order('created_at', { ascending: false }),
    ])

    let profile = unwrap(profileRes) as Profile | null
    if (!profile) {
      // fallback: o trigger não rodou (projeto restaurado, etc.)
      profile = unwrap(
        await this.sb.from('profiles').insert({ id: uid }).select().single()) as Profile
    }

    return {
      profile,
      categories: (unwrap(catRes) ?? []) as Category[],
      dreams: (unwrap(dreamRes) ?? []) as Dream[],
      deposits: (unwrap(depRes) ?? []) as Deposit[],
      checkins: (unwrap(checkRes) ?? []) as Checkin[],
      affirmations: (unwrap(affRes) ?? []) as Affirmation[],
      couple: await this.loadCouple(),
    }
  }

  private async loadCouple(): Promise<CoupleInfo | null> {
    const couple = unwrap(
      await this.sb.from('couples').select('*').maybeSingle()) as { id: string; name: string; invite_code: string } | null
    if (!couple) return null

    const members = (unwrap(
      await this.sb.from('couple_members').select('user_id, share_all_individual'),
    ) ?? []) as { user_id: string; share_all_individual: boolean }[]

    const profiles = (unwrap(
      await this.sb
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in(
          'id',
          members.map((m) => m.user_id),
        ),
    ) ?? []) as { id: string; display_name: string; avatar_url: string | null }[]

    return {
      id: couple.id,
      name: couple.name,
      invite_code: couple.invite_code,
      members: members.map((m) => {
        const p = profiles.find((x) => x.id === m.user_id)
        return {
          user_id: m.user_id,
          share_all_individual: m.share_all_individual,
          display_name: p?.display_name ?? 'Par',
          avatar_url: p?.avatar_url ?? null,
        }
      }),
    }
  }

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    const uid = await this.uid()
    return unwrap(
      await this.sb.from('profiles').update(patch).eq('id', uid).select().single()) as Profile
  }

  /* --------------------------------------------------------- categorias */

  async createCategory(input: { name: string; emoji: string; color: string }): Promise<Category> {
    const uid = await this.uid()
    return unwrap(
      await this.sb
        .from('categories')
        .insert({ ...input, user_id: uid, sort_order: 99 })
        .select()
        .single()) as Category
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<Category> {
    return unwrap(
      await this.sb.from('categories').update(patch).eq('id', id).select().single()) as Category
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await this.sb.from('categories').delete().eq('id', id)
    if (error) throw new RepoError(error.message, error)
  }

  /* ------------------------------------------------------------- sonhos */

  async createDream(input: DreamInput & { title: string }): Promise<Dream> {
    const uid = await this.uid()
    return unwrap(
      await this.sb.from('dreams').insert({ ...input, owner_id: uid }).select().single()) as Dream
  }

  async updateDream(id: string, patch: DreamInput): Promise<Dream> {
    return unwrap(
      await this.sb.from('dreams').update(patch).eq('id', id).select().single()) as Dream
  }

  async deleteDream(id: string): Promise<void> {
    const uid = await this.uid()
    // limpa as fotos do sonho antes de apagar o registro
    const { data: files } = await this.sb.storage.from(BUCKET).list(`${uid}/${id}`)
    if (files?.length) {
      await this.sb.storage.from(BUCKET).remove(files.map((f) => `${uid}/${id}/${f.name}`))
    }
    const { error } = await this.sb.from('dreams').delete().eq('id', id)
    if (error) throw new RepoError(error.message, error)
  }

  async uploadDreamImage(dreamId: string, file: Blob, ext: string): Promise<string> {
    const uid = await this.uid()
    const path = `${uid}/${dreamId}/${Date.now()}.${ext}`
    const { error } = await this.sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '31536000',
      upsert: true,
      contentType: file.type || `image/${ext}`,
    })
    if (error) throw new RepoError(error.message, error)
    return path
  }

  async imageUrl(path: string | null): Promise<string | null> {
    if (!path) return null
    const hit = this.urlCache.get(path)
    if (hit && hit.expires > Date.now()) return hit.url

    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 12)
    if (error || !data?.signedUrl) return null
    this.urlCache.set(path, { url: data.signedUrl, expires: Date.now() + 60 * 60 * 11 * 1000 })
    return data.signedUrl
  }

  /* ------------------------------------------------------------- aportes */

  async addDeposit(input: {
    dream_id: string | null
    amount: number
    note: string
    occurred_on: string
  }): Promise<Deposit> {
    const uid = await this.uid()
    return unwrap(
      await this.sb.from('dream_deposits').insert({ ...input, user_id: uid }).select().single()) as Deposit
  }

  async deleteDeposit(id: string): Promise<void> {
    const { error } = await this.sb.from('dream_deposits').delete().eq('id', id)
    if (error) throw new RepoError(error.message, error)
  }

  /* ------------------------------------------------------------ check-in */

  async saveCheckin(input: {
    mood: Mood
    gratitude: string
    action_taken: string
    visualized_seconds: number
  }): Promise<Checkin> {
    const uid = await this.uid()
    const day = new Date().toISOString().slice(0, 10)
    return unwrap(
      await this.sb
        .from('daily_checkins')
        .upsert({ ...input, user_id: uid, day }, { onConflict: 'user_id,day' })
        .select()
        .single()) as Checkin
  }

  /* --------------------------------------------------------- afirmações */

  async addAffirmation(text: string): Promise<Affirmation> {
    const uid = await this.uid()
    return unwrap(
      await this.sb.from('affirmations').insert({ text, user_id: uid }).select().single()) as Affirmation
  }

  async deleteAffirmation(id: string): Promise<void> {
    const { error } = await this.sb.from('affirmations').delete().eq('id', id)
    if (error) throw new RepoError(error.message, error)
  }

  /* --------------------------------------------------------------- casal */

  async createCouple(name: string): Promise<CoupleInfo> {
    const { error } = await this.sb.rpc('create_couple', { p_name: name })
    if (error) throw new RepoError(error.message, error)
    const couple = await this.loadCouple()
    if (!couple) throw new RepoError('Não foi possível criar o quadro em casal.')
    return couple
  }

  async joinCouple(code: string): Promise<CoupleInfo> {
    const { error } = await this.sb.rpc('join_couple', { p_code: code.trim().toUpperCase() })
    if (error) throw new RepoError(error.message, error)
    const couple = await this.loadCouple()
    if (!couple) throw new RepoError('Não foi possível entrar no quadro em casal.')
    return couple
  }

  async leaveCouple(): Promise<void> {
    const { error } = await this.sb.rpc('leave_couple')
    if (error) throw new RepoError(error.message, error)
  }

  async setShareAllIndividual(value: boolean): Promise<void> {
    const uid = await this.uid()
    const { error } = await this.sb
      .from('couple_members')
      .update({ share_all_individual: value })
      .eq('user_id', uid)
    if (error) throw new RepoError(error.message, error)
  }

  async listCheers(dreamId: string): Promise<Cheer[]> {
    return (unwrap(
      await this.sb.from('dream_cheers').select('*').eq('dream_id', dreamId).order('created_at')) ?? []) as Cheer[]
  }

  async addCheer(dreamId: string, body: string): Promise<Cheer> {
    const uid = await this.uid()
    return unwrap(
      await this.sb.from('dream_cheers').insert({ dream_id: dreamId, user_id: uid, body }).select().single()) as Cheer
  }

  /* ----------------------------------------------------------------- push */

  async savePushSubscription(sub: PushSubscriptionJSON, userAgent: string): Promise<void> {
    const uid = await this.uid()
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      throw new RepoError('Inscrição de notificação inválida.')
    }
    const { error } = await this.sb.from('push_subscriptions').upsert(
      {
        user_id: uid,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent,
      },
      { onConflict: 'endpoint' },
    )
    if (error) throw new RepoError(error.message, error)
  }

  async removePushSubscription(endpoint: string): Promise<void> {
    const { error } = await this.sb.from('push_subscriptions').delete().eq('endpoint', endpoint)
    if (error) throw new RepoError(error.message, error)
  }
}
