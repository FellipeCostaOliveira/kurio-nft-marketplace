import axios, { type AxiosError } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from './contracts'

/** Erro normalizado que atravessa transporte → estado → UI. */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly fieldErrors: Record<string, string>
  readonly retryable: boolean
  readonly details: unknown

  constructor(init: { code: ApiErrorCode; status: number; message: string; fieldErrors?: Record<string, string>; retryable?: boolean; details?: unknown }) {
    super(init.message)
    this.name = 'ApiError'
    this.code = init.code
    this.status = init.status
    this.fieldErrors = init.fieldErrors ?? {}
    this.retryable = init.retryable ?? false
    this.details = init.details
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError({ code: 'CANCELED', status: 0, message: 'Requisição cancelada.' })
  if (axios.isAxiosError(error)) {
    const e = error as AxiosError<ApiErrorBody>
    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT')
      return new ApiError({ code: 'TIMEOUT', status: 0, message: 'O servidor demorou para responder. Verificamos o estado antes de tentar de novo.', retryable: true })
    const body = e.response?.data
    if (e.response && body?.error) {
      return new ApiError({
        code: body.error.code,
        status: e.response.status,
        message: body.error.message,
        fieldErrors: body.error.fieldErrors,
        retryable: body.error.retryable,
        details: body.error.details,
      })
    }
    if (!e.response) return new ApiError({ code: 'NETWORK_ERROR', status: 0, message: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.', retryable: true })
    return new ApiError({ code: 'INTERNAL', status: e.response.status, message: 'Erro inesperado do servidor.', retryable: e.response.status >= 500 })
  }
  return new ApiError({ code: 'INTERNAL', status: 0, message: error instanceof Error ? error.message : 'Erro inesperado.' })
}

export function isAuthError(e: unknown): boolean {
  return e instanceof ApiError && (e.code === 'SESSION_EXPIRED' || e.code === 'UNAUTHENTICATED')
}
