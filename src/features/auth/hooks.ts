import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { LoginRequest, RegisterRequest, Session } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import { guestCartId, rotateGuestCartId, sessionStore, useSession } from '@/lib/session'

/** Remove do cache tudo que pertence a um usuário (dados privados + carrinho/cotação). */
export function clearPrivateData(qc: QueryClient, userId: string) {
  void qc.cancelQueries({ queryKey: qk.user(userId) })
  qc.removeQueries({ queryKey: qk.user(userId) })
  qc.removeQueries({ queryKey: qk.cart(`user:${userId}`) })
  qc.removeQueries({ queryKey: ['quote', `user:${userId}`] })
}

async function completeSignIn(qc: QueryClient, session: Session) {
  const guestId = guestCartId()
  const prev = sessionStore.get().user
  if (prev && prev.id !== session.user.id) clearPrivateData(qc, prev.id)
  sessionStore.signIn(session)
  // Preserva itens do visitante: mescla o carrinho guest no carrinho do usuário.
  try {
    const cart = await api.cart.merge(guestId)
    qc.setQueryData(qk.cart(`user:${session.user.id}`), cart)
  } catch {
    void qc.invalidateQueries({ queryKey: qk.cart(`user:${session.user.id}`) })
  }
  qc.removeQueries({ queryKey: qk.cart(`guest:${guestId}`) })
  qc.removeQueries({ queryKey: ['quote', `guest:${guestId}`] })
  rotateGuestCartId()
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginRequest) => api.auth.login(body),
    onSuccess: (session) => completeSignIn(qc, session),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RegisterRequest) => api.auth.register(body),
    onSuccess: (session) => completeSignIn(qc, session),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout()
      } catch {
        /* logout local mesmo se a rede falhar */
      }
    },
    onSettled: () => {
      const user = sessionStore.get().user
      sessionStore.signOut()
      if (user) clearPrivateData(qc, user.id)
    },
  })
}

/** Revalida a sessão persistida após refresh; 401 marca a sessão como expirada (interceptor). */
export function useSessionValidation() {
  const session = useSession()
  return useQuery({
    queryKey: [...qk.session, session.user?.id ?? null],
    queryFn: ({ signal }) => api.auth.session({ signal }),
    enabled: !!session.token,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  })
}
