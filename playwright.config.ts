import { defineConfig, devices } from '@playwright/test'

/**
 * E2E + regressão visual com os mocks (MSW) do build de demonstração.
 * PW_CHROMIUM_PATH permite usar um Chromium já instalado (ambientes sem download).
 */
const executablePath = process.env.PW_CHROMIUM_PATH
const launchOptions = executablePath
  ? { executablePath, args: ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader'] }
  : {}
const PORT = Number(process.env.PORT ?? 4173)

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.015, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: Number(process.env.PW_WORKERS ?? 1),
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFileName}/{arg}{ext}',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    launchOptions,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions },
    },
    {
      name: 'chromium-mobile',
      // Viewport mobile de 390px (iPhone 12/13/14) em Chromium.
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, launchOptions },
      grepInvert: /@desktop-only/,
    },
    {
      name: 'chromium-tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, launchOptions },
      grep: /@responsive/,
    },
  ],
  webServer: {
    command: `npm run build:demo && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
