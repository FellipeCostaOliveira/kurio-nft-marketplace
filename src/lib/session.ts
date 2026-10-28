/**
 * Estado de sessão no cliente. Persiste apenas token, expiração e dados públicos do usuário
 * (nunca a senha). Exposto como store externo para React (useSyncExternalStore).
 */
import { useSyncExternalStore } from 'react'
import type { Session, UserPublic } from '@/api/contracts'
import { safeStorage, uuid } from './utils'

const SESSION_KEY = 'kurio.session'
const GUEST_CART_KEY = 'kurio.guestCartId'

export interface SessionState {
  status: 'anonymous' | 'authenticated' | 'expired'
  token: string | null
  user: UserPublic | null
  expiresAt: string | null
}

function read(): SessionState {
  const raw = safeStorage.get(SESSION_KEY)
  if (raw) {
    try {
      const s = JSON.parse(raw) as Session
      if (s.token && s.user) return { status: 'authenticated', token: s.token, user: s.user, expiresAt: s.expiresAt }
    } catch {
      /* ignora */
    }
  }
  return { status: 'anonymous', token: null, user: null, expiresAt: null }
}

let current: SessionState = read()
const listeners = new Set<() => void>()
type ChangeListener = (next: SessionState, prev: SessionState) => void
const changeListeners = new Set<ChangeListener>()

function emit(next: SessionState) {
  const prev = current
  current = next
  listeners.forEach((l) => l())
  changeListeners.forEach((l) => l(next, prev))
}

export const sessionStore = {
  get: () => current,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  onChange(l: ChangeListener) {
    changeListeners.add(l)
    return () => {
      changeListeners.delete(l)
    }
  },
  signIn(session: Session) {
    safeStorage.set(SESSION_KEY, JSON.stringify(session))
    emit({ status: 'authenticated', token: session.token, user: session.user, expiresAt: session.expiresAt })
  },
  updateUser(user: UserPublic) {
    if (!current.token) return
    const session: Session = { token: current.token, user, expiresAt: current.expiresAt ?? '' }
    safeStorage.set(SESSION_KEY, JSON.stringify(session))
    emit({ ...current, user })
  },
  /** Sessão inválida no servidor: limpa credenciais mas marca "expired" para pedir novo login. */
  expire() {
    if (current.status !== 'authenticated') return
    safeStorage.remove(SESSION_KEY)
    emit({ status: 'expired', token: null, user: null, expiresAt: null, })
  },
  signOut() {
    safeStorage.remove(SESSION_KEY)
    emit({ status: 'anonymous', token: null, user: null, expiresAt: null })
  },
  /** Sincroniza abas: logout/login em outra aba reflete aqui. */
  reloadFromStorage() {
    const next = read()
    if (next.token !== current.token) emit(next.token ? next : { ...next, status: current.status === 'authenticated' ? 'anonymous' : current.status })
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SESSION_KEY) sessionStore.reloadFromStorage()
  })
}

export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

/** Identificador do carrinho do visitante (persistido para sobreviver a refresh). */
export function guestCartId(): string {
  let id = safeStorage.get(GUEST_CART_KEY)
  if (!id) {
    id = `guest_${uuid()}`
    safeStorage.set(GUEST_CART_KEY, id)
  }
  return id
}

export function rotateGuestCartId(): string {
  const id = `guest_${uuid()}`
  safeStorage.set(GUEST_CART_KEY, id)
  return id
}

export function cartScope(s: SessionState): string {
  return s.user ? `user:${s.user.id}` : `guest:${guestCartId()}`
}
