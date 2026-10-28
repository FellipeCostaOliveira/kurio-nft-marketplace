import { useEffect } from 'react'

export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} | Kurio` : 'Kurio — Marketplace de NFTs'
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  }, [title, description])
}
