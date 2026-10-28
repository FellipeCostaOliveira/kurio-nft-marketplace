import { useSyncExternalStore } from 'react'

export type AuthMode = 'login' | 'signup'
interface AuthDialogState {
  open: boolean
  mode: AuthMode
  reason: 'manual' | 'expired' | 'required'
  /** Para onde voltar após autenticar (quando o diálogo veio de uma rota protegida). */
  redirect: string | null
}

/** Elemento que tinha o foco ao abrir — recebe o foco de volta ao fechar. */
export let returnFocusTo: HTMLElement | null = null

let state: AuthDialogState = { open: false, mode: 'login', reason: 'manual', redirect: null }
const listeners = new Set<() => void>()
const set = (s: AuthDialogState) => {
  state = s
  listeners.forEach((l) => l())
}

export const authDialog = {
  get: () => state,
  open: (mode: AuthMode = 'login', opts: Partial<Pick<AuthDialogState, 'reason' | 'redirect'>> = {}) => {
    if (!state.open) returnFocusTo = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    set({ open: true, mode, reason: opts.reason ?? 'manual', redirect: opts.redirect ?? null })
  },
  setMode: (mode: AuthMode) => set({ ...state, mode }),
  close: () => set({ ...state, open: false }),
  subscribe: (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export function useAuthDialog() {
  return useSyncExternalStore(authDialog.subscribe, authDialog.get, authDialog.get)
}
