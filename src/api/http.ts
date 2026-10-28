import axios from 'axios'
import { beforeRequest } from '@/lib/ready'
import { guestCartId, sessionStore } from '@/lib/session'
import { toApiError } from './errors'

export const REQUEST_TIMEOUT_MS = 8000

/** Único cliente HTTP da aplicação. Todas as chamadas REST passam por aqui. */
export const http = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? '/api',
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use(async (config) => {
  await beforeRequest()
  const { token } = sessionStore.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  else config.headers.set('X-Cart-Id', guestCartId())
  return config
})

http.interceptors.response.use(
  (r) => r,
  (error) => {
    const apiError = toApiError(error)
    // Sessão expirada/invalidada no servidor: o app pede novo login preservando o contexto.
    const auth = error?.config?.headers?.get?.('Authorization') as string | undefined
    const sentToken = auth?.slice(7)
    if ((apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHENTICATED') && sentToken && sentToken === sessionStore.get().token) {
      sessionStore.expire()
    }
    return Promise.reject(apiError)
  },
)
