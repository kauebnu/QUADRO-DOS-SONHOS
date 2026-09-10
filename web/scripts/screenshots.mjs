/**
 * Gera as telas do WE DREAM para conferência visual.
 *   node scripts/screenshots.mjs [urlBase] [pastaDeSaida]
 */
import { mkdir } from 'node:fs/promises'
import { chromium, devices } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173'
const OUT = process.argv[3] ?? 'screenshots'

const TELAS = [
  { nome: '01-login', rota: '/', semDemo: true },
  { nome: '02-inicio', rota: '/' },
  { nome: '03-quadro', rota: '/quadro' },
  { nome: '04-sonho', rota: 'PRIMEIRO_SONHO' },
  { nome: '05-banco', rota: '/banco' },
  { nome: '06-realizados', rota: '/realizados' },
  { nome: '07-apresentacao', rota: '/apresentacao' },
  { nome: '08-casal', rota: '/casal' },
  { nome: '09-dicas', rota: '/dicas' },
  { nome: '10-perfil', rota: '/perfil' },
  { nome: '11-novo-sonho', rota: '/sonho/novo' },
]

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

for (const perfil of [
  { id: 'celular', opts: { ...devices['Pixel 7'], isMobile: true, deviceScaleFactor: 2 } },
  { id: 'desktop', opts: { viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 } },
]) {
  const ctx = await browser.newContext({ ...perfil.opts, locale: 'pt-BR' })
  const page = await ctx.newPage()

  await page.goto(`${BASE}/`)
  await page.waitForLoadState('networkidle')

  for (const tela of TELAS) {
    if (!tela.semDemo) {
      // garante que estamos dentro da demonstração
      const botao = page.getByRole('button', { name: 'Explorar demonstração' })
      if (await botao.isVisible().catch(() => false)) {
        await botao.click()
        await page.waitForTimeout(900)
      }
    }

    let rota = tela.rota
    if (rota === 'PRIMEIRO_SONHO') {
      await page.goto(`${BASE}/quadro`)
      await page.waitForTimeout(600)
      const href = await page
        .locator('a[href^="/sonho/"]:not([href="/sonho/novo"])')
        .first()
        .getAttribute('href')
      rota = href ?? '/quadro'
    }

    await page.goto(`${BASE}${rota}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1400) // deixa as animações assentarem

    await page.screenshot({
      path: `${OUT}/${perfil.id}-${tela.nome}.png`,
      fullPage: !['07-apresentacao', '01-login'].includes(tela.nome),
    })
    console.log(`✓ ${perfil.id}-${tela.nome}.png`)
  }

  await ctx.close()
}

await browser.close()
console.log(`\nTelas salvas em ${OUT}/`)
