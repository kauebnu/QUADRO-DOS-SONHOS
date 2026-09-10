/**
 * Gera os ícones do PWA (preto + dourado) a partir de um SVG.
 *   node scripts/make-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')

const GOLD_DEFS = `
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%"  stop-color="#FBF6E4"/>
    <stop offset="38%" stop-color="#E8D07C"/>
    <stop offset="70%" stop-color="#D4AF37"/>
    <stop offset="100%" stop-color="#8F6F24"/>
  </linearGradient>
  <radialGradient id="glow" cx="50%" cy="42%" r="58%">
    <stop offset="0%"  stop-color="#D4AF37" stop-opacity=".38"/>
    <stop offset="70%" stop-color="#D4AF37" stop-opacity="0"/>
  </radialGradient>`

/** Estrela de quatro pontas (o "brilho" da manifestação). */
function sparkle(cx, cy, r, fill = 'url(#g)', opacity = 1) {
  const w = r * 0.2
  return `<path opacity="${opacity}" fill="${fill}" d="
    M ${cx} ${cy - r}
    C ${cx + w} ${cy - w} ${cx + w} ${cy - w} ${cx + r} ${cy}
    C ${cx + w} ${cy + w} ${cx + w} ${cy + w} ${cx} ${cy + r}
    C ${cx - w} ${cy + w} ${cx - w} ${cy + w} ${cx - r} ${cy}
    C ${cx - w} ${cy - w} ${cx - w} ${cy - w} ${cx} ${cy - r} Z"/>`
}

/** @param {{size:number, padding:number, showText:boolean, bg:boolean}} opts */
function iconSvg({ size = 512, padding = 0, showText = true, bg = true } = {}) {
  const s = size
  const inner = s - padding * 2
  const cx = s / 2
  const cy = showText ? s * 0.42 : s / 2
  const r = inner * (showText ? 0.2 : 0.3)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>${GOLD_DEFS}</defs>
  ${bg ? `<rect width="${s}" height="${s}" fill="#08080A"/>` : ''}
  ${bg ? `<rect width="${s}" height="${s}" fill="url(#glow)"/>` : ''}
  <circle cx="${cx}" cy="${cy}" r="${r * 1.62}" fill="none" stroke="url(#g)" stroke-opacity=".28" stroke-width="${s * 0.006}"/>
  ${sparkle(cx, cy, r)}
  ${sparkle(cx + r * 1.5, cy - r * 1.05, r * 0.34, 'url(#g)', 0.85)}
  ${sparkle(cx - r * 1.44, cy + r * 1.1, r * 0.26, 'url(#g)', 0.6)}
  ${
    showText
      ? // o letter-spacing acrescenta um espaço depois da última letra;
        // deslocamos o x para a direita para o texto ficar óptico ao centro
        `<text x="${cx + s * 0.015}" y="${s * 0.79}" text-anchor="middle"
             font-family="Georgia, 'Times New Roman', serif" font-weight="600"
             font-size="${s * 0.098}" letter-spacing="${s * 0.03}"
             fill="url(#g)">WE DREAM</text>`
      : ''
  }
</svg>`
}

/** Badge monocromático para a bandeja de notificações. */
function badgeSvg(size = 72) {
  const cx = size / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${GOLD_DEFS}</defs>
  ${sparkle(cx, cx, size * 0.36, '#FFFFFF')}
</svg>`
}

const targets = [
  { file: 'icon-192.png', svg: iconSvg({ size: 512, showText: true }), size: 192 },
  { file: 'icon-512.png', svg: iconSvg({ size: 512, showText: true }), size: 512 },
  // maskable precisa de 20% de margem segura em volta
  { file: 'icon-maskable-512.png', svg: iconSvg({ size: 512, padding: 96, showText: false }), size: 512 },
  { file: 'apple-touch-icon.png', svg: iconSvg({ size: 512, showText: true }), size: 180 },
  { file: 'badge-72.png', svg: badgeSvg(72), size: 72 },
]

await mkdir(outDir, { recursive: true })

for (const t of targets) {
  const buf = await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png({ quality: 92 }).toBuffer()
  await writeFile(resolve(outDir, t.file), buf)
  console.log(`✓ icons/${t.file} (${t.size}px)`)
}

// favicon vetorial (nítido em qualquer tamanho)
await writeFile(resolve(root, 'public/favicon.svg'), iconSvg({ size: 64, showText: false }))
console.log('✓ favicon.svg')

// imagem de compartilhamento
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>${GOLD_DEFS}
    <radialGradient id="og" cx="18%" cy="12%" r="70%">
      <stop offset="0%" stop-color="#D4AF37" stop-opacity=".22"/>
      <stop offset="100%" stop-color="#D4AF37" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#08080A"/>
  <rect width="1200" height="630" fill="url(#og)"/>
  ${sparkle(980, 180, 120, 'url(#g)', 0.5)}
  ${sparkle(1090, 96, 42, 'url(#g)', 0.35)}
  <text x="90" y="300" font-family="Georgia, serif" font-weight="600" font-size="104"
        letter-spacing="34" fill="url(#g)">WE DREAM</text>
  <text x="96" y="368" font-family="system-ui, sans-serif" font-size="30" letter-spacing="6"
        fill="#E8D07C" fill-opacity=".72">WE DREAMS, WE WORK, WE CONQUER!</text>
  <text x="96" y="438" font-family="system-ui, sans-serif" font-size="24"
        fill="#F6EDC8" fill-opacity=".45">Seu quadro dos sonhos · Lei da Atração acontecendo</text>
</svg>`
await writeFile(
  resolve(root, 'public/og-image.png'),
  await sharp(Buffer.from(ogSvg)).png().toBuffer(),
)
console.log('✓ og-image.png')
