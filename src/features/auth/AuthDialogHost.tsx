import { lazy, Suspense, useEffect, useState } from 'react'
import { useSession } from '@/lib/session'
import { authDialog, useAuthDialog } from './auth-dialog-store'

const AuthDialog = lazy(() => import('./AuthDialog').then((m) => ({ default: m.AuthDialog })))

/** Carrega o diálogo de autenticação só quando necessário (bundle inicial menor). */
export function AuthDialogHost() {
  const dialog = useAuthDialog()
  const session = useSession()
  const [mounted, setMounted] = useState(false)

  // Sessão expirada em qualquer tela: reabre o login sem sair da página (contexto preservado).
  useEffect(() => {
    if (session.status === 'expired' && !authDialog.get().open) authDialog.open('login', { reason: 'expired' })
  }, [session.status])

  useEffect(() => {
    if (dialog.open) setMounted(true)
  }, [dialog.open])

  if (!mounted) return null
  return (
    <Suspense fallback={null}>
      <AuthDialog />
    </Suspense>
  )
}
