/**
 * Contratos REST e de eventos da Kurio.
 * Fonte única de tipos para: handlers MSW, cliente Axios, cache do TanStack Query e UI.
 * Valores em ETH sempre trafegam como string decimal (ex.: "1.19"). Quantidades são inteiras.
 */

export type EthString = string
export type ISODate = string

// ---------- Erros ----------
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'AVAILABILITY_CONFLICT'
  | 'QUOTE_OUTDATED'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'WALLET_REJECTED'
  | 'WALLET_DISCONNECTED'
  | 'TRANSIENT'
  | 'INTERNAL'
  // Gerados no cliente (não vêm do servidor)
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'CANCELED'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Erros por campo (chave = nome do campo no formulário). */
    fieldErrors?: Record<string, string>
    details?: unknown
    retryable: boolean
  }
}

// ---------- Domínio: catálogo ----------
export type Network = 'ethereum' | 'polygon' | 'solana'
export type CollectionSlug =
  | 'arte-digital'
  | 'fotografia'
  | 'musica'
  | 'arte-3d'
  | 'colecionaveis'
  | 'generativa'
  | 'jogos'
  | 'assinaturas'
  | 'utilidade'
export type SortOption = 'recent' | 'price-asc' | 'price-desc' | 'name' | 'popular'
export type CatalogTab = 'all' | 'new' | 'trending'

export interface ImageAsset {
  src: string
  srcSm: string
  alt: string
}

export interface Edition {
  id: string
  label: string
  /** null = edição aberta */
  supply: number | null
  available: number
  maxPerOrder: number
}

export interface NftSummary {
  id: string
  name: string
  tokenId: string
  image: ImageAsset
  price: EthString
  previousPrice: EthString | null
  collection: CollectionSlug
  collectionName: string
  network: Network
  rarity: 'common' | 'rare'
  listedAt: ISODate
  isTrending: boolean
  totalAvailable: number
  /** Versão monotônica do recurso; compartilhada com eventos nft.updated. */
  version: number
}

export interface Review {
  id: string
  author: string
  rating: number
  comment: string
  createdAt: ISODate
}

export interface NftDetail extends NftSummary {
  description: string
  longDescription: string[]
  gallery: ImageAsset[]
  editions: Edition[]
  series: string
  attributes: string[]
  contract: { address: string; standard: 'ERC-721' | 'ERC-1155' | 'SPL' }
  royaltyPercent: number
  creator: string
  rating: number
  reviewsCount: number
  reviews: Review[]
  related: NftSummary[]
}

export interface CatalogQuery {
  q?: string
  collections?: CollectionSlug[]
  networks?: Network[]
  minPrice?: EthString
  maxPrice?: EthString
  sort: SortOption
  tab: CatalogTab
  page: number
  pageSize: number
}

export interface Facet<T extends string> {
  id: T
  name: string
  count: number
}

export interface CatalogResponse {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: {
    collections: Facet<CollectionSlug>[]
    networks: Facet<Network>[]
    priceRange: { min: EthString; max: EthString }
  }
  /** Eco dos parâmetros interpretados pela API — usado para descartar respostas fora de ordem. */
  query: CatalogQuery
}

export interface FeaturedResponse {
  spotlight: NftSummary
}

// ---------- Sessão e conta ----------
export interface UserPublic {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string | null
}

export interface Session {
  token: string
  expiresAt: ISODate
  user: UserPublic
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface Profile {
  id: string
  displayName: string
  username: string
  email: string
  ensName: string
  ensSuffix: '.eth'
  walletNickname: string
  avatarUrl: string | null
  version: number
  updatedAt: ISODate
}

export type ProfileUpdate = Pick<Profile, 'displayName' | 'username' | 'email' | 'ensName' | 'ensSuffix' | 'walletNickname'>

export interface PasswordChangeRequest {
  currentPassword: string
  newPassword: string
}

// ---------- Carteiras ----------
export type WalletSlot = 'primary' | 'secondary'
export type WalletType = 'metamask' | 'walletconnect' | 'coinbase' | 'phantom'

export interface WalletInput {
  displayName: string
  nickname: string
  network: Network
  profileName: string
  address: string
  secondaryAddress: string
  walletType: WalletType
  referralCode: string
  email: string
  ensName: string
  ensSuffix: '.eth'
}

export interface Wallet extends WalletInput {
  id: string
  slot: WalletSlot
  updatedAt: ISODate
}

export interface WalletsResponse {
  primary: Wallet | null
  secondary: Wallet | null
}

export interface WalletConnection {
  walletId: string
  network: Network
  address: string
  connectedAt: ISODate
}

// ---------- Favoritos ----------
export interface FavoritesResponse {
  nftIds: string[]
  items: NftSummary[]
}

// ---------- Carrinho ----------
export interface CartItem {
  id: string
  nftId: string
  editionId: string
  quantity: number
  nft: NftSummary
  edition: Edition
  /** Preço que o usuário viu/aceitou por último. Divergência gera issue na cotação. */
  acknowledgedPrice: EthString
}

export interface Cart {
  id: string
  ownerId: string | null
  items: CartItem[]
  coupon: { code: string } | null
  version: number
  updatedAt: ISODate
}

export interface AddCartItemRequest {
  nftId: string
  editionId: string
  quantity: number
}

// ---------- Cotação ----------
export type QuoteIssue =
  | { type: 'PRICE_CHANGED'; itemId: string; nftId: string; name: string; previousPrice: EthString; currentPrice: EthString }
  | { type: 'UNAVAILABLE'; itemId: string; nftId: string; name: string; edition: string }
  | { type: 'QUANTITY_EXCEEDS'; itemId: string; nftId: string; name: string; requested: number; available: number }

export interface QuoteLine {
  itemId: string
  nftId: string
  editionId: string
  editionLabel: string
  name: string
  tokenId: string
  image: ImageAsset
  unitPrice: EthString
  quantity: number
  lineTotal: EthString
  available: number
}

export interface Quote {
  id: string
  /** Hash do conteúdo da cotação; muda a cada alteração de preço, estoque, cupom ou taxa. */
  version: string
  network: Network
  lines: QuoteLine[]
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  coupon: { code: string; status: 'applied' | 'invalid' | 'expired'; description: string } | null
  issues: QuoteIssue[]
  createdAt: ISODate
  expiresAt: ISODate
}

export interface QuoteRequest {
  network: Network
}

// ---------- Pedidos ----------
export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface CollectorInfo {
  displayName: string
  username: string
  network: Network
  profileName: string
  walletAddress: string
  secondaryAddress: string
  walletType: WalletType
  referralCode: string
  email: string
  ensName: string
  ensSuffix: '.eth'
  note: string
}

export interface CreateOrderRequest {
  quoteId: string
  quoteVersion: string
  network: Network
  walletId: string
  collector: CollectorInfo
}

export interface OrderLine {
  nftId: string
  editionId: string
  editionLabel: string
  name: string
  tokenId: string
  image: ImageAsset
  unitPrice: EthString
  quantity: number
  lineTotal: EthString
}

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  version: number
  idempotencyKey: string
  network: Network
  wallet: { id: string; label: string; walletType: WalletType; address: string }
  lines: OrderLine[]
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  coupon: string | null
  transaction: { hash: string; explorerUrl: string; confirmedAt: ISODate } | null
  failureReason: string | null
  createdAt: ISODate
  updatedAt: ISODate
}

// ---------- Eventos Socket.IO ----------
export interface RealtimeEvent<TType extends string, TResource extends string, TData> {
  /** Identidade estável do evento (duplicatas têm o mesmo id). */
  id: string
  type: TType
  resource: { type: TResource; id: string }
  /** Versão do recurso após o evento. Eventos com versão <= à conhecida são ignorados. */
  version: number
  occurredAt: ISODate
  data: TData
}

export type NftUpdatedEvent = RealtimeEvent<
  'nft.updated',
  'nft',
  {
    name: string
    price: EthString
    previousPrice: EthString
    editions: Pick<Edition, 'id' | 'available'>[]
    totalAvailable: number
    changes: Array<'price' | 'availability'>
  }
>

export type OrderUpdatedEvent = RealtimeEvent<'order.updated', 'order', { userId: string; order: Order }>

export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
  'session.ready': (payload: { userId: string | null }) => void
}

export interface ClientToServerEvents {
  'session.hello': (payload: { token: string | null }) => void
}

export const NETWORKS: { id: Network; name: string }[] = [
  { id: 'ethereum', name: 'Ethereum' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'solana', name: 'Solana' },
]

export const WALLET_TYPES: { id: WalletType; name: string }[] = [
  { id: 'metamask', name: 'MetaMask' },
  { id: 'walletconnect', name: 'WalletConnect' },
  { id: 'coinbase', name: 'Coinbase Wallet' },
  { id: 'phantom', name: 'Phantom' },
]

export const COLLECTIONS: { id: CollectionSlug; name: string }[] = [
  { id: 'arte-digital', name: 'Arte digital' },
  { id: 'fotografia', name: 'Fotografia' },
  { id: 'musica', name: 'Música' },
  { id: 'arte-3d', name: 'Arte 3D' },
  { id: 'colecionaveis', name: 'Colecionáveis' },
  { id: 'generativa', name: 'Generativa' },
  { id: 'jogos', name: 'Jogos' },
  { id: 'assinaturas', name: 'Assinaturas' },
  { id: 'utilidade', name: 'Utilidade' },
]

export const SORT_OPTIONS: { id: SortOption; name: string }[] = [
  { id: 'recent', name: 'Listados recentemente' },
  { id: 'price-asc', name: 'Menor preço' },
  { id: 'price-desc', name: 'Maior preço' },
  { id: 'popular', name: 'Mais populares' },
  { id: 'name', name: 'Nome (A–Z)' },
]
