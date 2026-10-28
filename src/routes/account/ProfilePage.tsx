import { useEffect, useId, useRef, useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { ProfileUpdate } from '@/api/contracts'
import { ApiError } from '@/api/errors'
import { passwordChangeSchema, profileSchema } from '@/api/schemas'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { EnsSuffixSelect } from '@/components/ui/ens-suffix-select'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { PasswordInput } from '@/components/ui/password-input'
import { useProfile, useProfileMutations } from '@/features/account/hooks'
import { useZodForm } from '@/lib/form'
import { usePageTitle } from '@/lib/usePageTitle'

/** Redimensiona para 256px (WebP) antes do upload. */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const s = Math.min(bitmap.width, bitmap.height)
  ctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, size, size)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao processar imagem'))), 'image/webp', 0.85))
}

const EMPTY: ProfileUpdate = { displayName: '', username: '', email: '', ensName: '', ensSuffix: '.eth', walletNickname: '' }

export function ProfilePage() {
  usePageTitle('Meu perfil')
  const id = useId()
  const profile = useProfile()
  const m = useProfileMutations()
  const form = useZodForm(profileSchema, EMPTY)
  const pwd = useZodForm(passwordChangeSchema, { currentPassword: '', newPassword: '', confirmPassword: '' })
  const [status, setStatus] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const loaded = useRef<number | null>(null)

  useEffect(() => {
    const p = profile.data
    if (p && loaded.current !== p.version) {
      loaded.current = p.version
      form.reset({ displayName: p.displayName, username: p.username, email: p.email, ensName: p.ensName, ensSuffix: '.eth', walletNickname: p.walletNickname })
    }
  }, [profile.data, form])

  const passwordTouched = !!(pwd.values.currentPassword || pwd.values.newPassword || pwd.values.confirmPassword)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    setFormError(null)
    const data = form.validate()
    const pdata = passwordTouched ? pwd.validate() : null
    if (!data || (passwordTouched && !pdata)) {
      setFormError('Revise os campos destacados.')
      return
    }
    try {
      await m.update.mutateAsync(data)
      if (pdata) {
        await m.changePassword.mutateAsync({ currentPassword: pdata.currentPassword, newPassword: pdata.newPassword })
        pwd.reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
      }
      setStatus(pdata ? 'Perfil e senha atualizados.' : 'Perfil atualizado.')
      toast.success(pdata ? 'Perfil e senha atualizados' : 'Perfil atualizado')
    } catch (err) {
      const api = err instanceof ApiError ? err : null
      setFormError(api?.message ?? 'Não foi possível salvar.')
      if (api?.fieldErrors) {
        const fe = api.fieldErrors
        if ('currentPassword' in fe || 'newPassword' in fe) pwd.setServerErrors(fe)
        else form.setServerErrors(fe)
      }
    }
  }

  const onFile = async (file: File | undefined) => {
    setAvatarError(null)
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setAvatarError('Use uma imagem PNG, JPG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('A imagem original deve ter até 5 MB.')
      return
    }
    try {
      const blob = await resizeImage(file)
      await m.uploadAvatar.mutateAsync(blob)
      toast.success('Avatar atualizado')
    } catch (err) {
      const api = err instanceof ApiError ? err : null
      setAvatarError(api?.fieldErrors.avatar ?? api?.message ?? 'Não foi possível enviar a imagem.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} title="Não foi possível carregar seu perfil" />
  if (profile.isPending)
    return (
      <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Carregando perfil">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    )

  const v = form.values
  const avatar = profile.data.avatarUrl

  return (
    <form ref={form.formRef} onSubmit={save} noValidate aria-labelledby={`${id}-t`} className="max-w-[540px] lg:max-w-none">
      <h1 id={`${id}-t`} className="mb-5 text-sm font-semibold">
        Perfil do colecionador
      </h1>
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <Field id={`${id}-dn`} label="Nome de exibição" required error={form.errors.displayName}>
          {(p) => <Input {...p} value={v.displayName} onChange={(e) => form.set('displayName', e.target.value)} autoComplete="name" />}
        </Field>
        <Field id={`${id}-un`} label="Nome de usuário" required error={form.errors.username}>
          {(p) => <Input {...p} value={v.username} onChange={(e) => form.set('username', e.target.value)} autoComplete="username" />}
        </Field>
        <Field id={`${id}-em`} label="E-mail" required error={form.errors.email}>
          {(p) => <Input {...p} type="email" value={v.email} onChange={(e) => form.set('email', e.target.value)} autoComplete="email" />}
        </Field>
        <Field id={`${id}-ens`} label="Nome ENS" required error={form.errors.ensName}>
          {(p) => (
            <div className="flex gap-2">
              <EnsSuffixSelect />
              <Input {...p} value={v.ensName} onChange={(e) => form.set('ensName', e.target.value)} aria-label="Nome ENS" />
            </div>
          )}
        </Field>
        <Field id={`${id}-wn`} label="Apelido da carteira" required error={form.errors.walletNickname}>
          {(p) => <Input {...p} value={v.walletNickname} onChange={(e) => form.set('walletNickname', e.target.value)} />}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" id={`${id}-av`}>
            Avatar
          </span>
          <div className="flex items-center gap-3" role="group" aria-labelledby={`${id}-av`}>
            <span className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-border bg-surface">
              {avatar ? <img src={avatar} alt="Seu avatar atual" className="size-full object-cover" data-testid="avatar-img" /> : <ImageIcon className="size-4 text-primary" aria-label="Sem avatar" />}
            </span>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id={`${id}-file`} onChange={(e) => void onFile(e.target.files?.[0])} aria-describedby={avatarError ? `${id}-av-err` : undefined} data-testid="avatar-input" tabIndex={-1} />
            <Button type="button" size="sm" className="h-8" onClick={() => fileRef.current?.click()} loading={m.uploadAvatar.isPending}>
              Alterar
            </Button>
            {avatar && (
              <button type="button" className="text-xs hover:text-primary" onClick={() => m.removeAvatar.mutate(undefined, { onSuccess: () => toast.success('Avatar removido') })}>
                Remover
              </button>
            )}
          </div>
          {avatarError && (
            <p id={`${id}-av-err`} className="text-xs text-destructive" role="alert">
              {avatarError}
            </p>
          )}
        </div>
      </div>

      <fieldset className="mt-8 grid max-w-[260px] gap-4 sm:max-w-[calc(50%-0.5rem)]">
        <legend className="mb-3 text-sm font-semibold">Alterar senha</legend>
        <Field id={`${id}-cp`} label="Senha atual" error={pwd.errors.currentPassword}>
          {(p) => <PasswordInput {...p} value={pwd.values.currentPassword} onChange={(e) => pwd.set('currentPassword', e.target.value)} autoComplete="current-password" />}
        </Field>
        <Field id={`${id}-np`} label="Nova senha" error={pwd.errors.newPassword} hint="Mín. 8 caracteres, com maiúscula, número e símbolo.">
          {(p) => <PasswordInput {...p} value={pwd.values.newPassword} onChange={(e) => pwd.set('newPassword', e.target.value)} autoComplete="new-password" />}
        </Field>
        <Field id={`${id}-cf`} label="Confirmar nova senha" error={pwd.errors.confirmPassword}>
          {(p) => <PasswordInput {...p} value={pwd.values.confirmPassword} onChange={(e) => pwd.set('confirmPassword', e.target.value)} autoComplete="new-password" />}
        </Field>
      </fieldset>

      <div aria-live="polite" className="mt-4 min-h-5 text-xs">
        {formError && (
          <p className="text-destructive" data-testid="profile-error">
            {formError}
          </p>
        )}
        {status && (
          <p className="text-success" data-testid="profile-status">
            {status}
          </p>
        )}
      </div>
      <Button type="submit" className="mt-3 h-9 w-28" loading={m.update.isPending || m.changePassword.isPending}>
        Salvar
      </Button>
    </form>
  )
}
