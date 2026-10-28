/**
 * Lê ?scenario=<nome> e ?mock-reset=1 de forma síncrona (antes do router) e os
 * repassa à camada de mocks, removendo-os da URL.
 */
export const PENDING_KEY = 'kurio.mock.pending'

export function consumeMockUrlParams() {
  try {
    const url = new URL(window.location.href)
    const scenario = url.searchParams.get('scenario')
    const reset = url.searchParams.get('mock-reset')
    if (!scenario && !reset) return
    localStorage.setItem(PENDING_KEY, JSON.stringify({ scenario, reset: !!reset }))
    url.searchParams.delete('scenario')
    url.searchParams.delete('mock-reset')
    window.history.replaceState(window.history.state, '', url)
  } catch {
    /* ignora */
  }
}
