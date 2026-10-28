import { Link, useNavigate } from '@tanstack/react-router'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import type { CartItem, QuoteLine } from '@/api/contracts'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { authDialog } from '@/features/auth/auth-dialog-store'
import { CouponForm, SummaryRows } from '@/features/cart/CartSummary'
import { useCart, useQuote, useRemoveCartItem, useUpdateCartItem } from '@/features/cart/hooks'
import { QuoteIssues } from '@/features/cart/QuoteIssues'
import { useCatalog } from '@/features/catalog/hooks'
import { NftStrip } from '@/features/catalog/NftStrip'
import { formatEth } from '@/lib/eth'
import { useSession } from '@/lib/session'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { useIsMobile } from '@/hooks/useIsMobile'

function Stepper({ item, line, mobile }: { item: CartItem; line?: QuoteLine; mobile?: boolean }) {
  const update = useUpdateCartItem()
  const max = Math.min(item.edition.available, item.edition.maxPerOrder)
  const pendingQty = update.isPending ? update.variables?.quantity : undefined
  const qty = pendingQty ?? item.quantity
  const set = (q: number) => update.mutate({ itemId: item.id, quantity: q })
  return (
    <div className="flex items-center gap-2" role="group" aria-label={`Quantidade de ${item.nft.name}`}>
      <button type="button" className={cn('flex items-center justify-center rounded-full disabled:opacity-40', mobile ? 'size-7 bg-[#4a2f22] text-foreground' : 'size-5 bg-primary text-primary-foreground')} onClick={() => set(qty - 1)} disabled={qty <= 1 || update.isPending} aria-label={`Diminuir quantidade de ${item.nft.name}`}>
        <Minus className="size-3" aria-hidden="true" />
      </button>
      <span className="w-5 text-center tabular-nums" aria-live="polite" data-testid="item-qty">
        {qty}
      </span>
      <button type="button" className={cn('flex items-center justify-center rounded-full disabled:opacity-40', mobile ? 'size-7 bg-[#4a2f22] text-foreground' : 'size-5 bg-primary text-primary-foreground')} onClick={() => set(qty + 1)} disabled={qty >= max || update.isPending} aria-label={`Aumentar quantidade de ${item.nft.name}`}>
        <Plus className="size-3" aria-hidden="true" />
      </button>
      {line && line.available < item.quantity && <span className="sr-only">Quantidade acima do disponível</span>}
    </div>
  )
}

function Row({ item, line }: { item: CartItem; line?: QuoteLine }) {
  const remove = useRemoveCartItem()
  const unit = line?.unitPrice ?? item.nft.price
  const total = line?.lineTotal
  return (
    <li className="grid grid-cols-[48px_1fr_auto] items-center gap-x-3 gap-y-2 rounded-sm bg-surface p-2 text-xs md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_32px] md:gap-4 md:px-2" data-testid="cart-row">
      <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
        <img src={item.nft.image.srcSm} alt="" width={48} height={48} className="size-12 shrink-0 rounded-sm object-cover" />
        <div className="min-w-0">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="block truncate font-semibold hover:text-primary">
            {item.nft.name}
          </Link>
          <p className="text-[11px] text-primary">ID do token: {item.nft.tokenId}</p>
          <p className="text-[11px] text-muted-foreground">Edição {item.edition.label}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => remove.mutate({ itemId: item.id, name: item.nft.name })}
        disabled={remove.isPending}
        className="justify-self-end rounded p-1 text-foreground hover:text-destructive md:order-last"
        aria-label={`Remover ${item.nft.name} do carrinho`}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
      <p className="col-span-3 flex justify-between font-semibold text-primary md:col-span-1 md:block">
        <span className="font-normal text-foreground md:sr-only">Preço</span>
        {formatEth(unit)}
      </p>
      <div className="col-span-3 flex items-center justify-between md:col-span-1 md:block">
        <span className="md:sr-only">Edições</span>
        <Stepper item={item} line={line} />
      </div>
      <p className="col-span-3 flex justify-between font-semibold text-primary md:col-span-1 md:block" data-testid="row-total">
        <span className="font-normal text-foreground md:sr-only">Total</span>
        {total ? formatEth(total) : <Skeleton className="inline-block h-4 w-16" />}
      </p>
    </li>
  )
}

/** Item do carrinho no Figma mobile: arte à esquerda, nome/edição/total e stepper à direita. */
function MobileRow({ item, line }: { item: CartItem; line?: QuoteLine }) {
  const remove = useRemoveCartItem()
  return (
    <li className="relative flex overflow-hidden rounded-2xl bg-surface" data-testid="cart-row">
      <img src={item.nft.image.srcSm} alt="" width={112} height={112} className="w-[100px] shrink-0 self-stretch object-cover" />
      <div className="flex min-w-0 flex-1 items-center gap-2 py-3 pl-3 pr-3">
        <div className="min-w-0 flex-1">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="block truncate text-sm font-bold hover:text-primary">
            {item.nft.name}
          </Link>
          <p className="mt-0.5 text-xs text-[#c9a27c]">Edição: {item.edition.label}</p>
          <p className="mt-2 text-lg font-bold text-primary" data-testid="row-total">
            {line ? formatEth(line.lineTotal) : <Skeleton className="inline-block h-5 w-16" />}
          </p>
        </div>
        <Stepper item={item} line={line} mobile />
      </div>
      <button
        type="button"
        onClick={() => remove.mutate({ itemId: item.id, name: item.nft.name })}
        disabled={remove.isPending}
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:text-destructive"
        aria-label={`Remover ${item.nft.name} do carrinho`}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </li>
  )
}

function CartSkeleton() {
  return (
    <ul className="flex flex-col gap-2" aria-hidden="true" data-testid="cart-skeleton">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-sm bg-surface p-2">
          <Skeleton className="size-12" />
          <Skeleton className="h-4 flex-1" />
        </li>
      ))}
    </ul>
  )
}

export function CartPage() {
  usePageTitle('Carrinho')
  const session = useSession()
  const navigate = useNavigate()
  const cart = useCart()
  const quote = useQuote('ethereum', cart.data)
  const related = useCatalog({ sort: 'popular', tab: 'trending', page: 1, pageSize: 5 })
  const items = cart.data?.items ?? []
  const lines = new Map(quote.data?.lines.map((l) => [l.itemId, l]))
  const hasIssues = (quote.data?.issues.length ?? 0) > 0
  const quoteUpdating = quote.isFetching && (quote.isPlaceholderData || !!quote.data)

  const isMobile = useIsMobile()
  const checkout = () => {
    if (!session.user) {
      authDialog.open('login', { reason: 'required', redirect: '/pagamento' })
      return
    }
    void navigate({ to: '/pagamento' })
  }

  if (isMobile)
    return (
      <div className="flex min-h-dvh flex-col">
        <MobileTopBar title="Carrinho de NFTs" />
        <section aria-label="Itens do carrinho" className="flex-1 px-4 pt-4">
          <QuoteIssues quote={quote.data} />
          {cart.isPending ? (
            <CartSkeleton />
          ) : cart.isError ? (
            <ErrorState error={cart.error} onRetry={() => void cart.refetch()} title="Não foi possível carregar o carrinho" />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl bg-surface px-6 py-12 text-center" data-testid="cart-empty">
              <ShoppingCart className="size-7 text-primary" aria-hidden="true" />
              <p className="mt-3 text-base font-semibold">Seu carrinho está vazio</p>
              <Button asChild className="mt-4 rounded-full" size="sm">
                <Link to="/" hash="catalogo">
                  Explorar NFTs
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((i) => (
                <MobileRow key={i.id} item={i} line={lines.get(i.id)} />
              ))}
            </ul>
          )}
        </section>
        <aside aria-label="Resumo da carteira" className="mt-6 rounded-t-[28px] bg-[#221510] px-4 pb-6 pt-6">
          <CouponForm currentCode={cart.data?.coupon?.code ?? null} variant="pill" />
          <div className="mt-2 text-sm [&_dl]:gap-3 [&_dl]:text-sm">
            {items.length === 0 && !cart.isPending ? (
              <SummaryRows quote={{ subtotal: '0', discount: '0', networkFee: '0', total: '0' } as never} />
            ) : quote.isError && !quote.data ? (
              <ErrorState error={quote.error} onRetry={() => void quote.refetch()} title="Falha ao calcular a cotação" className="py-6" />
            ) : (
              <SummaryRows quote={quote.data} updating={quoteUpdating} />
            )}
          </div>
          <button
            type="button"
            onClick={checkout}
            disabled={items.length === 0 || !quote.data || hasIssues || quoteUpdating}
            className="mt-6 h-14 w-full rounded-full bg-gradient-to-r from-[#e0a06a] to-[#b8743c] text-base font-semibold text-primary-foreground shadow-md disabled:opacity-55"
            data-testid="checkout-button"
          >
            Conectar e finalizar
          </button>
          {hasIssues && <p className="mt-2 text-center text-[11px] text-accent-foreground">Revise as alterações acima para continuar.</p>}
        </aside>
      </div>
    )

  return (
    <>
      <div className="mx-auto max-w-[1180px] px-4 pt-6">
        <nav aria-label="Trilha" className="text-xs">
          <ol className="flex gap-1">
            <li>
              <Link to="/" className="hover:text-primary">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/mercado" className="hover:text-primary">
                Mercado
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Carrinho</li>
          </ol>
        </nav>
        <h1 className="sr-only">Carrinho de NFTs</h1>

        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
          <section aria-label="Itens do carrinho" className="min-w-0">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_32px] gap-4 border-b border-[#5a3b24] px-2 pb-2 text-xs font-semibold md:grid" aria-hidden="true">
              <span>NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
              <span />
            </div>
            <div className="mt-3">
              <QuoteIssues quote={quote.data} />
              {cart.isPending ? (
                <CartSkeleton />
              ) : cart.isError ? (
                <ErrorState error={cart.error} onRetry={() => void cart.refetch()} title="Não foi possível carregar o carrinho" />
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center rounded-sm bg-surface px-6 py-12 text-center" data-testid="cart-empty">
                  <ShoppingCart className="size-7 text-primary" aria-hidden="true" />
                  <p className="mt-3 text-base font-semibold">Seu carrinho está vazio</p>
                  <p className="mt-1 text-xs text-muted-foreground">Explore o catálogo e adicione NFTs à sua coleção.</p>
                  <Button asChild className="mt-4" size="sm">
                    <Link to="/" hash="catalogo">
                      Explorar NFTs
                    </Link>
                  </Button>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((i) => (
                    <Row key={i.id} item={i} line={lines.get(i.id)} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <aside aria-labelledby="summary-title" className="lg:pt-0">
            <h2 id="summary-title" className="mb-4 text-sm font-semibold">
              Resumo da carteira
            </h2>
            <CouponForm currentCode={cart.data?.coupon?.code ?? null} />
            <div className="mt-3">
              {items.length === 0 && !cart.isPending ? (
                <SummaryRows quote={{ subtotal: '0', discount: '0', networkFee: '0', total: '0' } as never} />
              ) : quote.isError && !quote.data ? (
                <ErrorState error={quote.error} onRetry={() => void quote.refetch()} title="Falha ao calcular a cotação" className="py-6" />
              ) : (
                <SummaryRows quote={quote.data} updating={quoteUpdating} />
              )}
            </div>
            {quote.data?.coupon && quote.data.coupon.status !== 'applied' && (
              <p className="mt-2 text-xs text-destructive" role="alert">
                O cupom {quote.data.coupon.code} {quote.data.coupon.status === 'expired' ? 'expirou' : 'é inválido'} e não foi aplicado.
              </p>
            )}
            <Button className={cn('mt-5 w-full')} onClick={checkout} disabled={items.length === 0 || !quote.data || hasIssues || quoteUpdating} data-testid="checkout-button">
              Conectar e finalizar
            </Button>
            {hasIssues && <p className="mt-2 text-center text-[11px] text-accent-foreground">Revise as alterações acima para continuar.</p>}
            <Link to="/" hash="catalogo" className="mt-3 block text-center text-xs text-primary hover:underline">
              Continuar explorando
            </Link>
          </aside>
        </div>
      </div>
      <NftStrip id="also-viewed" title="Colecionadores também viram" items={related.data?.items} loading={related.isPending} />
    </>
  )
}
