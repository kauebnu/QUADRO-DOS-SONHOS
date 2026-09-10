import { expect, test, type Page } from '@playwright/test'

/**
 * Suíte funcional do WE DREAM.
 *
 * Roda contra o modo demonstração (localStorage), que usa exatamente as
 * mesmas telas, cálculos e regras do modo Supabase — só troca a camada de
 * persistência. As regras do servidor (RLS, casal, storage) são cobertas
 * pelos testes SQL em supabase/tests.
 */

async function entrarNaDemo(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await expect(page.getByRole('heading', { name: 'Em foco agora' })).toBeVisible()
}

/** Abre uma seção pelo menu lateral (funciona no celular e no desktop). */
async function irPara(page: Page, nome: string) {
  await page.getByRole('button', { name: 'Abrir menu' }).first().click()
  // No menu, o nome acessível do link é "Rótulo + descrição"
  // (ex.: "Realizados Seu arquivo de conquistas"), por isso ancoramos no início.
  const inicio = new RegExp('^' + nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  await page.getByRole('dialog').getByRole('link', { name: inicio }).first().click()
}

// Cada teste roda em um contexto novo do navegador, então o localStorage
// já começa vazio — nada a limpar aqui (limpar em cada navegação apagaria
// os dados que alguns testes verificam depois do reload).

/* ------------------------------------------------------------------ login */

test('tela de entrada mostra a marca, o slogan e o acesso à demonstração', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('WE DREAM').first()).toBeVisible()
  await expect(page.getByText('We dreams, we work, we conquer!').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Explorar demonstração' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible()
})

test('alternar para "Criar conta" pede o nome', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByLabel('Como quer ser chamada(o)?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Começar a sonhar' })).toBeVisible()
})

/* ------------------------------------------------------------------ início */

test('painel inicial traz frase do dia, coach, números e destaques', async ({ page }) => {
  await entrarNaDemo(page)

  await expect(page.getByText('Sua frase de hoje')).toBeVisible()
  await expect(page.getByText('Seu coach diz')).toBeVisible()

  await expect(page.getByText('sonhos ativos')).toBeVisible()
  await expect(page.getByText('realizados', { exact: true })).toBeVisible()
  await expect(page.getByText('dias de foco')).toBeVisible()
  await expect(page.getByText('guardado', { exact: true })).toBeVisible()

  // 8 sonhos ativos nos dados de exemplo
  const ativos = page.locator('a', { hasText: 'sonhos ativos' })
  await expect(ativos).toContainText('8')
})

test('a frase do dia é a mesma no mesmo dia (não pisca a cada render)', async ({ page }) => {
  await entrarNaDemo(page)
  const frase = await page.locator('p.font-display').filter({ hasText: '“' }).first().innerText()
  await page.reload()
  const frase2 = await page.locator('p.font-display').filter({ hasText: '“' }).first().innerText()
  expect(frase2).toBe(frase)
})

/* ------------------------------------------------------------------ quadro */

test('quadro lista, busca e filtra por categoria', async ({ page }) => {
  await entrarNaDemo(page)
  await page.getByRole('link', { name: 'Quadro', exact: true }).first().click()

  await expect(page.getByRole('heading', { name: 'O Quadro' })).toBeVisible()
  await expect(page.getByText('8 sonhos em construção')).toBeVisible()

  // busca textual
  await page.getByPlaceholder('Buscar por título').fill('Santorini')
  await expect(page.getByText('1 sonho em construção')).toBeVisible()
  await expect(page.getByText('Lua de mel em Santorini')).toBeVisible()

  await page.getByRole('button', { name: 'Limpar busca' }).click()
  await expect(page.getByText('8 sonhos em construção')).toBeVisible()

  // filtro por categoria
  await page.getByRole('button', { name: 'Filtros' }).click()
  await page.getByRole('button', { name: /Viagens/ }).click()
  await expect(page.getByText('1 sonho em construção')).toBeVisible()
})

test('aba Realizados mostra apenas os sonhos conquistados', async ({ page }) => {
  await entrarNaDemo(page)
  await page.getByRole('link', { name: 'Quadro', exact: true }).first().click()
  await page.getByRole('button', { name: 'Realizados' }).click()
  await expect(page.getByText('2 sonhos realizados')).toBeVisible()
})

/* -------------------------------------------------------- criar / editar */

test('cria um sonho completo e ele aparece no quadro', async ({ page }) => {
  await entrarNaDemo(page)
  await page.getByRole('link', { name: 'Novo sonho' }).first().click()

  await expect(page.getByRole('heading', { name: 'Novo sonho' })).toBeVisible()

  await page.getByPlaceholder('Ex.: Casa dos sonhos frente ao mar').fill('Apartamento em Paris')
  await page.getByPlaceholder('Como é esse sonho realizado?').fill('Vista para a torre, luz da manhã.')
  await page.getByPlaceholder(/Guardar X por mês/).fill('1) Vender o curso\n2) Guardar 30% por mês')
  await page.getByLabel('Categoria').selectOption({ label: '✈️ Viagens' })
  await page.getByPlaceholder('850000').fill('1200000')
  await page.getByRole('button', { name: /Prioridade máxima/ }).click()

  await page.getByRole('button', { name: 'Adicionar ao quadro' }).click()

  // vai para o detalhe do sonho recém-criado
  await expect(page.getByRole('heading', { name: 'Apartamento em Paris' })).toBeVisible()
  await expect(page.getByText('Vista para a torre')).toBeVisible()
  await expect(page.getByText('1) Vender o curso')).toBeVisible()
  await expect(page.getByText('R$ 1.200.000,00').first()).toBeVisible()

  // e consta no quadro
  await page.getByRole('link', { name: 'Quadro', exact: true }).first().click()
  await expect(page.getByText('9 sonhos em construção')).toBeVisible()
})

test('bloqueia sonho sem título e data de realização anterior à de criação', async ({ page }) => {
  await entrarNaDemo(page)
  await page.goto('/sonho/novo')

  // data alvo antes da data de adição
  await page.getByPlaceholder('Ex.: Casa dos sonhos frente ao mar').fill('Teste de validação')
  await page.getByLabel('Adicionei ao quadro em').fill('2026-06-01')
  await page.getByLabel('Pretendo realizar em').fill('2026-01-01')
  await page.getByRole('button', { name: 'Adicionar ao quadro' }).click()
  await expect(page.getByText('A data de realizar não pode ser antes da data de adicionar.')).toBeVisible()
})

test('edita um sonho existente', async ({ page }) => {
  await entrarNaDemo(page)
  await page.getByRole('link', { name: 'Quadro', exact: true }).first().click()
  await page.getByText('Retiro de silêncio').click()

  await page.getByRole('link', { name: 'Editar' }).click()
  const titulo = page.getByPlaceholder('Ex.: Casa dos sonhos frente ao mar')
  await titulo.fill('Retiro de silêncio de 7 dias')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()

  await expect(page.getByRole('heading', { name: 'Retiro de silêncio de 7 dias' })).toBeVisible()
})

test('exclui um sonho com confirmação', async ({ page }) => {
  await entrarNaDemo(page)
  await page.goto('/quadro')
  await page.getByText('Retiro de silêncio').click()
  await page.getByRole('link', { name: 'Editar' }).click()

  await page.getByRole('button', { name: 'Excluir' }).click()
  await expect(page.getByRole('heading', { name: 'Excluir este sonho?' })).toBeVisible()
  await page.getByRole('button', { name: 'Sim, excluir' }).click()

  await expect(page.getByRole('heading', { name: 'O Quadro' })).toBeVisible()
  await expect(page.getByText('7 sonhos em construção')).toBeVisible()
})

/* ------------------------------------------------------ realizar/arquivar */

test('marca como realizado, arquiva e desfaz', async ({ page }) => {
  await entrarNaDemo(page)
  await page.goto('/quadro')
  await page.getByText('Retiro de silêncio').click()

  await page.getByRole('button', { name: 'Marcar como realizado' }).click()
  await expect(page.getByRole('heading', { name: 'Sonho realizado! 🏆' })).toBeVisible()
  await page.getByRole('button', { name: 'Sim, realizei!' }).click()

  await expect(page.getByText(/Conquistado em/)).toBeVisible()

  // arquivar
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByText('Guardado no seu arquivo de conquistas.')).toBeVisible()

  // aparece no arquivo de realizados
  await irPara(page, 'Realizados')
  await expect(page.getByRole('heading', { name: 'Sonhos realizados' })).toBeVisible()
  // usa o link do card: o toast de comemoração também contém o nome do sonho
  const cartao = page.getByRole('link', { name: /Retiro de silêncio/ })
  await expect(cartao).toBeVisible()

  // desfazer volta para ativo
  await cartao.click()
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByRole('button', { name: 'Marcar como realizado' })).toBeVisible()
})

/* -------------------------------------------------------- banco dos sonhos */

test('registra aporte e a porcentagem do sonho sobe', async ({ page }) => {
  await entrarNaDemo(page)
  await page.goto('/quadro')
  await page.getByText('MBA internacional').click()

  // 22.000 de 180.000 = 12%
  await expect(page.getByText('12%').first()).toBeVisible()
  await expect(page.getByText('R$ 22.000,00').first()).toBeVisible()

  await page.getByRole('button', { name: 'Aportar' }).click()
  await page.getByPlaceholder('500').fill('20000')
  await page.getByPlaceholder('Ex.: bônus do mês').fill('Aporte do teste')
  await page.getByRole('button', { name: 'Guardar no sonho' }).click()

  // 42.000 de 180.000 = 23%
  await expect(page.getByText('R$ 42.000,00').first()).toBeVisible()
  await expect(page.getByText('23%').first()).toBeVisible()
  await expect(page.getByText('Aporte do teste')).toBeVisible()
})

test('retirada reduz o total guardado', async ({ page }) => {
  await entrarNaDemo(page)
  await irPara(page, 'Banco')

  await expect(page.getByRole('heading', { name: 'Banco dos Sonhos' })).toBeVisible()
  // 45+12+12+15,5+9+1,5+1,5+22+41+2+8,4 (mil) = 169.900
  await expect(page.getByText('R$ 169.900,00')).toBeVisible()

  await page.getByRole('button', { name: 'Novo aporte' }).click()
  await page.getByRole('button', { name: /Retirei \/ usei/ }).click()
  await page.getByPlaceholder('500').fill('900')
  await page.getByRole('button', { name: 'Registrar retirada' }).click()

  await expect(page.getByText('R$ 169.000,00')).toBeVisible()
})

test('banco lista o progresso por sonho ordenado pela porcentagem', async ({ page }) => {
  await entrarNaDemo(page)
  await irPara(page, 'Banco')
  await expect(page.getByRole('heading', { name: 'Progresso de cada sonho' })).toBeVisible()
  // Reforma da cozinha: 41.000 de 75.000 = 55% (maior porcentagem)
  // exclui o botão "Novo sonho" do cabeçalho, que também aponta para /sonho/…
  const primeiro = page.locator('a[href^="/sonho/"]:not([href="/sonho/novo"])').first()
  await expect(primeiro).toContainText('Reforma da cozinha')
})

/* ---------------------------------------------------------------- ritual */

test('ritual diário grava o check-in e inicia a sequência', async ({ page }) => {
  await entrarNaDemo(page)

  // o dado de exemplo já tem check-in de hoje; editamos
  await page.getByRole('button', { name: 'Editar check-in de hoje' }).click()
  await expect(page.getByRole('heading', { name: 'Ritual do dia' })).toBeVisible()

  await page.getByRole('button', { name: /Ótimo/ }).click()
  await page.getByPlaceholder('Três coisas específicas…').fill('Grata pelo teste passando')
  await page.getByRole('button', { name: 'Continuar' }).click()

  // cronômetro de visualização
  await expect(page.getByText('Meta: 60 segundos sentindo que já é seu')).toBeVisible()
  await page.getByRole('button', { name: /Começar|Continuar/ }).first().click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Pausar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).last().click()

  await page.getByPlaceholder(/ligar para a corretora/).fill('Terminei os testes')
  await page.getByRole('button', { name: 'Concluir ritual' }).click()

  await expect(page.getByText('Check-in do dia registrado! 🙏')).toBeVisible()
})

/* ---------------------------------------------------------- apresentação */

test('o X fecha a apresentação mesmo com os controles em repouso', async ({ page }) => {
  await entrarNaDemo(page)
  await page.goto('/apresentacao')
  await expect(page.getByLabel('Sair da apresentação')).toBeVisible()

  // deixa os controles entrarem em repouso (somem depois de ~3,2s)
  await page.waitForTimeout(4200)

  // mesmo em repouso, o botão de sair continua clicável
  await page.getByLabel('Sair da apresentação').click()
  await expect(page.getByRole('heading', { name: 'Em foco agora' })).toBeVisible()
})

test('o X funciona quando a apresentação é a primeira página aberta', async ({ page }) => {
  // sem histórico para "voltar": antes, o botão não fazia nada
  await entrarNaDemo(page)
  await page.context().clearCookies()
  await page.goto('/apresentacao')
  await expect(page.getByLabel('Sair da apresentação')).toBeVisible()
  await page.getByLabel('Sair da apresentação').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Em foco agora' })).toBeVisible()
})

test('com os controles em repouso, o primeiro toque só os revela', async ({ page }) => {
  await entrarNaDemo(page)
  await page.goto('/apresentacao')
  await expect(page.getByText('1 / 8')).toBeVisible()

  await page.waitForTimeout(4200) // controles em repouso

  // toque na zona esquerda: deve apenas reacender os controles
  const caixa = page.viewportSize()!
  await page.mouse.click(Math.round(caixa.width * 0.1), Math.round(caixa.height * 0.5))
  await expect(page.getByText('1 / 8')).toBeVisible()

  // agora sim o toque navega
  await page.mouse.click(Math.round(caixa.width * 0.9), Math.round(caixa.height * 0.5))
  await expect(page.getByText('2 / 8')).toBeVisible()
})

test('modo apresentação roda os sonhos e tem ajustes', async ({ page }) => {
  await entrarNaDemo(page)
  await page.goto('/apresentacao')

  await expect(page.getByLabel('Sair da apresentação')).toBeVisible()
  await expect(page.getByText('/ 8')).toBeVisible()

  // avança manualmente
  await page.getByLabel('Próximo').click()
  await expect(page.getByText('2 / 8')).toBeVisible()
  await page.getByLabel('Anterior').click()
  await expect(page.getByText('1 / 8')).toBeVisible()

  // pausa
  await page.getByLabel('Pausar').click()
  await expect(page.getByLabel('Continuar')).toBeVisible()

  // ajustes
  await page.getByLabel('Ajustes da apresentação').click()
  await expect(page.getByRole('heading', { name: 'Ajustes da apresentação' })).toBeVisible()
  await page.getByRole('button', { name: 'Realizados' }).click()
  await page.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByText('1 / 2')).toBeVisible()

  await page.getByLabel('Sair da apresentação').click()
})

/* ---------------------------------------------------------------- casal */

test('quadro em casal mostra o par, o código e o botão de privacidade', async ({ page }) => {
  await entrarNaDemo(page)
  await irPara(page, 'Quadro em casal')

  await expect(page.getByRole('heading', { name: 'Nosso Quadro' })).toBeVisible()
  await expect(page.getByText('We dreams, we work, we conquer! —').first()).toBeVisible()
  await expect(page.getByText('together').first()).toBeVisible()
  await expect(page.getByText('Seu par', { exact: true })).toBeVisible()

  // botão global de compartilhar individuais
  const chave = page.getByRole('switch', {
    name: /Deixar meu par ver TODOS os meus sonhos individuais/,
  })
  await expect(chave).toHaveAttribute('aria-checked', 'false')
  await chave.click()
  await expect(chave).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('Seu par agora vê todos os seus sonhos individuais.')).toBeVisible()
})

test('sonho individual pode ser marcado como compartilhado', async ({ page }) => {
  await entrarNaDemo(page)
  await page.goto('/quadro')
  await page.getByText('Porsche 911').click()
  await page.getByRole('link', { name: 'Editar' }).click()

  const chave = page.getByRole('switch', { name: /Deixar meu par ver este sonho/ })
  await expect(chave).toHaveAttribute('aria-checked', 'false')
  await chave.click()
  await page.getByRole('button', { name: 'Salvar alterações' }).click()

  await page.goto('/quadro')
  const card = page.locator('a', { hasText: 'Porsche 911' }).first()
  await expect(card).toContainText('Compartilhado')
})

/* ------------------------------------------------------- lei da atração */

test('página de dicas abre trilhas e cria afirmação', async ({ page }) => {
  await entrarNaDemo(page)
  await irPara(page, 'Lei da Atração')

  await expect(page.getByRole('heading', { name: 'Lei da Atração' })).toBeVisible()
  await expect(page.getByText('Clareza é metade da manifestação')).toBeVisible()

  // filtra por trilha
  await page.getByRole('button', { name: '💰 Prosperidade' }).click()
  await expect(page.getByText('Dinheiro gosta de nome e destino')).toBeVisible()

  // nova afirmação
  await page.getByPlaceholder('Eu sou um ímã de prosperidade…').fill('Eu estou me tornando imparável')
  await page.getByRole('button', { name: 'Adicionar afirmação' }).click()
  await expect(page.getByText('Eu estou me tornando imparável')).toBeVisible()
})

/* ---------------------------------------------------------------- perfil */

test('perfil salva o nome e cria categoria personalizada', async ({ page }) => {
  await entrarNaDemo(page)
  await irPara(page, 'Perfil e ajustes')

  await page.getByLabel('Como quer ser chamada(o)').fill('Antonella')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Antonella' })).toBeVisible()

  await irPara(page, 'Perfil e ajustes')
  await page.getByRole('button', { name: 'Nova' }).click()
  await page.getByPlaceholder(/Maternidade, Arte, Aventura/).fill('Maternidade')
  await page.getByRole('button', { name: '👑' }).click()
  await page.getByRole('button', { name: 'Criar categoria' }).click()

  await expect(page.getByText('Categoria criada!')).toBeVisible()
  await expect(page.getByText('Maternidade')).toBeVisible()
})

test('categoria personalizada fica disponível no formulário do sonho', async ({ page }) => {
  await entrarNaDemo(page)
  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Nova' }).click()
  await page.getByPlaceholder(/Maternidade, Arte, Aventura/).fill('Aventura')
  await page.getByRole('button', { name: 'Criar categoria' }).click()

  await page.goto('/sonho/novo')
  await expect(page.getByLabel('Categoria')).toContainText('Aventura')
})

/* --------------------------------------------------------------- geral */

test('nenhum erro de console durante a navegação principal', async ({ page }) => {
  const erros: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') erros.push(msg.text())
  })
  page.on('pageerror', (err) => erros.push(String(err)))

  await entrarNaDemo(page)
  for (const rota of ['/quadro', '/banco', '/realizados', '/dicas', '/casal', '/perfil']) {
    await page.goto(rota)
    await page.waitForLoadState('networkidle')
  }

  const relevantes = erros.filter((e) => !/favicon|manifest|Download the React DevTools/i.test(e))
  expect(relevantes, `erros no console:\n${relevantes.join('\n')}`).toEqual([])
})

test('os dados sobrevivem ao recarregar a página', async ({ page }) => {
  await entrarNaDemo(page)
  await page.goto('/sonho/novo')
  await page.getByPlaceholder('Ex.: Casa dos sonhos frente ao mar').fill('Sonho persistente')
  await page.getByRole('button', { name: 'Adicionar ao quadro' }).click()
  await expect(page.getByRole('heading', { name: 'Sonho persistente' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sonho persistente' })).toBeVisible()
})
