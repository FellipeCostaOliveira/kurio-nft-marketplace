/**
 * Cenários determinísticos e configuração de rede dos mocks.
 * Selecionáveis por: ?scenario=<nome> na URL, VITE_MOCK_SCENARIO, painel de cenários,
 * window.__kurio.setScenario() ou POST /api/__mock/scenario.
 */
import type { ApiErrorCode } from '@/api/contracts'
import { safeStorage } from '@/lib/utils'

export interface FailureRule {
  id: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Regex (string) testada contra o pathname. */
  path: string
  kind: 'http' | 'network' | 'timeout'
  status?: number
  code?: ApiErrorCode
  message?: string
  /** Quantas vezes falha antes de se recuperar. undefined = sempre. */
  times?: number
}

export interface MockConfig {
  scenario: ScenarioName
  /** Latência base [min, max] em ms; a variação é pseudo-aleatória com semente fixa. */
  latency: [number, number]
  /** Alterna respostas lentas/rápidas na listagem para produzir respostas fora de ordem. */
  outOfOrder: boolean
  /** Simula ausência total de conexão para REST. */
  offline: boolean
  emptyCatalog: boolean
  failures: FailureRule[]
  payment: 'confirm' | 'decline'
  paymentDelayMs: number
  /** A 1ª criação de pedido é registrada, mas a resposta demora além do timeout do cliente. */
  orderTimeoutOnce: boolean
  orderTimeoutMs: number
  walletConnect: 'connect' | 'reject' | 'disconnect'
  /** Muda o preço do 1º item no momento da confirmação (gera QUOTE_OUTDATED + nft.updated). */
  priceChangeOnCheckout: boolean
  /** Esgota a edição do 1º item no momento da confirmação. */
  soldOutOnCheckout: boolean
  socketOffline: boolean
  sessionTtlMs: number
  seed: number
}

export const SCENARIOS = {
  default: 'Padrão: sucesso com latência curta',
  slow: 'Rede lenta (skeletons visíveis)',
  'variable-latency': 'Latência variável',
  'out-of-order': 'Respostas fora de ordem no catálogo',
  offline: 'Sem conexão (REST indisponível)',
  'server-error': 'Falha 500 no catálogo (recupera na nova tentativa)',
  'empty-catalog': 'Catálogo vazio',
  'session-expired': 'Sessão expira em 20s',
  unauthorized: 'Perfil e carteiras retornam 403',
  'validation-error': 'Perfil/carteiras retornam 422 do servidor',
  'coupon-error': 'Falha 503 ao aplicar cupom (1x)',
  'price-change': 'Preço muda durante a compra',
  'sold-out': 'Edição esgota durante a compra',
  'order-timeout': 'Timeout após criar pedido (recupera por idempotência)',
  'payment-declined': 'Pagamento recusado',
  'wallet-rejected': 'Usuário recusa a conexão da carteira',
  'wallet-disconnect': 'Carteira desconecta no envio do pedido',
  'favorite-failure': 'Falha na mutation de favoritos (1x)',
  'socket-offline': 'Socket.IO indisponível',
} as const

export type ScenarioName = keyof typeof SCENARIOS

const BASE: MockConfig = {
  scenario: 'default',
  latency: [60, 180],
  outOfOrder: false,
  offline: false,
  emptyCatalog: false,
  failures: [],
  payment: 'confirm',
  paymentDelayMs: 2500,
  orderTimeoutOnce: false,
  orderTimeoutMs: 12000,
  walletConnect: 'connect',
  priceChangeOnCheckout: false,
  soldOutOnCheckout: false,
  socketOffline: false,
  sessionTtlMs: 2 * 60 * 60 * 1000,
  seed: 42,
}

export function scenarioConfig(name: ScenarioName): MockConfig {
  const c: MockConfig = { ...BASE, scenario: name, failures: [] }
  switch (name) {
    case 'slow':
      return { ...c, latency: [2200, 2600] }
    case 'variable-latency':
      return { ...c, latency: [100, 2400] }
    case 'out-of-order':
      return { ...c, outOfOrder: true }
    case 'offline':
      return { ...c, offline: true }
    case 'server-error':
      return { ...c, failures: [{ id: 'catalog-500', method: 'GET', path: '^/api/nfts$', kind: 'http', status: 500, code: 'TRANSIENT', times: 2 }] }
    case 'empty-catalog':
      return { ...c, emptyCatalog: true }
    case 'session-expired':
      return { ...c, sessionTtlMs: 20000 }
    case 'unauthorized':
      return {
        ...c,
        failures: [
          { id: 'profile-403', path: '^/api/(profile|wallets)', kind: 'http', status: 403, code: 'FORBIDDEN', message: 'Você não tem permissão para acessar este recurso.' },
        ],
      }
    case 'validation-error':
      return {
        ...c,
        failures: [
          { id: 'profile-422', method: 'PATCH', path: '^/api/profile$', kind: 'http', status: 422, code: 'VALIDATION_ERROR', message: 'Revise os campos destacados.' },
          { id: 'wallet-422', method: 'PUT', path: '^/api/wallets/', kind: 'http', status: 422, code: 'VALIDATION_ERROR', message: 'Revise os campos destacados.' },
        ],
      }
    case 'coupon-error':
      return { ...c, failures: [{ id: 'coupon-503', method: 'PUT', path: '^/api/cart/coupon$', kind: 'http', status: 503, code: 'TRANSIENT', times: 1 }] }
    case 'price-change':
      return { ...c, priceChangeOnCheckout: true }
    case 'sold-out':
      return { ...c, soldOutOnCheckout: true }
    case 'order-timeout':
      return { ...c, orderTimeoutOnce: true }
    case 'payment-declined':
      return { ...c, payment: 'decline' }
    case 'wallet-rejected':
      return { ...c, walletConnect: 'reject' }
    case 'wallet-disconnect':
      return { ...c, walletConnect: 'disconnect' }
    case 'favorite-failure':
      return { ...c, failures: [{ id: 'fav-500', path: '^/api/favorites/', kind: 'http', status: 500, code: 'TRANSIENT', times: 1 }] }
    case 'socket-offline':
      return { ...c, socketOffline: true }
    default:
      return c
  }
}

const CONFIG_KEY = 'kurio.mock.config'

export function isScenarioName(v: unknown): v is ScenarioName {
  return typeof v === 'string' && v in SCENARIOS
}

export function loadConfig(): MockConfig {
  const raw = safeStorage.get(CONFIG_KEY)
  if (raw) {
    try {
      return { ...BASE, ...(JSON.parse(raw) as MockConfig) }
    } catch {
      /* ignora */
    }
  }
  const env = import.meta.env.VITE_MOCK_SCENARIO
  return scenarioConfig(isScenarioName(env) ? env : 'default')
}

export function saveConfig(c: MockConfig) {
  safeStorage.set(CONFIG_KEY, JSON.stringify(c))
}

export function clearConfig() {
  safeStorage.remove(CONFIG_KEY)
}
