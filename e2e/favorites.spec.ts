import { expect, gotoApp, loginAPI, test } from './fixtures'

test.describe('Favoritos', () => {
  test('visitante é convidado a entrar', async ({ page }) => {
    await gotoApp(page, '/nft/nft-001')
    await page.getByRole('button', { name: 'Favoritar' }).click()
    await expect(page.getByRole('dialog').getByText('Entre para continuar.')).toBeVisible()
  })

  test('atualização otimista, persistência e rollback em falha', async ({ page, mock }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'ana')
    await page.goto('/nft/nft-001')
    const btn = page.getByRole('button', { name: /Favoritar|Favoritado/ })
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Adicionado aos favoritos')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toHaveAttribute('aria-pressed', 'true')

    // Falha simulada: estado otimista volta e o usuário é avisado
    await mock.scenario('favorite-failure')
    await page.getByRole('button', { name: 'Favoritado' }).click()
    await expect(page.getByText('Não foi possível atualizar seus favoritos')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toHaveAttribute('aria-pressed', 'true')
    // Recuperação: nova tentativa funciona (falha configurada para 1x)
    await page.getByRole('button', { name: 'Favoritado' }).click()
    await expect(page.getByRole('button', { name: 'Favoritar' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText('Removido dos favoritos')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Favoritar' })).toHaveAttribute('aria-pressed', 'false')
  })
})
