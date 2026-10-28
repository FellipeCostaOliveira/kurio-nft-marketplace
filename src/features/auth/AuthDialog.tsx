import { useId, useState } from 'react'
import { CircleUserRound } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/errors'
import { loginSchema, registerSchema } from '@/api/schemas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { useZodForm } from '@/lib/form'
import { cn } from '@/lib/utils'
import { authDialog, returnFocusTo, useAuthDialog, type AuthMode } from './auth-dialog-store'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useLogin, useRegister } from './hooks'

/**
 * Ícones dos provedores carregados dos arquivos oficiais em /public/brand
 * (google.svg|png e facebook.svg|png — ver README). Sem o arquivo, mostra um ícone neutro.
 */
function BrandIcon({ name }: { name: 'google' | 'facebook' }) {
  const sources = [`/brand/${name}.svg`, `/brand/${name}.png`]
  const [index, setIndex] = useState(0)
  if (index >= sources.length) return <CircleUserRound className="size-4 text-muted-foreground" aria-hidden="true" />
  return <img src={sources[index]} alt="" width={16} height={16} className="size-4 object-contain" onError={() => setIndex((i) => i + 1)} />
}

function SocialButtons({ mobile }: { mobile?: boolean }) {
  const unavailable = (provider: string) =>
    toast.info(`Login com ${provider} indisponível`, { description: 'Nesta versão de demonstração, use e-mail e senha.' })
  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="mb-3 text-center text-xs text-muted-foreground">Ou continue com</p>
      <div className={cn('mx-auto flex flex-col gap-2', mobile ? 'w-full gap-3 [&_button]:h-10 [&_button]:rounded-md' : 'max-w-xs')}>
        <Button type="button" variant="ghost" className="border border-border bg-background text-xs font-normal" onClick={() => unavailable('Google')} aria-describedby="social-note">
          <BrandIcon name="google" /> Continuar com Google
        </Button>
        <Button type="button" variant="ghost" className="border border-border bg-background text-xs font-normal" onClick={() => unavailable('Facebook')} aria-describedby="social-note">
          <BrandIcon name="facebook" /> Continuar com Facebook
        </Button>
        <p id="social-note" className="sr-only">
          Login social não está disponível nesta demonstração.
        </p>
      </div>
    </div>
  )
}

// Figma mobile: login/cadastro em tela cheia, campos e botões maiores.
const MOBILE_FORM = 'w-full gap-4 [&_input]:h-12 [&_input]:rounded-lg [&_input]:bg-[#1a100c] [&_input]:text-sm'
const MOBILE_BTN = 'mt-4 h-12 rounded-lg text-base'

function LoginForm({ onDone, mobile }: { onDone: (name: string) => void; mobile?: boolean }) {
  const id = useId()
  const login = useLogin()
  const form = useZodForm(loginSchema, { email: '', password: '' })
  const [formError, setFormError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const data = form.validate()
    if (!data) return
    login.mutate(data, {
      onSuccess: (s) => onDone(s.user.displayName),
      onError: (err) => {
        const api = err as ApiError
        setFormError(api.message)
        if (Object.keys(api.fieldErrors ?? {}).length) form.setServerErrors(api.fieldErrors)
      },
    })
  }

  return (
    <form ref={form.formRef} onSubmit={submit} noValidate className={cn('mx-auto flex flex-col gap-3', mobile ? MOBILE_FORM : 'max-w-xs')}>
      <Field id={`${id}-email`} label="E-mail" srOnlyLabel error={form.errors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" placeholder="contato@email.com" value={form.values.email} onChange={(e) => form.set('email', e.target.value)} />}
      </Field>
      <Field id={`${id}-password`} label="Senha" srOnlyLabel error={form.errors.password}>
        {(p) => <PasswordInput {...p} autoComplete="current-password" placeholder="Senha" value={form.values.password} onChange={(e) => form.set('password', e.target.value)} />}
      </Field>
      <button
        type="button"
        className="self-end text-xs text-link hover:underline"
        onClick={() => toast.info('Recuperação de senha indisponível', { description: 'Este fluxo não faz parte desta entrega.' })}
      >
        Esqueceu a senha?
      </button>
      <div aria-live="assertive" className="min-h-0">
        {formError && <p className="rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{formError}</p>}
      </div>
      <Button type="submit" loading={login.isPending} className={cn(mobile && MOBILE_BTN)}>
        Entrar
      </Button>
    </form>
  )
}

function SignupForm({ onDone, mobile }: { onDone: (name: string) => void; mobile?: boolean }) {
  const id = useId()
  const register = useRegister()
  const form = useZodForm(registerSchema, { username: '', email: '', password: '', confirmPassword: '' })
  const [formError, setFormError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const data = form.validate()
    if (!data) return
    register.mutate(
      { username: data.username, email: data.email, password: data.password },
      {
        onSuccess: (s) => onDone(s.user.displayName),
        onError: (err) => {
          const api = err as ApiError
          setFormError(api.message)
          if (Object.keys(api.fieldErrors ?? {}).length) form.setServerErrors(api.fieldErrors)
        },
      },
    )
  }

  return (
    <form ref={form.formRef} onSubmit={submit} noValidate className={cn('mx-auto flex flex-col gap-3', mobile ? MOBILE_FORM : 'max-w-xs')}>
      <Field id={`${id}-username`} label="Nome de usuário" srOnlyLabel error={form.errors.username}>
        {(p) => <Input {...p} autoComplete="username" placeholder="Nome de usuário" value={form.values.username} onChange={(e) => form.set('username', e.target.value)} />}
      </Field>
      <Field id={`${id}-email`} label="E-mail" srOnlyLabel error={form.errors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" placeholder="Digite seu e-mail" value={form.values.email} onChange={(e) => form.set('email', e.target.value)} />}
      </Field>
      <Field id={`${id}-password`} label="Senha" srOnlyLabel error={form.errors.password} hint="Mín. 8 caracteres, com maiúscula, número e símbolo.">
        {(p) => <PasswordInput {...p} autoComplete="new-password" placeholder="Senha" value={form.values.password} onChange={(e) => form.set('password', e.target.value)} />}
      </Field>
      <Field id={`${id}-confirm`} label="Confirmar senha" srOnlyLabel error={form.errors.confirmPassword}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" placeholder="Confirmar senha" value={form.values.confirmPassword} onChange={(e) => form.set('confirmPassword', e.target.value)} />}
      </Field>
      <div aria-live="assertive">
        {formError && <p className="rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{formError}</p>}
      </div>
      <Button type="submit" loading={register.isPending} className={cn(mobile && MOBILE_BTN)}>
        {mobile ? 'Criar perfil' : 'Criar conta'}
      </Button>
    </form>
  )
}

/** Diálogo global de autenticação: aberto manualmente, por rota protegida ou por expiração de sessão. */
export function AuthDialog() {
  const dialog = useAuthDialog()
  const navigate = useNavigate()
  const mobile = useIsMobile()

  const onDone = (name: string) => {
    const redirect = authDialog.get().redirect
    authDialog.close()
    toast.success(`Olá, ${name}!`, { description: 'Você entrou na sua conta.' })
    if (redirect) void navigate({ to: redirect, replace: true })
  }

  const setMode = (m: AuthMode) => authDialog.setMode(m)

  return (
    <Dialog open={dialog.open} onOpenChange={(open) => !open && authDialog.close()}>
      <DialogContent
        className={cn(
          mobile
            ? 'inset-0 left-0 top-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-0 px-6 pb-8 pt-16'
            : 'max-w-[420px] px-6 pb-7 pt-6',
        )}
        accentBar={!mobile}
        onCloseAutoFocus={(e) => {
          if (returnFocusTo?.isConnected) {
            e.preventDefault()
            returnFocusTo.focus()
          }
        }}
      >
        {mobile ? (
          <>
            <p className="text-center text-3xl font-bold tracking-[0.18em]" aria-hidden="true">
              KURIO
            </p>
            <DialogTitle className="mb-6 mt-16 text-center text-xl font-bold">{dialog.mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}</DialogTitle>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-center gap-2" role="group" aria-label="Acesso à conta">
              {(['login', 'signup'] as const).map((m, i) => (
                <span key={m} className="flex items-center gap-2">
                  {i === 1 && <span className="h-5 w-px bg-primary" aria-hidden="true" />}
                  <button
                    type="button"
                    aria-pressed={dialog.mode === m}
                    className={cn('text-lg font-semibold', dialog.mode === m ? 'text-primary' : 'text-foreground hover:text-primary')}
                    onClick={() => setMode(m)}
                  >
                    {m === 'login' ? 'Entrar' : 'Criar conta'}
                  </button>
                </span>
              ))}
            </div>
            <DialogTitle className="sr-only">{dialog.mode === 'login' ? 'Entrar na Kurio' : 'Criar conta na Kurio'}</DialogTitle>
          </>
        )}
        {dialog.reason === 'expired' && (
          <p className="mb-3 rounded-sm border border-primary/50 bg-accent px-3 py-2 text-center text-xs text-accent-foreground" role="status">
            Sua sessão expirou. Entre novamente para continuar de onde parou.
          </p>
        )}
        {dialog.reason === 'required' && (
          <p className="mb-3 text-center text-xs text-accent-foreground" role="status">
            Entre para continuar.
          </p>
        )}
        <DialogDescription className={cn('mb-4 text-center text-xs', mobile && 'sr-only')}>
          {dialog.mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
        </DialogDescription>
        {dialog.mode === 'login' ? <LoginForm key="l" onDone={onDone} mobile={mobile} /> : <SignupForm key="s" onDone={onDone} mobile={mobile} />}
        <SocialButtons mobile={mobile} />
        {mobile && (
          <p className="mt-auto pt-8 text-center text-sm text-[#e8c9a8]">
            {dialog.mode === 'login' ? 'Novo na Kurio? ' : 'Já tem uma conta? '}
            <button type="button" className="underline-offset-4 hover:underline" onClick={() => setMode(dialog.mode === 'login' ? 'signup' : 'login')}>
              {dialog.mode === 'login' ? 'Crie uma conta' : 'Entre'}
            </button>
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
