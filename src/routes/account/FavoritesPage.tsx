import { Link } from '@tanstack/react-router'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useFavorites, useToggleFavorite } from '@/features/catalog/hooks'
import { NftCard, NftCardSkeleton } from '@/features/catalog/NftCard'
import { usePageTitle } from '@/lib/usePageTitle'

export function FavoritesPage() {
  usePageTitle('Lista de interesse')
  const favorites = useFavorites()
  const fav = useToggleFavorite()
  return (
    <section aria-labelledby="fav-title">
      <h1 id="fav-title" className="mb-4 text-sm font-semibold">
        Lista de interesse
      </h1>
      {favorites.isError ? (
        <ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} />
      ) : favorites.isPending ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : favorites.data.items.length === 0 ? (
        <div className="rounded-sm bg-surface p-8 text-center text-xs">
          <p className="text-sm font-semibold">Nenhum favorito ainda</p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/" hash="catalogo">
              Explorar NFTs
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3" data-testid="favorites-grid">
          {favorites.data.items.map((n) => (
            <li key={n.id}>
              <NftCard nft={n} isFavorite onFavorite={() => fav.toggle(n.id, n.name, true)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
