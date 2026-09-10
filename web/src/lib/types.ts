export type DreamScope = 'individual' | 'couple'
export type DreamStatus = 'active' | 'realized'
export type Mood = 'otimo' | 'bom' | 'neutro' | 'dificil'

export type AppUser = {
  id: string
  email: string
}

export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  timezone: string
  notification_hour: number
  notifications_on: boolean
  onboarding_done: boolean
}

export type Category = {
  id: string
  user_id: string
  name: string
  emoji: string
  color: string
  sort_order: number
}

export type Dream = {
  id: string
  owner_id: string
  couple_id: string | null
  scope: DreamScope
  share_with_partner: boolean
  title: string
  description: string
  plan: string
  category_id: string | null
  image_path: string | null
  date_added: string
  target_date: string | null
  realized_at: string | null
  status: DreamStatus
  archived: boolean
  target_amount: number | null
  priority: number
  created_at: string
  updated_at: string
}

export type DreamInput = Partial<
  Pick<
    Dream,
    | 'title'
    | 'description'
    | 'plan'
    | 'category_id'
    | 'scope'
    | 'share_with_partner'
    | 'target_date'
    | 'date_added'
    | 'realized_at'
    | 'archived'
    | 'target_amount'
    | 'priority'
    | 'image_path'
    | 'couple_id'
  >
>

export type Deposit = {
  id: string
  dream_id: string | null
  user_id: string
  amount: number
  note: string
  occurred_on: string
  created_at: string
}

export type Checkin = {
  id: string
  user_id: string
  day: string
  mood: Mood
  gratitude: string
  action_taken: string
  visualized_seconds: number
}

export type Affirmation = {
  id: string
  user_id: string
  text: string
  created_at: string
}

export type CoupleMember = {
  user_id: string
  share_all_individual: boolean
  display_name: string
  avatar_url: string | null
}

export type CoupleInfo = {
  id: string
  name: string
  invite_code: string
  members: CoupleMember[]
}

export type Cheer = {
  id: string
  dream_id: string
  user_id: string
  body: string
  created_at: string
}
