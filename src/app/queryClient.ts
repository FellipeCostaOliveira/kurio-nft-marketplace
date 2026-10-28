import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'

/**
 * Política de cache e retries (documentada no ARCHITECTURE.md):
 * - staleTime 30s para dados públicos; dados privados definem staleTime próprio.
 * - Queries: 1 retry automático apenas para erros transitórios (5xx/rede/timeout); 4xx nunca.
 * - Mutations: sem retry automático (evita operações duplicadas); pedidos usam idempotência.
 * - refetchOnWindowFocus ativo para manter preços/estoque frescos; refetchOnReconnect ativo.
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => error instanceof ApiError && error.retryable && failureCount < 1,
        retryDelay: 600,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  })
}
