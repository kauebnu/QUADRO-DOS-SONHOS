/**
 * Gera o par de chaves VAPID das notificações push.
 *   npm run vapid          (ou: node scripts/generate-vapid.js)
 *
 * Usa só o Node, sem nenhuma dependência instalada — assim o instalador
 * da VPS consegue gerar as chaves antes de qualquer `npm install`.
 *
 * VAPID é um par de chaves ECDSA na curva P-256:
 *   · pública  = ponto não comprimido (0x04 ‖ X ‖ Y), 65 bytes
 *   · privada  = o escalar d, 32 bytes
 * Ambas em base64url, exatamente como a biblioteca web-push espera.
 *
 * A chave PÚBLICA vai no app. A PRIVADA fica só no servidor, no .env.
 */
import { generateKeyPairSync } from 'node:crypto'
import { argv } from 'node:process'
import { pathToFileURL } from 'node:url'

function gerarVapid() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })

  const pub = publicKey.export({ format: 'jwk' })
  const priv = privateKey.export({ format: 'jwk' })

  const x = Buffer.from(pub.x, 'base64url')
  const y = Buffer.from(pub.y, 'base64url')
  if (x.length !== 32 || y.length !== 32) {
    throw new Error(`coordenadas com tamanho inesperado: x=${x.length} y=${y.length}`)
  }

  const d = Buffer.from(priv.d, 'base64url')
  if (d.length !== 32) throw new Error(`chave privada com ${d.length} bytes, esperava 32`)

  return {
    publicKey: Buffer.concat([Buffer.from([0x04]), x, y]).toString('base64url'),
    privateKey: d.toString('base64url'),
  }
}

// só imprime quando executado direto; ao ser importado, apenas exporta
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  const { publicKey, privateKey } = gerarVapid()

  // modo silencioso para o instalador: imprime só "publica privada"
  if (argv.includes('--cru')) {
    console.log(`${publicKey} ${privateKey}`)
  } else {
    console.log(`
Chaves VAPID geradas — guarde a privada com cuidado.

  VAPID_PUBLIC_KEY=${publicKey}
  VAPID_PRIVATE_KEY=${privateKey}

No .env do servidor coloque as duas.
No app (VITE_VAPID_PUBLIC_KEY / WEB_VAPID_PUBLIC_KEY) use APENAS a pública.
`)
  }
}

export { gerarVapid }
