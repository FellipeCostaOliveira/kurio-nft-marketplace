import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ChevronLeft, Heart, Mail, Minus, Plus, ShoppingCart, Star, ZoomIn } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ethMul } from '@/lib/eth'
import * as RG from '@radix-ui/react-radio-group'
import type { NftDetail } from '@/api/contracts'
import { ApiError } from '@/api/errors'
import { ErrorState, NotFoundState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc'
import { useAddToCart, useCart } from '@/features/cart/hooks'
import { useFavorites, useNftDetail, useToggleFavorite } from '@/features/catalog/hooks'
import { NftStrip } from '@/features/catalog/NftStrip'
import { formatEth } from '@/lib/eth'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn, formatDate } from '@/lib/utils'

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`Avaliação ${rating} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('size-3', i < rating ? 'fill-primary text-primary' : 'text-muted-foreground')} aria-hidden="true" />
      ))}
    </span>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pt-6" aria-busy="true" aria-label="Carregando NFT" data-testid="detail-skeleton">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-[64px_1fr] gap-3 sm:grid-cols-[80px_1fr]">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
          <Skeleton className="aspect-square w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}

function Gallery({ nft }: { nft: NftDetail }) {
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(false)
  const img = nft.gallery[active] ?? nft.image
  return (
    <div className="grid grid-cols-[60px_1fr] gap-3 sm:grid-cols-[76px_1fr] lg:grid-cols-[86px_1fr] lg:gap-4">
      <ul className="flex flex-col gap-3" aria-label="Galeria de imagens">
        {nft.gallery.map((g, i) => (
          <li key={g.src}>
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={active === i}
              aria-label={`Ver imagem ${i + 1}: ${g.alt}`}
              className={cn('block overflow-hidden rounded-sm border-2', active === i ? 'border-primary' : 'border-transparent hover:border-border')}
            >
              <img src={g.srcSm} alt="" width={86} height={86} className="aspect-square w-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative rounded-md bg-surface p-3 sm:p-5">
        <img src={img.src} alt={img.alt} width={640} height={640} fetchPriority="high" className="aspect-square w-full rounded-xl object-cover" />
        <button type="button" onClick={() => setZoom(true)} className="absolute right-4 top-4 rounded-full bg-background/80 p-1.5 hover:text-primary" aria-label="Ampliar imagem">
          <ZoomIn className="size-4" aria-hidden="true" />
        </button>
      </div>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(92vw,720px)] p-3" accentBar={false}>
          <DialogTitle className="sr-only">{nft.name} ampliado</DialogTitle>
          <DialogDescription className="sr-only">{img.alt}</DialogDescription>
          <img src={img.src} alt={img.alt} className="w-full rounded-md" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Purchase({ nft, variant = 'default' }: { nft: NftDetail; variant?: 'default' | 'mobile' }) {
  const navigate = useNavigate()
  const add = useAddToCart()
  const cart = useCart()
  const favorites = useFavorites()
  const fav = useToggleFavorite()
  const isFav = !!favorites.data?.nftIds.includes(nft.id)
  const defaultEdition = useMemo(() => nft.editions.find((e) => e.id === 'e50' && e.available > 0) ?? nft.editions.find((e) => e.available > 0) ?? nft.editions[0], [nft.editions])
  const [editionId, setEditionId] = useState(defaultEdition.id)
  const [qty, setQty] = useState(1)
  const edition = nft.editions.find((e) => e.id === editionId) ?? defaultEdition
  const inCart = cart.data?.items.find((i) => i.nftId === nft.id && i.editionId === edition.id)?.quantity ?? 0
  const limit = Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart)
  const soldOut = edition.available === 0

  // Disponibilidade mudou (tempo real): mantém a quantidade dentro do limite.
  useEffect(() => {
    if (qty > Math.max(1, limit)) setQty(Math.max(1, limit))
  }, [limit, qty])

  const prevPrice = useRef(nft.price)
  const [priceNotice, setPriceNotice] = useState<string | null>(null)
  useEffect(() => {
    if (prevPrice.current !== nft.price) {
      setPriceNotice(`Preço atualizado de ${formatEth(prevPrice.current)} para ${formatEth(nft.price)}.`)
      prevPrice.current = nft.price
    }
  }, [nft.price])

  const buy = () => {
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: qty, name: nft.name },
      { onSuccess: () => void navigate({ to: '/carrinho' }) },
    )
  }

  if (variant === 'mobile') {
    const avg = nft.reviews.length ? nft.reviews.reduce((a, r) => a + r.rating, 0) / nft.reviews.length : nft.rating
    return (
      <>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold">{nft.name}</h1>
          <a href="#avaliacoes" className="flex shrink-0 items-center gap-1 rounded-full border border-primary px-2.5 py-0.5 text-xs font-semibold" aria-label={`Nota ${avg.toFixed(1)} de 5 em ${nft.reviewsCount} avaliações`}>
            <Star className="size-3.5 fill-primary text-primary" aria-hidden="true" />
            {avg.toFixed(1).replace('.', ',')}
            <span className="font-normal text-muted-foreground">({nft.reviewsCount})</span>
          </a>
        </div>
        <p aria-live="polite" className="text-xs text-accent-foreground" data-testid="price-notice">
          {priceNotice}
        </p>
        <h2 className="sr-only">Sobre este NFT</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#e0a86f]">{nft.description}</p>
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Edição:</legend>
          <RG.Root value={edition.id} onValueChange={setEditionId} className="mt-2 flex flex-wrap gap-2" aria-label="Edição">
            {nft.editions.map((e) => {
              const disabled = e.available === 0
              return (
                <RG.Item
                  key={e.id}
                  value={e.id}
                  disabled={disabled}
                  className={cn(
                    'rounded-full border border-[#5a3b24] px-3 py-1 text-xs uppercase text-foreground data-[state=checked]:border-primary data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:text-muted-foreground disabled:line-through focus-visible:outline-2 focus-visible:outline-ring',
                  )}
                >
                  {e.label}
                  {disabled && <span className="sr-only"> (esgotada)</span>}
                </RG.Item>
              )
            })}
          </RG.Root>
          <p className="mt-1.5 text-[11px] text-muted-foreground" data-testid="edition-availability">
            {soldOut ? 'Esta edição está esgotada.' : `${edition.available} disponíveis · máx. ${edition.maxPerOrder} por pedido${inCart ? ` · ${inCart} no carrinho` : ''}`}
          </p>
        </fieldset>
        <dl className="mt-4 space-y-2.5 text-sm text-[#c9a27c]">
          <div className="flex gap-1.5">
            <dt>ID do token:</dt>
            <dd>{nft.tokenId}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Coleção:</dt>
            <dd>{nft.series}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Atributos:</dt>
            <dd>{nft.attributes.join(', ')}</dd>
          </div>
        </dl>

        {/* Barra fixa de compra (Figma mobile) */}
        <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-[#221510] px-4 pb-5 pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.45)]" data-testid="mobile-buy-bar">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2" role="group" aria-label="Quantidade">
              <span className="mr-1 text-sm" aria-hidden="true">
                Qtd.
              </span>
              <button type="button" className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Diminuir quantidade">
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <label htmlFor="qty" className="sr-only">
                Quantidade
              </label>
              <input
                id="qty"
                type="number"
                inputMode="numeric"
                min={1}
                max={Math.max(1, limit)}
                value={qty}
                onChange={(e) => {
                  const v = Math.floor(Number(e.target.value))
                  if (Number.isFinite(v)) setQty(Math.min(Math.max(1, v), Math.max(1, limit)))
                }}
                className="w-8 bg-transparent text-center text-lg font-semibold"
              />
              <button type="button" className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" onClick={() => setQty((q) => Math.min(limit, q + 1))} disabled={qty >= limit} aria-label="Aumentar quantidade">
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xl font-bold text-primary" data-testid="detail-price">
              <span className="sr-only">Preço: </span>
              {formatEth(ethMul(nft.price, qty))}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={buy}
              disabled={soldOut || limit === 0 || add.isPending}
              className="h-14 flex-1 rounded-full bg-gradient-to-r from-[#e0a06a] to-[#b8743c] text-base font-semibold text-primary-foreground shadow-md disabled:opacity-55"
            >
              {soldOut ? 'Esgotado' : limit === 0 ? 'Limite no carrinho' : add.isPending ? 'Adicionando…' : 'Comprar NFT'}
            </button>
            <button
              type="button"
              onClick={() => add.mutate({ nftId: nft.id, editionId: edition.id, quantity: qty, name: nft.name })}
              disabled={soldOut || limit === 0 || add.isPending}
              className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-primary disabled:opacity-55"
              aria-label="Adicionar ao carrinho"
            >
              <ShoppingCart className="size-5" fill="currentColor" aria-hidden="true" />
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="flex min-w-0 flex-col">
      <h1 className="text-xl font-bold sm:text-2xl">{nft.name}</h1>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-bold text-primary" data-testid="detail-price">
          <span className="sr-only">Preço: </span>
          {formatEth(nft.price)}
          {nft.previousPrice && <span className="ml-2 text-sm font-normal text-muted-foreground line-through">{formatEth(nft.previousPrice)}</span>}
        </p>
        <a href="#avaliacoes" className="flex items-center gap-1.5 text-xs hover:text-primary">
          <Stars rating={nft.rating} /> {nft.reviewsCount} avaliações de colecionadores
        </a>
      </div>
      <p aria-live="polite" className="text-xs text-accent-foreground" data-testid="price-notice">
        {priceNotice}
      </p>
      <h2 className="mt-4 text-xs font-semibold">Sobre este NFT:</h2>
      <p className="mt-1 text-xs leading-relaxed text-[#e0a86f]">{nft.description}</p>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold">Edição:</legend>
        <RG.Root value={edition.id} onValueChange={setEditionId} className="mt-2 flex flex-wrap gap-2" aria-label="Edição">
          {nft.editions.map((e) => {
            const disabled = e.available === 0
            return (
              <RG.Item
                key={e.id}
                value={e.id}
                disabled={disabled}
                className={cn(
                  'rounded-full border border-transparent px-2.5 py-0.5 text-[11px] uppercase text-foreground hover:border-border data-[state=checked]:border-primary data-[state=checked]:text-primary',
                  'disabled:cursor-not-allowed disabled:text-muted-foreground disabled:line-through focus-visible:outline-2 focus-visible:outline-ring',
                )}
              >
                {e.label}
                {disabled && <span className="sr-only"> (esgotada)</span>}
              </RG.Item>
            )
          })}
        </RG.Root>
        <p className="mt-1.5 text-[11px] text-muted-foreground" data-testid="edition-availability">
          {soldOut ? 'Esta edição está esgotada.' : `${edition.available} disponíveis · máx. ${edition.maxPerOrder} por pedido${inCart ? ` · ${inCart} no carrinho` : ''}`}
        </p>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2" role="group" aria-label="Quantidade">
          <button type="button" className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Diminuir quantidade">
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <label htmlFor="qty" className="sr-only">
            Quantidade
          </label>
          <input
            id="qty"
            type="number"
            inputMode="numeric"
            min={1}
            max={Math.max(1, limit)}
            value={qty}
            onChange={(e) => {
              const v = Math.floor(Number(e.target.value))
              if (Number.isFinite(v)) setQty(Math.min(Math.max(1, v), Math.max(1, limit)))
            }}
            className="h-7 w-10 rounded-sm border border-input bg-background text-center text-sm"
          />
          <button type="button" className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" onClick={() => setQty((q) => Math.min(limit, q + 1))} disabled={qty >= limit} aria-label="Aumentar quantidade">
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="ml-auto flex gap-2">
          <Button onClick={buy} disabled={soldOut || limit === 0} loading={add.isPending} className="h-8 min-w-28 text-xs uppercase">
            {soldOut ? 'Esgotado' : limit === 0 ? 'Limite no carrinho' : 'Comprar'}
          </Button>
          <Button variant="outline" className="h-8 text-xs" onClick={() => fav.toggle(nft.id, nft.name, isFav)} aria-pressed={isFav}>
            <Heart className={cn(isFav && 'fill-primary')} aria-hidden="true" /> {isFav ? 'Favoritado' : 'Favoritar'}
          </Button>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-2.5 text-xs text-[#e0a86f]">
        <dt>ID do token:</dt>
        <dd>{nft.tokenId}</dd>
        <dt>Coleção:</dt>
        <dd>{nft.series}</dd>
        <dt>Atributos:</dt>
        <dd>{nft.attributes.join(', ')}</dd>
      </dl>
      <div className="mt-3 flex items-center gap-1 text-xs font-semibold">
        <span className="mr-1">Compartilhar este NFT:</span>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(location.href)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (nova aba)" className="flex size-6 items-center justify-center hover:text-primary">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
            <path d="M5 9h3v10H5zM6.5 4a1.7 1.7 0 110 3.4 1.7 1.7 0 010-3.4zM10 9h3v1.5c.6-1 1.8-1.8 3.4-1.8 3 0 3.6 2 3.6 4.6V19h-3v-5c0-1.2 0-2.6-1.6-2.6S13 12.6 13 14v5h-3z" />
          </svg>
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(location.href)}`} aria-label="Compartilhar por e-mail" className="flex size-6 items-center justify-center hover:text-primary">
          <Mail className="size-3.5" aria-hidden="true" />
        </a>
        <a href={`https://x.com/intent/tweet?url=${encodeURIComponent(location.href)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no X (nova aba)" className="flex size-6 items-center justify-center hover:text-primary">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M4 4l16 16M20 4L4 20" />
          </svg>
        </a>
      </div>
    </div>
  )
}

function DetailTabs({ nft, className }: { nft: NftDetail; className?: string }) {
  return (
        <Tabs defaultValue="details" className={cn('mt-12', className)} id="avaliacoes">
          <TabsList className="border-[#5a3b24]">
            <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
            <TabsTrigger value="reviews">Avaliações de colecionadores ({nft.reviewsCount})</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4 space-y-4 text-xs leading-relaxed text-[#e0a86f]">
            {nft.longDescription.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
            <div>
              <h3 className="font-semibold text-foreground">Rede:</h3>
              <p>Cunhado na {nft.network === 'ethereum' ? 'Ethereum' : nft.network === 'polygon' ? 'Polygon' : 'Solana'} com procedência imutável e metadados armazenados no IPFS.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Contrato:</h3>
              <p>Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Direitos autorais:</h3>
              <p>
                {nft.contract.address} • Contrato inteligente {nft.contract.standard} verificado.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="reviews" className="mt-4">
            <ul className="grid gap-3 sm:grid-cols-2">
              {nft.reviews.map((r) => (
                <li key={r.id} className="rounded-sm bg-surface p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{r.author}</span>
                    <Stars rating={r.rating} />
                  </div>
                  <p className="mt-1.5 text-[#e0a86f]">{r.comment}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
  )
}

/** Figma mobile: topo com voltar/favoritar, arte grande, painel arredondado e barra de compra fixa. */
function MobileNftDetail({ nft }: { nft: NftDetail }) {
  const router = useRouter()
  const favorites = useFavorites()
  const fav = useToggleFavorite()
  const isFav = !!favorites.data?.nftIds.includes(nft.id)
  const [active, setActive] = useState(0)
  const img = nft.gallery[active] ?? nft.image
  const back = () => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: '/' }))
  return (
    <div className="pb-48">
      <div className="flex items-center justify-between px-4 pt-4">
        <button type="button" onClick={back} className="flex size-10 items-center justify-center rounded-full bg-surface text-foreground" aria-label="Voltar">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => fav.toggle(nft.id, nft.name, isFav)}
          className="flex size-10 items-center justify-center rounded-full bg-surface text-primary"
          aria-label={isFav ? 'Favoritado' : 'Favoritar'}
          aria-pressed={isFav}
        >
          <Heart className={cn('size-5', isFav && 'fill-primary')} aria-hidden="true" />
        </button>
      </div>
      <div className="relative mt-3 px-4">
        <img src={img.src} alt={img.alt} width={640} height={640} fetchPriority="high" className="aspect-[5/4.4] w-full rounded-[28px] object-cover" />
        <ul className="absolute inset-x-0 bottom-10 flex justify-center" aria-label="Galeria de imagens">
          {nft.gallery.map((g, i) => (
            <li key={g.src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={active === i}
                aria-label={`Ver imagem ${i + 1}: ${g.alt}`}
                className="flex size-6 items-center justify-center"
              >
                <span className={cn('block size-2.5 rounded-full border border-white/80', active === i ? 'bg-white' : 'bg-black/30')} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative -mt-8 rounded-t-[28px] bg-[#221510] px-4 pb-6 pt-6">
        <Purchase key={nft.id} nft={nft} variant="mobile" />
        <DetailTabs nft={nft} className="mt-8" />
      </div>
      <NftStrip id="more-title" title="Mais desta coleção" items={nft.related} />
    </div>
  )
}

export function NftDetailPage() {
  const { nftId } = useParams({ from: '/nft/$nftId' })
  const { data: nft, isPending, isError, error, refetch } = useNftDetail(nftId)
  usePageTitle(nft?.name ?? 'NFT', nft ? `${nft.name} — ${nft.description}` : undefined)
  const isMobile = useIsMobile()

  if (isPending) return <DetailSkeleton />
  if (isError) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND')
      return <NotFoundState title="NFT não encontrado" description="Este NFT não existe ou foi removido do mercado. Explore outras obras no catálogo." />
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-10">
        <ErrorState error={error} onRetry={() => void refetch()} title="Não foi possível carregar este NFT" />
      </div>
    )
  }

  if (isMobile) return <MobileNftDetail nft={nft} />

  return (
    <>
      <div className="mx-auto max-w-[1180px] px-4 pt-6">
        <nav aria-label="Trilha" className="text-xs">
          <ol className="flex flex-wrap gap-1">
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
            <li aria-current="page" className="text-muted-foreground">
              {nft.name}
            </li>
          </ol>
        </nav>
        <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,500px)_1fr] lg:gap-10">
          <Gallery nft={nft} />
          <Purchase key={nft.id} nft={nft} />
        </div>

        <DetailTabs nft={nft} />
      </div>
      <NftStrip id="more-title" title="Mais desta coleção" items={nft.related} />
    </>
  )
}
