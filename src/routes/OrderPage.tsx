import { useEffect } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Loader2, XCircle } from 'lucide-react'
import type { Order } from '@/api/contracts'
import { NETWORKS, WALLET_TYPES } from '@/api/contracts'
import { ApiError } from '@/api/errors'
import { ErrorState, NotFoundState, RequireAuth } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useOrder } from '@/features/account/hooks'
import { clearAttempt, clearDraft } from '@/features/checkout/attempt'
import { formatEth } from '@/lib/eth'
import { useSession } from '@/lib/session'
import { usePageTitle } from '@/lib/usePageTitle'
import { formatDate, shortHash } from '@/lib/utils'

function ThankYouIcon() {
  return (
    <svg viewBox="0 0 64 56" className="mx-auto h-12 w-14 text-primary" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 22L32 4l26 18v28a2 2 0 01-2 2H8a2 2 0 01-2-2z" />
      <path d="M6 22l26 18 26-18" />
      <rect x="16" y="12" width="32" height="18" rx="1" fill="var(--surface)" />
      <text x="32" y="20" textAnchor="middle" fontSize="6" fill="currentColor" stroke="none" fontWeight="700">
        THANK
      </text>
      <text x="32" y="27" textAnchor="middle" fontSize="6" fill="currentColor" stroke="none" fontWeight="700">
        YOU
      </text>
    </svg>
  )
}

/** Recibo: reproduz exclusivamente o snapshot do pedido (não consulta o catálogo). */
function Receipt({ order }: { order: Order }) {
  const network = NETWORKS.find((n) => n.id === order.network)?.name ?? order.network
  const walletName = WALLET_TYPES.find((w) => w.id === order.wallet.walletType)?.name ?? order.wallet.label
  return (
    <>
      <ThankYouIcon />
      <DialogTitle className="mt-2 text-center text-sm font-semibold text-primary">Seus NFTs agora estão na sua carteira</DialogTitle>
      <DialogDescription className="sr-only">Pedido confirmado. Recibo da transação.</DialogDescription>
      <dl className="-mx-6 mt-4 grid grid-cols-2 gap-y-3 border-y border-primary/70 px-6 py-3 text-[11px] sm:grid-cols-4 sm:divide-x sm:divide-border">
        <div className="sm:pr-2">
          <dt className="font-semibold">ID da transação</dt>
          <dd className="text-muted-foreground" data-testid="tx-id">
            {shortHash(order.transaction!.hash, 6, 4)}
          </dd>
        </div>
        <div className="sm:px-2">
          <dt className="font-semibold">Data</dt>
          <dd className="text-muted-foreground">{formatDate(order.transaction!.confirmedAt)}</dd>
        </div>
        <div className="sm:px-2">
          <dt className="font-semibold">Total</dt>
          <dd className="text-muted-foreground">{formatEth(order.total)}</dd>
        </div>
        <div className="sm:pl-2">
          <dt className="font-semibold">Carteira</dt>
          <dd className="text-muted-foreground">{walletName}</dd>
        </div>
      </dl>
      <h3 className="mt-4 text-xs font-semibold">Detalhes da transação</h3>
      <table className="mt-2 w-full text-xs" data-testid="receipt-lines">
        <thead>
          <tr className="text-left">
            <th scope="col" className="pb-2 font-semibold">
              NFTs
            </th>
            <th scope="col" className="pb-2 text-center font-semibold">
              Edições
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={`${l.nftId}-${l.editionId}`}>
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  <img src={l.image.srcSm} alt="" width={36} height={36} className="size-9 rounded-sm object-cover" />
                  <div>
                    <p className="font-semibold">{l.name}</p>
                    <p className="text-[10px] text-primary">
                      ID do token: {l.tokenId} · {l.editionLabel}
                    </p>
                  </div>
                </div>
              </td>
              <td className="text-center text-muted-foreground">(x {l.quantity})</td>
              <td className="text-right font-semibold text-primary">{formatEth(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto mt-3 grid w-full max-w-60 grid-cols-2 gap-y-1 text-xs">
        {order.discount !== '0' && (
          <>
            <dt>Desconto{order.coupon ? ` (${order.coupon})` : ''}</dt>
            <dd className="text-right">(-) {formatEth(order.discount)}</dd>
          </>
        )}
        <dt>Taxa de rede</dt>
        <dd className="text-right">{formatEth(order.networkFee)}</dd>
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-bold text-primary" data-testid="receipt-total">
          {formatEth(order.total)}
        </dd>
      </dl>
      <p className="mt-4 border-t border-border pt-3 text-center text-[11px] text-muted-foreground">
        Transação confirmada na {network}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
      </p>
      <div className="mt-4 flex justify-center">
        <Button asChild size="sm">
          <Link to="/explorador/$hash" params={{ hash: order.transaction!.hash }}>
            Ver no Etherscan <span className="sr-only">(explorador simulado)</span>
          </Link>
        </Button>
      </div>
    </>
  )
}

function OrderInner() {
  const { orderId } = useParams({ from: '/pedido/$orderId' })
  const session = useSession()
  const navigate = useNavigate()
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId)
  usePageTitle(order?.status === 'confirmed' ? 'Pedido confirmado' : 'Pedido')

  useEffect(() => {
    if (order && order.status !== 'pending' && session.user) {
      clearAttempt(session.user.id)
      if (order.status === 'confirmed') clearDraft(session.user.id)
    }
  }, [order, session.user])

  if (isError && error instanceof ApiError && error.code === 'NOT_FOUND') return <NotFoundState title="Pedido não encontrado" description="Este pedido não existe ou pertence a outra conta." />

  const close = () => void navigate({ to: order?.status === 'declined' ? '/carrinho' : '/' })

  return (
    <div className="min-h-[60vh]">
      <Dialog open onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-[440px]" data-testid={`order-${order?.status ?? 'loading'}`}>
          {isPending ? (
            <div className="flex flex-col items-center py-8" aria-busy="true">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
              <DialogTitle className="mt-3 text-sm">Carregando pedido…</DialogTitle>
              <DialogDescription className="sr-only">Buscando o estado do pedido.</DialogDescription>
            </div>
          ) : isError || !order ? (
            <>
              <DialogTitle className="sr-only">Erro ao carregar pedido</DialogTitle>
              <DialogDescription className="sr-only">Falha ao consultar o pedido.</DialogDescription>
              <ErrorState error={error} onRetry={() => void refetch()} title="Não foi possível consultar o pedido" />
            </>
          ) : order.status === 'pending' ? (
            <div className="flex flex-col items-center py-6 text-center" role="status" aria-live="polite">
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
              <DialogTitle className="mt-4 text-base">Aguardando confirmação na rede</DialogTitle>
              <DialogDescription className="mt-2 max-w-xs text-xs">
                Seu pedido de {formatEth(order.total)} foi registrado e está sendo processado. Você pode recarregar ou fechar esta página: o estado será recuperado sem criar outra compra.
              </DialogDescription>
              <p className="mt-3 text-[11px] text-muted-foreground">Pedido {order.id}</p>
            </div>
          ) : order.status === 'declined' ? (
            <div className="flex flex-col items-center py-4 text-center" role="alert">
              <XCircle className="size-9 text-destructive" aria-hidden="true" />
              <DialogTitle className="mt-3 text-base">Pagamento recusado</DialogTitle>
              <DialogDescription className="mt-2 text-xs">{order.failureReason}</DialogDescription>
              <div className="mt-5 flex gap-2">
                <Button variant="outline" asChild>
                  <Link to="/carrinho">Voltar ao carrinho</Link>
                </Button>
                <Button asChild>
                  <Link to="/pagamento">Tentar novamente</Link>
                </Button>
              </div>
            </div>
          ) : (
            <Receipt order={order} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function OrderPage() {
  return (
    <RequireAuth>
      <OrderInner />
    </RequireAuth>
  )
}

export function ExplorerPage() {
  const { hash } = useParams({ from: '/explorador/$hash' })
  usePageTitle('Explorador simulado')
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-12">
      <p className="text-xs uppercase tracking-widest text-primary">Explorador simulado</p>
      <h1 className="mt-2 text-xl font-bold">Transação</h1>
      <p className="mt-4 break-all rounded-sm bg-surface p-4 font-mono text-xs" data-testid="explorer-hash">
        {hash}
      </p>
      <p className="mt-4 max-w-xl text-xs text-muted-foreground">
        Esta é uma referência de transação fictícia gerada pela simulação. Nenhuma transação real foi enviada à blockchain; integrações com exploradores reais estão fora do escopo desta entrega.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">Voltar para o início</Link>
      </Button>
    </div>
  )
}
