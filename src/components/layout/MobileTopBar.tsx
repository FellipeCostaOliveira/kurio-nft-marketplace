import { useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'

/** Topo das telas mobile do Figma: botão voltar circular + título centralizado. */
export function MobileTopBar({ title, fallback = '/' }: { title: string; fallback?: string }) {
  const router = useRouter()
  const back = () => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: fallback }))
  return (
    <div className="relative flex h-14 items-center px-4 pt-2">
      <button type="button" onClick={back} className="flex size-10 items-center justify-center rounded-full bg-surface text-foreground" aria-label="Voltar">
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <h1 className="pointer-events-none absolute inset-x-16 text-center text-lg font-bold">{title}</h1>
    </div>
  )
}
