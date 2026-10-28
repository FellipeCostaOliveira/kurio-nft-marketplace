import { addToCartViaDetail, expect, gotoApp, loginUI, test } from './fixtures'

test.describe('Carrinho', () => {
  test('quantidades, remoção, cupom e totais coerentes com a API', async ({ page }) => {
    await gotoApp(page, '/')
    await addToCartViaDetail(page, 'nft-001', 2)
    await addToCartViaDetail(page, 'nft-005', 1)
    const rows = page.getByTestId('cart-row')
    await expect(rows).toHaveCount(2)
    await expect(page.getByTestId('summary-subtotal')).toHaveText('3.77 ETH') // 2×1.19 + 1.39

    await rows.nth(1).getByRole('button', { name: /Aumentar quantidade/ }).click()
    await expect(page.getByTestId('summary-subtotal')).toHaveText('5.16 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText('5.176 ETH') // + 0.016 taxa

    // Cupom inválido / expirado / válido / remoção
    const code = page.getByPlaceholder('Digite o código promocional...')
    await code.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByTestId('coupon-error')).toHaveText('O cupom NAOEXISTE é inválido.')
    await code.fill('lancamento')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByTestId('coupon-error')).toHaveText('O cupom LANCAMENTO expirou.')
    await code.fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByTestId('coupon-applied')).toContainText('KURIO10')
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0.516 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText('4.66 ETH')
    await page.getByTestId('coupon-applied').getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0.00 ETH')

    // Remoção
    await rows.first().getByRole('button', { name: /Remover Emerald Ape/ }).click()
    await expect(rows).toHaveCount(1)
    await expect(page.getByTestId('summary-subtotal')).toHaveText('2.78 ETH')
  })

  test('falha transitória ao aplicar cupom e nova tentativa', async ({ page }) => {
    await gotoApp(page, '/', { scenario: 'coupon-error' })
    await addToCartViaDetail(page, 'nft-007', 1)
    await page.getByPlaceholder('Digite o código promocional...').fill('GENESIS5')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByTestId('coupon-error')).toContainText('temporariamente indisponível')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByTestId('coupon-applied')).toContainText('GENESIS5')
  })

  test('persiste após refresh e preserva itens do visitante ao autenticar', async ({ page }) => {
    await gotoApp(page, '/')
    await addToCartViaDetail(page, 'nft-006', 3)
    await page.reload()
    await expect(page.getByTestId('cart-row')).toHaveCount(1)
    await expect(page.getByTestId('item-qty')).toHaveText('3')

    await loginUI(page, 'ana')
    await expect(page.getByTestId('cart-row')).toHaveCount(1)
    await expect(page.getByTestId('item-qty')).toHaveText('3')
    await page.reload()
    await expect(page.getByTestId('cart-row')).toHaveCount(1)
    // Desktop: badge do header; mobile: a tela do carrinho não tem header (Figma).
    if ((page.viewportSize()?.width ?? 1440) >= 768) await expect(page.getByTestId('cart-count')).toHaveText('3')
    else await expect(page.getByTestId('item-qty')).toHaveText('3')
  })

  test('respeita a disponibilidade por edição (409 da API)', async ({ page, mock }) => {
    await gotoApp(page, '/')
    await page.goto('/nft/nft-001')
    await page.getByRole('radio', { name: '1/1', exact: true }).click()
    // estoque muda no "servidor" antes do clique
    await mock.updateNft('nft-001', { editions: [{ id: 'e1', available: 1 }] })
    await page.getByRole('button', { name: 'Comprar' }).click()
    await expect(page).toHaveURL(/carrinho/)
    await page.goto('/nft/nft-001')
    await page.getByRole('radio', { name: '1/1', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Limite no carrinho' })).toBeDisabled()
  })
})
