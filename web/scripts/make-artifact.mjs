/**
 * Converte dist-preview/index.html no formato de página do Artifact:
 * sem <!doctype>, <html>, <head> e <body> — só o conteúdo.
 *
 *   npm run build:preview && node scripts/make-artifact.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entrada = resolve(root, 'dist-preview/index.html')
const saida = process.argv[2] ?? resolve(root, 'dist-preview/wedream-previa.html')

let html = await readFile(entrada, 'utf8')

const pegar = (re) => {
  const m = html.match(re)
  return m ? m[0] : ''
}

const title = pegar(/<title>[\s\S]*?<\/title>/i)
const estilos = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0])
const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/gi)].map(
  (m) => m[0],
)

// o corpo, sem os <script> (que reinserimos no fim) e sem o <noscript>
let corpo = pegar(/<body[^>]*>[\s\S]*<\/body>/i)
  .replace(/^<body[^>]*>/i, '')
  .replace(/<\/body>$/i, '')
  .replace(/<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<noscript>[\s\S]*?<\/noscript>/gi, '')
  .trim()

if (!corpo.includes('id="root"')) {
  throw new Error('não encontrei <div id="root"> no build de prévia')
}
if (scripts.length === 0) {
  throw new Error('nenhum script inline encontrado — o build de arquivo único falhou?')
}

// nada pode depender da rede: o Artifact bloqueia hosts fora da lista
const externos = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/gi)].map((m) => m[1])
if (externos.length) {
  console.warn('⚠ referências externas encontradas (serão bloqueadas):')
  for (const url of new Set(externos)) console.warn('   ·', url)
}

const paginaTitulo = title || '<title>WE DREAM</title>'

const out = `${paginaTitulo}
${estilos.join('\n')}
${corpo}
${scripts.join('\n')}
`

await writeFile(saida, out, 'utf8')
console.log(`✓ ${saida}`)
console.log(`  ${(out.length / 1024 / 1024).toFixed(2)} MB · ${estilos.length} estilo(s) · ${scripts.length} script(s)`)
