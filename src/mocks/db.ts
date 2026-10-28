/**
 * Banco em memória dos mocks, persistido em localStorage para sobreviver a refresh.
 * Mantém consistência entre catálogo, favoritos, carrinho, perfil, carteiras e pedidos.
 * Toda mutação relevante publica o evento Socket.IO correspondente (ver realtime-bus).
 */
import type {
  Cart,
  CartItem,
  Edition,
  Network,
  NftDetail,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  Profile,
  Quote,
  QuoteIssue,
  QuoteLine,
  UserPublic,
  Wallet,
  WalletConnection,
  WalletSlot,
} from '@/api/contracts'
import { ethAdd, ethCmp, ethMul, eth } from '@/lib/eth'
import { safeStorage } from '@/lib/utils'
import {
  buildCatalog,
  COUPONS,
  NETWORK_FEES,
  SEED_FAVORITES,
  SEED_USERS,
  SEED_WALLETS,
  type SeedUser,
} from './fixtures'
import { bus } from './realtime-bus'

const DB_KEY = 'kurio.mock.db'
const DB_SCHEMA = 3

interface NftState {
  price: string
  previousPrice: string | null
  editions: Edition[]
  version: number
}

interface CartRecord {
  id: string
  ownerId: string | null
  items: Array<{ id: string; nftId: string; editionId: string; quantity: number; acknowledgedPrice: string }>
  coupon: { code: string } | null
  version: number
  updatedAt: string
}

interface UserRecord extends SeedUser {
  profileVersion: number
  updatedAt: string
}

interface OrderRecord extends Order {
  settleAt: number
  outcome: 'confirm' | 'decline'
  cartId: string
  reserved: Array<{ nftId: string; editionId: string; quantity: number }>
}

interface DbState {
  schema: number
  nftState: Record<string, NftState>
  users: Record<string, UserRecord>
  sessions: Record<string, { userId: string; expiresAt: number }>
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  userCarts: Record<string, string>
  wallets: Record<string, { primary: Wallet | null; secondary: Wallet | null }>
  connections: Record<string, WalletConnection | null>
  quotes: Record<string, { quote: Quote; cartId: string }>
  orders: Record<string, OrderRecord>
  idempotency: Record<string, { orderId: string; bodyHash: string }>
  seq: number
}

const catalog: NftDetail[] = buildCatalog()
const catalogById = new Map(catalog.map((n) => [n.id, n]))

function seedState(): DbState {
  const now = new Date().toISOString()
  const users: Record<string, UserRecord> = {}
  for (const u of SEED_USERS) users[u.id] = { ...u, profileVersion: 1, updatedAt: now }
  const nftState: Record<string, NftState> = {}
  for (const n of catalog) nftState[n.id] = { price: n.price, previousPrice: n.previousPrice, editions: n.editions.map((e) => ({ ...e })), version: 1 }
  return {
    schema: DB_SCHEMA,
    nftState,
    users,
    sessions: {},
    favorites: structuredClone(SEED_FAVORITES),
    carts: {},
    userCarts: {},
    wallets: structuredClone(SEED_WALLETS),
    connections: {},
    quotes: {},
    orders: {},
    idempotency: {},
    seq: 1,
  }
}

function load(): DbState {
  const raw = safeStorage.get(DB_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === DB_SCHEMA) return parsed
    } catch {
      /* ignora e recria */
    }
  }
  return seedState()
}

export let state: DbState = load()
let persistTimer: ReturnType<typeof setTimeout> | undefined

const writeNow = () => {
  clearTimeout(persistTimer)
  persistTimer = undefined
  safeStorage.set(DB_KEY, JSON.stringify(state))
}

export function persist(immediate = false) {
  if (immediate) return writeNow()
  clearTimeout(persistTimer)
  persistTimer = setTimeout(writeNow, 50)
}

// Garante que nenhuma escrita pendente se perca em refresh/fechamento da aba.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => persistTimer !== undefined && writeNow())
}

export function resetDb() {
  for (const t of settleTimers.values()) clearTimeout(t)
  settleTimers.clear()
  state = seedState()
  persist(true)
}

export function nextId(prefix: string): string {
  state.seq += 1
  return `${prefix}_${state.seq.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

// ---------- NFTs ----------
export function allNfts(): NftDetail[] {
  return catalog
}

export function nftSummary(id: string): NftSummary | null {
  const base = catalogById.get(id)
  if (!base) return null
  const s = state.nftState[id]
  return {
    id: base.id,
    name: base.name,
    tokenId: base.tokenId,
    image: base.image,
    price: s.price,
    previousPrice: s.previousPrice,
    collection: base.collection,
    collectionName: base.collectionName,
    network: base.network,
    rarity: base.rarity,
    listedAt: base.listedAt,
    isTrending: base.isTrending,
    totalAvailable: s.editions.reduce((a, e) => a + e.available, 0),
    version: s.version,
  }
}

export function nftDetail(id: string): NftDetail | null {
  const base = catalogById.get(id)
  const summary = nftSummary(id)
  if (!base || !summary) return null
  const related = catalog
    .filter((n) => n.collection === base.collection && n.id !== id)
    .slice(0, 5)
    .map((n) => nftSummary(n.id)!)
  return { ...base, ...summary, editions: state.nftState[id].editions.map((e) => ({ ...e })), related }
}

function publishNftUpdate(id: string, previousPrice: string, changes: Array<'price' | 'availability'>) {
  const s = state.nftState[id]
  const summary = nftSummary(id)!
  const event: NftUpdatedEvent = {
    id: `evt_nft_${id}_v${s.version}`,
    type: 'nft.updated',
    resource: { type: 'nft', id },
    version: s.version,
    occurredAt: new Date().toISOString(),
    data: {
      name: summary.name,
      price: s.price,
      previousPrice,
      editions: s.editions.map((e) => ({ id: e.id, available: e.available })),
      totalAvailable: summary.totalAvailable,
      changes,
    },
  }
  bus.publish(event)
}

/** Altera preço e/ou disponibilidade, incrementa a versão e publica nft.updated. */
export function updateNft(id: string, patch: { price?: string; editions?: Array<{ id: string; available: number }> }) {
  const s = state.nftState[id]
  if (!s) throw new Error(`NFT ${id} inexistente`)
  const previousPrice = s.price
  const changes: Array<'price' | 'availability'> = []
  if (patch.price && patch.price !== s.price) {
    s.price = eth(patch.price).toFixed(2)
    changes.push('price')
  }
  if (patch.editions) {
    for (const p of patch.editions) {
      const e = s.editions.find((x) => x.id === p.id)
      if (e && e.available !== p.available) {
        e.available = Math.max(0, p.available)
        if (!changes.includes('availability')) changes.push('availability')
      }
    }
  }
  if (changes.length === 0) return
  s.version += 1
  persist()
  publishNftUpdate(id, previousPrice, changes)
}

// ---------- Usuários e sessão ----------
export function publicUser(u: UserRecord): UserPublic {
  return { id: u.id, username: u.username, displayName: u.displayName, email: u.email, avatarUrl: u.avatarUrl }
}

export function profileOf(u: UserRecord): Profile {
  return {
    id: u.id,
    displayName: u.displayName,
    username: u.username,
    email: u.email,
    ensName: u.ensName,
    ensSuffix: '.eth',
    walletNickname: u.walletNickname,
    avatarUrl: u.avatarUrl,
    version: u.profileVersion,
    updatedAt: u.updatedAt,
  }
}

export function findUserByEmail(email: string) {
  return Object.values(state.users).find((u) => u.email.toLowerCase() === email.toLowerCase())
}

export function findUserByUsername(username: string) {
  return Object.values(state.users).find((u) => u.username.toLowerCase() === username.toLowerCase())
}

export async function hashPassword(salt: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function createSession(userId: string, ttlMs: number) {
  const token = `tok_${nextId('s')}_${Math.random().toString(36).slice(2)}`
  const expiresAt = Date.now() + ttlMs
  state.sessions[token] = { userId, expiresAt }
  persist(true)
  return { token, expiresAt: new Date(expiresAt).toISOString() }
}

export type SessionLookup = { status: 'valid'; user: UserRecord } | { status: 'expired' } | { status: 'missing' }

export function lookupSession(token: string | null): SessionLookup {
  if (!token) return { status: 'missing' }
  const s = state.sessions[token]
  if (!s) return { status: 'expired' }
  if (s.expiresAt <= Date.now()) return { status: 'expired' }
  const user = state.users[s.userId]
  return user ? { status: 'valid', user } : { status: 'missing' }
}

export function expireAllSessions() {
  for (const s of Object.values(state.sessions)) s.expiresAt = 0
  persist()
}

// ---------- Carrinho ----------
export function getOrCreateCart(cartId: string, ownerId: string | null): CartRecord {
  if (ownerId) {
    const id = state.userCarts[ownerId]
    if (id && state.carts[id]) return state.carts[id]
    const cart: CartRecord = { id: `cart_${ownerId}`, ownerId, items: [], coupon: null, version: 1, updatedAt: new Date().toISOString() }
    state.carts[cart.id] = cart
    state.userCarts[ownerId] = cart.id
    persist()
    return cart
  }
  let cart = state.carts[cartId]
  if (!cart) {
    cart = { id: cartId, ownerId: null, items: [], coupon: null, version: 1, updatedAt: new Date().toISOString() }
    state.carts[cartId] = cart
    persist()
  }
  return cart
}

export function touchCart(cart: CartRecord) {
  cart.version += 1
  cart.updatedAt = new Date().toISOString()
  persist()
}

export function edition(nftId: string, editionId: string): Edition | undefined {
  return state.nftState[nftId]?.editions.find((e) => e.id === editionId)
}

export function serializeCart(cart: CartRecord): Cart {
  const items: CartItem[] = []
  for (const it of cart.items) {
    const nft = nftSummary(it.nftId)
    const ed = edition(it.nftId, it.editionId)
    if (!nft || !ed) continue
    items.push({ ...it, nft, edition: { ...ed } })
  }
  return { id: cart.id, ownerId: cart.ownerId, items, coupon: cart.coupon, version: cart.version, updatedAt: cart.updatedAt }
}

/** Mescla o carrinho do visitante no carrinho do usuário, respeitando disponibilidade. */
export function mergeCarts(guestCartId: string, ownerId: string): CartRecord {
  const target = getOrCreateCart('', ownerId)
  const guest = state.carts[guestCartId]
  if (guest && guest.ownerId === null && guest.id !== target.id) {
    for (const it of guest.items) {
      const ed = edition(it.nftId, it.editionId)
      if (!ed) continue
      const existing = target.items.find((x) => x.nftId === it.nftId && x.editionId === it.editionId)
      const limit = Math.min(ed.available, ed.maxPerOrder)
      if (existing) existing.quantity = Math.min(limit, existing.quantity + it.quantity)
      else if (limit > 0) target.items.push({ ...it, id: nextId('item'), quantity: Math.min(limit, it.quantity) })
    }
    if (!target.coupon && guest.coupon) target.coupon = guest.coupon
    delete state.carts[guestCartId]
    touchCart(target)
  }
  return target
}

// ---------- Cotação ----------
async function hashContent(content: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(content))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function couponStatus(code: string): { valid: boolean; expired: boolean } {
  const c = COUPONS[code.toUpperCase()]
  return { valid: !!c && !c.expired, expired: !!c?.expired }
}

export async function computeQuote(cart: CartRecord, network: Network, persistQuote = true): Promise<Quote> {
  const lines: QuoteLine[] = []
  const issues: QuoteIssue[] = []
  for (const it of cart.items) {
    const base = catalogById.get(it.nftId)
    const s = state.nftState[it.nftId]
    const ed = s?.editions.find((e) => e.id === it.editionId)
    if (!base || !s || !ed) continue
    if (ed.available === 0) issues.push({ type: 'UNAVAILABLE', itemId: it.id, nftId: it.nftId, name: base.name, edition: ed.label })
    else if (it.quantity > ed.available) issues.push({ type: 'QUANTITY_EXCEEDS', itemId: it.id, nftId: it.nftId, name: base.name, requested: it.quantity, available: ed.available })
    if (ethCmp(s.price, it.acknowledgedPrice) !== 0)
      issues.push({ type: 'PRICE_CHANGED', itemId: it.id, nftId: it.nftId, name: base.name, previousPrice: it.acknowledgedPrice, currentPrice: s.price })
    lines.push({
      itemId: it.id,
      nftId: it.nftId,
      editionId: it.editionId,
      editionLabel: ed.label,
      name: base.name,
      tokenId: base.tokenId,
      image: base.image,
      unitPrice: s.price,
      quantity: it.quantity,
      lineTotal: ethMul(s.price, it.quantity),
      available: ed.available,
    })
  }
  const subtotal = lines.length ? ethAdd(...lines.map((l) => l.lineTotal)) : '0'
  let discount = '0'
  let coupon: Quote['coupon'] = null
  if (cart.coupon) {
    const def = COUPONS[cart.coupon.code.toUpperCase()]
    if (!def) coupon = { code: cart.coupon.code, status: 'invalid', description: 'Cupom inválido' }
    else if (def.expired) coupon = { code: cart.coupon.code, status: 'expired', description: def.description }
    else {
      const raw = def.kind === 'percent' ? eth(subtotal).times(def.value) : eth(def.value)
      discount = (raw.gt(subtotal) ? eth(subtotal) : raw).round(6, 1).toString()
      coupon = { code: cart.coupon.code.toUpperCase(), status: 'applied', description: def.description }
    }
  }
  const networkFee = lines.length ? NETWORK_FEES[network] : '0'
  const total = eth(subtotal).minus(discount).plus(networkFee).toString()
  const content = { lines: lines.map((l) => [l.nftId, l.editionId, l.unitPrice, l.quantity, l.available > 0]), subtotal, discount, networkFee, total, coupon, network, issues: issues.length }
  const version = await hashContent(content)
  const now = Date.now()
  const quote: Quote = {
    id: `quo_${version}`,
    version,
    network,
    lines,
    subtotal,
    discount,
    networkFee,
    total,
    coupon,
    issues,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
  }
  if (persistQuote) {
    state.quotes[quote.id] = { quote, cartId: cart.id }
    persist()
  }
  return quote
}

// ---------- Carteiras ----------
export function walletsOf(userId: string) {
  if (!state.wallets[userId]) state.wallets[userId] = { primary: null, secondary: null }
  return state.wallets[userId]
}

export function findWallet(userId: string, walletId: string): Wallet | null {
  const w = walletsOf(userId)
  return [w.primary, w.secondary].find((x) => x?.id === walletId) ?? null
}

export function saveWallet(userId: string, slot: WalletSlot, data: Omit<Wallet, 'id' | 'slot' | 'updatedAt'>): Wallet {
  const w = walletsOf(userId)
  const current = w[slot]
  const wallet: Wallet = { ...data, id: current?.id ?? nextId('wal'), slot, updatedAt: new Date().toISOString() }
  w[slot] = wallet
  persist()
  return wallet
}

// ---------- Pedidos ----------
const settleTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function publicOrder(o: OrderRecord): Order {
  const { settleAt: _a, outcome: _b, cartId: _c, reserved: _d, ...rest } = o
  return structuredClone(rest)
}

function publishOrder(o: OrderRecord) {
  const event: OrderUpdatedEvent = {
    id: `evt_order_${o.id}_v${o.version}`,
    type: 'order.updated',
    resource: { type: 'order', id: o.id },
    version: o.version,
    occurredAt: new Date().toISOString(),
    data: { userId: o.userId, order: publicOrder(o) },
  }
  bus.publish(event, o.userId)
}

export function reserve(order: OrderRecord) {
  for (const r of order.reserved) {
    const s = state.nftState[r.nftId]
    const ed = s.editions.find((e) => e.id === r.editionId)!
    const prev = s.price
    ed.available -= r.quantity
    s.version += 1
    publishNftUpdate(r.nftId, prev, ['availability'])
  }
}

function release(order: OrderRecord) {
  for (const r of order.reserved) {
    const s = state.nftState[r.nftId]
    const ed = s.editions.find((e) => e.id === r.editionId)!
    ed.available += r.quantity
    s.version += 1
    publishNftUpdate(r.nftId, s.price, ['availability'])
  }
}

export function settleOrder(orderId: string, outcome?: 'confirm' | 'decline') {
  const o = state.orders[orderId]
  if (!o || o.status !== 'pending') return // estados terminais não mudam
  const result = outcome ?? o.outcome
  o.version += 1
  o.updatedAt = new Date().toISOString()
  if (result === 'confirm') {
    o.status = 'confirmed'
    const hash = `0x${(o.id + o.idempotencyKey).split('').map((c) => c.charCodeAt(0).toString(16)).join('').slice(0, 64).padEnd(64, 'a')}`
    o.transaction = { hash, explorerUrl: `/explorador/${hash}`, confirmedAt: o.updatedAt }
    // remove do carrinho somente itens e quantidades comprados
    const cart = state.carts[o.cartId]
    if (cart) {
      for (const line of o.lines) {
        const item = cart.items.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
        if (!item) continue
        item.quantity -= line.quantity
      }
      cart.items = cart.items.filter((i) => i.quantity > 0)
      if (cart.items.length === 0) cart.coupon = null
      touchCart(cart)
    }
  } else {
    o.status = 'declined'
    o.failureReason = 'O pagamento foi recusado pela carteira. Nenhum valor foi cobrado e seus itens continuam no carrinho.'
    release(o)
  }
  settleTimers.delete(orderId)
  persist(true)
  publishOrder(o)
}

export function scheduleSettlement(o: OrderRecord) {
  const wait = Math.max(0, o.settleAt - Date.now())
  clearTimeout(settleTimers.get(o.id))
  settleTimers.set(
    o.id,
    setTimeout(() => settleOrder(o.id), wait),
  )
}

/** Reagenda pedidos pendentes após refresh (a "blockchain" continua processando). */
export function resumePendingOrders() {
  for (const o of Object.values(state.orders)) if (o.status === 'pending') scheduleSettlement(o)
}

export type { OrderRecord, CartRecord, UserRecord }
