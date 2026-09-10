/**
 * Gera o par de chaves VAPID usado pelas notificações push.
 *   npm run vapid
 *
 * A chave PÚBLICA vai no app (VITE_VAPID_PUBLIC_KEY / config.js).
 * A chave PRIVADA fica SÓ no servidor (.env), nunca no repositório.
 */
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()

console.log(`
Chaves VAPID geradas — guarde a privada com cuidado.

  VAPID_PUBLIC_KEY=${publicKey}
  VAPID_PRIVATE_KEY=${privateKey}

No .env do servidor coloque as duas.
No app (variável VITE_VAPID_PUBLIC_KEY ou WEB_VAPID_PUBLIC_KEY) use APENAS a pública.
`)
