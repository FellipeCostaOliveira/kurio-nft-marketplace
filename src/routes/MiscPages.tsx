import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/usePageTitle'

/** Seções fora do escopo: comunicam claramente a indisponibilidade (sem simular sucesso). */
export function ComingSoonPage({ title }: { title: string }) {
  usePageTitle(title)
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col items-center px-4 py-24 text-center" data-testid="coming-soon">
      <p className="text-xs uppercase tracking-widest text-primary">Em breve</p>
      <h1 className="mt-3 text-2xl font-bold">{title}</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">Esta seção não faz parte da versão atual da Kurio. Enquanto isso, explore o catálogo de NFTs.</p>
      <Button asChild className="mt-6">
        <Link to="/" hash="catalogo">
          Explorar NFTs
        </Link>
      </Button>
    </div>
  )
}
