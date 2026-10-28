import { expect, gotoApp, test } from './fixtures'

test.describe('Acessibilidade e teclado', () => {
  test('pular para o conteúdo e foco visível', async ({ page }) => {
    await gotoApp(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#conteudo/)
  })

  test('diálogo de login: foco preso, Esc fecha e foco retorna ao gatilho @desktop-only', async ({ page }) => {
    await gotoApp(page, '/')
    const trigger = page.getByRole('banner').getByRole('button', { name: 'Entrar' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dlg = page.getByRole('dialog')
    await expect(dlg).toBeVisible()
    // Tab percorre apenas elementos do diálogo
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dlg).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('menu mobile (drawer) controla o foco', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'Drawer só existe no mobile')
    await gotoApp(page, '/mercado')
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    const drawer = page.getByRole('dialog', { name: 'MENU' })
    await expect(drawer).toBeVisible()
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused()
  })

  test('formulário de login: erros associados e foco no campo inválido', async ({ page }) => {
    await gotoApp(page, '/entrar')
    const dlg = page.getByRole('dialog')
    await dlg.getByRole('button', { name: 'Entrar', exact: true }).last().click()
    const email = dlg.getByRole('textbox', { name: 'E-mail' })
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(/E-mail é obrigatório/)
  })

  test('navegação do catálogo por teclado até o detalhe', async ({ page }) => {
    await gotoApp(page, '/')
    await page.getByRole('searchbox', { name: /Buscar NFTs/ }).focus()
    await page.keyboard.type('Ivory')
    await expect(page).toHaveURL(/q=Ivory/)
    const link = page.getByRole('link', { name: 'Ivory Baron #088', exact: true })
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Ivory Baron #088' })).toBeVisible()
    // Edições navegáveis por setas (radiogroup)
    const checked = page.getByRole('radio', { checked: true })
    await checked.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: 'Aberta', exact: true })).toBeFocused()
  })

  test('sem overflow horizontal @responsive', async ({ page }) => {
    for (const path of ['/', '/nft/nft-001', '/carrinho', '/entrar']) {
      await gotoApp(page, path)
      await page.waitForTimeout(400)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `overflow em ${path}`).toBeLessThanOrEqual(0)
    }
  })
})
