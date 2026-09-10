/**
 * Configuração em tempo de execução.
 *
 * Em produção o container escreve /config.js com window.__WE_DREAM_CONFIG__,
 * assim a MESMA imagem Docker serve qualquer ambiente sem rebuild.
 * Em dev caímos nas variáveis do .env do Vite.
 */
type RuntimeConfig = {
  supabaseUrl: string
  supabaseAnonKey: string
  vapidPublicKey: string
  pushApiUrl: string
}

declare global {
  interface Window {
    __WE_DREAM_CONFIG__?: Partial<RuntimeConfig>
  }
}

const runtime = typeof window !== 'undefined' ? window.__WE_DREAM_CONFIG__ ?? {} : {}

function pick(runtimeValue: string | undefined, envValue: string | undefined): string {
  const v = (runtimeValue ?? '').trim()
  // O entrypoint do container pode deixar placeholders não substituídos
  if (v && !v.startsWith('__') && !v.startsWith('${')) return v
  return (envValue ?? '').trim()
}

export const config: RuntimeConfig = {
  supabaseUrl: pick(runtime.supabaseUrl, import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: pick(runtime.supabaseAnonKey, import.meta.env.VITE_SUPABASE_ANON_KEY),
  vapidPublicKey: pick(runtime.vapidPublicKey, import.meta.env.VITE_VAPID_PUBLIC_KEY),
  pushApiUrl: pick(runtime.pushApiUrl, import.meta.env.VITE_PUSH_API_URL),
}

/** Há um backend Supabase configurado? Se não, o app roda em modo demonstração. */
export const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey)

export const APP = {
  name: 'WE DREAM',
  slogan: 'We dreams, we work, we conquer!',
  sloganCouple: 'We dreams, we work, we conquer! — Together',
} as const
