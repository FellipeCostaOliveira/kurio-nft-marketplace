import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function shortHash(hash: string, start = 6, end = 4): string {
  if (hash.length <= start + end) return hash
  return `${hash.slice(0, start)}…${hash.slice(-end)}`
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
}

/** Acesso seguro ao storage (modo privado, quota, etc.). */
export const safeStorage = {
  get(key: string, store: Storage = localStorage): string | null {
    try {
      return store.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string, store: Storage = localStorage) {
    try {
      store.setItem(key, value)
    } catch {
      /* ignora */
    }
  },
  remove(key: string, store: Storage = localStorage) {
    try {
      store.removeItem(key)
    } catch {
      /* ignora */
    }
  },
}
