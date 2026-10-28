import { SlidersHorizontal } from 'lucide-react'
import { catalogFilters } from './filters-store'
import type { CatalogSearch } from './search'
import { SearchBox } from './SearchBox'

interface Props {
  search: CatalogSearch
  onChange: (patch: Partial<CatalogSearch>, opts?: { resetPage?: boolean }) => void
}

/** Barra do topo no mobile (Figma): busca "Explorar coleções" + botão de filtros. */
export function MobileCatalogBar({ search, onChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <SearchBox variant="pill" placeholder="Explorar coleções" value={search.q} onSearch={(q) => onChange({ q }, { resetPage: true })} />
      <button
        type="button"
        onClick={() => catalogFilters.set(true)}
        aria-label="Filtros"
        aria-haspopup="dialog"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e0a06a] to-[#b8743c] text-primary-foreground shadow-md"
      >
        <SlidersHorizontal className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
