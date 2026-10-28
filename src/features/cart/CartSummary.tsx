import { useId, useState } from 'react'
import type { Quote } from '@/api/contracts'
import { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useCoupon } from './hooks'

export function SummaryRows({ quote, updating }: { quote?: Quote; updating?: boolean }) {
  if (!quote)
    return (
      <div className="flex flex-col gap-3" aria-hidden="true" data-testid="summary-skeleton">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    )
  return (
    <dl className={cn('flex flex-col gap-2.5 text-xs transition-opacity', updating && 'opacity-60')} aria-busy={updating || undefined} data-testid="summary">
      <div className="flex justify-between gap-2">
        <dt>Subtotal</dt>
        <dd data-testid="summary-subtotal">{formatEth(quote.subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt>Desconto do lançamento</dt>
        <dd data-testid="summary-discount">(-) {formatEth(quote.discount)}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt>Taxa de rede</dt>
        <dd className="text-right">
          <span data-testid="summary-fee">{formatEth(quote.networkFee, { maxDecimals: 6 })}</span>
          <span className="block text-[10px] text-primary">Taxa estimada</span>
        </dd>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-[#5a3b24] pt-3 text-sm font-bold">
        <dt>Total</dt>
        <dd className="text-base text-primary" data-testid="summary-total">
          {formatEth(quote.total)}
        </dd>
      </div>
    </dl>
  )
}

export function CouponForm({ currentCode, compact, variant = 'default' }: { currentCode: string | null; compact?: boolean; variant?: 'default' | 'pill' }) {
  const id = useId()
  const { apply, remove } = useCoupon()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setError('Digite um código promocional.')
      return
    }
    setError(null)
    apply.mutate(code.trim(), {
      onSuccess: () => {
        setStatus(`Cupom ${code.trim().toUpperCase()} aplicado.`)
        setCode('')
      },
      onError: (err) => {
        const e = err as ApiError
        setError(e.fieldErrors?.code ?? e.message)
      },
    })
  }

  if (currentCode)
    return (
      <div className="flex items-center justify-between gap-2 rounded-sm border border-primary/60 bg-accent px-3 py-2 text-xs" data-testid="coupon-applied">
        <span>
          Cupom <strong>{currentCode}</strong> aplicado
        </span>
        <button
          type="button"
          className="text-link underline"
          onClick={() => remove.mutate(undefined, { onSuccess: () => setStatus(`Cupom ${currentCode} removido.`) })}
          disabled={remove.isPending}
        >
          Remover
        </button>
        <span className="sr-only" aria-live="polite">
          {status}
        </span>
      </div>
    )

  return (
    <form onSubmit={submit} noValidate className={cn('flex flex-col gap-1.5', compact && 'gap-1')}>
      <label htmlFor={`${id}-code`} className={cn('text-xs font-semibold', variant === 'pill' && 'sr-only')}>
        Código promocional
      </label>
      {variant === 'pill' ? (
        <div className="flex items-center rounded-full border border-[#5a3b24] bg-background p-1 pl-4">
          <input
            id={`${id}-code`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Digite o código promocional..."
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : undefined}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent text-xs uppercase placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <Button type="submit" className="h-10 rounded-full bg-gradient-to-r from-[#e0a06a] to-[#b8743c] px-5 text-sm" loading={apply.isPending}>
            Aplicar
          </Button>
        </div>
      ) : (
      <div className="flex">
        <input
          id={`${id}-code`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          autoComplete="off"
          className="h-8 min-w-0 flex-1 rounded-l-sm border border-input bg-background px-3 text-xs uppercase placeholder:normal-case placeholder:text-muted-foreground aria-[invalid=true]:border-destructive"
        />
        <Button type="submit" className="h-8 rounded-l-none px-4 text-xs" loading={apply.isPending}>
          Aplicar
        </Button>
      </div>
      )}
      <p id={`${id}-err`} className="min-h-4 text-xs text-destructive" aria-live="assertive" data-testid="coupon-error">
        {error}
      </p>
      <span className="sr-only" aria-live="polite">
        {status}
      </span>
    </form>
  )
}
