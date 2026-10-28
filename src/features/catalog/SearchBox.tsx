import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBoxProps {
  value?: string
  onSearch: (q: string | undefined) => void
  placeholder?: string
  variant?: 'compact' | 'pill'
  className?: string
}

/** Busca do catálogo com debounce; o valor vai para a URL (?q=). */
export function SearchBox({ value, onSearch, placeholder = 'Buscar NFTs...', variant = 'compact', className }: SearchBoxProps) {
  const [text, setText] = useState(value ?? '')
  const lastSent = useRef(value ?? '')
  useEffect(() => {
    setText(value ?? '')
    lastSent.current = value ?? ''
  }, [value])
  useEffect(() => {
    if (text === lastSent.current) return
    const t = setTimeout(() => {
      lastSent.current = text
      onSearch(text.trim() || undefined)
    }, 350)
    return () => clearTimeout(t)
  }, [text, onSearch])
  const pill = variant === 'pill'
  return (
    <form
      role="search"
      className={cn('relative', pill ? 'w-full' : 'w-full sm:w-56', className)}
      onSubmit={(e) => {
        e.preventDefault()
        lastSent.current = text
        onSearch(text.trim() || undefined)
      }}
    >
      <label htmlFor="catalog-search" className="sr-only">
        Buscar NFTs por nome, coleção ou token
      </label>
      {pill && <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-primary" aria-hidden="true" />}
      <input
        id="catalog-search"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full min-w-0 border text-foreground placeholder:text-muted-foreground/80 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0',
          pill ? 'h-11 rounded-xl border-transparent bg-surface pl-11 pr-9 text-sm placeholder:text-[#e0a86f]' : 'h-8 rounded-sm border-input bg-background px-3 pr-8 text-xs',
        )}
      />
      {text && (
        <button type="button" className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Limpar busca" onClick={() => setText('')}>
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </form>
  )
}
