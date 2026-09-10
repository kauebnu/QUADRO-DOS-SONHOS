/**
 * Arte gerada para sonhos sem foto.
 *
 * Cada sonho ganha uma capa única e elegante (gradiente preto/dourado +
 * o emoji da categoria), determinística a partir do id — nunca fica um
 * card cinza feio no quadro, e funciona 100% offline.
 */

const PALETTES: [string, string, string][] = [
  ['#0B0B0F', '#3A2E12', '#D4AF37'],
  ['#0A0A0C', '#2E2A3A', '#E8D07C'],
  ['#08080A', '#402F13', '#F0E1A4'],
  ['#0C0A08', '#3D2B16', '#DCBE5C'],
  ['#090A0C', '#2A3140', '#D4AF37'],
  ['#0B0908', '#432D1B', '#F6EDC8'],
  ['#0A0B0A', '#26331F', '#E8D07C'],
  ['#0C080C', '#3B2233', '#DCBE5C'],
]

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function dreamArt(seed: string, emoji = '✨'): string {
  const h = hash(seed || 'we-dream')
  const [c0, c1, c2] = PALETTES[h % PALETTES.length]
  const angle = 20 + (h % 120)
  // dois focos de luz, sempre em quadrantes diferentes
  const ax = 22 + (h % 26)
  const ay = 18 + ((h >> 3) % 30)
  const bx = 58 + ((h >> 6) % 28)
  const by = 56 + ((h >> 9) % 30)
  const ringCx = 400 + (((h >> 4) % 160) - 80)
  const ringCy = 400 + (((h >> 7) % 160) - 80)
  const ringR = 200 + (h % 90)

  // O emoji entra como um selo discreto: sugere a categoria sem competir
  // com a foto real nem virar um adesivo gigante no modo apresentação.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${c0}"/>
      <stop offset="52%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c0}"/>
    </linearGradient>
    <radialGradient id="ga" cx="${ax}%" cy="${ay}%" r="62%">
      <stop offset="0%" stop-color="${c2}" stop-opacity="0.38"/>
      <stop offset="52%" stop-color="${c2}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${c2}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gb" cx="${bx}%" cy="${by}%" r="55%">
      <stop offset="0%" stop-color="${c2}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="${c2}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vig" cx="50%" cy="46%" r="72%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.45"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <rect width="800" height="800" fill="url(#ga)"/>
  <rect width="800" height="800" fill="url(#gb)"/>
  <circle cx="${ringCx}" cy="${ringCy}" r="${ringR}" fill="none" stroke="${c2}" stroke-opacity="0.14" stroke-width="1.5"/>
  <circle cx="${ringCx}" cy="${ringCy}" r="${ringR + 90}" fill="none" stroke="${c2}" stroke-opacity="0.07" stroke-width="1"/>
  <circle cx="${ringCx}" cy="${ringCy}" r="${ringR - 110}" fill="none" stroke="${c2}" stroke-opacity="0.05" stroke-width="1"/>
  <rect width="800" height="800" fill="url(#vig)"/>
  <circle cx="400" cy="392" r="86" fill="#000" fill-opacity="0.18" stroke="${c2}" stroke-opacity="0.22" stroke-width="1.5"/>
  <text x="400" y="424" font-size="84" text-anchor="middle" opacity="0.72">${emoji}</text>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Redimensiona/comprime a foto no navegador antes de subir. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Arquivo não é uma imagem')
  if (file.type === 'image/gif') return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  )
  return blob && blob.size < file.size ? blob : file
}
