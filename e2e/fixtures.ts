import { test as base, expect, type Page } from '@playwright/test'

/** Usuários fictícios dos fixtures do MSW (senha só existe como hash nos mocks). */
export const USERS = {
  ana: { email: 'ana@kurio.test', password: 'Kurio@2026', name: 'Ana Ribeiro', id: 'usr_ana' },
  bruno: { email: 'bruno@kurio.test', password: 'Kurio@2026', name: 'Bruno Sato', id: 'usr_bruno' },
} as const

type ScenarioName = string

/** Acesso ao controle do servidor simulado (window.__kurio). Os efeitos chegam ao app via REST/Socket.IO. */
export class MockApi {
  constructor(private readonly page: Page) {}
  async ready() {
    await this.page.waitForFunction(() => !!window.__kurio)
  }
  async call<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
    await this.ready()
    return this.page.evaluate(
      ({ method, args }) => {
        const k = window.__kurio as unknown as Record<string, (...a: unknown[]) => unknown>
        return k[method](...args) as never
      },
      { method, args },
    ) as Promise<T>
  }
  scenario(name: ScenarioName) {
    return this.call('setScenario', name)
  }
  configure(partial: Record<string, unknown>) {
    return this.call('configure', partial)
  }
  updateNft(id: string, patch: { price?: string; editions?: Array<{ id: string; available: number }> }) {
    return this.call('updateNft', id, patch)
  }
  nft(id: string) {
    return this.call<{ price: string; version: number; totalAvailable: number }>('nft', id)
  }
  orders() {
    return this.call<Array<{ id: string; status: string; userId: string; idempotencyKey: string }>>('orders')
  }
  settleOrder(id: string, outcome: 'confirm' | 'decline') {
    return this.call('settleOrder', id, outcome)
  }
  replayLastEvent() {
    return this.call('replayLastEvent')
  }
  sendStaleNftEvent(id: string, price: string) {
    return this.call('sendStaleNftEvent', id, price)
  }
  dropSockets() {
    return this.call('dropSockets')
  }
  setSocketOffline(offline: boolean) {
    return this.call('setSocketOffline', offline)
  }
  socketClients() {
    return this.call<Array<{ id: number; userId: string | null }>>('socketClients')
  }
  expireSessions() {
    return this.call('expireSessions')
  }
}

export async function gotoApp(page: Page, path = '/', opts: { scenario?: ScenarioName } = {}) {
  const url = new URL(path, 'http://x')
  url.searchParams.set('mock-reset', '1')
  if (opts.scenario) url.searchParams.set('scenario', opts.scenario)
  await page.goto(`${url.pathname}${url.search}${url.hash}`)
  await page.waitForFunction(() => !!window.__kurio)
}

export async function waitSocket(page: Page, userId: string | null = null) {
  await expect
    .poll(async () => page.evaluate((uid) => window.__kurio?.socketClients().some((c) => c.userId === uid) ?? false, userId), { timeout: 10_000 })
    .toBe(true)
}

/** Login pela UI (diálogo). */
export async function loginUI(page: Page, user: keyof typeof USERS) {
  const u = USERS[user]
  const dialog = page.getByRole('dialog')
  if (!(await dialog.isVisible())) {
    const mobile = (page.viewportSize()?.width ?? 1440) < 768
    if (mobile) {
      // Mobile (Figma): entrada pela barra inferior; telas imersivas usam a rota /entrar.
      const nav = page.getByRole('navigation', { name: 'Navegação inferior' })
      const navLogin = nav.getByRole('button', { name: 'Entrar' })
      if (await nav.isVisible()) {
        await expect(navLogin).toBeVisible()
        await navLogin.click()
      }
      else {
        const back = new URL(page.url()).pathname
        await page.goto(`/entrar?redirect=${encodeURIComponent(back)}`)
      }
    } else {
      const btn = page.getByRole('banner').getByRole('button', { name: 'Entrar', exact: true })
      await expect(btn).toBeVisible()
      await btn.click()
    }
  }
  await page.getByRole('dialog').getByPlaceholder('contato@email.com').fill(u.email)
  await page.getByRole('dialog').getByPlaceholder('Senha').fill(u.password)
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true }).last().click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

/** Login programático via API simulada (para testes que não exercitam o formulário). */
export async function loginAPI(page: Page, user: keyof typeof USERS) {
  const u = USERS[user]
  await page.waitForFunction(() => !!window.__kurio)
  await page.evaluate(async ({ email, password }) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const s = await r.json()
    localStorage.setItem('kurio.session', JSON.stringify(s))
  }, u)
  await page.reload()
  await page.waitForFunction(() => !!window.__kurio)
}

export async function addToCartViaDetail(page: Page, nftId: string, qty = 1) {
  await page.goto(`/nft/${nftId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
  for (let i = 1; i < qty; i++) await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
}

/** Do carrinho até o formulário de pagamento já pré-preenchido. */
export async function goToCheckout(page: Page, expectedName: string = USERS.ana.name) {
  if (!/\/carrinho$/.test(page.url())) await page.goto('/carrinho')
  await page.getByTestId('checkout-button').click()
  await expect(page).toHaveURL(/\/pagamento$/)
  // Mobile: dados do colecionador ficam numa seção recolhível.
  const toggle = page.getByTestId('collector-toggle')
  if ((page.viewportSize()?.width ?? 1440) < 768) {
    await expect(toggle).toBeVisible()
    const open = await toggle.evaluate((el) => (el.parentElement as HTMLDetailsElement).open)
    if (!open) await toggle.click()
  }
  await expect(page.getByRole('textbox', { name: /Nome de exibição/ })).toHaveValue(expectedName)
  await expect(page.getByTestId('confirm-purchase')).toBeEnabled()
}

export async function openReview(page: Page, connect = true) {
  await page.getByTestId('confirm-purchase').click()
  const review = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(review).toBeVisible()
  if (connect) {
    const status = review.getByTestId('wallet-connection')
    if (!(await status.textContent())?.includes('Carteira conectada')) await review.getByTestId('connect-wallet').click()
    await expect(status).toContainText('Carteira conectada')
  }
  return review
}

export const test = base.extend<{ mock: MockApi }>({
  mock: async ({ page }, use) => {
    await use(new MockApi(page))
  },
})

export { expect }
