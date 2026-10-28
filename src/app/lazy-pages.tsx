import { MarketPage } from '@/routes/HomePage'
import { ComingSoonPage } from '@/routes/MiscPages'
import { marketRoute, soonRoute, useCatalogNavigation } from './router'

export function MarketRoute() {
  const search = marketRoute.useSearch()
  const onChange = useCatalogNavigation('/mercado')
  return <MarketPage search={search} onChange={onChange} />
}

export function CreatorsRoute() {
  return <ComingSoonPage title="Criadores" />
}

export function LearnRoute() {
  return <ComingSoonPage title="Aprenda" />
}

export function SoonRoute() {
  const { secao } = soonRoute.useSearch()
  return <ComingSoonPage title={secao ?? 'Em breve'} />
}
