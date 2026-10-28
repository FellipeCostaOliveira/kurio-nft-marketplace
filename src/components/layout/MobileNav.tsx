import { Link, useRouterState } from '@tanstack/react-router'
import { Heart, Home, ScanLine, ShoppingCart, User } from 'lucide-react'
import { authDialog } from '@/features/auth/auth-dialog-store'
import { useCartCount } from '@/features/cart/hooks'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

/** Barra de navegação inferior do Figma mobile. */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const session = useSession()
  const count = useCartCount()
  const item = (active: boolean) => cn('flex size-11 items-center justify-center rounded-full', active ? 'text-primary' : 'text-[#e8c9a8]')

  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto flex h-[68px] max-w-[480px] items-center justify-between rounded-t-[28px] bg-[#221510] px-5 shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
        <Link to="/" className={item(pathname === '/')} aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined}>
          <Home className="size-5" fill={pathname === '/' ? 'currentColor' : 'none'} aria-hidden="true" />
        </Link>
        <Link to="/perfil/favoritos" className={item(pathname.startsWith('/perfil/favoritos'))} aria-label="Favoritos" aria-current={pathname.startsWith('/perfil/favoritos') ? 'page' : undefined}>
          <Heart className="size-5" fill="currentColor" aria-hidden="true" />
        </Link>
        <Link
          to="/mercado"
          className="-mt-10 flex size-[60px] items-center justify-center rounded-full border-4 border-background bg-gradient-to-br from-[#e0a06a] to-[#b8743c] text-primary-foreground shadow-lg"
          aria-label="Explorar mercado"
          aria-current={pathname.startsWith('/mercado') ? 'page' : undefined}
        >
          <ScanLine className="size-6" aria-hidden="true" />
        </Link>
        <Link to="/carrinho" className={cn(item(pathname.startsWith('/carrinho')), 'relative')} aria-label={`Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}`}>
          <ShoppingCart className="size-5" fill="currentColor" aria-hidden="true" />
          {count > 0 && (
            <span className="absolute right-0.5 top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground" aria-hidden="true">
              {count}
            </span>
          )}
        </Link>
        {session.user ? (
          <Link to="/perfil" className={item(pathname === '/perfil' || pathname.startsWith('/perfil/carteiras'))} aria-label="Meu perfil">
            <User className="size-5" fill="currentColor" aria-hidden="true" />
          </Link>
        ) : (
          <button type="button" className={item(false)} aria-label="Entrar" onClick={() => authDialog.open('login')}>
            <User className="size-5" fill="currentColor" aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>
  )
}
