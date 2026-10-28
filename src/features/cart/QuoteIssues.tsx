import type { Quote } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { formatEth } from '@/lib/eth'
import { useAcknowledgeCart } from './hooks'

/** Lista mudanças de preço/disponibilidade detectadas pela cotação da API. */
export function QuoteIssues({ quote, onAcknowledged }: { quote?: Quote; onAcknowledged?: () => void }) {
  const ack = useAcknowledgeCart()
  const issues = quote?.issues ?? []
  return (
    <div aria-live="polite" data-testid="quote-issues">
      {issues.length > 0 && (
        <div role="alert" className="mb-4 rounded-sm border border-primary bg-accent p-3 text-xs text-accent-foreground">
          <p className="font-semibold text-foreground">Alguns itens mudaram desde que você os adicionou:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {issues.map((i) => (
              <li key={`${i.type}-${i.itemId}`}>
                {i.type === 'PRICE_CHANGED' && (
                  <>
                    O preço de <strong>{i.name}</strong> mudou de {formatEth(i.previousPrice)} para {formatEth(i.currentPrice)}.
                  </>
                )}
                {i.type === 'UNAVAILABLE' && (
                  <>
                    A edição {i.edition} de <strong>{i.name}</strong> esgotou e será removida.
                  </>
                )}
                {i.type === 'QUANTITY_EXCEEDS' && (
                  <>
                    <strong>{i.name}</strong>: só há {i.available} disponível(is); você tinha {i.requested}.
                  </>
                )}
              </li>
            ))}
          </ul>
          <Button size="sm" className="mt-3 h-7 text-xs" loading={ack.isPending} onClick={() => ack.mutate(true, { onSuccess: onAcknowledged })}>
            Entendi, atualizar carrinho
          </Button>
        </div>
      )}
    </div>
  )
}
