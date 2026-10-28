import type { Page } from '@playwright/test'
import { addToCartViaDetail, expect, gotoApp, goToCheckout, loginAPI, MockApi, openReview, test, USERS, waitSocket } from './fixtures'

async function setup(page: Page, mock: MockApi, scenario?: string) {
  await gotoApp(page, '/', { scenario })
  await loginAPI(page, 'ana')
  await waitSocket(page, USERS.ana.id)
  // Liquidação manual: o teste decide quando a "rede" confirma/recusa.
  await mock.configure({ paymentDelayMs: 10 * 60_000 })
}

test.describe('Pagamento e confirmação', () => {
  test('compra completa do catálogo ao recibo confirmado', async ({ page, mock }) => {
    await setup(page, mock)
    await page.goto('/')
    await page.getByRole('link', { name: 'Emerald Ape #042' }).first().click()
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await page.getByRole('button', { name: 'Comprar' }).click()
    await expect(page).toHaveURL(/carrinho/)
    await goToCheckout(page)
    const review = await openReview(page)
    await expect(review.getByTestId('summary-total')).toHaveText('2.396 ETH')
    await review.getByTestId('pay-button').click()

    await expect(page).toHaveURL(/\/pedido\//)
    await expect(page.getByTestId('order-pending')).toContainText('Aguardando confirmação')
    // Confirmação só aparece após resposta da simulação
    await expect(page.getByTestId('receipt-total')).toHaveCount(0)

    // Enquanto pendente, o usuário adiciona mais 1 unidade: só o comprado sai do carrinho.
    const [order] = await mock.orders()
    await addToCartViaDetail(page, 'nft-001', 1)
    await expect(page.getByTestId('item-qty')).toHaveText('3')
    await page.goto(`/pedido/${order.id}`)
    await mock.settleOrder(order.id, 'confirm')
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible()
    await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')
    await expect(page.getByTestId('receipt-lines')).toContainText('Emerald Ape #042')
    await expect(page.getByTestId('tx-id')).toHaveText(/^0x/)

    // Recibo é snapshot: mudança no catálogo não altera os valores
    await mock.updateNft('nft-001', { price: '9.99' })
    await page.reload()
    await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')

    await page.goto('/carrinho')
    await expect(page.getByTestId('item-qty')).toHaveText('1')

    // Explorador simulado
    await page.goto(`/pedido/${order.id}`)
    await page.getByRole('link', { name: /Ver no Etherscan/ }).click()
    await expect(page.getByTestId('explorer-hash')).toHaveText(/^0x/)
  })

  test('pagamento recusado preserva os itens no carrinho', async ({ page, mock }) => {
    await setup(page, mock, 'payment-declined')
    await mock.configure({ paymentDelayMs: 300 })
    await addToCartViaDetail(page, 'nft-006', 2)
    await goToCheckout(page)
    const review = await openReview(page)
    await review.getByTestId('pay-button').click()
    await expect(page.getByTestId('order-declined')).toContainText('Pagamento recusado')
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('item-qty')).toHaveText('2')
  })

  test('clique repetido não duplica o pedido', async ({ page, mock }) => {
    await setup(page, mock)
    await addToCartViaDetail(page, 'nft-007', 1)
    await goToCheckout(page)
    const review = await openReview(page)
    await review.getByTestId('pay-button').dblclick()
    await expect(page).toHaveURL(/\/pedido\//)
    expect(await mock.orders()).toHaveLength(1)
  })

  test('timeout após criar o pedido recupera o mesmo pedido por idempotência', async ({ page, mock }) => {
    test.setTimeout(60_000)
    await setup(page, mock, 'order-timeout')
    await mock.configure({ paymentDelayMs: 10 * 60_000 })
    await addToCartViaDetail(page, 'nft-007', 1)
    await goToCheckout(page)
    const review = await openReview(page)
    await review.getByTestId('pay-button').click()
    await expect(review.getByTestId('order-verifying')).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/pedido\//, { timeout: 20_000 })
    const orders = await mock.orders()
    expect(orders).toHaveLength(1)
    expect(page.url()).toContain(orders[0].id)

    // Refresh durante pendente não cria outra compra; /pagamento avisa sobre o pedido em andamento
    await page.reload()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await page.goto('/pagamento')
    await expect(page.getByTestId('pending-order-banner')).toBeVisible()
    expect(await mock.orders()).toHaveLength(1)
  })

  test('carteira: recusa de conexão e desconexão no envio', async ({ page, mock }) => {
    await setup(page, mock, 'wallet-rejected')
    await addToCartViaDetail(page, 'nft-007', 1)
    await goToCheckout(page)
    const review = await openReview(page, false)
    await review.getByTestId('connect-wallet').click()
    await expect(review.getByTestId('wallet-connection')).toContainText('A conexão foi recusada')
    await expect(review.getByTestId('pay-button')).toBeDisabled()
    await review.getByTestId('connect-wallet').click()
    await expect(review.getByTestId('wallet-connection')).toContainText('Carteira conectada')

    await mock.scenario('wallet-disconnect')
    await mock.configure({ paymentDelayMs: 10 * 60_000 })
    await review.getByTestId('pay-button').click()
    await expect(review.getByTestId('order-error')).toContainText('A carteira foi desconectada')
    await review.getByTestId('connect-wallet').click()
    await expect(review.getByTestId('wallet-connection')).toContainText('Carteira conectada')
    await review.getByTestId('pay-button').click()
    await expect(page).toHaveURL(/\/pedido\//)
    expect(await mock.orders()).toHaveLength(1)
  })

  test('validação dos campos do layout antes da revisão', async ({ page, mock }) => {
    await setup(page, mock)
    await addToCartViaDetail(page, 'nft-007', 1)
    await goToCheckout(page)
    await page.getByRole('textbox', { name: 'E-mail (obrigatório)' }).fill('invalido')
    await page.getByRole('textbox', { name: /Código de indicação/ }).fill('!')
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('checkout-notice')).toContainText('Revise os campos destacados')
    await expect(page.getByRole('textbox', { name: 'E-mail (obrigatório)' })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
    await expect(page.getByText('Use de 4 a 12 letras ou números.')).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Revise seu pedido' })).toBeHidden()
  })

  test('sessão expira durante o checkout e o contexto é preservado após novo login', async ({ page, mock }) => {
    await setup(page, mock)
    await addToCartViaDetail(page, 'nft-007', 1)
    await goToCheckout(page)
    const note = page.getByRole('textbox', { name: /Observação do colecionador/ })
    await note.fill('Entregar na carteira principal')
    await page.waitForTimeout(300)
    await mock.expireSessions()
    await page.getByTestId('confirm-purchase').click()
    const dlg = page.getByRole('dialog')
    await expect(dlg.getByText('Sua sessão expirou')).toBeVisible()
    await dlg.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await dlg.getByPlaceholder('Senha').fill(USERS.ana.password)
    await dlg.getByRole('button', { name: 'Entrar', exact: true }).last().click()
    await expect(dlg).toBeHidden()
    await expect(page).toHaveURL(/\/pagamento$/)
    const toggle = page.getByTestId('collector-toggle')
    if ((page.viewportSize()?.width ?? 1440) < 768) await toggle.click()
    await expect(page.getByRole('textbox', { name: /Observação do colecionador/ })).toHaveValue('Entregar na carteira principal')
  })
})
