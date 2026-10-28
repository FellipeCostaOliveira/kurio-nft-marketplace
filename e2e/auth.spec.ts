import { expect, gotoApp, loginAPI, loginUI, test, USERS, waitSocket } from './fixtures'

test.describe('Conta e sessão', () => {
  test('cadastro valida campos, trata conflito e cria a conta', async ({ page }) => {
    await gotoApp(page, '/cadastro')
    const dlg = page.getByRole('dialog')
    await expect(dlg.getByRole('button', { name: /^Criar (conta|perfil)$/ }).last()).toBeVisible()
    await dlg.getByRole('button', { name: /^Criar (conta|perfil)$/ }).last().click()
    // Erros associados aos campos e foco no primeiro inválido
    const username = dlg.getByPlaceholder('Nome de usuário')
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    await expect(username).toBeFocused()
    await expect(dlg.getByText('Nome de usuário é obrigatório.')).toBeVisible()

    await username.fill('novo.colecionador')
    await dlg.getByPlaceholder('Digite seu e-mail').fill(USERS.ana.email)
    await dlg.getByPlaceholder('Senha', { exact: true }).fill('Fraca1')
    await dlg.getByPlaceholder('Confirmar senha').fill('Fraca2')
    await dlg.getByRole('button', { name: /^Criar (conta|perfil)$/ }).last().click()
    await expect(dlg.getByText('A senha precisa ter ao menos 8 caracteres.')).toBeVisible()
    await expect(dlg.getByText('As senhas não conferem.')).toBeVisible()

    await dlg.getByPlaceholder('Senha', { exact: true }).fill('Nova@2026')
    await dlg.getByPlaceholder('Confirmar senha').fill('Nova@2026')
    await dlg.getByRole('button', { name: /^Criar (conta|perfil)$/ }).last().click()
    // Conflito vindo da API (e-mail já cadastrado)
    await expect(dlg.getByText('Já existe uma conta com este e-mail.').first()).toBeVisible()

    await dlg.getByPlaceholder('Digite seu e-mail').fill('novo@kurio.test')
    await dlg.getByRole('button', { name: /^Criar (conta|perfil)$/ }).last().click()
    await expect(dlg).toBeHidden()
    await expect(page).toHaveURL('/')
    await page.goto('/perfil')
    await expect(page.getByLabel(/Nome de usuário/)).toHaveValue('novo.colecionador')
  })

  test('login com erro, sucesso e retorno ao fluxo anterior', async ({ page }) => {
    await gotoApp(page, '/perfil/carteiras')
    // rota protegida → /entrar com redirect
    await expect(page).toHaveURL(/\/entrar\?redirect=/)
    const dlg = page.getByRole('dialog')
    await dlg.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await dlg.getByPlaceholder('Senha').fill('errada')
    await dlg.getByRole('button', { name: 'Entrar', exact: true }).last().click()
    await expect(dlg.getByText('E-mail ou senha incorretos.').first()).toBeVisible()
    await dlg.getByPlaceholder('Senha').fill(USERS.ana.password)
    await dlg.getByRole('button', { name: 'Entrar', exact: true }).last().click()
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  })

  test('sessão recuperada após refresh e expiração durante a navegação preserva o contexto', async ({ page, mock }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'ana')
    await page.goto('/perfil')
    await expect(page.getByLabel(/Nome de exibição/)).toHaveValue(USERS.ana.name)
    await page.reload()
    await expect(page.getByLabel(/Nome de exibição/)).toHaveValue(USERS.ana.name)

    await mock.expireSessions()
    await page.getByLabel(/Nome de exibição/).fill('Ana Editada')
    await page.getByRole('button', { name: 'Salvar' }).click()
    const dlg = page.getByRole('dialog')
    await expect(dlg.getByText('Sua sessão expirou')).toBeVisible()
    await dlg.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await dlg.getByPlaceholder('Senha').fill(USERS.ana.password)
    await dlg.getByRole('button', { name: 'Entrar', exact: true }).last().click()
    await expect(dlg).toBeHidden()
    await expect(page).toHaveURL(/\/perfil$/)
  })

  test('sessão expira pelo relógio (TTL) e pede novo login', async ({ page }) => {
    await page.clock.install()
    await gotoApp(page, '/', { scenario: 'session-expired' })
    await loginAPI(page, 'ana')
    await page.goto('/perfil')
    await expect(page.getByLabel(/Nome de exibição/)).toHaveValue(USERS.ana.name)
    await page.clock.fastForward(25_000)
    await page.reload()
    await expect(page.getByRole('dialog').getByText('Sua sessão expirou')).toBeVisible()
  })

  test('logout e troca de usuário limpam dados privados e subscriptions', async ({ page }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'ana')
    await waitSocket(page, USERS.ana.id)
    await page.goto('/perfil/favoritos')
    await expect(page.getByTestId('favorites-grid').getByText('Sage Nomad #009')).toBeVisible()

    await page.getByTestId('logout').click()
    await expect(page.getByTestId('auth-required')).toBeVisible()
    // Socket da sessão anterior encerrado e substituído por conexão anônima
    await waitSocket(page, null)
    expect((await page.evaluate(() => window.__kurio!.socketClients())).some((c) => c.userId === USERS.ana.id)).toBe(false)
    // Cache privado removido
    const cachedKeys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k === 'kurio.session'))
    expect(cachedKeys).toHaveLength(0)

    await loginUI(page, 'bruno')
    await waitSocket(page, USERS.bruno.id)
    await page.goto('/perfil/favoritos')
    await expect(page.getByTestId('favorites-grid').getByText('Golden Beat #207')).toBeVisible()
    await expect(page.getByText('Sage Nomad #009')).toHaveCount(0)
  })
})
