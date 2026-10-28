import { lazy, Suspense, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MobileCatalogBar } from '@/features/catalog/MobileCatalogBar'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NftCardSkeleton } from '@/features/catalog/NftCard'
import type { CatalogSearch } from '@/features/catalog/search'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

// Catálogo (Radix Select/Dialog/Slider) fora do caminho crítico do LCP.
const Catalog = lazy(() => import('@/features/catalog/Catalog').then((m) => ({ default: m.Catalog })))

/** Fallback com as mesmas dimensões do catálogo para não gerar deslocamento de layout. */
function CatalogFallback() {
  return (
    <section className="mx-auto mt-10 max-w-[1180px] px-4 lg:mt-14" aria-busy="true" aria-label="Carregando catálogo">
      <div className="grid gap-8 lg:grid-cols-[200px_1fr] lg:gap-[22px]">
        <div className="hidden h-[640px] rounded-sm bg-surface lg:block" />
        <div>
          <div className="h-[70px] sm:h-10" />
          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:gap-x-[18px] lg:gap-y-8">
            {Array.from({ length: 9 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

const SLIDES = [
  { image: '/nfts/emerald-ape.webp', alt: 'Emerald Ape #042: macaco marrom com óculos redondos verdes e jaqueta college verde', nftId: 'nft-001' },
  { image: '/nfts/ivory-baron.webp', alt: 'Ivory Baron #088: chimpanzé escuro com gola alta verde e blazer creme', nftId: 'nft-006' },
  { image: '/nfts/golden-beat.webp', alt: 'Golden Beat #207: macaco dourado com fones de ouvido verdes', nftId: 'nft-007' },
]

/** Hero do Figma mobile: cartão com gradiente, texto à esquerda e arte sobreposta à direita. */
function MobileHero() {
  const [slide, setSlide] = useState(0)
  const s = SLIDES[slide]
  return (
    <section aria-labelledby="hero-title" className="relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#5a3620] via-[#3a2316] to-[#24150f] p-4 pb-3">
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-[#7a4a2a]/25" />
      <div className="relative grid grid-cols-[1fr_44%] items-center gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="mt-2 text-[19px] font-bold uppercase leading-[1.35] tracking-wide">
            Seja dono da cultura digital
          </h1>
          <p className="mt-2 text-[11px] leading-relaxed text-[#e0a86f]">Descubra NFTs selecionados de criadores do mundo todo.</p>
          <Link to="/" hash="catalogo" className="mt-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            Explorar <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="relative">
          <Link to="/nft/$nftId" params={{ nftId: s.nftId }} className="block overflow-hidden rounded-2xl" aria-label="Ver NFT em destaque">
            <img src={s.image} alt={s.alt} width={640} height={640} fetchPriority={slide === 0 ? 'high' : 'auto'} className="aspect-[5/6] w-full object-cover" />
          </Link>
          <img
            src="/nfts/violet-nomad-sm.webp"
            alt=""
            width={320}
            height={320}
            className="absolute -bottom-1 -left-3 aspect-square w-[46%] rounded-xl border-2 border-[#3a2316] object-cover shadow-lg"
          />
        </div>
      </div>
      <div className="relative mt-1 flex justify-center" role="group" aria-label="Destaques">
        {SLIDES.map((sl, i) => (
          <button
            key={sl.nftId}
            type="button"
            onClick={() => setSlide(i)}
            className="flex size-6 items-center justify-center"
            aria-label={`Mostrar destaque ${i + 1} de ${SLIDES.length}`}
            aria-current={i === slide || undefined}
          >
            <span className={cn('size-2 rounded-full bg-primary', i === slide ? 'opacity-100' : 'opacity-50')} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  )
}

function Hero() {
  const [slide, setSlide] = useState(0)
  const s = SLIDES[slide]
  return (
    <section aria-labelledby="hero-title" className="mx-auto max-w-[1180px] px-4 pt-8 lg:pt-6">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_minmax(0,420px)] lg:grid-cols-[1fr_440px]">
        <div className="order-2 md:order-1 md:pl-4">
          <p className="mb-3 text-xs font-medium">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="text-[28px] font-bold uppercase leading-[1.25] tracking-wide sm:text-[34px] lg:text-[40px]">
            Seja dono do futuro
            <br className="hidden sm:block" /> da arte digital
          </h1>
          <p className="mt-4 max-w-md text-xs leading-relaxed text-foreground/90">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <Button asChild className="mt-6 h-9 px-8 text-xs uppercase tracking-wider">
            <Link to="/" hash="catalogo">
              Explorar
            </Link>
          </Button>
          <div className="mt-10 flex md:justify-end md:pr-4" role="group" aria-label="Destaques">
            {SLIDES.map((sl, i) => (
              <button
                key={sl.nftId}
                type="button"
                onClick={() => setSlide(i)}
                className="group flex size-6 items-center justify-center"
                aria-label={`Mostrar destaque ${i + 1} de ${SLIDES.length}`}
                aria-current={i === slide || undefined}
              >
                <span aria-hidden="true" className={cn('size-2 rounded-full bg-primary transition-opacity', i === slide ? 'opacity-100' : 'opacity-45 group-hover:opacity-80')} />
              </button>
            ))}
          </div>
        </div>
        <div className="order-1 md:order-2">
          <Link to="/nft/$nftId" params={{ nftId: s.nftId }} className="block overflow-hidden rounded-2xl" aria-label="Ver NFT em destaque">
            <img src={s.image} alt={s.alt} width={640} height={640} fetchPriority={slide === 0 ? 'high' : 'auto'} decoding={slide === 0 ? 'sync' : 'async'} className="aspect-square w-full object-cover" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function Promos() {
  const items = [
    {
      title: 'Lançamentos gênesis de edição limitada',
      text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
      img: '/nfts/emerald-ape-sm.webp',
      search: { aba: 'new' as const },
    },
    {
      title: 'Arte digital selecionada e muito mais',
      text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura on-chain.',
      img: '/nfts/ivory-baron-sm.webp',
      search: { colecoes: 'arte-digital' },
    },
  ]
  return (
    <section aria-label="Coleções em destaque" className="mx-auto mt-14 grid max-w-[1180px] gap-5 px-4 md:grid-cols-2">
      {items.map((p) => (
        <article key={p.title} className="grid grid-cols-[120px_1fr] items-center gap-4 rounded-sm bg-surface sm:grid-cols-[180px_1fr]">
          <img src={p.img} alt="" width={320} height={320} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
          <div className="py-4 pr-4 text-right">
            <h2 className="text-sm font-bold leading-snug">{p.title}</h2>
            <p className="mt-2 text-xs text-[#e0a86f]">{p.text}</p>
            <Button asChild size="sm" className="mt-3 h-7 text-xs">
              <Link to="/" hash="catalogo" search={p.search}>
                Explorar <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '13 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', img: '/nfts/ivory-baron-sm.webp' },
  { date: '13 de setembro', read: '3 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', img: '/nfts/emerald-ape-sm.webp' },
  { date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', img: '/nfts/violet-nomad-sm.webp' },
  { date: '15 de setembro', read: '3 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', img: '/nfts/golden-beat-sm.webp' },
]

function Journal() {
  return (
    <section aria-labelledby="journal-title" className="mx-auto mt-16 max-w-[1180px] px-4">
      <h2 id="journal-title" className="text-center text-xl font-bold">
        Diário da Cunhagem
      </h2>
      <p className="mt-2 text-center text-xs text-foreground/85">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((p) => (
          <li key={p.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-sm bg-surface">
              <img src={p.img} alt="" width={320} height={320} loading="lazy" className="aspect-[4/3] w-full rounded-t-xl object-cover" />
              <div className="flex flex-1 flex-col p-3">
                <p className="text-[11px] text-foreground/80">
                  <time>{p.date}</time> <span aria-hidden="true">|</span> Leitura de {p.read}
                </p>
                <h3 className="mt-2 text-sm font-bold leading-snug">{p.title}</h3>
                <p className="mt-1 flex-1 text-xs text-[#e0a86f]">{p.text}</p>
                <button
                  type="button"
                  className="mt-2 self-start text-xs text-foreground hover:text-primary"
                  aria-label={`Ler mais: ${p.title}`}
                  onClick={() => toast.info('Conteúdo editorial em breve', { description: 'As páginas editoriais não fazem parte desta versão.' })}
                >
                  Ler mais →
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

export interface HomeProps {
  search: CatalogSearch
  onChange: (patch: Partial<CatalogSearch>, opts?: { resetPage?: boolean }) => void
}

export function HomePage({ search, onChange }: HomeProps) {
  usePageTitle('', 'Kurio é um marketplace de NFTs com arte digital selecionada de criadores emergentes e consagrados.')
  const isMobile = useIsMobile()
  return (
    <>
      {isMobile ? (
        <div className="px-4 pt-5">
          <MobileCatalogBar search={search} onChange={onChange} />
          <MobileHero />
        </div>
      ) : (
        <Hero />
      )}
      <Suspense fallback={<CatalogFallback />}>
        <Catalog search={search} onChange={onChange} />
      </Suspense>
      <Promos />
      <Journal />
    </>
  )
}

export function MarketPage({ search, onChange }: HomeProps) {
  usePageTitle('Mercado', 'Explore o mercado de NFTs da Kurio com busca, filtros por coleção, rede e preço.')
  const isMobile = useIsMobile()
  return (
    <>
      {isMobile && (
        <div className="px-4 pt-5">
          <MobileCatalogBar search={search} onChange={onChange} />
        </div>
      )}
      <div className="mx-auto max-w-[1180px] px-4 pt-6">
        <nav aria-label="Trilha" className="text-xs">
          <ol className="flex gap-1">
            <li>
              <Link to="/" className="hover:text-primary">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Mercado</li>
          </ol>
        </nav>
        <h1 className="mt-4 text-2xl font-bold uppercase tracking-wide">Mercado</h1>
      </div>
      <Suspense fallback={<CatalogFallback />}>
        <Catalog search={search} onChange={onChange} />
      </Suspense>
    </>
  )
}
