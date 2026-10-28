/**
 * Simulação de condições de rede aplicada a todos os handlers REST:
 * latência (determinística), respostas fora de ordem, offline, timeouts e falhas HTTP.
 */
import { delay, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/api/contracts'
import { mulberry32 } from './fixtures'
import { lookupSession, type UserRecord } from './db'
import { loadConfig, saveConfig, type MockConfig } from './scenarios'

export let config: MockConfig = loadConfig()
let rand = mulberry32(config.seed)
let catalogCounter = 0

export function setConfig(next: MockConfig) {
  config = next
  rand = mulberry32(next.seed)
  catalogCounter = 0
  saveConfig(next)
}

export function errorResponse(status: number, code: ApiErrorCode, message: string, extra: Partial<ApiErrorBody['error']> = {}) {
  const body: ApiErrorBody = {
    error: { code, message, retryable: status >= 500 || code === 'TRANSIENT', ...extra },
  }
  return HttpResponse.json(body, { status })
}

const DEFAULT_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  TRANSIENT: 'Serviço temporariamente indisponível. Tente novamente.',
  INTERNAL: 'Erro interno do servidor.',
  FORBIDDEN: 'Acesso negado.',
  VALIDATION_ERROR: 'Dados inválidos.',
}

function latency(): number {
  const [min, max] = config.latency
  return Math.round(min + rand() * (max - min))
}

type Resolver = HttpResponseResolver<PathParams, DefaultBodyType, DefaultBodyType>

/** Envolve um resolver com as condições de rede do cenário ativo. */
export function withNetwork(resolver: Resolver): Resolver {
  return async (info) => {
    const { request } = info
    const url = new URL(request.url)
    if (config.offline) {
      await delay(150)
      return HttpResponse.error()
    }
    for (const rule of config.failures) {
      if (rule.method && rule.method !== request.method) continue
      if (!new RegExp(rule.path).test(url.pathname)) continue
      if (rule.times !== undefined) {
        if (rule.times <= 0) continue
        rule.times -= 1
        saveConfig(config)
      }
      await delay(latency())
      if (rule.kind === 'network') return HttpResponse.error()
      if (rule.kind === 'timeout') {
        await delay(config.orderTimeoutMs)
        return HttpResponse.error()
      }
      const code = rule.code ?? 'INTERNAL'
      return errorResponse(rule.status ?? 500, code, rule.message ?? DEFAULT_MESSAGES[code] ?? 'Falha simulada.', {
        fieldErrors: code === 'VALIDATION_ERROR' ? serverFieldErrors(url.pathname) : undefined,
      })
    }
    let wait = latency()
    if (config.outOfOrder && url.pathname === '/api/nfts') {
      catalogCounter += 1
      // 1ª, 3ª, 5ª... respostas demoram mais que as seguintes.
      wait = catalogCounter % 2 === 1 ? 1800 : 150
    }
    await delay(wait)
    return resolver(info)
  }
}

function serverFieldErrors(pathname: string): Record<string, string> {
  if (pathname.startsWith('/api/profile')) return { username: 'Este nome de usuário foi reservado pelo servidor.' }
  return { address: 'Endereço recusado pela validação do servidor.' }
}

// ---------- Auth helpers ----------
export function bearer(request: Request): string | null {
  const h = request.headers.get('authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

export type AuthResult = { ok: true; user: UserRecord } | { ok: false; response: Response }

export function requireUser(request: Request): AuthResult {
  const token = bearer(request)
  const result = lookupSession(token)
  if (result.status === 'valid') return { ok: true, user: result.user }
  if (result.status === 'expired') {
    return { ok: false, response: errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.') }
  }
  return { ok: false, response: errorResponse(401, 'UNAUTHENTICATED', 'Faça login para continuar.') }
}

/** Usuário opcional: token inválido/expirado ainda gera 401 para não misturar dados. */
export function optionalUser(request: Request): AuthResult | { ok: true; user: null } {
  const token = bearer(request)
  if (!token) return { ok: true, user: null }
  return requireUser(request)
}
