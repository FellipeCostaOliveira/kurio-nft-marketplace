import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { createQueryClient } from './app/queryClient'
import { createAppRouter } from './app/router'
import { markNetworkReady, networkReady } from './lib/ready'
import { consumeMockUrlParams } from './mocks/url-params'
import { startRealtime } from './realtime/realtime'
import './styles.css'

if (import.meta.env.VITE_ENABLE_MOCKS === 'true') consumeMockUrlParams()

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

void networkReady.then(() => startRealtime(queryClient))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)

// Camada de mocks ativada por configuração (também no build de demonstração).
// Inicia logo após o primeiro frame: o shell/hero pinta sem disputar banda com o MSW;
// requisições REST aguardam `networkReady` (ver src/api/http.ts).
if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
  requestAnimationFrame(() =>
    setTimeout(() => {
      import('./mocks/browser')
        .then(({ startMocks }) => startMocks())
        .catch((e) => console.error('[mocks] falha ao iniciar MSW', e))
        .finally(markNetworkReady)
    }, 0),
  )
} else {
  markNetworkReady()
}
