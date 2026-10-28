import { Link } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { Skeleton } from '@/components/ui/misc'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export function Price({ price, previous, className }: { price: string; previous?: string | null; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-primary', className)}>
      <span>
        <span className="sr-only">Preço: </span>
        {formatEth(price)}
      </span>
      {previous && (
        <span className="text-sm font-normal text-muted-foreground line-through">
          <span className="sr-only">Preço anterior: </span>
          {formatEth(previous)}
        </span>
      )}
    </p>
  )
}

interface NftCardProps {
  nft: NftSummary
  priority?: boolean
  isFavorite?: boolean
  onFavorite?: () => void
  onAddToCart?: () => void
  compact?: boolean
  variant?: 'default' | 'mobile'
}

/** Card do Figma mobile: cartão arredondado, coração sobre a imagem, nome e preço abaixo. */
function MobileNftCard({ nft, priority, isFavorite, onFavorite }: NftCardProps) {
  const soldOut = nft.totalAvailable === 0
  return (
    <article className="relative flex min-w-0 flex-col" aria-labelledby={`nft-${nft.id}-name`} data-testid="nft-card">
      <div className="relative rounded-2xl bg-surface p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block overflow-hidden rounded-xl" tabIndex={-1} aria-hidden="true">
          <img
            src={nft.image.srcSm}
            srcSet={`${nft.image.srcSm} 320w, ${nft.image.src} 640w`}
            sizes="45vw"
            alt=""
            width={320}
            height={320}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className={cn('aspect-[5/6] w-full object-cover', soldOut && 'opacity-60 grayscale-[40%]')}
          />
        </Link>
        {nft.rarity === 'rare' && <span className="absolute left-0 top-3 bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">Raro</span>}
        {soldOut && <span className="absolute bottom-3 left-3 rounded-sm bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase text-foreground">Esgotado</span>}
        {onFavorite && (
          <button
            type="button"
            onClick={onFavorite}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-[#2a1a12]/90 text-primary"
            aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
            aria-pressed={!!isFavorite}
          >
            <Heart className={cn('size-4', isFavorite && 'fill-primary')} aria-hidden="true" />
          </button>
        )}
      </div>
      <h3 id={`nft-${nft.id}-name`} className="mt-3 truncate px-1 text-sm font-medium">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="hover:text-primary">
          {nft.name}
        </Link>
      </h3>
      <Price price={nft.price} previous={nft.previousPrice} className="px-1 text-base" />
    </article>
  )
}

export function NftCard(props: NftCardProps) {
  if (props.variant === 'mobile') return <MobileNftCard {...props} />
  return <DesktopNftCard {...props} />
}

function DesktopNftCard({ nft, priority, isFavorite, onFavorite, onAddToCart, compact }: NftCardProps) {
  const soldOut = nft.totalAvailable === 0
  return (
    <article className="group relative flex min-w-0 flex-col" aria-labelledby={`nft-${nft.id}-name`} data-testid="nft-card">
      <div className={cn('relative rounded-sm bg-surface', compact ? 'p-2' : 'p-2.5 sm:p-3')}>
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block overflow-hidden rounded-xl focus-visible:outline-offset-4" tabIndex={-1} aria-hidden="true">
          <img
            src={nft.image.srcSm}
            srcSet={`${nft.image.srcSm} 320w, ${nft.image.src} 640w`}
            sizes="(min-width: 1024px) 260px, (min-width: 640px) 30vw, 45vw"
            alt=""
            width={320}
            height={320}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className={cn('aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]', soldOut && 'opacity-60 grayscale-[40%]')}
          />
        </Link>
        {nft.rarity === 'rare' && <span className="absolute left-0 top-3 bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">Raro</span>}
        {soldOut && <span className="absolute right-3 top-3 rounded-sm bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase text-foreground">Esgotado</span>}
        {(onAddToCart || onFavorite) && (
          <div className="absolute bottom-4 right-4 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            {onAddToCart && (
              <button
                type="button"
                onClick={onAddToCart}
                disabled={soldOut}
                className="flex size-7 items-center justify-center rounded-sm bg-background/90 text-foreground hover:text-primary disabled:opacity-50"
                aria-label={soldOut ? `${nft.name} esgotado` : `Adicionar ${nft.name} ao carrinho`}
              >
                <ShoppingCart className="size-3.5" aria-hidden="true" />
              </button>
            )}
            {onFavorite && (
              <button
                type="button"
                onClick={onFavorite}
                className="flex size-7 items-center justify-center rounded-sm bg-background/90 text-foreground hover:text-primary"
                aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
                aria-pressed={!!isFavorite}
              >
                <Heart className={cn('size-3.5', isFavorite && 'fill-primary text-primary')} aria-hidden="true" />
              </button>
            )}
            <Link
              to="/nft/$nftId"
              params={{ nftId: nft.id }}
              className="flex size-7 items-center justify-center rounded-sm bg-background/90 text-foreground hover:text-primary"
              aria-label={`Ver detalhes de ${nft.name}`}
            >
              <Search className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
      <h3 id={`nft-${nft.id}-name`} className="mt-2.5 truncate text-sm font-medium">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="hover:text-primary">
          {nft.name}
        </Link>
      </h3>
      <Price price={nft.price} previous={nft.previousPrice} />
    </article>
  )
}

export function NftCardSkeleton({ compact, variant }: { compact?: boolean; variant?: 'default' | 'mobile' }) {
  if (variant === 'mobile')
    return (
      <div className="flex flex-col" aria-hidden="true">
        <div className="rounded-2xl bg-surface p-1.5">
          <Skeleton className="aspect-[5/6] w-full rounded-xl" />
        </div>
        <Skeleton className="mt-3 h-4 w-3/4" />
        <Skeleton className="mt-1.5 h-5 w-1/3" />
      </div>
    )
  return (
    <div className="flex flex-col" aria-hidden="true">
      <div className={cn('rounded-sm bg-surface', compact ? 'p-2' : 'p-2.5 sm:p-3')}>
        <Skeleton className="aspect-square w-full rounded-xl" />
      </div>
      <Skeleton className="mt-2.5 h-4 w-3/4" />
      <Skeleton className="mt-1.5 h-4 w-1/3" />
    </div>
  )
}
