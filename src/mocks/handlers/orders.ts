import { delay, http, HttpResponse } from 'msw'
import type { CreateOrderRequest, Order, WalletType } from '@/api/contracts'
import { WALLET_TYPES } from '@/api/contracts'
import { collectorSchema, fieldErrorsOf } from '@/api/schemas'
import { eth } from '@/lib/eth'
import {
  computeQuote,
  findWallet,
  getOrCreateCart,
  nextId,
  persist,
  publicOrder,
  reserve,
  scheduleSettlement,
  state,
  updateNft,
  type OrderRecord,
} from '../db'
import { bearer, config, errorResponse, requireUser, setConfig, withNetwork } from '../network'
import { API } from './api-base'

async function sha(value: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const orderHandlers = [
  http.post(
    `${API}/orders`,
    withNetwork(async ({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const user = auth.user
      const key = request.headers.get('idempotency-key')
      if (!key || key.length < 8) return errorResponse(400, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key obrigatório.')
      const body = (await request.json()) as CreateOrderRequest
      const bodyHash = await sha(body)
      const idemKey = `${user.id}:${key}`
      const previous = state.idempotency[idemKey]
      if (previous) {
        if (previous.bodyHash !== bodyHash)
          return errorResponse(409, 'IDEMPOTENCY_CONFLICT', 'Esta tentativa de compra já foi usada com outro conteúdo. Revise o pedido novamente.')
        return HttpResponse.json(publicOrder(state.orders[previous.orderId]), { status: 200, headers: { 'Idempotent-Replay': 'true' } })
      }

      const parsed = collectorSchema.safeParse(body.collector)
      if (!parsed.success) return errorResponse(422, 'VALIDATION_ERROR', 'Revise os dados do colecionador.', { fieldErrors: fieldErrorsOf(parsed.error) })

      // Conexão da carteira (simulada por sessão)
      const token = bearer(request)!
      const connection = state.connections[token]
      if (config.walletConnect === 'disconnect' && connection) {
        state.connections[token] = null
        persist()
        setConfig({ ...config, walletConnect: 'connect' })
        return errorResponse(428, 'WALLET_DISCONNECTED', 'A carteira foi desconectada. Conecte novamente para enviar o pedido.')
      }
      if (!connection || connection.walletId !== body.walletId || connection.network !== body.network)
        return errorResponse(428, 'WALLET_DISCONNECTED', 'Conecte a carteira selecionada antes de confirmar a compra.')

      const cart = getOrCreateCart('', user.id)

      // Cenários: mudanças "do mundo" no momento exato da confirmação (via eventos reais)
      const first = cart.items[0]
      if (first && config.priceChangeOnCheckout) {
        setConfig({ ...config, priceChangeOnCheckout: false })
        const s = state.nftState[first.nftId]
        updateNft(first.nftId, { price: eth(s.price).plus('0.10').toFixed(2) })
      }
      if (first && config.soldOutOnCheckout) {
        setConfig({ ...config, soldOutOnCheckout: false })
        updateNft(first.nftId, { editions: [{ id: first.editionId, available: 0 }] })
      }

      const fresh = await computeQuote(cart, body.network)
      if (fresh.lines.length === 0) return errorResponse(422, 'VALIDATION_ERROR', 'Seu carrinho está vazio.')
      if (fresh.version !== body.quoteVersion || fresh.issues.length > 0)
        return errorResponse(409, 'QUOTE_OUTDATED', 'Preço, disponibilidade ou taxas mudaram. Revise e confirme novamente.', { details: { quote: fresh } })
      if (fresh.coupon && fresh.coupon.status !== 'applied')
        return errorResponse(422, fresh.coupon.status === 'expired' ? 'COUPON_EXPIRED' : 'COUPON_INVALID', 'O cupom aplicado não é mais válido.')

      const wallet =
        body.walletId === 'external'
          ? { id: 'external', label: 'Outra carteira', walletType: body.collector.walletType, address: body.collector.walletAddress }
          : (() => {
              const w = findWallet(user.id, body.walletId)
              return w ? { id: w.id, label: w.nickname, walletType: w.walletType, address: w.address } : null
            })()
      if (!wallet) return errorResponse(404, 'NOT_FOUND', 'Carteira não encontrada.')

      const now = new Date()
      const order: OrderRecord = {
        id: nextId('ord'),
        userId: user.id,
        status: 'pending',
        version: 1,
        idempotencyKey: key,
        network: body.network,
        wallet: { ...wallet, label: wallet.label || WALLET_TYPES.find((w) => w.id === (wallet.walletType as WalletType))?.name || 'Carteira' },
        lines: fresh.lines.map((l) => ({
          nftId: l.nftId,
          editionId: l.editionId,
          editionLabel: l.editionLabel,
          name: l.name,
          tokenId: l.tokenId,
          image: l.image,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          lineTotal: l.lineTotal,
        })),
        subtotal: fresh.subtotal,
        discount: fresh.discount,
        networkFee: fresh.networkFee,
        total: fresh.total,
        coupon: fresh.coupon?.code ?? null,
        transaction: null,
        failureReason: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        settleAt: now.getTime() + config.paymentDelayMs,
        outcome: config.payment,
        cartId: cart.id,
        reserved: fresh.lines.map((l) => ({ nftId: l.nftId, editionId: l.editionId, quantity: l.quantity })),
      }
      state.orders[order.id] = order
      state.idempotency[idemKey] = { orderId: order.id, bodyHash }
      reserve(order)
      persist(true)
      scheduleSettlement(order)

      if (config.orderTimeoutOnce) {
        // Pedido criado, mas a resposta "se perde": o cliente estoura o timeout.
        setConfig({ ...config, orderTimeoutOnce: false })
        await delay(config.orderTimeoutMs)
        return HttpResponse.error()
      }
      return HttpResponse.json(publicOrder(order), { status: 201 })
    }),
  ),

  http.get(
    `${API}/orders`,
    withNetwork(({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const status = new URL(request.url).searchParams.get('status')
      const list: Order[] = Object.values(state.orders)
        .filter((o) => o.userId === auth.user.id && (!status || o.status === status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(publicOrder)
      return HttpResponse.json({ items: list })
    }),
  ),

  http.get(
    `${API}/orders/:id`,
    withNetwork(({ request, params }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const o = state.orders[String(params.id)]
      // Pedido de outro usuário responde 404 para não revelar existência.
      if (!o || o.userId !== auth.user.id) return errorResponse(404, 'NOT_FOUND', 'Pedido não encontrado.')
      return HttpResponse.json(publicOrder(o))
    }),
  ),
]
