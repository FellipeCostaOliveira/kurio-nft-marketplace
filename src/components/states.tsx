import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, LogIn, WifiOff } from 'lucide-react'
import { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { authDialog } from '@/features/auth/auth-dialog-store'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

export function ErrorState({ error, onRetry, title = 'Algo deu errado', className }: { error: unknown; onRetry?: () => void; title?: string; className?: string }) {
  const e = error instanceof ApiError ? error : null
  const offline = e?.code === 'NETWORK_ERROR' || e?.code === 'TIMEOUT'
  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-sm bg-surface px-6 py-10 text-center', className)} data-testid="error-state">
      {offline ? <WifiOff className="mb-3 size-6 text-primary" aria-hidden="true" /> : <AlertTriangle className="mb-3 size-6 text-primary" aria-hidden="true" />}
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{e?.message ?? 'Tente novamente em instantes.'}</p>
      {onRetry && (
        <Button className="mt-4" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function NotFoundState({ title = 'Página não encontrada', description = 'O endereço acessado não existe ou foi removido.' }: { title?: string; description?: string }) {
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col items-center px-4 py-24 text-center" data-testid="not-found">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button asChild className="mt-6">
        <Link to="/">Voltar para o início</Link>
      </Button>
    </div>
  )
}

/** Conteúdo privado: sem sessão (ex.: expirou na tela) mostra convite para entrar, sem perder a rota. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  if (session.user) return <>{children}</>
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col items-center px-4 py-24 text-center" data-testid="auth-required">
      <LogIn className="size-7 text-primary" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-bold">{session.status === 'expired' ? 'Sua sessão expirou' : 'Entre para continuar'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Esta área é exclusiva para colecionadores autenticados.</p>
      <Button className="mt-6" onClick={() => authDialog.open('login', { reason: session.status === 'expired' ? 'expired' : 'required' })}>
        Entrar
      </Button>
    </div>
  )
}
