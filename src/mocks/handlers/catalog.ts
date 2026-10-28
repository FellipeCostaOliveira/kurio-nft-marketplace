import { http, HttpResponse } from 'msw'
import type { CatalogQuery, CatalogResponse, CollectionSlug, FavoritesResponse, Network, NftSummary, SortOption } from '@/api/contracts'
import { COLLECTIONS, NETWORKS } from '@/api/contracts'
import { eth } from '@/lib/eth'
import { allNfts, nftDetail, nftSummary, persist, state } from '../db'
import { SEED_NOW } from '../fixtures'
import { config, errorResponse, requireUser, withNetwork } from '../network'
import { API } from './api-base'

const SORTS: SortOption[] = ['recent', 'price-asc', 'price-desc', 'name', 'popular']
const NEW_WINDOW = 7 * 86400000

function parseQuery(url: URL): CatalogQuery {
  const p = url.searchParams
  const list = (k: string) => (p.get(k) ?? '').split(',').filter(Boolean)
  const sort = p.get('sort') as SortOption
  const tab = p.get('tab')
  return {
    q: p.get('q')?.trim() || undefined,
    collections: list('collections').filter((c): c is CollectionSlug => COLLECTIONS.some((x) => x.id === c)),
    networks: list('networks').filter((n): n is Network => NETWORKS.some((x) => x.id === n)),
    minPrice: p.get('minPrice') || undefined,
    maxPrice: p.get('maxPrice') || undefined,
    sort: SORTS.includes(sort) ? sort : 'recent',
    tab: tab === 'new' || tab === 'trending' ? tab : 'all',
    page: Math.max(1, Number(p.get('page')) || 1),
    pageSize: Math.min(48, Math.max(1, Number(p.get('pageSize')) || 9)),
  }
}

export const catalogHandlers = [
  http.get(
    `${API}/nfts`,
    withNetwork(({ request }) => {
      const url = new URL(request.url)
      const q = parseQuery(url)
      const items = config.emptyCatalog ? [] : allNfts().map((n) => nftSummary(n.id)!)

      const matchBase = (n: NftSummary) => {
        if (q.q && !`${n.name} ${n.collectionName} ${n.tokenId}`.toLowerCase().includes(q.q.toLowerCase())) return false
        if (q.minPrice && eth(n.price).lt(q.minPrice)) return false
        if (q.maxPrice && eth(n.price).gt(q.maxPrice)) return false
        if (q.tab === 'new' && SEED_NOW - Date.parse(n.listedAt) > NEW_WINDOW) return false
        if (q.tab === 'trending' && !n.isTrending) return false
        return true
      }
      const matchCollection = (n: NftSummary) => !q.collections?.length || q.collections.includes(n.collection)
      const matchNetwork = (n: NftSummary) => !q.networks?.length || q.networks.includes(n.network)

      const base = items.filter(matchBase)
      const filtered = base.filter((n) => matchCollection(n) && matchNetwork(n))

      const sorted = [...filtered].sort((a, b) => {
        switch (q.sort) {
          case 'price-asc':
            return eth(a.price).cmp(b.price) || a.id.localeCompare(b.id)
          case 'price-desc':
            return eth(b.price).cmp(a.price) || a.id.localeCompare(b.id)
          case 'name':
            return a.name.localeCompare(b.name, 'pt-BR')
          case 'popular':
            return Number(b.isTrending) - Number(a.isTrending) || a.id.localeCompare(b.id)
          default:
            return Date.parse(b.listedAt) - Date.parse(a.listedAt)
        }
      })
      const total = sorted.length
      const totalPages = Math.max(1, Math.ceil(total / q.pageSize))
      const page = Math.min(q.page, totalPages)
      const prices = items.map((n) => eth(n.price))
      const body: CatalogResponse = {
        items: sorted.slice((page - 1) * q.pageSize, page * q.pageSize),
        page,
        pageSize: q.pageSize,
        total,
        totalPages,
        facets: {
          collections: COLLECTIONS.map((c) => ({ id: c.id, name: c.name, count: base.filter((n) => n.collection === c.id && matchNetwork(n)).length })),
          networks: NETWORKS.map((c) => ({ id: c.id, name: c.name, count: base.filter((n) => n.network === c.id && matchCollection(n)).length })),
          priceRange: {
            min: prices.length ? prices.reduce((a, b) => (a.lt(b) ? a : b)).toFixed(2) : '0.00',
            max: prices.length ? prices.reduce((a, b) => (a.gt(b) ? a : b)).toFixed(2) : '0.00',
          },
        },
        query: { ...q, page },
      }
      return HttpResponse.json(body)
    }),
  ),

  http.get(
    `${API}/nfts/featured`,
    withNetwork(() => HttpResponse.json({ spotlight: nftSummary('nft-002') })),
  ),

  http.get(
    `${API}/nfts/:id`,
    withNetwork(({ params }) => {
      const nft = nftDetail(String(params.id))
      if (!nft) return errorResponse(404, 'NOT_FOUND', 'NFT não encontrado.')
      return HttpResponse.json(nft)
    }),
  ),

  // ---------- Favoritos ----------
  http.get(
    `${API}/favorites`,
    withNetwork(({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const ids = state.favorites[auth.user.id] ?? []
      const body: FavoritesResponse = { nftIds: ids, items: ids.map((id) => nftSummary(id)).filter((n): n is NftSummary => !!n) }
      return HttpResponse.json(body)
    }),
  ),

  http.put(
    `${API}/favorites/:nftId`,
    withNetwork(({ request, params }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const id = String(params.nftId)
      if (!nftSummary(id)) return errorResponse(404, 'NOT_FOUND', 'NFT não encontrado.')
      const list = (state.favorites[auth.user.id] ??= [])
      if (!list.includes(id)) list.unshift(id)
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.delete(
    `${API}/favorites/:nftId`,
    withNetwork(({ request, params }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      state.favorites[auth.user.id] = (state.favorites[auth.user.id] ?? []).filter((x) => x !== String(params.nftId))
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
