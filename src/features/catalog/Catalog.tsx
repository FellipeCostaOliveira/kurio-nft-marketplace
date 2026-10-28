import { useEffect, useId, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { CatalogResponse, NftSummary } from '@/api/contracts'
import { COLLECTIONS, NETWORKS, SORT_OPTIONS } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, SheetContent } from '@/components/ui/dialog'
import { Skeleton, Slider } from '@/components/ui/misc'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/states'
import { useAddToCart } from '@/features/cart/hooks'
import { formatEthBr } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useCatalog, useFavorites, useFeatured, useToggleFavorite } from './hooks'
import { NftCard, NftCardSkeleton } from './NftCard'
import { hasActiveFilters, splitList, toCatalogQuery, toggleInList, type CatalogSearch } from './search'
import { Link } from '@tanstack/react-router'
import { useIsMobile } from '@/hooks/useIsMobile'
import { catalogFilters, filtersReturnFocus, useCatalogFiltersOpen } from './filters-store'
import { SearchBox } from './SearchBox'

type Patch = Partial<CatalogSearch>
interface CatalogProps {
  search: CatalogSearch
  onChange: (patch: Patch, opts?: { resetPage?: boolean; replace?: boolean }) => void
}

const PRICE_MIN = 0.02
const PRICE_MAX = 12.3

function FilterPanel({ search, onChange, data }: CatalogProps & { data?: CatalogResponse }) {
  const id = useId()
  const collections = splitList(search.colecoes, COLLECTIONS)
  const networks = splitList(search.redes, NETWORKS)
  const [range, setRange] = useState<[number, number]>([Number(search.precoMin ?? PRICE_MIN), Number(search.precoMax ?? PRICE_MAX)])
  useEffect(() => setRange([Number(search.precoMin ?? PRICE_MIN), Number(search.precoMax ?? PRICE_MAX)]), [search.precoMin, search.precoMax])
  const countOf = (facet: 'collections' | 'networks', key: string) => data?.facets[facet].find((f) => f.id === key)?.count

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Coleções</legend>
        <ul className="flex flex-col gap-1">
          {COLLECTIONS.map((c) => {
            const active = collections.includes(c.id)
            const count = countOf('collections', c.id)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ colecoes: toggleInList(search.colecoes, c.id) }, { resetPage: true })}
                  className={cn('flex w-full items-center justify-between rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors', active ? 'bg-accent text-accent-foreground' : 'text-[#e0a86f] hover:bg-surface-2')}
                >
                  <span>{c.name}</span>
                  <span className={cn('tabular-nums', active ? 'text-accent-foreground' : 'text-foreground')}>({count ?? '–'})</span>
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Faixa de preço</legend>
        <Slider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={0.01}
          value={range}
          minStepsBetweenThumbs={1}
          onValueChange={(v) => setRange([v[0], v[1]] as [number, number])}
          thumbLabels={['Preço mínimo', 'Preço máximo']}
        />
        <p className="mt-2 text-xs" id={`${id}-range`} aria-live="polite">
          Preço: {formatEthBr(range[0].toFixed(2))} – {formatEthBr(range[1].toFixed(2))} ETH
        </p>
        <Button
          size="sm"
          className="mt-2 h-7 px-3"
          aria-describedby={`${id}-range`}
          onClick={() =>
            onChange(
              {
                precoMin: range[0] > PRICE_MIN ? range[0].toFixed(2) : undefined,
                precoMax: range[1] < PRICE_MAX ? range[1].toFixed(2) : undefined,
              },
              { resetPage: true },
            )
          }
        >
          Aplicar
        </Button>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Rede</legend>
        <ul className="flex flex-col gap-1">
          {NETWORKS.map((n) => {
            const active = networks.includes(n.id)
            return (
              <li key={n.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ redes: toggleInList(search.redes, n.id) }, { resetPage: true })}
                  className={cn('flex w-full items-center justify-between rounded-sm px-2.5 py-1.5 text-left text-xs', active ? 'bg-accent text-accent-foreground' : 'text-[#e0a86f] hover:bg-surface-2')}
                >
                  <span>{n.name}</span>
                  <span className="tabular-nums text-foreground">({countOf('networks', n.id) ?? '–'})</span>
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>
    </div>
  )
}

function FeaturedSpotlight() {
  const { data, isPending } = useFeatured()
  return (
    <section aria-labelledby="spotlight-title" className="mt-6 hidden rounded-sm bg-surface p-3 lg:block">
      <h2 id="spotlight-title" className="text-center text-lg font-bold uppercase leading-tight text-primary">
        NFT em destaque
        <span className="block text-sm text-foreground">Oferta limitada</span>
      </h2>
      {isPending || !data ? (
        <Skeleton className="mt-3 aspect-[5/6] w-full rounded-xl" />
      ) : (
        <Link to="/nft/$nftId" params={{ nftId: data.spotlight.id }} className="mt-3 block overflow-hidden rounded-xl">
          <img src={data.spotlight.image.src} alt={data.spotlight.image.alt} width={640} height={640} loading="lazy" className="aspect-[5/6] w-full object-cover" />
          <span className="sr-only">Ver {data.spotlight.name}</span>
        </Link>
      )}
    </section>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages = useMemo(() => {
    const out: (number | '…')[] = []
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= 1 || (page <= 3 && p <= 4)) out.push(p)
      else if (out.at(-1) !== '…') out.push('…')
    }
    return out
  }, [page, totalPages])
  if (totalPages <= 1) return null
  const btn = 'flex size-7 items-center justify-center rounded-sm text-xs font-semibold'
  return (
    <nav aria-label="Paginação do catálogo" className="mt-8 flex justify-end">
      <ul className="flex items-center gap-1.5">
        <li>
          <button type="button" className={cn(btn, 'bg-surface hover:bg-surface-2 disabled:opacity-40')} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        </li>
        {pages.map((p, i) =>
          p === '…' ? (
            <li key={`e${i}`} aria-hidden="true" className="px-1 text-xs">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                onClick={() => onPage(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Página ${p}`}
                className={cn(btn, p === page ? 'bg-primary text-primary-foreground' : 'bg-surface hover:bg-surface-2')}
              >
                {p}
              </button>
            </li>
          ),
        )}
        <li>
          <button type="button" className={cn(btn, 'bg-surface hover:bg-surface-2 disabled:opacity-40')} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Próxima página">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  )
}

function SortSelect({ search, onChange }: CatalogProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span id="sort-label" className="text-xs">
        Ordenar por:
      </span>
      <Select value={search.ordem ?? 'recent'} onValueChange={(v) => onChange({ ordem: v === 'recent' ? undefined : (v as CatalogSearch['ordem']) }, { resetPage: true })}>
        <SelectTrigger aria-labelledby="sort-label" className="h-8 w-auto gap-1 border-none bg-transparent px-1 text-xs" data-testid="sort-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const TABS = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
] as const

export function Catalog({ search, onChange }: CatalogProps) {
  const query = useMemo(() => toCatalogQuery(search), [search])
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = useCatalog(query)
  const favorites = useFavorites()
  const favIds = new Set(favorites.data?.nftIds ?? [])
  const fav = useToggleFavorite()
  const add = useAddToCart()
  const isMobile = useIsMobile()
  const filtersOpen = useCatalogFiltersOpen()
  const setFiltersOpen = (v: boolean) => catalogFilters.set(v)
  const activeTab = search.aba ?? 'all'
  const updating = isFetching && isPlaceholderData

  const quickAdd = (n: NftSummary) => {
    // Atalho do card: edição 1/50 (padrão do Figma). Indisponibilidade é tratada pela API (409).
    add.mutate({ nftId: n.id, editionId: 'e50', quantity: 1, name: n.name })
  }

  return (
    <section id="catalogo" aria-labelledby="catalog-title" className="mx-auto mt-6 max-w-[1180px] scroll-mt-20 px-4 md:mt-10 lg:mt-14">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="grid gap-8 lg:grid-cols-[200px_1fr] lg:gap-[22px]">
        <aside aria-label="Filtros" className="hidden lg:block">
          <div className="rounded-sm bg-surface p-3">
            <FilterPanel search={search} onChange={onChange} data={data} />
          </div>
          <FeaturedSpotlight />
        </aside>

        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div role="group" aria-label="Seções do catálogo" className="-mx-4 flex gap-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={activeTab === t.id}
                  onClick={() => onChange({ aba: t.id === 'all' ? undefined : t.id }, { resetPage: true })}
                  className={cn(
                    'shrink-0 border-b-2 pb-1 font-semibold',
                    isMobile ? 'text-sm' : 'text-xs',
                    activeTab === t.id ? 'border-primary text-primary' : 'border-transparent hover:text-primary',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {!isMobile && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <SearchBox value={search.q} onSearch={(q) => onChange({ q }, { resetPage: true })} />
                <SortSelect search={search} onChange={onChange} />
                <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
                  <SlidersHorizontal aria-hidden="true" /> Filtros
                </Button>
              </div>
            )}
          </div>
          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetContent
              side="left"
              aria-describedby={undefined}
              onCloseAutoFocus={(e) => {
                if (filtersReturnFocus?.isConnected) {
                  e.preventDefault()
                  filtersReturnFocus.focus()
                }
              }}
            >
              <DialogTitle className="mb-5 text-base">Filtros</DialogTitle>
              {isMobile && (
                <div className="mb-6">
                  <SortSelect search={search} onChange={onChange} />
                </div>
              )}
              <FilterPanel search={search} onChange={onChange} data={data} />
              <Button className="mt-6" onClick={() => setFiltersOpen(false)}>
                Ver {data?.total ?? ''} resultados
              </Button>
            </SheetContent>
          </Dialog>
          {!isMobile && <div className="mt-1 border-b border-[#5a3b24]" />}

          <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs">
            <p aria-live="polite" aria-atomic="true" data-testid="results-count">
              {isPending ? 'Carregando NFTs…' : data ? `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}${search.q ? ` para “${search.q}”` : ''}` : ''}
              {updating && <span className="ml-2 text-muted-foreground">Atualizando…</span>}
            </p>
            {hasActiveFilters(search) && (
              <button
                type="button"
                className="flex items-center gap-1 text-link hover:underline"
                onClick={() => onChange({ q: undefined, colecoes: undefined, redes: undefined, precoMin: undefined, precoMax: undefined, aba: undefined }, { resetPage: true })}
              >
                <RotateCcw className="size-3" aria-hidden="true" /> Limpar filtros
              </button>
            )}
          </div>

          {isError && !data ? (
            <ErrorState className="mt-6" error={error} onRetry={() => void refetch()} title="Não foi possível carregar o catálogo" />
          ) : (
            <>
              {isError && data && (
                <p role="alert" className="mt-3 text-xs text-destructive">
                  Falha ao atualizar o catálogo. Mostrando os últimos resultados.{' '}
                  <button type="button" className="underline" onClick={() => void refetch()}>
                    Tentar novamente
                  </button>
                </p>
              )}
              <ul
                className={cn(
                  'mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:gap-x-[18px] lg:gap-y-8',
                  // Figma mobile: coluna da direita deslocada (grade escalonada)
                  isMobile && 'gap-x-4 gap-y-5 [&>li:nth-child(even)]:mt-8',
                  updating && 'opacity-70 transition-opacity',
                )} aria-busy={isPending || updating} data-testid="catalog-grid">
                {isPending
                  ? Array.from({ length: 9 }, (_, i) => (
                      <li key={i} data-testid="catalog-skeleton">
                        <NftCardSkeleton variant={isMobile ? 'mobile' : 'default'} />
                      </li>
                    ))
                  : data?.items.map((n, i) => (
                      <li key={n.id}>
                        <NftCard
                          nft={n}
                          priority={i < 3}
                          isFavorite={favIds.has(n.id)}
                          onFavorite={() => fav.toggle(n.id, n.name, favIds.has(n.id))}
                          onAddToCart={isMobile ? undefined : () => quickAdd(n)}
                          variant={isMobile ? 'mobile' : 'default'}
                        />
                      </li>
                    ))}
              </ul>
              {data && data.items.length === 0 && (
                <div className="mt-6 rounded-sm bg-surface px-6 py-12 text-center" data-testid="empty-state">
                  <p className="text-base font-semibold">Nenhum NFT encontrado</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ajuste a busca ou os filtros para ver mais resultados.</p>
                  {hasActiveFilters(search) && (
                    <Button className="mt-4" size="sm" onClick={() => onChange({ q: undefined, colecoes: undefined, redes: undefined, precoMin: undefined, precoMax: undefined, aba: undefined }, { resetPage: true })}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              )}
              {data && <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => onChange({ pagina: p === 1 ? undefined : p })} />}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
