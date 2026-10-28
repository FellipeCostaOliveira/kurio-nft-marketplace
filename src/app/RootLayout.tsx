import { lazy, Suspense, useEffect, useRef } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import { AuthDialogHost } from '@/features/auth/AuthDialogHost'
import { clearPrivateData, useSessionValidation } from '@/features/auth/hooks'
import { sessionStore } from '@/lib/session'

const MockPanel = import.meta.env.VITE_ENABLE_MOCKS === 'true' ? lazy(() => import('@/mocks/MockPanel')) : null

export function RootLayout() {
  const qc = useQueryClient()
  useSessionValidation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isMobile = useIsMobile()
  // Figma mobile: telas "imersivas" têm barra própria (voltar/título) e ação fixa no rodapé.
  const immersive = /^\/(nft|carrinho|pagamento|pedido|entrar|cadastro)(\/|$)/.test(pathname)
  const showHeader = !isMobile || (!immersive && pathname !== '/')
  const showFooter = !isMobile || !immersive
  const showBottomNav = isMobile && !immersive

  // Logout, expiração ou troca de usuário: limpa dados privados do usuário anterior.
  useEffect(
    () =>
      sessionStore.onChange((next, prev) => {
        if (prev.user && next.user?.id !== prev.user.id) clearPrivateData(qc, prev.user.id)
      }),
    [qc],
  )

  // Em navegações client-side (não no carregamento inicial), move o foco para o conteúdo.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    document.getElementById('conteudo')?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <>
      {showHeader ? (
        <Header />
      ) : (
        <a href="#conteudo" className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-primary px-3 py-2 text-primary-foreground">
          Pular para o conteúdo
        </a>
      )}
      <main id="conteudo" tabIndex={-1} className={cn('min-h-dvh outline-none', showBottomNav && 'pb-24')}>
        <Outlet />
      </main>
      {showFooter && (
        <div className={cn(showBottomNav && 'pb-20')}>
          <Footer />
        </div>
      )}
      {showBottomNav && <MobileNav />}
      <AuthDialogHost />
      <Toaster
        theme="dark"
        position={isMobile ? "bottom-center" : "bottom-right"}
        mobileOffset={{ bottom: 180 }}
        richColors
        closeButton
        containerAriaLabel="Notificações"
        toastOptions={{ style: { fontFamily: 'var(--font-sans)', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' } }}
      />
      {MockPanel && (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      )}
    </>
  )
}
