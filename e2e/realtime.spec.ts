import { addToCartViaDetail, expect, gotoApp, goToCheckout, loginAPI, loginUI, openReview, test, USERS, waitSocket } from './fixtures'

test.describe('Tempo real (Socket.IO via MSW)', () => {
  test('preço muda com o NFT no carrinho: aviso, resumo e checkout bloqueado até revisar', async ({ page, mock }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'ana')
    await waitSocket(page, USERS.ana.id)
    await addToCartViaDetail(page, 'nft-001', 1)
    await expect(page.getByTestId('summary-total')).toHaveText('1.206 ETH')

    // Mudança no "servidor" → evento nft.updated → socket.io-client → cache
    await mock.updateNft('nft-001', { price: '1.50' })
    await expect(page.getByText('Item do carrinho atualizado')).toBeVisible()
    await expect(page.getByTestId('quote-issues')).toContainText('mudou de 1.19 ETH para 1.50 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText('1.516 ETH')
    await expect(page.getByTestId('checkout-button')).toBeDisabled()
    await page.getByRole('button', { name: 'Entendi, atualizar carrinho' }).click()
    await expect(page.getByTestId('checkout-button')).toBeEnabled()

    // No checkout: nova alteração bloqueia "Confirmar compra"
    await goToCheckout(page)
    await mock.updateNft('nft-001', { price: '1.60' })
    await expect(page.getByTestId('quote-issues')).toContainText('mudou de 1.50 ETH para 1.60 ETH')
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()
  })

  test('cotação desatualizada na confirmação (cenário price-change) exige nova confirmação', async ({ page, mock }) => {
    await gotoApp(page, '/', { scenario: 'price-change' })
    await loginAPI(page, 'ana')
    await waitSocket(page, USERS.ana.id)
    await mock.configure({ paymentDelayMs: 10 * 60_000 })
    await addToCartViaDetail(page, 'nft-001', 1)
    await goToCheckout(page)
    const review = await openReview(page)
    await review.getByTestId('pay-button').click()
    // Servidor rejeita (QUOTE_OUTDATED) e o evento chega pelo socket
    await expect(page.getByTestId('checkout-notice')).toContainText('mudaram')
    await expect(page.getByTestId('quote-issues')).toContainText('1.29 ETH')
    expect(await mock.orders()).toHaveLength(0)
    await page.getByRole('button', { name: 'Entendi, atualizar carrinho' }).click()
    await expect(page.getByTestId('confirm-purchase')).toBeEnabled()
    const review2 = await openReview(page)
    await expect(review2.getByTestId('summary-total')).toHaveText('1.306 ETH')
    await review2.getByTestId('pay-button').click()
    await expect(page).toHaveURL(/\/pedido\//)
  })

  test('alteração durante a revisão marca a cotação como desatualizada', async ({ page, mock }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'ana')
    await waitSocket(page, USERS.ana.id)
    await addToCartViaDetail(page, 'nft-005', 1)
    await goToCheckout(page)
    const review = await openReview(page)
    await mock.updateNft('nft-005', { editions: [{ id: 'e50', available: 0 }] })
    await expect(review.getByTestId('review-stale')).toBeVisible()
    await expect(review.getByTestId('pay-button')).toBeDisabled()
  })

  test('eventos duplicados e antigos não regridem o estado', async ({ page, mock }) => {
    await gotoApp(page, '/nft/nft-002')
    await waitSocket(page, null)
    await expect(page.getByTestId('detail-price')).toContainText('1.69 ETH')
    await mock.updateNft('nft-002', { price: '2.00' })
    await expect(page.getByTestId('detail-price')).toContainText('2.00 ETH')
    await expect(page.getByTestId('price-notice')).toContainText('de 1.69 ETH para 2.00 ETH')

    await mock.replayLastEvent() // duplicata (mesmo id/versão)
    await mock.sendStaleNftEvent('nft-002', '0.01') // versão anterior
    await page.waitForTimeout(500)
    await expect(page.getByTestId('detail-price')).toContainText('2.00 ETH')
    await expect(page.getByTestId('price-notice')).toContainText('de 1.69 ETH para 2.00 ETH')

    // Catálogo também reflete o evento
    await page.goto('/')
    await expect(page.getByRole('article', { name: 'Sage Nomad #009' })).toContainText('2.00 ETH')
  })

  test('desconexão com pedido pendente: reconexão/refresh recuperam o estado sem nova compra', async ({ page, mock }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'ana')
    await waitSocket(page, USERS.ana.id)
    await mock.configure({ paymentDelayMs: 10 * 60_000 })
    await addToCartViaDetail(page, 'nft-007', 1)
    await goToCheckout(page)
    const review = await openReview(page)
    await review.getByTestId('pay-button').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const [order] = await mock.orders()

    await mock.setSocketOffline(true)
    await page.reload()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await mock.settleOrder(order.id, 'confirm') // evento perdido: socket offline
    await mock.setSocketOffline(false)
    // Reconexão → reconciliação via REST (ou polling de fallback)
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
    expect(await mock.orders()).toHaveLength(1)
    // Terminal: nova tentativa de liquidação não altera o estado
    await mock.settleOrder(order.id, 'decline')
    await page.reload()
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
  })

  test('eventos da sessão anterior não alcançam outro usuário', async ({ page, mock }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'ana')
    await waitSocket(page, USERS.ana.id)
    await mock.configure({ paymentDelayMs: 10 * 60_000 })
    await addToCartViaDetail(page, 'nft-007', 1)
    await goToCheckout(page)
    const review = await openReview(page)
    await review.getByTestId('pay-button').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const [order] = await mock.orders()

    await page.goto('/perfil')
    await page.getByTestId('logout').click()
    await loginUI(page, 'bruno')
    await waitSocket(page, USERS.bruno.id)
    await mock.settleOrder(order.id, 'confirm')
    await page.waitForTimeout(400)
    await expect(page.getByText('Pedido confirmado')).toHaveCount(0)
    await page.goto(`/pedido/${order.id}`)
    await expect(page.getByTestId('not-found')).toContainText('Pedido não encontrado')
  })
})
