/**
 * Tentativa de compra persistida em sessionStorage.
 * A mesma tentativa (mesmo conteúdo) reutiliza a mesma Idempotency-Key — cliques repetidos,
 * reenvio após timeout ou refresh recuperam o mesmo pedido em vez de criar outro.
 */
import type { CollectorInfo, CreateOrderRequest } from '@/api/contracts'
import { safeStorage, uuid } from '@/lib/utils'

export interface Attempt {
  key: string
  fingerprint: string
  orderId?: string
  createdAt: number
}

const keyFor = (userId: string) => `kurio.checkout.attempt.${userId}`
const draftKey = (userId: string) => `kurio.checkout.draft.${userId}`

export function fingerprint(body: CreateOrderRequest): string {
  return JSON.stringify([body.quoteId, body.quoteVersion, body.network, body.walletId, body.collector])
}

export function getAttempt(userId: string): Attempt | null {
  const raw = safeStorage.get(keyFor(userId), sessionStorage)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Attempt
  } catch {
    return null
  }
}

/** Retorna a tentativa vigente para este conteúdo ou cria uma nova chave. */
export function attemptFor(userId: string, body: CreateOrderRequest): Attempt {
  const fp = fingerprint(body)
  const current = getAttempt(userId)
  if (current && current.fingerprint === fp) return current
  const next: Attempt = { key: `idem_${uuid()}`, fingerprint: fp, createdAt: Date.now() }
  safeStorage.set(keyFor(userId), JSON.stringify(next), sessionStorage)
  return next
}

export function markAttemptOrder(userId: string, orderId: string) {
  const a = getAttempt(userId)
  if (a) safeStorage.set(keyFor(userId), JSON.stringify({ ...a, orderId }), sessionStorage)
}

export function clearAttempt(userId: string) {
  safeStorage.remove(keyFor(userId), sessionStorage)
}

// Rascunho do formulário: preserva o contexto em expiração de sessão/refresh.
export function loadDraft(userId: string): Partial<CollectorInfo> | null {
  const raw = safeStorage.get(draftKey(userId), sessionStorage)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Partial<CollectorInfo>
  } catch {
    return null
  }
}

export function saveDraft(userId: string, draft: CollectorInfo) {
  safeStorage.set(draftKey(userId), JSON.stringify(draft), sessionStorage)
}

export function clearDraft(userId: string) {
  safeStorage.remove(draftKey(userId), sessionStorage)
}
