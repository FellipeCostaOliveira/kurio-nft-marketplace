import type { Page } from '@playwright/test'
import { addToCartViaDetail, expect, gotoApp, goToCheckout, loginAPI, test } from './fixtures'

/**
 * Regressão visual com dados estáveis (fixtures determinísticas + reset do cenário).
 * Baselines versionadas em e2e/__screenshots__/<projeto>/.
 */
async function stabilize(page: Page) {
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important} *{transition:none!important;animation:none!important}' })
  await page.evaluate(() => document.fonts.ready)
  // Força o carregamento das imagens lazy e espera todas decodificarem (captura estável).
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => img.setAttribute('loading', 'eager'))
    await Promise.all([...document.images].map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))))
  })
  await page.waitForLoadState('networkidle')
  // Painel de cenários e indicador de tempo real não fazem parte do layout do Figma.
  await page.getByTestId('mock-panel-toggle').evaluate((el) => (el.style.visibility = 'hidden')).catch(() => {})
}

const mask = (page: Page) => [page.locator('[title^="Tempo real"]')]

test.describe('Regressão visual', () => {
  test('início', async ({ page }) => {
    await gotoApp(page, '/')
    await expect(page.locator('[data-testid=nft-card]')).toHaveCount(9)
    await stabilize(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true, mask: mask(page), timeout: 15_000 })
  })

  test('detalhe do NFT', async ({ page }) => {
    await gotoApp(page, '/nft/nft-001')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mais desta coleção' })).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true, mask: mask(page) })
  })

  test('carrinho', async ({ page }) => {
    await gotoApp(page, '/')
    await addToCartViaDetail(page, 'nft-001', 2)
    await addToCartViaDetail(page, 'nft-005', 6)
    await addToCartViaDetail(page, 'nft-006', 9)
    await expect(page.getByTestId('summary-total')).toBeVisible()
    await expect(page.getByTestId('cart-row')).toHaveCount(3)
    await stabilize(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true, mask: mask(page) })
  })

  test('pagamento', async ({ page }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'ana')
    await addToCartViaDetail(page, 'nft-001', 2)
    await goToCheckout(page)
    await expect(page.getByTestId('summary-total')).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true, mask: mask(page) })
  })
})
