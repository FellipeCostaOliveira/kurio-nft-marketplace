/**
 * Portão de rede (infraestrutura, sem regra de negócio).
 * - `networkReady`: com mocks ativos, as requisições aguardam o Service Worker do MSW subir;
 *   a interface (hero, layout, skeletons) já renderiza antes, preservando o LCP.
 * - `beforeRequest`: gancho opcional que a camada de mocks registra para garantir que o
 *   Service Worker continua atendendo esta aba antes de cada chamada (ver mocks/browser.ts).
 */
let resolveReady: () => void = () => {}
export const networkReady: Promise<void> = new Promise((r) => {
  resolveReady = r
})
export function markNetworkReady() {
  resolveReady()
}

let gate: (() => Promise<void>) | null = null
export function setBeforeRequestGate(fn: () => Promise<void>) {
  gate = fn
}

/** Aguarda a rede ficar pronta (e, com mocks, confirma que o worker atende esta aba). */
export async function beforeRequest(): Promise<void> {
  await networkReady
  if (gate) await gate()
}
