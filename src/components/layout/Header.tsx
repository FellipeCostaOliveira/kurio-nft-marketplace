import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogIn, Menu, Search, ShoppingCart, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, DialogTrigger, SheetContent } from '@/components/ui/dialog'
import { authDialog } from '@/features/auth/auth-dialog-store'
import { useLogout } from '@/features/auth/hooks'
import { useCartCount } from '@/features/cart/hooks'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'
import { useRealtimeStatus } from '@/realtime/realtime'

const NAV = [
  { to: '/', label: 'Início', match: (p: string) => p === '/' },
  { to: '/mercado', label: 'Mercado', match: (p: string) => p.startsWith('/mercado') || p.startsWith('/nft') || p.startsWith('/carrinho') || p.startsWith('/pagamento') },
  { to: '/criadores', label: 'Criadores', match: (p: string) => p.startsWith('/criadores') },
  { to: '/aprenda', label: 'Aprenda', match: (p: string) => p.startsWith('/aprenda') },
] as const

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-xs font-bold tracking-[0.18em] text-foreground', className)} aria-label="Kurio — página inicial">
      KURIO
    </Link>
  )
}

function RealtimeDot() {
  const rt = useRealtimeStatus()
  const label = rt.status === 'connected' ? 'Tempo real conectado' : rt.status === 'connecting' ? 'Conectando ao tempo real' : 'Tempo real desconectado — reconectando'
  return (
    <span className="relative flex items-center" title={label}>
      <span className={cn('size-2 rounded-full', rt.status === 'connected' ? 'bg-success' : 'bg-muted-foreground')} aria-hidden="true" />
      <span className="sr-only" role="status">
        {label}
      </span>
    </span>
  )
}

export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const session = useSession()
  const count = useCartCount()
  const navigate = useNavigate()
  const logout = useLogout()
  const [menuOpen, setMenuOpen] = useState(false)

  const goSearch = () => {
    void navigate({ to: '/', hash: 'catalogo' }).then(() => {
      setTimeout(() => document.getElementById('catalog-search')?.focus(), 50)
    })
  }

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <a href="#conteudo" className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-primary px-3 py-2 text-primary-foreground">
        Pular para o conteúdo
      </a>
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-4 border-b border-[#5a3b24] px-4 lg:h-[60px]">
        <Logo />
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {NAV.map((n) => {
              const active = n.match(pathname)
              return (
                <li key={n.to}>
                  <Link
                    to={n.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn('relative block py-4 text-sm font-medium transition-colors hover:text-primary', active ? 'text-primary after:absolute after:inset-x-[-6px] after:bottom-0 after:h-0.5 after:bg-primary' : 'text-foreground')}
                  >
                    {n.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-3 sm:gap-4">
          <RealtimeDot />
          <button type="button" onClick={goSearch} className="rounded p-1.5 hover:text-primary" aria-label="Buscar NFTs">
            <Search className="size-[18px]" aria-hidden="true" />
          </button>
          <Link to="/carrinho" className="relative rounded p-1.5 hover:text-primary" aria-label={`Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <ShoppingCart className="size-[18px]" aria-hidden="true" />
            <span className="absolute -right-0.5 top-0 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground" aria-hidden="true" data-testid="cart-count">
              {count}
            </span>
          </Link>
          {session.user ? (
            <Link to="/perfil" className="hidden items-center gap-2 rounded-md border border-primary px-2 py-1 text-xs font-semibold text-primary hover:bg-accent sm:flex" data-testid="user-menu">
              {session.user.avatarUrl ? <img src={session.user.avatarUrl} alt="" className="size-5 rounded-full object-cover" /> : <User className="size-4" aria-hidden="true" />}
              <span className="max-w-28 truncate">{session.user.displayName}</span>
            </Link>
          ) : (
            <Button size="sm" className="hidden sm:inline-flex" onClick={() => authDialog.open('login')}>
              <LogIn aria-hidden="true" /> Entrar
            </Button>
          )}
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <button type="button" className="rounded p-1.5 md:hidden" aria-label="Abrir menu">
                <Menu className="size-5" aria-hidden="true" />
              </button>
            </DialogTrigger>
            <SheetContent aria-describedby={undefined}>
              <DialogTitle className="mb-6 text-sm tracking-[0.18em]">MENU</DialogTitle>
              <nav aria-label="Principal (mobile)">
                <ul className="flex flex-col gap-1">
                  {NAV.map((n) => (
                    <li key={n.to}>
                      <Link
                        to={n.to}
                        onClick={() => setMenuOpen(false)}
                        aria-current={n.match(pathname) ? 'page' : undefined}
                        className={cn('block rounded px-3 py-2.5 text-base', n.match(pathname) ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-2')}
                      >
                        {n.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-6 border-t border-border pt-6">
                {session.user ? (
                  <div className="flex flex-col gap-2">
                    <Link to="/perfil" onClick={() => setMenuOpen(false)} className="rounded px-3 py-2.5 hover:bg-surface-2">
                      Meu perfil ({session.user.displayName})
                    </Link>
                    <Link to="/perfil/carteiras" onClick={() => setMenuOpen(false)} className="rounded px-3 py-2.5 hover:bg-surface-2">
                      Carteiras
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMenuOpen(false)
                        logout.mutate()
                      }}
                    >
                      Sair
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setMenuOpen(false)
                      authDialog.open('login')
                    }}
                  >
                    <LogIn aria-hidden="true" /> Entrar
                  </Button>
                )}
              </div>
            </SheetContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}
