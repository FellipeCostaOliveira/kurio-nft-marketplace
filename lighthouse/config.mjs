/**
 * Configuração versionada da auditoria Lighthouse.
 * - Build otimizado (npm run build:demo) servido por `vite preview`.
 * - Cenário padrão dos mocks (MSW ativo, latência 60–180 ms).
 * - 3 medições por página e perfil; o relatório usa a mediana.
 */
export const BASE_URL = process.env.LH_BASE_URL ?? 'http://localhost:4173'
export const RUNS = Number(process.env.LH_RUNS ?? 3)

export const PAGES = [
  { id: 'inicio', path: '/' },
  { id: 'detalhe', path: '/nft/nft-001' },
]

export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

export const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }

/** Perfis: mobile = padrão do Lighthouse (Moto G Power, 4G lento simulado, CPU 4x);
 *  desktop = preset desktop oficial (1350×940, rede/CPU sem throttling agressivo). */
export const PROFILES = {
  mobile: {
    extends: 'lighthouse:default',
    settings: {
      onlyCategories: CATEGORIES,
      formFactor: 'mobile',
      throttlingMethod: 'simulate',
      screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
    },
  },
  desktop: {
    extends: 'lighthouse:default',
    settings: {
      onlyCategories: CATEGORIES,
      formFactor: 'desktop',
      throttlingMethod: 'simulate',
      throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
      screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
      emulatedUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    },
  },
}

export const CHROME_FLAGS = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run']
