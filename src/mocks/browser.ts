/**
 * Ponto de entrada da camada de mocks (carregado dinamicamente por main.tsx
 * somente quando VITE_ENABLE_MOCKS=true).
 */
import { setupWorker } from 'msw/browser'
import { setBeforeRequestGate } from '@/lib/ready'
import { controlHandlers, mockControl } from './control'
import { resumePendingOrders } from './db'
import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { cartHandlers } from './handlers/cart'
import { catalogHandlers } from './handlers/catalog'
import { orderHandlers } from './handlers/orders'
import { isScenarioName } from './scenarios'
import { socketHandlers } from './socket'
import { PENDING_KEY } from './url-params'

export const handlers = [
  ...controlHandlers,
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
  ...socketHandlers,
]

export async function startMocks() {
  // ?scenario=<nome> e ?mock-reset=1 (capturados por url-params.ts antes do router).
  const pendingRaw = localStorage.getItem(PENDING_KEY)
  if (pendingRaw) {
    localStorage.removeItem(PENDING_KEY)
    const { scenario, reset } = JSON.parse(pendingRaw) as { scenario: string | null; reset: boolean }
    if (reset) mockControl.reset(isScenarioName(scenario) ? scenario : 'default')
    else if (isScenarioName(scenario)) mockControl.setScenario(scenario)
  }

  const worker = setupWorker(...handlers)
  await worker.start({
    quiet: true,
    onUnhandledRequest(request, print) {
      const { pathname } = new URL(request.url)
      if (pathname.startsWith('/api')) print.warning()
    },
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  resumePendingOrders()
  keepWorkerAttached()
  window.__kurio = mockControl
  return worker
}

/**
 * O mockServiceWorker.js guarda em memória quais abas deve atender. Quando o navegador
 * encerra o Service Worker por inatividade (ex.: aba em segundo plano), essa lista se perde
 * e as chamadas passariam direto para o servidor (404). Antes de cada requisição — e ao
 * voltar para a aba — reenviamos MOCK_ACTIVATE e aguardamos a confirmação do worker.
 */
function keepWorkerAttached() {
  if (!('serviceWorker' in navigator)) return
  let lastConfirmed = Date.now()
  let pending: Promise<void> | null = null

  const activate = (): Promise<void> => {
    const sw = navigator.serviceWorker.controller
    if (!sw) return Promise.resolve()
    if (pending) return pending
    pending = new Promise<void>((resolve) => {
      const done = () => {
        navigator.serviceWorker.removeEventListener('message', onMessage)
        clearTimeout(timer)
        lastConfirmed = Date.now()
        pending = null
        resolve()
      }
      const onMessage = (event: MessageEvent) => {
        if ((event.data as { type?: string } | null)?.type === 'MOCKING_ENABLED') done()
      }
      const timer = setTimeout(done, 1500)
      navigator.serviceWorker.addEventListener('message', onMessage)
      sw.postMessage('MOCK_ACTIVATE')
    })
    return pending
  }

  // Confirmação recente (worker vivo pelos keepalives do MSW) dispensa a ida e volta.
  setBeforeRequestGate(() => (Date.now() - lastConfirmed < 4000 ? Promise.resolve() : activate()))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void activate()
  })
  window.addEventListener('focus', () => void activate())
  window.addEventListener('online', () => void activate())
}
