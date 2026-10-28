import type { CatalogQuery, Network } from './contracts'

/**
 * Chaves do TanStack Query. Dados privados ficam sob ['user', userId, ...] para
 * isolamento por usuário e limpeza em bloco no logout/troca de usuário.
 */
export const qk = {
  catalog: (q: CatalogQuery) => ['catalog', 'list', q] as const,
  catalogAll: ['catalog'] as const,
  featured: ['catalog', 'featured'] as const,
  nft: (id: string) => ['nft', id] as const,
  nftAll: ['nft'] as const,
  cart: (scope: string) => ['cart', scope] as const,
  cartAll: ['cart'] as const,
  quote: (scope: string, network: Network) => ['quote', scope, network] as const,
  quoteAll: ['quote'] as const,
  session: ['session'] as const,
  user: (userId: string) => ['user', userId] as const,
  favorites: (userId: string) => ['user', userId, 'favorites'] as const,
  profile: (userId: string) => ['user', userId, 'profile'] as const,
  wallets: (userId: string) => ['user', userId, 'wallets'] as const,
  order: (userId: string, id: string) => ['user', userId, 'order', id] as const,
  orders: (userId: string, status?: string) => ['user', userId, 'orders', status ?? 'all'] as const,
}
