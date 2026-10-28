import { useEffect } from 'react'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { NotFoundState } from '@/components/states'
import { authDialog, useAuthDialog } from '@/features/auth/auth-dialog-store'
import { validateCatalogSearch, type CatalogSearch } from '@/features/catalog/search'
import { sessionStore } from '@/lib/session'
import { HomePage } from '@/routes/HomePage'
import { RootLayout } from './RootLayout'

interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => <NotFoundState />,
})

/** Rotas privadas: sem sessão, redireciona para /entrar preservando o destino. */
function requireAuth({ location }: { location: { href: string } }) {
  if (!sessionStore.get().user) throw redirect({ to: '/entrar', search: { redirect: location.href } })
}

function useCatalogNavigation(to: '/' | '/mercado') {
  const navigate = useNavigate()
  return (patch: Partial<CatalogSearch>, opts: { resetPage?: boolean } = {}) =>
    void navigate({
      to,
      search: (prev: CatalogSearch) => ({ ...prev, ...patch, ...(opts.resetPage ? { pagina: undefined } : {}) }),
      resetScroll: false,
    })
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateCatalogSearch,
  component: function IndexRoute() {
    const search = indexRoute.useSearch()
    const onChange = useCatalogNavigation('/')
    return <HomePage search={search} onChange={onChange} />
  },
})

const marketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mercado',
  validateSearch: validateCatalogSearch,
  component: lazyRouteComponent(() => import('./lazy-pages'), 'MarketRoute'),
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  component: lazyRouteComponent(() => import('@/routes/NftDetailPage'), 'NftDetailPage'),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: lazyRouteComponent(() => import('@/routes/CartPage'), 'CartPage'),
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pagamento',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/routes/CheckoutPage'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pedido/$orderId',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/routes/OrderPage'), 'OrderPage'),
})

const explorerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explorador/$hash',
  component: lazyRouteComponent(() => import('@/routes/OrderPage'), 'ExplorerPage'),
})

/** Só aceita redirecionamentos internos (evita open redirect). */
function validateAuthSearch(s: Record<string, unknown>): { redirect?: string } {
  const r = typeof s.redirect === 'string' && s.redirect.startsWith('/') && !s.redirect.startsWith('//') ? s.redirect : undefined
  return { redirect: r }
}

/** /entrar e /cadastro: página inicial ao fundo + diálogo de autenticação (como no Figma). */
function AuthRoute({ mode, redirectTo }: { mode: 'login' | 'signup'; redirectTo?: string }) {
  const navigate = useNavigate()
  const dialog = useAuthDialog()
  const onChange = useCatalogNavigation('/')
  useEffect(() => {
    if (sessionStore.get().user) {
      void navigate({ to: redirectTo ?? '/', replace: true })
      return
    }
    authDialog.open(mode, { reason: redirectTo ? 'required' : 'manual', redirect: redirectTo ?? '/' })
  }, [mode, redirectTo, navigate])
  useEffect(() => {
    // Fechou sem autenticar: volta ao início (evita loop em rotas protegidas).
    if (!dialog.open && !sessionStore.get().user) {
      const t = setTimeout(() => {
        if (!authDialog.get().open && location.pathname.match(/^\/(entrar|cadastro)/)) void navigate({ to: '/', replace: true })
      }, 0)
      return () => clearTimeout(t)
    }
  }, [dialog.open, navigate])
  return <HomePage search={{}} onChange={onChange} />
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrar',
  validateSearch: validateAuthSearch,
  component: function LoginRoute() {
    const { redirect: r } = loginRoute.useSearch()
    return <AuthRoute mode="login" redirectTo={r} />
  },
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: validateAuthSearch,
  component: function SignupRoute() {
    const { redirect: r } = signupRoute.useSearch()
    return <AuthRoute mode="signup" redirectTo={r} />
  },
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/perfil',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/routes/account/ProfileLayout'), 'ProfileLayout'),
})
const profileIndexRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/routes/account/ProfilePage'), 'ProfilePage'),
})
const walletsRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/carteiras',
  component: lazyRouteComponent(() => import('@/routes/account/WalletsPage'), 'WalletsPage'),
})
const favoritesRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/favoritos',
  component: lazyRouteComponent(() => import('@/routes/account/FavoritesPage'), 'FavoritesPage'),
})

const creatorsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/criadores', component: lazyRouteComponent(() => import('./lazy-pages'), 'CreatorsRoute') })
const learnRoute = createRoute({ getParentRoute: () => rootRoute, path: '/aprenda', component: lazyRouteComponent(() => import('./lazy-pages'), 'LearnRoute') })
const soonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/em-breve',
  validateSearch: (s: Record<string, unknown>): { secao?: string } => ({ secao: typeof s.secao === 'string' ? s.secao.slice(0, 60) : undefined }),
  component: lazyRouteComponent(() => import('./lazy-pages'), 'SoonRoute'),
})

export const routeTree = rootRoute.addChildren([
  indexRoute,
  marketRoute,
  nftRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  explorerRoute,
  loginRoute,
  signupRoute,
  profileRoute.addChildren([profileIndexRoute, walletsRoute, favoritesRoute]),
  creatorsRoute,
  learnRoute,
  soonRoute,
])

export { marketRoute, soonRoute, useCatalogNavigation }

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
