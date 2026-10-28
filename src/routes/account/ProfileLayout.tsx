import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Download, Heart, LifeBuoy, LogOut, MapPin, ShoppingCart, Tag, User } from 'lucide-react'
import { RequireAuth } from '@/components/states'
import { useLogout } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'

const ITEMS = [
  { to: '/perfil', label: 'Dados do perfil', icon: User, exact: true },
  { to: '/perfil/carteiras', label: 'Carteiras', icon: MapPin },
  { label: 'Atividade', icon: ShoppingCart, soon: true },
  { to: '/perfil/favoritos', label: 'Lista de interesse', icon: Heart },
  { label: 'Ofertas', icon: Tag, soon: true },
  { label: 'Arquivos baixados', icon: Download, soon: true },
  { label: 'Suporte', icon: LifeBuoy, soon: true },
] as const

export function ProfileLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useLogout()
  return (
    <RequireAuth>
      <div className="mx-auto grid max-w-[1180px] gap-6 px-4 pt-6 md:grid-cols-[200px_1fr] lg:grid-cols-[192px_1fr] lg:gap-4">
        <aside aria-label="Meu perfil">
          <nav className="rounded-sm bg-surface py-3">
            <h2 className="mb-2 px-2 text-sm font-bold">Meu perfil</h2>
            <ul className="grid grid-cols-2 gap-x-1 sm:grid-cols-3 md:flex md:flex-col">
              {ITEMS.map((item) => {
                const Icon = item.icon
                if ('soon' in item)
                  return (
                    <li key={item.label}>
                      {/* Fora do escopo da entrega: mesmo visual do Figma, sem navegação (não simula sucesso). */}
                      <span aria-disabled="true" title="Indisponível nesta versão" className="flex cursor-default items-center gap-2 border-l-4 border-transparent px-3 py-2 text-xs text-[#d29a5c]">
                        <Icon className="size-3.5" aria-hidden="true" />
                        {item.label}
                        <span className="sr-only"> (indisponível nesta versão)</span>
                      </span>
                    </li>
                  )
                const active = 'exact' in item ? pathname === item.to : pathname.startsWith(item.to)
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={cn('flex items-center gap-2 border-l-4 px-3 py-2 text-xs', active ? 'border-primary text-[#e6a66b]' : 'border-transparent text-[#d29a5c] hover:text-primary')}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
              <li className="md:mt-1 md:border-t md:border-[#5a3b24]">
                <button type="button" onClick={() => logout.mutate()} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-primary hover:text-primary-hover" data-testid="logout">
                  <LogOut className="size-3.5" aria-hidden="true" /> Sair
                </button>
              </li>
            </ul>
          </nav>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </RequireAuth>
  )
}
