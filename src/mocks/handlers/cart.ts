import { http, HttpResponse } from 'msw'
import type { AddCartItemRequest, Network, QuoteRequest } from '@/api/contracts'
import {
  computeQuote,
  couponStatus,
  edition,
  getOrCreateCart,
  mergeCarts,
  nextId,
  nftSummary,
  serializeCart,
  state,
  touchCart,
  type CartRecord,
} from '../db'
import { errorResponse, optionalUser, requireUser, withNetwork } from '../network'
import { API } from './api-base'

type CartResolution = { ok: true; cart: CartRecord } | { ok: false; response: Response }

/** Carrinho do usuário autenticado (Bearer) ou do visitante (X-Cart-Id). */
function resolveCart(request: Request): CartResolution {
  const auth = optionalUser(request)
  if (!auth.ok) return auth
  if (auth.user) return { ok: true, cart: getOrCreateCart('', auth.user.id) }
  const cartId = request.headers.get('x-cart-id')
  if (!cartId || !/^guest_[a-z0-9-]{8,}$/i.test(cartId)) return { ok: false, response: errorResponse(400, 'VALIDATION_ERROR', 'Identificador de carrinho ausente.') }
  const existing = state.carts[cartId]
  if (existing?.ownerId) return { ok: false, response: errorResponse(403, 'FORBIDDEN', 'Carrinho pertence a outro usuário.') }
  return { ok: true, cart: getOrCreateCart(cartId, null) }
}

function limitFor(nftId: string, editionId: string) {
  const ed = edition(nftId, editionId)
  return ed ? { ed, limit: Math.min(ed.available, ed.maxPerOrder) } : null
}

function availabilityError(name: string, label: string, limit: number) {
  return errorResponse(
    409,
    'AVAILABILITY_CONFLICT',
    limit === 0 ? `A edição ${label} de ${name} está esgotada.` : `Só há ${limit} unidade(s) disponível(is) da edição ${label} de ${name} por pedido.`,
    { details: { available: limit } },
  )
}

export const cartHandlers = [
  http.get(
    `${API}/cart`,
    withNetwork(({ request }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      return HttpResponse.json(serializeCart(r.cart))
    }),
  ),

  http.post(
    `${API}/cart/items`,
    withNetwork(async ({ request }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const body = (await request.json()) as AddCartItemRequest
      const nft = nftSummary(body.nftId)
      const l = limitFor(body.nftId, body.editionId)
      if (!nft || !l) return errorResponse(404, 'NOT_FOUND', 'NFT ou edição inexistente.')
      if (!Number.isInteger(body.quantity) || body.quantity < 1) return errorResponse(422, 'VALIDATION_ERROR', 'Quantidade inválida.', { fieldErrors: { quantity: 'Quantidade inválida.' } })
      const existing = r.cart.items.find((i) => i.nftId === body.nftId && i.editionId === body.editionId)
      const next = (existing?.quantity ?? 0) + body.quantity
      if (next > l.limit) return availabilityError(nft.name, l.ed.label, l.limit)
      if (existing) {
        existing.quantity = next
        existing.acknowledgedPrice = nft.price
      } else r.cart.items.push({ id: nextId('item'), nftId: body.nftId, editionId: body.editionId, quantity: body.quantity, acknowledgedPrice: nft.price })
      touchCart(r.cart)
      return HttpResponse.json(serializeCart(r.cart), { status: 201 })
    }),
  ),

  http.patch(
    `${API}/cart/items/:itemId`,
    withNetwork(async ({ request, params }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const item = r.cart.items.find((i) => i.id === params.itemId)
      if (!item) return errorResponse(404, 'NOT_FOUND', 'Item não está no carrinho.')
      const { quantity } = (await request.json()) as { quantity: number }
      if (!Number.isInteger(quantity) || quantity < 1) return errorResponse(422, 'VALIDATION_ERROR', 'Quantidade inválida.')
      const l = limitFor(item.nftId, item.editionId)!
      if (quantity > l.limit) return availabilityError(nftSummary(item.nftId)!.name, l.ed.label, l.limit)
      item.quantity = quantity
      touchCart(r.cart)
      return HttpResponse.json(serializeCart(r.cart))
    }),
  ),

  http.delete(
    `${API}/cart/items/:itemId`,
    withNetwork(({ request, params }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const before = r.cart.items.length
      r.cart.items = r.cart.items.filter((i) => i.id !== params.itemId)
      if (r.cart.items.length === before) return errorResponse(404, 'NOT_FOUND', 'Item não está no carrinho.')
      if (r.cart.items.length === 0) r.cart.coupon = null
      touchCart(r.cart)
      return HttpResponse.json(serializeCart(r.cart))
    }),
  ),

  http.put(
    `${API}/cart/coupon`,
    withNetwork(async ({ request }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const { code } = (await request.json()) as { code: string }
      const c = (code ?? '').trim().toUpperCase()
      if (!c) return errorResponse(422, 'VALIDATION_ERROR', 'Digite um código promocional.', { fieldErrors: { code: 'Digite um código promocional.' } })
      if (r.cart.items.length === 0) return errorResponse(422, 'VALIDATION_ERROR', 'Adicione itens antes de aplicar um cupom.', { fieldErrors: { code: 'Adicione itens antes de aplicar um cupom.' } })
      const s = couponStatus(c)
      if (s.expired) return errorResponse(422, 'COUPON_EXPIRED', `O cupom ${c} expirou.`, { fieldErrors: { code: `O cupom ${c} expirou.` } })
      if (!s.valid) return errorResponse(422, 'COUPON_INVALID', `O cupom ${c} é inválido.`, { fieldErrors: { code: `O cupom ${c} é inválido.` } })
      r.cart.coupon = { code: c }
      touchCart(r.cart)
      return HttpResponse.json(serializeCart(r.cart))
    }),
  ),

  http.delete(
    `${API}/cart/coupon`,
    withNetwork(({ request }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      r.cart.coupon = null
      touchCart(r.cart)
      return HttpResponse.json(serializeCart(r.cart))
    }),
  ),

  http.post(
    `${API}/cart/acknowledge`,
    withNetwork(async ({ request }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const { adjustQuantities } = ((await request.json().catch(() => ({}))) ?? {}) as { adjustQuantities?: boolean }
      for (const it of r.cart.items) {
        it.acknowledgedPrice = nftSummary(it.nftId)!.price
        if (adjustQuantities) {
          const l = limitFor(it.nftId, it.editionId)!
          it.quantity = Math.min(it.quantity, l.limit)
        }
      }
      if (adjustQuantities) r.cart.items = r.cart.items.filter((i) => i.quantity > 0)
      touchCart(r.cart)
      return HttpResponse.json(serializeCart(r.cart))
    }),
  ),

  http.post(
    `${API}/cart/merge`,
    withNetwork(async ({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const { guestCartId } = (await request.json()) as { guestCartId: string }
      const cart = mergeCarts(guestCartId, auth.user.id)
      return HttpResponse.json(serializeCart(cart))
    }),
  ),

  http.post(
    `${API}/quote`,
    withNetwork(async ({ request }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const body = ((await request.json().catch(() => ({}))) ?? {}) as Partial<QuoteRequest>
      const network: Network = body.network === 'polygon' || body.network === 'solana' ? body.network : 'ethereum'
      return HttpResponse.json(await computeQuote(r.cart, network))
    }),
  ),
]
