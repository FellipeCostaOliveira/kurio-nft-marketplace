import { useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { CollectionSlug } from '@/api/contracts'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

function Newsletter() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
    if (!ok) {
      setError('Informe um e-mail válido.')
      return
    }
    setError(null)
    // Fora do escopo: não simulamos sucesso de inscrição.
    toast.info('Inscrições ainda não estão disponíveis', { description: 'A newsletter não faz parte desta versão. Nenhum dado foi enviado.' })
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="text-sm font-semibold leading-tight">
        Antecipe-se ao próximo lançamento
      </h2>
      <div className="flex">
        <label htmlFor={`${id}-email`} className="sr-only">
          E-mail para newsletter
        </label>
        <input
          id={`${id}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : `${id}-hint`}
          className="h-8 min-w-0 flex-1 rounded-l-sm border border-input bg-background px-3 text-xs placeholder:text-muted-foreground"
        />
        <button type="submit" className="h-8 rounded-r-sm bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
          Enviar
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
        </p>
      )}
    </form>
  )
}

function SoonLink({ label }: { label: string }) {
  return (
    <Link to="/em-breve" search={{ secao: label }} className="text-xs text-foreground/90 hover:text-primary">
      {label}
    </Link>
  )
}

const SOCIAL = [
  { label: 'Facebook', href: 'https://facebook.com', path: 'M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V9c0-.6.4-1 1-1z' },
  { label: 'Instagram', href: 'https://instagram.com', path: 'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm5 5a4 4 0 100 8 4 4 0 000-8zm5.5-1.5a1 1 0 100 2 1 1 0 000-2z' },
  { label: 'X (Twitter)', href: 'https://x.com', path: 'M4 4l16 16M20 4L4 20' },
  { label: 'LinkedIn', href: 'https://linkedin.com', path: 'M5 9h3v10H5zM6.5 4a1.7 1.7 0 110 3.4 1.7 1.7 0 010-3.4zM10 9h3v1.5c.6-1 1.8-1.8 3.4-1.8 3 0 3.6 2 3.6 4.6V19h-3v-5c0-1.2 0-2.6-1.6-2.6S13 12.6 13 14v5h-3z' },
  { label: 'YouTube', href: 'https://youtube.com', path: 'M3 8c0-2 1-3 3-3h12c2 0 3 1 3 3v8c0 2-1 3-3 3H6c-2 0-3-1-3-3zm7 1v6l5-3z' },
]

export function FooterFeatures() {
  return (
    <section aria-label="Recursos da Kurio" className="mx-auto max-w-[1180px] px-4">
      <div className="grid gap-8 rounded-t-md bg-surface px-6 py-8 md:grid-cols-[repeat(3,1fr)_1.3fr] md:gap-0">
        {FEATURES.map((f) => (
          <div key={f.letter} className="md:border-r md:border-[#5a3b24] md:px-5 md:first:pl-0">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground" aria-hidden="true">
              {f.letter}
            </div>
            <h2 className="mb-1 text-sm font-semibold">{f.title}</h2>
            <p className="text-xs leading-relaxed text-[#e0a86f]">{f.text}</p>
          </div>
        ))}
        <div className="md:pl-5">
          <Newsletter />
        </div>
      </div>
    </section>
  )
}

const COLLECTION_LINKS: Array<{ label: string; slug: CollectionSlug }> = [
  { label: 'Arte digital', slug: 'arte-digital' },
  { label: 'Fotografia', slug: 'fotografia' },
  { label: 'Música', slug: 'musica' },
  { label: 'Arte 3D', slug: 'arte-3d' },
  { label: 'Utilidade', slug: 'utilidade' },
]

export function Footer() {
  return (
    <footer className="mt-16">
      <FooterFeatures />
      <div className="mx-auto max-w-[1180px] px-4">
        <div className="grid grid-cols-1 gap-3 bg-band px-6 py-5 text-xs sm:grid-cols-2 md:grid-cols-4 md:items-center">
          <span className="font-bold tracking-[0.18em]">KURIO</span>
          <span className="leading-relaxed">Feito para colecionadores, criadores e cultura</span>
          <a href="mailto:contato@email.com" className="hover:text-primary">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="hover:text-primary">
            +55 11 4002 8922
          </a>
        </div>
        <div className="grid grid-cols-2 gap-8 rounded-b-md bg-surface px-6 py-8 md:grid-cols-4">
          <nav aria-label="Meu perfil">
            <h2 className="mb-3 text-sm font-semibold">Meu perfil</h2>
            <ul className="flex flex-col gap-2">
              <li>
                <Link to="/perfil" className="text-xs hover:text-primary">
                  Meu perfil
                </Link>
              </li>
              <li>
                <SoonLink label="Minha coleção" />
              </li>
              <li>
                <SoonLink label="Atividade" />
              </li>
              <li>
                <SoonLink label="Estúdio do criador" />
              </li>
              <li>
                <Link to="/perfil/favoritos" className="text-xs hover:text-primary">
                  Lista de interesse
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Central de ajuda">
            <h2 className="mb-3 text-sm font-semibold">Central de ajuda</h2>
            <ul className="flex flex-col gap-2">
              {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((l) => (
                <li key={l}>
                  <SoonLink label={l} />
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Coleções">
            <h2 className="mb-3 text-sm font-semibold">Coleções</h2>
            <ul className="flex flex-col gap-2">
              {COLLECTION_LINKS.map((c) => (
                <li key={c.slug}>
                  <Link to="/" hash="catalogo" search={{ colecoes: c.slug }} className="text-xs hover:text-primary">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="mb-3 text-sm font-semibold">Redes sociais</h2>
            <ul className="mb-5 flex flex-wrap gap-2">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${s.label} (abre em nova aba)`}
                    className="flex size-7 items-center justify-center rounded-sm border border-primary text-primary hover:bg-accent"
                  >
                    <svg viewBox="0 0 24 24" className="size-3.5" fill={s.label.startsWith('X') ? 'none' : 'currentColor'} stroke={s.label.startsWith('X') ? 'currentColor' : 'none'} strokeWidth={2.5} aria-hidden="true">
                      <path d={s.path} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
            <h2 className="mb-2 text-sm font-semibold">Carteiras compatíveis</h2>
            <p className="inline-block rounded-sm bg-band px-2 py-1 text-[9px] font-semibold tracking-wider text-foreground/90">METAMASK · WALLETCONNECT · COINBASE</p>
          </div>
        </div>
        <p className="py-4 text-center text-xs text-foreground/85">© 2026 Kurio. Propriedade digital para todos.</p>
      </div>
    </footer>
  )
}
