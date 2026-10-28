/**
 * Cliente de tempo real (socket.io-client).
 * - Um socket por sessão: login/logout/troca de usuário encerra o anterior e libera listeners.
 * - Eventos têm id estável e versão: duplicatas e versões antigas são descartadas.
 * - Após reconexão, recursos ativos são reconciliados com a API REST.
 */
import type { Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSyncExternalStore } from 'react'
import type {
  CatalogResponse,
  ClientToServerEvents,
  FavoritesResponse,
  FeaturedResponse,
  NftDetail,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  ServerToClientEvents,
} from '@/api/contracts'
import { qk } from '@/api/queryKeys'
import { formatEth } from '@/lib/eth'
import { cartScope, sessionStore } from '@/lib/session'

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'wss://realtime.kurio.test'

type Status = 'idle' | 'connecting' | 'connected' | 'disconnected'
interface RealtimeState {
  status: Status
  userId: string | null
  reconnects: number
}

let state: RealtimeState = { status: 'idle', userId: null, reconnects: 0 }
const statusListeners = new Set<() => void>()
function setState(patch: Partial<RealtimeState>) {
  state = { ...state, ...patch }
  statusListeners.forEach((l) => l())
}
export function useRealtimeStatus(): RealtimeState {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l)
      return () => statusListeners.delete(l)
    },
    () => state,
    () => state,
  )
}

// ---------- Versionamento ----------
const seenEventIds = new Set<string>()
const knownVersion = new Map<string, number>()
const lastNftEvent = new Map<string, NftUpdatedEvent>()

function remember(id: string) {
  seenEventIds.add(id)
  if (seenEventIds.size > 1000) seenEventIds.delete(seenEventIds.values().next().value as string)
}

/** Aplica o último evento conhecido sobre dados REST mais antigos (evita regressão). */
export function withKnownNftState<T extends NftSummary | NftDetail>(nft: T): T {
  const ev = lastNftEvent.get(nft.id)
  if (!ev || ev.version <= nft.version) return nft
  const patched = { ...nft, price: ev.data.price, totalAvailable: ev.data.totalAvailable, version: ev.version }
  if ('editions' in nft) {
    ;(patched as NftDetail).editions = nft.editions.map((e) => ({ ...e, available: ev.data.editions.find((x) => x.id === e.id)?.available ?? e.available }))
  }
  return patched
}

function patchSummary<T extends NftSummary>(n: T, ev: NftUpdatedEvent): T {
  if (n.id !== ev.resource.id || n.version >= ev.version) return n
  return { ...n, price: ev.data.price, totalAvailable: ev.data.totalAvailable, version: ev.version }
}

// Carregado sob demanda: o engine.io-client captura o WebSocket global no import,
// então ele precisa ser importado DEPOIS que o MSW intercepta WebSocket.
type IoFactory = typeof import('socket.io-client').io
let ioFactory: IoFactory | null = null

export class RealtimeClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
  private connectedOnce = false
  private unsubscribeSession: (() => void) | null = null

  constructor(private readonly queryClient: QueryClient) {}

  async start() {
    ioFactory ??= (await import('socket.io-client')).io
    this.open()
    this.unsubscribeSession = sessionStore.onChange((next, prev) => {
      if (next.user?.id !== prev.user?.id) {
        // Troca de sessão: encerra o socket anterior (listeners incluídos) e abre outro.
        knownVersion.forEach((_v, k) => k.startsWith('order:') && knownVersion.delete(k))
        this.close()
        this.open()
      }
    })
  }

  stop() {
    this.unsubscribeSession?.()
    this.close()
  }

  private open() {
    const token = sessionStore.get().token
    const userId = sessionStore.get().user?.id ?? null
    if (!ioFactory) return
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = ioFactory(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 400,
      reconnectionDelayMax: 3000,
      timeout: 5000,
    })
    this.socket = socket
    this.connectedOnce = false
    setState({ status: 'connecting', userId: null })

    socket.on('connect', () => {
      socket.emit('session.hello', { token })
      setState({ status: 'connected' })
      if (this.connectedOnce) {
        setState({ reconnects: state.reconnects + 1 })
        this.reconcile()
      }
      this.connectedOnce = true
    })
    socket.on('session.ready', ({ userId: bound }) => setState({ userId: bound }))
    socket.on('disconnect', () => setState({ status: 'disconnected' }))
    socket.on('connect_error', () => setState({ status: 'disconnected' }))
    socket.on('nft.updated', (event) => this.onNft(event))
    socket.on('order.updated', (event) => this.onOrder(event, state.userId === userId ? userId : null))
  }

  private close() {
    if (!this.socket) return
    this.socket.removeAllListeners()
    this.socket.disconnect()
    this.socket = null
    setState({ status: 'idle', userId: null })
  }

  /** Reconciliação após reconexão: REST é a fonte da verdade. */
  reconcile() {
    const qc = this.queryClient
    const userId = sessionStore.get().user?.id
    void qc.invalidateQueries({ queryKey: qk.nftAll, refetchType: 'active' })
    void qc.invalidateQueries({ queryKey: qk.catalogAll, refetchType: 'active' })
    void qc.invalidateQueries({ queryKey: qk.cartAll, refetchType: 'active' })
    void qc.invalidateQueries({ queryKey: qk.quoteAll, refetchType: 'active' })
    if (userId) void qc.invalidateQueries({ queryKey: qk.user(userId), refetchType: 'active' })
  }

  private accept(event: { id: string; resource: { type: string; id: string }; version: number }, restVersion = 0): boolean {
    if (seenEventIds.has(event.id)) return false // duplicata
    const key = `${event.resource.type}:${event.resource.id}`
    const known = Math.max(knownVersion.get(key) ?? 0, restVersion)
    if (event.version <= known) {
      remember(event.id)
      return false // evento antigo: não regride estado
    }
    remember(event.id)
    knownVersion.set(key, event.version)
    return true
  }

  private onNft(event: NftUpdatedEvent) {
    const qc = this.queryClient
    const id = event.resource.id
    const cached = qc.getQueryData<NftDetail>(qk.nft(id))
    if (!this.accept(event, cached?.version ?? 0)) return
    lastNftEvent.set(id, event)

    qc.setQueryData<NftDetail>(qk.nft(id), (old) => (old ? withKnownNftState(old) : old))
    qc.setQueriesData<CatalogResponse>({ queryKey: ['catalog', 'list'] }, (old) => (old ? { ...old, items: old.items.map((n) => patchSummary(n, event)) } : old))
    qc.setQueryData<FeaturedResponse>(qk.featured, (old) => (old ? { spotlight: patchSummary(old.spotlight, event) } : old))
    qc.setQueriesData<FavoritesResponse>({ predicate: (q) => q.queryKey[0] === 'user' && q.queryKey[2] === 'favorites' }, (old) =>
      old ? { ...old, items: old.items.map((n) => patchSummary(n, event)) } : old,
    )
    qc.setQueriesData<NftDetail>({ queryKey: qk.nftAll }, (old) => (old?.related ? { ...old, related: old.related.map((n) => patchSummary(n, event)) } : old))

    // Carrinho e cotação: a API é a referência para totais → refetch.
    const scope = cartScope(sessionStore.get())
    const cart = qc.getQueryData<{ items: { nftId: string }[] }>(qk.cart(scope))
    const inCart = cart?.items.some((i) => i.nftId === id)
    if (inCart) {
      void qc.invalidateQueries({ queryKey: qk.cart(scope) })
      void qc.invalidateQueries({ queryKey: ['quote', scope] })
      const msg = event.data.changes.includes('price')
        ? `O preço de ${event.data.name} mudou de ${formatEth(event.data.previousPrice)} para ${formatEth(event.data.price)}.`
        : `A disponibilidade de ${event.data.name} mudou.`
      toast.info('Item do carrinho atualizado', { description: msg, id: `nft-${id}` })
    }
  }

  private onOrder(event: OrderUpdatedEvent, socketUserId: string | null) {
    const current = sessionStore.get().user?.id
    // Isolamento: ignora eventos de outra sessão/usuário.
    if (!current || event.data.userId !== current || socketUserId !== current) return
    const qc = this.queryClient
    const key = qk.order(current, event.resource.id)
    const cached = qc.getQueryData<Order>(key)
    if (!this.accept(event, cached?.version ?? 0)) return
    qc.setQueryData<Order>(key, (old) => (!old || old.version < event.version ? event.data.order : old))
    void qc.invalidateQueries({ queryKey: qk.orders(current).slice(0, 3) })
    const order = event.data.order
    if (order.status === 'confirmed') {
      void qc.invalidateQueries({ queryKey: qk.cartAll })
      void qc.invalidateQueries({ queryKey: qk.quoteAll })
      toast.success('Pedido confirmado', { description: `Transação registrada na rede. Total ${formatEth(order.total)}.`, id: `order-${order.id}` })
    } else if (order.status === 'declined') {
      void qc.invalidateQueries({ queryKey: qk.cartAll })
      toast.error('Pagamento recusado', { description: 'Seus itens continuam no carrinho.', id: `order-${order.id}` })
    }
  }
}

let client: RealtimeClient | null = null
export function startRealtime(queryClient: QueryClient) {
  client?.stop()
  client = new RealtimeClient(queryClient)
  void client.start()
  return client
}
export const realtime = {
  reconcile: () => client?.reconcile(),
}
