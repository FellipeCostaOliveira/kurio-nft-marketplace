import { expect, gotoApp, test } from './fixtures'

const grid = (page: import('@playwright/test').Page) => page.getByTestId('catalog-grid')
const cardNames = (page: import('@playwright/test').Page) => grid(page).locator('[data-testid=nft-card] h3')
const openFilters = async (page: import('@playwright/test').Page) => {
  const btn = page.getByRole('button', { name: 'Filtros', exact: true })
  if (await btn.isVisible()) await btn.click()
}
const closeFilters = async (page: import('@playwright/test').Page) => {
  const dlg = page.getByRole('dialog', { name: 'Filtros' })
  if (await dlg.isVisible()) await page.keyboard.press('Escape')
}

test.describe('Catálogo', () => {
  test('busca, filtros combinados, ordenação, paginação e histórico', async ({ page }) => {
    await gotoApp(page, '/')
    await expect(cardNames(page)).toHaveCount(9)
    await expect(cardNames(page).first()).toHaveText('Emerald Ape #042')
    await expect(page.getByTestId('results-count')).toHaveText(/239 NFTs/)

    // Paginação
    await page.getByRole('button', { name: 'Página 2', exact: true }).click()
    await expect(page).toHaveURL(/pagina=2/)
    await expect(page.getByRole('button', { name: 'Página 2', exact: true })).toHaveAttribute('aria-current', 'page')

    // Filtro reinicia a paginação; filtros combináveis
    await openFilters(page)
    await page.getByRole('button', { name: /^Música/ }).click()
    await expect(page).not.toHaveURL(/pagina=/)
    await expect(page).toHaveURL(/colecoes=musica/)
    await page.getByRole('button', { name: /^Polygon/ }).click()
    await expect(page).toHaveURL(/redes=polygon/)
    await closeFilters(page)
    await expect(page.getByTestId('results-count')).not.toHaveText(/239 NFTs|Atualizando/)
    const combined = await page.getByTestId('results-count').textContent()
    const total = Number(combined?.match(/(\d+)/)?.[1])
    expect(total).toBeGreaterThan(0)
    expect(total).toBeLessThan(65)

    // Ordenação por menor preço (no mobile fica no painel de filtros)
    await openFilters(page)
    await page.getByTestId('sort-trigger').click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/ordem=price-asc/)
    await closeFilters(page)
    await expect(page.getByTestId('results-count')).not.toContainText('Atualizando')
    const prices = await grid(page).locator('[data-testid=nft-card] p').allTextContents()
    const values = prices.map((p) => Number(p.match(/([\d.]+) ETH/)?.[1]))
    expect([...values].sort((a, b) => a - b)).toEqual(values)

    // Busca
    await page.getByRole('searchbox', { name: /Buscar NFTs/ }).fill('Golden')
    await expect(page).toHaveURL(/q=Golden/)
    await expect(page.getByTestId('results-count')).toContainText('Golden')

    // Refresh mantém o estado
    await page.reload()
    await expect(page).toHaveURL(/q=Golden/)
    await expect(page.getByRole('searchbox', { name: /Buscar NFTs/ })).toHaveValue('Golden')
    await openFilters(page)
    await expect(page.getByRole('button', { name: /^Música/ })).toHaveAttribute('aria-pressed', 'true')
    await closeFilters(page)

    // Histórico: voltar remove a busca
    await page.goBack()
    await expect(page).not.toHaveURL(/q=Golden/)
    await expect(page).toHaveURL(/ordem=price-asc/)
    await page.goBack()
    await expect(page).not.toHaveURL(/ordem=/)
    await page.goForward()
    await expect(page).toHaveURL(/ordem=price-asc/)
  })

  test('resultado vazio com limpeza de filtros', async ({ page }) => {
    await gotoApp(page, '/?q=inexistente-xyz')
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await page.getByTestId('empty-state').getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(cardNames(page)).toHaveCount(9)
  })

  test('catálogo vazio no cenário empty-catalog', async ({ page }) => {
    await gotoApp(page, '/', { scenario: 'empty-catalog' })
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByTestId('results-count')).toHaveText(/0 NFTs/)
  })

  test('respostas fora de ordem não sobrescrevem a consulta atual', async ({ page }) => {
    await gotoApp(page, '/', { scenario: 'out-of-order' })
    await expect(cardNames(page)).toHaveCount(9)
    // 1ª troca (lenta) e 2ª troca (rápida) em sequência: a lenta chega depois e deve ser descartada.
    await page.getByRole('button', { name: 'Novos lançamentos' }).click()
    await page.getByRole('button', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/aba=trending/)
    await page.waitForTimeout(2200)
    await expect(page.getByRole('button', { name: 'Em alta' })).toHaveAttribute('aria-pressed', 'true')
    const trending = await page.evaluate(async () => (await (await fetch('/api/nfts?tab=trending&sort=recent&page=1&pageSize=9')).json()).items.map((n: { name: string }) => n.name))
    await expect(cardNames(page)).toHaveText(trending)
  })

  test('skeletons com rede lenta, falha 500 e recuperação após nova tentativa', async ({ page }) => {
    await gotoApp(page, '/', { scenario: 'slow' })
    await expect(page.getByTestId('catalog-skeleton').first()).toBeVisible()
    await expect(cardNames(page)).toHaveCount(9, { timeout: 10_000 })

    await gotoApp(page, '/', { scenario: 'server-error' })
    await expect(page.getByTestId('error-state')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('error-state')).toContainText('Não foi possível carregar o catálogo')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(cardNames(page)).toHaveCount(9)
  })

  test('sem conexão mostra erro de rede', async ({ page }) => {
    await gotoApp(page, '/', { scenario: 'offline' })
    await expect(page.getByTestId('error-state')).toContainText('Sem conexão', { timeout: 10_000 })
  })
})
