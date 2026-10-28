import { expect, gotoApp, test } from './fixtures'

test.describe('Detalhe do NFT', () => {
  test('acesso direto mostra galeria, edições e limite de quantidade', async ({ page }) => {
    await gotoApp(page, '/nft/nft-001')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByTestId('detail-price')).toContainText('1.19 ETH')
    await expect(page).toHaveTitle(/Emerald Ape #042/)

    // Galeria
    await page.getByRole('button', { name: /Ver imagem 2/ }).click()
    await expect(page.getByRole('button', { name: /Ver imagem 2/ })).toHaveAttribute('aria-pressed', 'true')

    // Edição 1/10 tem 4 disponíveis e máximo 4 por pedido
    await page.getByRole('radio', { name: '1/10', exact: true }).click()
    await expect(page.getByTestId('edition-availability')).toContainText('4 disponíveis')
    const inc = page.getByRole('button', { name: 'Aumentar quantidade' })
    for (let i = 0; i < 5; i++) if (await inc.isEnabled()) await inc.click()
    await expect(page.getByRole('spinbutton', { name: 'Quantidade' })).toHaveValue('4')
    await expect(inc).toBeDisabled()
  })

  test('edição indisponível não pode ser selecionada', async ({ page }) => {
    await gotoApp(page, '/nft/nft-003')
    await expect(page.getByRole('heading', { level: 1, name: 'Neon Vessel #552' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /1\/1.*esgotada/ })).toBeDisabled()
  })

  test('NFT esgotado bloqueia a compra', async ({ page }) => {
    await gotoApp(page, '/nft/nft-013')
    await expect(page.getByRole('button', { name: 'Esgotado' })).toBeDisabled()
  })

  test('NFT inexistente mostra 404 e rota inexistente também', async ({ page }) => {
    await gotoApp(page, '/nft/nao-existe')
    await expect(page.getByTestId('not-found')).toContainText('NFT não encontrado')
    await page.goto('/rota/que/nao/existe')
    await expect(page.getByTestId('not-found')).toContainText('Página não encontrada')
  })
})
