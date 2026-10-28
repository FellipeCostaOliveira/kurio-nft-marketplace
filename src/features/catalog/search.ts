import type { CatalogQuery, CatalogTab, CollectionSlug, Network, SortOption } from '@/api/contracts'
import { COLLECTIONS, NETWORKS } from '@/api/contracts'
import { isEthString } from '@/lib/eth'

export const PAGE_SIZE = 9

/** Estado do catálogo na URL. Validação manual (sem zod) para manter o bundle inicial leve. */
export interface CatalogSearch {
  q?: string
  colecoes?: string
  redes?: string
  precoMin?: string
  precoMax?: string
  ordem?: SortOption
  aba?: CatalogTab
  pagina?: number
}

const SORTS: readonly SortOption[] = ['recent', 'price-asc', 'price-desc', 'name', 'popular']
const TABS: readonly CatalogTab[] = ['all', 'new', 'trending']

/** O router faz JSON.parse dos valores da URL; normalizamos tudo e descartamos o inválido. */
const str = (v: unknown): string | undefined => (v === null || v === undefined || v === '' ? undefined : String(v).slice(0, 120))

export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const ordem = str(raw.ordem) as SortOption | undefined
  const aba = str(raw.aba) as CatalogTab | undefined
  const pagina = Number(raw.pagina)
  return {
    q: str(raw.q),
    colecoes: str(raw.colecoes),
    redes: str(raw.redes),
    precoMin: str(raw.precoMin),
    precoMax: str(raw.precoMax),
    ordem: ordem && SORTS.includes(ordem) ? ordem : undefined,
    aba: aba && TABS.includes(aba) ? aba : undefined,
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 999 ? pagina : undefined,
  }
}

export function splitList<T extends string>(value: string | undefined, allowed: readonly { id: T }[]): T[] {
  if (!value) return []
  const ids = new Set(allowed.map((a) => a.id))
  return value.split(',').filter((v): v is T => ids.has(v as T))
}

/** Converte o estado da URL nos parâmetros exatos enviados à API. */
export function toCatalogQuery(s: CatalogSearch): CatalogQuery {
  const collections = splitList<CollectionSlug>(s.colecoes, COLLECTIONS).sort()
  const networks = splitList<Network>(s.redes, NETWORKS).sort()
  return {
    q: s.q?.trim() || undefined,
    collections: collections.length ? collections : undefined,
    networks: networks.length ? networks : undefined,
    minPrice: s.precoMin && isEthString(s.precoMin) ? s.precoMin : undefined,
    maxPrice: s.precoMax && isEthString(s.precoMax) ? s.precoMax : undefined,
    sort: (s.ordem ?? 'recent') as SortOption,
    tab: (s.aba ?? 'all') as CatalogTab,
    page: s.pagina ?? 1,
    pageSize: PAGE_SIZE,
  }
}

export function hasActiveFilters(s: CatalogSearch) {
  return !!(s.q || s.colecoes || s.redes || s.precoMin || s.precoMax || (s.aba && s.aba !== 'all'))
}

export function toggleInList(value: string | undefined, id: string): string | undefined {
  const list = new Set((value ?? '').split(',').filter(Boolean))
  if (list.has(id)) list.delete(id)
  else list.add(id)
  const out = [...list].sort().join(',')
  return out || undefined
}
