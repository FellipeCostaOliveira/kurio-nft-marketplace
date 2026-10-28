import { useRef, useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { cn } from '@/lib/utils'
import { NftCard, NftCardSkeleton } from './NftCard'

/** Faixa horizontal "Mais desta coleção" / "Colecionadores também viram", com indicadores de página. */
export function NftStrip({ title, items, loading, id }: { title: string; items?: NftSummary[]; loading?: boolean; id: string }) {
  const ref = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const pages = 3

  const goTo = (p: number) => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    el.scrollTo({ left: (max * p) / (pages - 1), behavior: 'smooth' })
    setPage(p)
  }

  return (
    <section aria-labelledby={id} className="mx-auto mt-14 max-w-[1180px] px-4">
      <h2 id={id} className="mb-5 border-b border-[#5a3b24] pb-2 text-sm font-semibold text-primary">
        {title}
      </h2>
      <ul
        ref={ref}
        className="grid snap-x snap-mandatory auto-cols-[minmax(150px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 [scrollbar-width:none] sm:auto-cols-[minmax(180px,1fr)] md:grid-cols-5 md:grid-flow-row md:overflow-visible"
        onScroll={(e) => {
          const el = e.currentTarget
          const max = el.scrollWidth - el.clientWidth
          if (max > 0) setPage(Math.round((el.scrollLeft / max) * (pages - 1)))
        }}
        aria-busy={loading || undefined}
      >
        {loading || !items
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="snap-start">
                <NftCardSkeleton compact />
              </li>
            ))
          : items.map((n) => (
              <li key={n.id} className="snap-start">
                <NftCard nft={n} compact />
              </li>
            ))}
      </ul>
      <div className="mt-3 flex justify-center md:hidden" role="group" aria-label={`Navegar em ${title}`}>
        {Array.from({ length: pages }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className="flex size-6 items-center justify-center"
            aria-label={`Página ${i + 1} de ${pages}`}
            aria-current={page === i || undefined}
          >
            <span aria-hidden="true" className={cn('size-2.5 rounded-full border border-primary', page === i && 'bg-primary')} />
          </button>
        ))}
      </div>
      <div className="mt-4 hidden justify-center gap-1.5 md:flex" aria-hidden="true">
        {Array.from({ length: pages }, (_, i) => (
          <span key={i} className={cn('size-2.5 rounded-full border border-primary', i === 1 && 'bg-primary')} />
        ))}
      </div>
    </section>
  )
}
