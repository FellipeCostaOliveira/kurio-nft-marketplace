/**
 * Controle dos mocks para demonstração e testes. Toda ação altera o "servidor" simulado;
 * os efeitos chegam ao app apenas por REST (MSW) e Socket.IO (socket.io-client).
 * Disponível como window.__kurio e como endpoints REST em /api/__mock/*.
 */
import { http, HttpResponse } from 'msw'
import type { NftUpdatedEvent } from '@/api/contracts'
import { expireAllSessions, nftSummary, resetDb, settleOrder, state, updateNft } from './db'
import { API } from './handlers/api-base'
import { config, setConfig } from './network'
import { bus } from './realtime-bus'
import { isScenarioName, scenarioConfig, SCENARIOS, type MockConfig, type ScenarioName } from './scenarios'
import { socketControl } from './socket'

export const mockControl = {
  scenarios: SCENARIOS,
  getConfig: (): MockConfig => structuredClone(config),
  reset(scenario: ScenarioName = 'default') {
    resetDb()
    bus.clearHistory()
    setConfig(scenarioConfig(scenario))
    socketControl.dropAll()
    return mockControl.getConfig()
  },
  setScenario(name: ScenarioName) {
    if (!isScenarioName(name)) throw new Error(`Cenário desconhecido: ${name}`)
    setConfig(scenarioConfig(name))
    if (config.socketOffline) socketControl.dropAll()
    return mockControl.getConfig()
  },
  configure(partial: Partial<MockConfig>) {
    setConfig({ ...config, ...partial })
    if (partial.socketOffline) socketControl.dropAll()
    return mockControl.getConfig()
  },
  updateNft(id: string, patch: { price?: string; editions?: Array<{ id: string; available: number }> }) {
    updateNft(id, patch)
    return nftSummary(id)
  },
  /** Reenvia o último evento publicado (mesmo id e versão) — teste de duplicatas. */
  replayLastEvent() {
    return bus.replay(-1)
  },
  /** Envia um nft.updated com versão anterior à atual — teste de eventos antigos. */
  sendStaleNftEvent(id: string, price = '0.01') {
    const current = state.nftState[id]
    const summary = nftSummary(id)!
    const event: NftUpdatedEvent = {
      id: `evt_stale_${id}_${Date.now()}`,
      type: 'nft.updated',
      resource: { type: 'nft', id },
      version: Math.max(0, current.version - 1),
      occurredAt: new Date(Date.now() - 60000).toISOString(),
      data: {
        name: summary.name,
        price,
        previousPrice: current.price,
        editions: current.editions.map((e) => ({ id: e.id, available: e.available })),
        totalAvailable: summary.totalAvailable,
        changes: ['price'],
      },
    }
    socketControl.inject(event)
    return event
  },
  dropSockets() {
    socketControl.dropAll()
  },
  setSocketOffline(offline: boolean) {
    setConfig({ ...config, socketOffline: offline })
    if (offline) socketControl.dropAll()
  },
  socketClients: () => socketControl.clients(),
  expireSessions() {
    expireAllSessions()
  },
  settleOrder(id: string, outcome?: 'confirm' | 'decline') {
    settleOrder(id, outcome)
  },
  orders: () => Object.values(state.orders).map((o) => ({ id: o.id, status: o.status, userId: o.userId, idempotencyKey: o.idempotencyKey })),
  nft: (id: string) => nftSummary(id),
}

export type MockControl = typeof mockControl

declare global {
  interface Window {
    __kurio?: MockControl
  }
}

export const controlHandlers = [
  http.get(`${API}/__mock/config`, () => HttpResponse.json(mockControl.getConfig())),
  http.post(`${API}/__mock/reset`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { scenario?: ScenarioName }
    return HttpResponse.json(mockControl.reset(body?.scenario ?? 'default'))
  }),
  http.post(`${API}/__mock/scenario`, async ({ request }) => {
    const { name } = (await request.json()) as { name: ScenarioName }
    if (!isScenarioName(name)) return HttpResponse.json({ error: 'cenário inválido' }, { status: 400 })
    return HttpResponse.json(mockControl.setScenario(name))
  }),
  http.post(`${API}/__mock/nfts/:id`, async ({ request, params }) => {
    const patch = (await request.json()) as Parameters<typeof updateNft>[1]
    return HttpResponse.json(mockControl.updateNft(String(params.id), patch))
  }),
  http.post(`${API}/__mock/socket/drop`, () => {
    mockControl.dropSockets()
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(`${API}/__mock/socket/offline`, async ({ request }) => {
    const { offline } = (await request.json()) as { offline: boolean }
    mockControl.setSocketOffline(offline)
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(`${API}/__mock/sessions/expire`, () => {
    mockControl.expireSessions()
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(`${API}/__mock/events/replay`, () => HttpResponse.json(mockControl.replayLastEvent())),
  http.post(`${API}/__mock/events/stale`, async ({ request }) => {
    const { nftId, price } = (await request.json()) as { nftId: string; price?: string }
    return HttpResponse.json(mockControl.sendStaleNftEvent(nftId, price))
  }),
]
