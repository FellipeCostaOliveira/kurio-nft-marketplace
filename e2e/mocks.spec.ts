import { expect, gotoApp, test } from './fixtures'

test.describe('Camada de mocks (MSW)', () => {
  test('continua atendendo a aba depois que o navegador encerra o Service Worker @desktop-only', async ({ page, context }) => {
    const responses: string[] = []
    page.on('response', (r) => {
      if (r.url().includes('/api/nfts?')) responses.push(`${r.status()}:${r.fromServiceWorker()}`)
    })
    await gotoApp(page, '/')
    await expect(page.locator('[data-testid=nft-card]')).toHaveCount(9)

    // Simula o Chrome encerrando o worker por inatividade (aba em segundo plano).
    const cdp = await context.newCDPSession(page)
    await cdp.send('ServiceWorker.enable')
    await cdp.send('ServiceWorker.stopAllWorkers')
    await page.waitForTimeout(4500)

    await page.getByRole('button', { name: 'Página 2', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Página 2', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-testid=nft-card]')).toHaveCount(9)
    await expect(page.getByTestId('error-state')).toHaveCount(0)
    expect(responses.at(-1)).toBe('200:true')
  })
})
