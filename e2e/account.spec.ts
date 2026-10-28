import { expect, gotoApp, loginAPI, test, USERS } from './fixtures'

// PNG 1×1 válido para o upload de avatar
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test.describe('Perfil do colecionador', () => {
  test('edição com validação, conflito da API e persistência após refresh', async ({ page }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'ana')
    await page.goto('/perfil')
    const display = page.getByRole('textbox', { name: /Nome de exibição/ })
    await expect(display).toHaveValue(USERS.ana.name)

    await display.fill('')
    await page.getByRole('textbox', { name: /Nome ENS/ }).fill('Inválido!')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(display).toHaveAttribute('aria-invalid', 'true')
    await expect(display).toBeFocused()
    await expect(page.getByText('Nome de exibição é obrigatório.')).toBeVisible()
    await expect(page.getByText('Use letras minúsculas, números ou hífen (sem ".eth").')).toBeVisible()

    // Conflito retornado pela API (usuário de outra conta)
    await display.fill('Ana R.')
    await page.getByRole('textbox', { name: /Nome ENS/ }).fill('ana-r')
    await page.getByRole('textbox', { name: /Nome de usuário/ }).fill('bruno.cunhador')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Este nome de usuário já está em uso.').first()).toBeVisible()

    await page.getByRole('textbox', { name: /Nome de usuário/ }).fill('ana.r')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByTestId('profile-status')).toHaveText('Perfil atualizado.')
    await expect(page.getByTestId('user-menu')).toContainText('Ana R.')
    await page.reload()
    await expect(display).toHaveValue('Ana R.')
    await expect(page.getByRole('textbox', { name: /Nome de usuário/ })).toHaveValue('ana.r')
  })

  test('erros de validação vindos do servidor (cenário validation-error)', async ({ page }) => {
    await gotoApp(page, '/', { scenario: 'validation-error' })
    await loginAPI(page, 'ana')
    await page.goto('/perfil')
    await expect(page.getByRole('textbox', { name: /Nome de exibição/ })).toHaveValue(USERS.ana.name)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Este nome de usuário foi reservado pelo servidor.')).toBeVisible()
    await expect(page.getByRole('textbox', { name: /Nome de usuário/ })).toHaveAttribute('aria-invalid', 'true')
  })

  test('acesso não autorizado (403) mostra erro sem vazar dados', async ({ page }) => {
    await gotoApp(page, '/', { scenario: 'unauthorized' })
    await loginAPI(page, 'ana')
    await page.goto('/perfil')
    await expect(page.getByTestId('error-state')).toContainText('Você não tem permissão')
  })

  test('avatar: envio, formato inválido e remoção', async ({ page }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'ana')
    await page.goto('/perfil')
    await page.getByTestId('avatar-input').setInputFiles({ name: 'avatar.gif', mimeType: 'image/gif', buffer: PNG })
    await expect(page.getByText('Use uma imagem PNG, JPG ou WebP.')).toBeVisible()
    await page.getByTestId('avatar-input').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByTestId('avatar-img')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('avatar-img')).toHaveAttribute('src', /^data:image\/webp/)
    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByTestId('avatar-img')).toHaveCount(0)
  })

  test('alteração de senha: senha atual incorreta, sucesso e novo login', async ({ page }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'ana')
    await page.goto('/perfil')
    await expect(page.getByRole('textbox', { name: /Nome de exibição/ })).toHaveValue(USERS.ana.name)
    await page.getByLabel('Senha atual').fill('Errada@123')
    await page.getByLabel('Nova senha', { exact: true }).fill('Nova@2027')
    await page.getByLabel('Confirmar nova senha').fill('Nova@2026')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('As senhas não conferem.')).toBeVisible()
    await page.getByLabel('Confirmar nova senha').fill('Nova@2027')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha atual incorreta.').first()).toBeVisible()
    await page.getByLabel('Senha atual').fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByTestId('profile-status')).toHaveText('Perfil e senha atualizados.')

    // Nova senha passa a valer (a antiga não)
    const status = await page.evaluate(async () => {
      const call = (password: string) =>
        fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'ana@kurio.test', password }) }).then((r) => r.status)
      return [await call('Kurio@2026'), await call('Nova@2027')]
    })
    expect(status).toEqual([401, 200])
  })
})

test.describe('Carteiras', () => {
  test('edição da principal e cadastro da secundária com validação', async ({ page }) => {
    await gotoApp(page, '/')
    await loginAPI(page, 'bruno')
    await page.goto('/perfil/carteiras')
    const form = page.getByTestId('wallet-form-primary')
    await expect(form).toBeVisible()
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText('Apelido da carteira é obrigatório.')).toBeVisible()
    await expect(form.getByText('Selecione uma rede.')).toBeVisible()

    await form.getByRole('textbox', { name: /Apelido da carteira/ }).fill('Cofre do Bruno')
    await form.getByRole('combobox', { name: /Rede/ }).click()
    await page.getByRole('option', { name: 'Ethereum' }).click()
    await form.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0x123')
    await form.getByRole('combobox', { name: /Tipo de carteira/ }).click()
    await page.getByRole('option', { name: 'Phantom' }).click()
    await form.getByRole('textbox', { name: /Código de indicação/ }).fill('BRUNO01')
    await form.getByRole('textbox', { name: /Nome ENS/ }).fill('brunosato')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText('Informe um endereço 0x com 40 caracteres hexadecimais.')).toBeVisible()
    await expect(form.getByText('Phantom está disponível apenas na rede Solana.')).toBeVisible()

    await form.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0xAbC0000000000000000000000000000000000001')
    await form.getByRole('combobox', { name: /Tipo de carteira/ }).click()
    await page.getByRole('option', { name: 'MetaMask' }).click()
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('wallet-summary-primary')).toContainText('Cofre do Bruno')

    // Secundária igual à principal: API recusa sem a flag, aceita com "Igual à carteira principal"
    await page.getByRole('button', { name: 'Adicionar' }).click()
    const sec = page.getByTestId('wallet-form-secondary')
    await sec.getByRole('textbox', { name: /Apelido da carteira/ }).fill('Reserva')
    await sec.getByRole('combobox', { name: /Rede/ }).click()
    await page.getByRole('option', { name: 'Ethereum' }).click()
    await sec.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0xAbC0000000000000000000000000000000000001')
    await sec.getByRole('combobox', { name: /Tipo de carteira/ }).click()
    await page.getByRole('option', { name: 'Coinbase Wallet' }).click()
    await sec.getByRole('textbox', { name: /Código de indicação/ }).fill('BRUNO01')
    await sec.getByRole('textbox', { name: /Nome ENS/ }).fill('brunosato')
    await sec.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('wallet-error-secondary')).toContainText('já está cadastrado como carteira principal')

    await page.getByRole('checkbox', { name: 'Igual à carteira principal' }).click()
    await page.getByTestId('wallet-form-secondary').getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('wallet-summary-secondary')).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('wallet-summary-primary')).toContainText('Cofre do Bruno')
    await expect(page.getByTestId('wallet-summary-secondary')).toBeVisible()
  })
})
