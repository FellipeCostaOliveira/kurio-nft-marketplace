import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Order, Profile, ProfileUpdate, WalletInput, WalletSlot, WalletsResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import { sessionStore, useSession } from '@/lib/session'
import { useRealtimeStatus } from '@/realtime/realtime'

function useUserId() {
  return useSession().user?.id
}

export function useProfile() {
  const uid = useUserId()
  return useQuery({ queryKey: qk.profile(uid ?? 'anon'), queryFn: ({ signal }) => api.profile.get({ signal }), enabled: !!uid, staleTime: 60_000 })
}

export function useWallets() {
  const uid = useUserId()
  return useQuery({ queryKey: qk.wallets(uid ?? 'anon'), queryFn: ({ signal }) => api.wallets.list({ signal }), enabled: !!uid, staleTime: 60_000 })
}

function syncSessionUser(p: Profile) {
  const s = sessionStore.get()
  if (s.user && s.user.id === p.id) sessionStore.updateUser({ id: p.id, username: p.username, displayName: p.displayName, email: p.email, avatarUrl: p.avatarUrl })
}

export function useProfileMutations() {
  const qc = useQueryClient()
  const uid = useUserId()
  const onProfile = (p: Profile) => {
    if (!uid) return
    qc.setQueryData(qk.profile(uid), p)
    syncSessionUser(p)
  }
  return {
    update: useMutation({ mutationFn: (body: ProfileUpdate) => api.profile.update(body), onSuccess: onProfile }),
    uploadAvatar: useMutation({ mutationFn: (file: Blob) => api.profile.uploadAvatar(file), onSuccess: onProfile }),
    removeAvatar: useMutation({ mutationFn: () => api.profile.removeAvatar(), onSuccess: onProfile }),
    changePassword: useMutation({ mutationFn: (body: { currentPassword: string; newPassword: string }) => api.profile.changePassword(body) }),
  }
}

export function useSaveWallet() {
  const qc = useQueryClient()
  const uid = useUserId()
  return useMutation({
    mutationFn: ({ slot, body, sameAsPrimary }: { slot: WalletSlot; body: WalletInput; sameAsPrimary?: boolean }) => api.wallets.save(slot, body, { sameAsPrimary }),
    onSuccess: (wallet) => {
      if (!uid) return
      qc.setQueryData<WalletsResponse>(qk.wallets(uid), (old) => ({ primary: old?.primary ?? null, secondary: old?.secondary ?? null, [wallet.slot]: wallet }))
    },
  })
}

/** Pedido com fallback de polling enquanto pendente (mais frequente sem tempo real). */
export function useOrder(orderId: string) {
  const uid = useUserId()
  const qc = useQueryClient()
  const rt = useRealtimeStatus()
  return useQuery({
    queryKey: qk.order(uid ?? 'anon', orderId),
    queryFn: async ({ signal }) => {
      const fresh = await api.orders.get(orderId, { signal })
      const cached = qc.getQueryData<Order>(qk.order(uid ?? 'anon', orderId))
      // Nunca regride para uma versão anterior já recebida por evento.
      return cached && cached.version > fresh.version ? cached : fresh
    },
    enabled: !!uid,
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? (rt.status === 'connected' ? 10_000 : 2_500) : false),
    staleTime: 0,
  })
}

export function usePendingOrders() {
  const uid = useUserId()
  return useQuery({ queryKey: qk.orders(uid ?? 'anon', 'pending'), queryFn: ({ signal }) => api.orders.list('pending', { signal }), enabled: !!uid, staleTime: 5_000 })
}
