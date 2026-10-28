import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CatalogQuery, FavoritesResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import { qk } from '@/api/queryKeys'
import { useSession } from '@/lib/session'
import { withKnownNftState } from '@/realtime/realtime'
import { authDialog } from '@/features/auth/auth-dialog-store'

export function useCatalog(query: CatalogQuery) {
  return useQuery({
    queryKey: qk.catalog(query),
    queryFn: async ({ signal }) => {
      // signal: troca de parâmetros cancela a requisição anterior (respostas obsoletas descartadas).
      const res = await api.nfts.list(query, { signal })
      if (res.query.sort !== query.sort || res.query.tab !== query.tab) throw new ApiError({ code: 'INTERNAL', status: 0, message: 'Resposta inconsistente com a consulta.' })
      return { ...res, items: res.items.map(withKnownNftState) }
    },
    placeholderData: keepPreviousData,
  })
}

export function useFeatured() {
  return useQuery({
    queryKey: qk.featured,
    queryFn: async ({ signal }) => {
      const r = await api.nfts.featured({ signal })
      return { spotlight: withKnownNftState(r.spotlight) }
    },
    staleTime: 60_000,
  })
}

export function useNftDetail(id: string) {
  return useQuery({
    queryKey: qk.nft(id),
    queryFn: async ({ signal }) => withKnownNftState(await api.nfts.detail(id, { signal })),
    retry: (count, error) => error instanceof ApiError && error.retryable && count < 1,
  })
}

export function useFavorites() {
  const session = useSession()
  const userId = session.user?.id
  return useQuery({
    queryKey: qk.favorites(userId ?? 'anon'),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
    enabled: !!userId,
    staleTime: 60_000,
  })
}

/**
 * Favoritar com atualização otimista e rollback em caso de falha.
 */
export function useToggleFavorite() {
  const qc = useQueryClient()
  const session = useSession()
  const userId = session.user?.id
  const mutation = useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) => (favorite ? api.favorites.add(nftId) : api.favorites.remove(nftId)),
    onMutate: async ({ nftId, favorite }) => {
      if (!userId) return
      const key = qk.favorites(userId)
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<FavoritesResponse>(key)
      qc.setQueryData<FavoritesResponse>(key, (old) => {
        const base = old ?? { nftIds: [], items: [] }
        const ids = favorite ? [nftId, ...base.nftIds.filter((x) => x !== nftId)] : base.nftIds.filter((x) => x !== nftId)
        return { nftIds: ids, items: favorite ? base.items : base.items.filter((n) => n.id !== nftId) }
      })
      return { previous, key }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.key) qc.setQueryData(ctx.key, ctx.previous)
      if (err instanceof ApiError && (err.code === 'SESSION_EXPIRED' || err.code === 'UNAUTHENTICATED')) return
      toast.error('Não foi possível atualizar seus favoritos', {
        description: `${vars.name} voltou ao estado anterior. ${err instanceof ApiError ? err.message : ''}`,
      })
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.favorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos', { description: vars.name, id: `fav-${vars.nftId}` })
    },
    onSettled: () => {
      if (userId) void qc.invalidateQueries({ queryKey: qk.favorites(userId) })
    },
  })

  const toggle = (nftId: string, name: string, isFavorite: boolean) => {
    if (!userId) {
      authDialog.open('login', { reason: 'required' })
      return
    }
    mutation.mutate({ nftId, favorite: !isFavorite, name })
  }
  return { toggle, isPending: mutation.isPending, pendingId: mutation.isPending ? mutation.variables?.nftId : undefined }
}
