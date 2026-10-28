import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AddCartItemRequest, Cart, Network } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError, isAuthError } from '@/api/errors'
import { qk } from '@/api/queryKeys'
import { cartScope, useSession } from '@/lib/session'

export function useCartScope() {
  const session = useSession()
  return cartScope(session)
}

export function useCart() {
  const scope = useCartScope()
  return useQuery({
    queryKey: qk.cart(scope),
    queryFn: ({ signal }) => api.cart.get({ signal }),
    staleTime: 10_000,
  })
}

export function useCartCount() {
  const { data } = useCart()
  return data?.items.reduce((s, i) => s + i.quantity, 0) ?? 0
}

/** Cotação da API (referência para totais). A chave inclui a versão do carrinho. */
export function useQuote(network: Network, cart: Cart | undefined) {
  const scope = useCartScope()
  return useQuery({
    queryKey: [...qk.quote(scope, network), cart?.version ?? 0],
    queryFn: ({ signal }) => api.quote(network, { signal }),
    enabled: !!cart && cart.items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

function useCartWriter() {
  const qc = useQueryClient()
  const scope = useCartScope()
  return (cart: Cart) => {
    qc.setQueryData(qk.cart(scope), cart)
    void qc.invalidateQueries({ queryKey: ['quote', scope] })
  }
}

function notifyError(title: string) {
  return (err: unknown) => {
    if (isAuthError(err)) return
    toast.error(title, { description: err instanceof ApiError ? err.message : undefined })
  }
}

export function useAddToCart() {
  const write = useCartWriter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AddCartItemRequest & { name: string }) => api.cart.add({ nftId: body.nftId, editionId: body.editionId, quantity: body.quantity }),
    onSuccess: (cart, vars) => {
      write(cart)
      toast.success('Adicionado ao carrinho', { description: `${vars.name} × ${vars.quantity}`, id: `cart-${vars.nftId}` })
    },
    onError: (err, vars) => {
      notifyError('Não foi possível adicionar ao carrinho')(err)
      if (err instanceof ApiError && err.code === 'AVAILABILITY_CONFLICT') void qc.invalidateQueries({ queryKey: qk.nft(vars.nftId) })
    },
  })
}

export function useUpdateCartItem() {
  const write = useCartWriter()
  const qc = useQueryClient()
  const scope = useCartScope()
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => api.cart.update(itemId, quantity),
    onSuccess: write,
    onError: (err) => {
      notifyError('Não foi possível alterar a quantidade')(err)
      void qc.invalidateQueries({ queryKey: qk.cart(scope) })
    },
  })
}

export function useRemoveCartItem() {
  const write = useCartWriter()
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string; name: string }) => api.cart.remove(itemId),
    onSuccess: (cart, vars) => {
      write(cart)
      toast.success('Item removido do carrinho', { description: vars.name })
    },
    onError: notifyError('Não foi possível remover o item'),
  })
}

export function useCoupon() {
  const write = useCartWriter()
  const apply = useMutation({ mutationFn: (code: string) => api.cart.applyCoupon(code), onSuccess: write })
  const remove = useMutation({ mutationFn: () => api.cart.removeCoupon(), onSuccess: write, onError: notifyError('Não foi possível remover o cupom') })
  return { apply, remove }
}

export function useAcknowledgeCart() {
  const write = useCartWriter()
  return useMutation({ mutationFn: (adjust: boolean) => api.cart.acknowledge(adjust), onSuccess: write, onError: notifyError('Não foi possível atualizar o carrinho') })
}
