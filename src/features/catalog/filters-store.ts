import { useSyncExternalStore } from 'react'

/** Abertura do painel de filtros (drawer mobile), acionado pela barra de busca do topo. */
let open = false
/** Elemento que abriu o painel — recebe o foco de volta ao fechar. */
export let filtersReturnFocus: HTMLElement | null = null
const listeners = new Set<() => void>()
export const catalogFilters = {
  get: () => open,
  set(v: boolean) {
    if (v && !open && document.activeElement instanceof HTMLElement) filtersReturnFocus = document.activeElement
    open = v
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}
export function useCatalogFiltersOpen() {
  return useSyncExternalStore(catalogFilters.subscribe, catalogFilters.get, catalogFilters.get)
}
