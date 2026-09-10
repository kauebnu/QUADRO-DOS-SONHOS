import { config } from './config'
import { quoteOfTheDay } from './quotes'

export type PushState =
  | 'unsupported'   // navegador sem suporte
  | 'unconfigured'  // falta a chave VAPID no servidor
  | 'denied'        // usuário bloqueou
  | 'granted'       // permitido e inscrito
  | 'default'       // ainda não perguntamos

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (!config.vapidPublicKey) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'default'

  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'granted' : 'default'
}

/** Pede permissão e devolve a inscrição pronta para salvar no banco. */
export async function subscribeToPush(): Promise<PushSubscriptionJSON> {
  if (!pushSupported()) throw new Error('Seu navegador não suporta notificações push.')
  if (!config.vapidPublicKey) {
    throw new Error('As notificações ainda não foram configuradas no servidor.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Você precisa permitir notificações para receber o lembrete diário.')
  }

  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing.toJSON()

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) as BufferSource,
  })
  return sub.toJSON()
}

export async function unsubscribeFromPush(): Promise<string | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return null
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  return endpoint
}

/**
 * Notificação local de teste — mostra na hora como o lembrete diário vai
 * aparecer, sem depender do servidor.
 */
export async function sendTestNotification(name: string): Promise<void> {
  if (!pushSupported()) throw new Error('Seu navegador não suporta notificações.')

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()

  if (permission !== 'granted') {
    throw new Error('Permita as notificações para ver o teste.')
  }

  const reg = await navigator.serviceWorker.ready
  await reg.showNotification(`${name ? `${name}, ` : ''}olhe seus sonhos ✨`, {
    body: quoteOfTheDay(new Date(), Math.floor(Math.random() * 97)),
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: 'wedream-teste',
    data: { url: '/' },
  })
}
