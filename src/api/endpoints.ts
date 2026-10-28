/**
 * Funções tipadas por recurso. Recebem AbortSignal para cancelamento de respostas obsoletas.
 */
import type {
  AddCartItemRequest,
  Cart,
  CatalogQuery,
  CatalogResponse,
  CreateOrderRequest,
  FavoritesResponse,
  FeaturedResponse,
  LoginRequest,
  Network,
  NftDetail,
  Order,
  PasswordChangeRequest,
  Profile,
  ProfileUpdate,
  Quote,
  RegisterRequest,
  Session,
  UserPublic,
  Wallet,
  WalletConnection,
  WalletInput,
  WalletSlot,
  WalletsResponse,
} from './contracts'
import { http } from './http'

type Opt = { signal?: AbortSignal }

export function catalogParams(q: CatalogQuery): Record<string, string> {
  const p: Record<string, string> = { sort: q.sort, tab: q.tab, page: String(q.page), pageSize: String(q.pageSize) }
  if (q.q) p.q = q.q
  if (q.collections?.length) p.collections = q.collections.join(',')
  if (q.networks?.length) p.networks = q.networks.join(',')
  if (q.minPrice) p.minPrice = q.minPrice
  if (q.maxPrice) p.maxPrice = q.maxPrice
  return p
}

export const api = {
  auth: {
    login: (body: LoginRequest) => http.post<Session>('/auth/login', body).then((r) => r.data),
    register: (body: RegisterRequest) => http.post<Session>('/auth/register', body).then((r) => r.data),
    session: (o: Opt = {}) => http.get<{ user: UserPublic; expiresAt: string }>('/auth/session', o).then((r) => r.data),
    logout: () => http.post<void>('/auth/logout').then(() => undefined),
  },
  nfts: {
    list: (q: CatalogQuery, o: Opt = {}) => http.get<CatalogResponse>('/nfts', { params: catalogParams(q), signal: o.signal }).then((r) => r.data),
    featured: (o: Opt = {}) => http.get<FeaturedResponse>('/nfts/featured', o).then((r) => r.data),
    detail: (id: string, o: Opt = {}) => http.get<NftDetail>(`/nfts/${encodeURIComponent(id)}`, o).then((r) => r.data),
  },
  favorites: {
    list: (o: Opt = {}) => http.get<FavoritesResponse>('/favorites', o).then((r) => r.data),
    add: (nftId: string) => http.put<void>(`/favorites/${encodeURIComponent(nftId)}`).then(() => undefined),
    remove: (nftId: string) => http.delete<void>(`/favorites/${encodeURIComponent(nftId)}`).then(() => undefined),
  },
  cart: {
    get: (o: Opt = {}) => http.get<Cart>('/cart', o).then((r) => r.data),
    add: (body: AddCartItemRequest) => http.post<Cart>('/cart/items', body).then((r) => r.data),
    update: (itemId: string, quantity: number) => http.patch<Cart>(`/cart/items/${itemId}`, { quantity }).then((r) => r.data),
    remove: (itemId: string) => http.delete<Cart>(`/cart/items/${itemId}`).then((r) => r.data),
    applyCoupon: (code: string) => http.put<Cart>('/cart/coupon', { code }).then((r) => r.data),
    removeCoupon: () => http.delete<Cart>('/cart/coupon').then((r) => r.data),
    acknowledge: (adjustQuantities = false) => http.post<Cart>('/cart/acknowledge', { adjustQuantities }).then((r) => r.data),
    merge: (guestCartId: string) => http.post<Cart>('/cart/merge', { guestCartId }).then((r) => r.data),
  },
  quote: (network: Network, o: Opt = {}) => http.post<Quote>('/quote', { network }, o).then((r) => r.data),
  orders: {
    create: (body: CreateOrderRequest, idempotencyKey: string) =>
      http.post<Order>('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey } }).then((r) => r.data),
    get: (id: string, o: Opt = {}) => http.get<Order>(`/orders/${encodeURIComponent(id)}`, o).then((r) => r.data),
    list: (status?: string, o: Opt = {}) => http.get<{ items: Order[] }>('/orders', { params: status ? { status } : {}, signal: o.signal }).then((r) => r.data.items),
  },
  profile: {
    get: (o: Opt = {}) => http.get<Profile>('/profile', o).then((r) => r.data),
    update: (body: ProfileUpdate) => http.patch<Profile>('/profile', body).then((r) => r.data),
    uploadAvatar: (file: Blob) => {
      const form = new FormData()
      form.append('avatar', file, 'avatar.webp')
      return http.put<Profile>('/profile/avatar', form).then((r) => r.data)
    },
    removeAvatar: () => http.delete<Profile>('/profile/avatar').then((r) => r.data),
    changePassword: (body: PasswordChangeRequest) => http.post<void>('/profile/password', body).then(() => undefined),
  },
  wallets: {
    list: (o: Opt = {}) => http.get<WalletsResponse>('/wallets', o).then((r) => r.data),
    save: (slot: WalletSlot, body: WalletInput, opts: { sameAsPrimary?: boolean } = {}) =>
      http.put<Wallet>(`/wallets/${slot}`, body, { headers: opts.sameAsPrimary ? { 'X-Same-As-Primary': 'true' } : {} }).then((r) => r.data),
    connect: (walletId: string, network: Network, address?: string) =>
      http.post<WalletConnection>(`/wallets/${encodeURIComponent(walletId)}/connect`, { network, address }).then((r) => r.data),
    disconnect: () => http.delete<void>('/wallets/connection').then(() => undefined),
  },
}
