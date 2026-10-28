import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import type { Network, Wallet, WalletInput, WalletSlot, WalletType } from '@/api/contracts'
import { NETWORKS, WALLET_TYPES } from '@/api/contracts'
import { ApiError } from '@/api/errors'
import { walletSchema } from '@/api/schemas'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { EnsSuffixSelect } from '@/components/ui/ens-suffix-select'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Checkbox, Skeleton } from '@/components/ui/misc'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProfile, useSaveWallet, useWallets } from '@/features/account/hooks'
import { useZodForm } from '@/lib/form'
import { usePageTitle } from '@/lib/usePageTitle'
import { shortHash } from '@/lib/utils'

const EMPTY: WalletInput = {
  displayName: '',
  nickname: '',
  network: '' as Network,
  profileName: '',
  address: '',
  secondaryAddress: '',
  walletType: '' as WalletType,
  referralCode: '',
  email: '',
  ensName: '',
  ensSuffix: '.eth',
}

function toInput(w: Wallet): WalletInput {
  const { id: _i, slot: _s, updatedAt: _u, ...rest } = w
  return rest
}

function WalletForm({ slot, initial, onSaved, sameAsPrimary }: { slot: WalletSlot; initial: WalletInput; onSaved: () => void; sameAsPrimary?: boolean }) {
  const id = useId()
  const save = useSaveWallet()
  const form = useZodForm(walletSchema, initial)
  const [formError, setFormError] = useState<string | null>(null)
  // Reinicia apenas quando o conteúdo inicial muda de fato (ex.: "Igual à carteira principal").
  const initialKey = JSON.stringify(initial)
  const { reset } = form
  useEffect(() => reset(JSON.parse(initialKey) as WalletInput), [initialKey, reset])
  const v = form.values
  const e = form.errors

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    setFormError(null)
    const data = form.validate()
    if (!data) {
      setFormError('Revise os campos destacados.')
      return
    }
    save.mutate(
      { slot, body: data, sameAsPrimary },
      {
        onSuccess: () => {
          toast.success(slot === 'primary' ? 'Carteira principal salva' : 'Carteira secundária salva')
          onSaved()
        },
        onError: (err) => {
          const api = err instanceof ApiError ? err : null
          setFormError(api?.message ?? 'Não foi possível salvar a carteira.')
          if (api?.fieldErrors && Object.keys(api.fieldErrors).length) form.setServerErrors(api.fieldErrors)
        },
      },
    )
  }

  return (
    <form ref={form.formRef} onSubmit={submit} noValidate className="mt-4" aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'} data-testid={`wallet-form-${slot}`}>
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <Field id={`${id}-dn`} label="Nome de exibição" required error={e.displayName}>
          {(p) => <Input {...p} value={v.displayName} onChange={(x) => form.set('displayName', x.target.value)} />}
        </Field>
        <Field id={`${id}-nk`} label="Apelido da carteira" required error={e.nickname}>
          {(p) => <Input {...p} value={v.nickname} onChange={(x) => form.set('nickname', x.target.value)} />}
        </Field>
        <Field id={`${id}-net`} label="Rede" required error={e.network}>
          {(p) => (
            <Select value={v.network || undefined} onValueChange={(x) => form.set('network', x as Network)}>
              <SelectTrigger {...p}>
                <SelectValue placeholder="Selecione uma rede" />
              </SelectTrigger>
              <SelectContent>
                {NETWORKS.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field id={`${id}-pn`} label="Nome do perfil" required error={e.profileName}>
          {(p) => <Input {...p} value={v.profileName} onChange={(x) => form.set('profileName', x.target.value)} />}
        </Field>
        <Field id={`${id}-ad`} label="Endereço da carteira" required error={e.address}>
          {(p) => <Input {...p} value={v.address} onChange={(x) => form.set('address', x.target.value)} placeholder="Endereço 0x da carteira" spellCheck={false} />}
        </Field>
        <Field id={`${id}-sa`} label="ENS ou carteira secundária (opcional)" srOnlyLabel error={e.secondaryAddress} className="sm:pt-[26px]">
          {(p) => <Input {...p} value={v.secondaryAddress} onChange={(x) => form.set('secondaryAddress', x.target.value)} placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} />}
        </Field>
        <Field id={`${id}-wt`} label="Tipo de carteira" required error={e.walletType}>
          {(p) => (
            <Select value={v.walletType || undefined} onValueChange={(x) => form.set('walletType', x as WalletType)}>
              <SelectTrigger {...p}>
                <SelectValue placeholder="Selecione uma carteira" />
              </SelectTrigger>
              <SelectContent>
                {WALLET_TYPES.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field id={`${id}-rc`} label="Código de indicação" required error={e.referralCode}>
          {(p) => <Input {...p} value={v.referralCode} onChange={(x) => form.set('referralCode', x.target.value)} />}
        </Field>
        <Field id={`${id}-em`} label="E-mail" required error={e.email}>
          {(p) => <Input {...p} type="email" value={v.email} onChange={(x) => form.set('email', x.target.value)} />}
        </Field>
        <Field id={`${id}-ens`} label="Nome ENS" required error={e.ensName}>
          {(p) => (
            <div className="flex gap-2">
              <EnsSuffixSelect />
              <Input {...p} value={v.ensName} onChange={(x) => form.set('ensName', x.target.value)} aria-label="Nome ENS" />
            </div>
          )}
        </Field>
      </div>
      <div aria-live="polite" className="mt-3 min-h-4 text-xs text-destructive" data-testid={`wallet-error-${slot}`}>
        {formError}
      </div>
      <Button type="submit" className="mt-2 h-9" loading={save.isPending}>
        Salvar carteira
      </Button>
    </form>
  )
}

function WalletSummary({ wallet, onEdit }: { wallet: Wallet; onEdit: () => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-surface p-3 text-xs" data-testid={`wallet-summary-${wallet.slot}`}>
      <div>
        <p className="font-semibold">
          {wallet.nickname} · {WALLET_TYPES.find((w) => w.id === wallet.walletType)?.name}
        </p>
        <p className="text-muted-foreground">
          {NETWORKS.find((n) => n.id === wallet.network)?.name} · {shortHash(wallet.address, 8, 6)} · {wallet.ensName}.eth
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onEdit}>
        Editar
      </Button>
    </div>
  )
}

export function WalletsPage() {
  usePageTitle('Carteiras')
  const wallets = useWallets()
  const profile = useProfile()
  const [editing, setEditing] = useState<{ primary: boolean; secondary: boolean }>({ primary: false, secondary: false })
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  if (wallets.isError) return <ErrorState error={wallets.error} onRetry={() => void wallets.refetch()} title="Não foi possível carregar suas carteiras" />
  if (wallets.isPending) return <Skeleton className="h-80 w-full" />

  const { primary, secondary } = wallets.data
  const base: WalletInput = { ...EMPTY, displayName: profile.data?.displayName ?? '', email: profile.data?.email ?? '', ensName: profile.data?.ensName ?? '', profileName: profile.data?.username ?? '' }
  const showPrimaryForm = editing.primary || !primary
  const secondaryInitial: WalletInput = sameAsPrimary && primary ? { ...toInput(primary), nickname: `${primary.nickname} (cópia)` } : secondary ? toInput(secondary) : base

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="w-primary">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 id="w-primary" className="text-sm font-semibold">
              Carteira principal
            </h1>
            <p className="text-xs text-[#e0a86f]">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!showPrimaryForm && (
            <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setEditing((s) => ({ ...s, primary: true }))}>
              Editar
            </button>
          )}
        </div>
        {showPrimaryForm ? (
          <WalletForm slot="primary" initial={primary ? toInput(primary) : base} onSaved={() => setEditing((s) => ({ ...s, primary: false }))} />
        ) : (
          <WalletSummary wallet={primary!} onEdit={() => setEditing((s) => ({ ...s, primary: true }))} />
        )}
      </section>

      <section aria-labelledby="w-secondary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="w-secondary" className="text-sm font-semibold">
              Carteira secundária
            </h2>
            {!secondary && !editing.secondary && <p className="text-xs text-[#e0a86f]">Você ainda não adicionou uma carteira secundária.</p>}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <Checkbox checked={sameAsPrimary} disabled={!primary} onCheckedChange={(c) => {
                setSameAsPrimary(!!c)
                if (c) setEditing((s) => ({ ...s, secondary: true }))
              }} />
              Igual à carteira principal
            </label>
            {!editing.secondary && (
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setEditing((s) => ({ ...s, secondary: true }))}>
                {secondary ? 'Editar' : 'Adicionar'}
              </button>
            )}
          </div>
        </div>
        {editing.secondary ? (
          <WalletForm
            slot="secondary"
            initial={secondaryInitial}
            sameAsPrimary={sameAsPrimary}
            onSaved={() => {
              setEditing((s) => ({ ...s, secondary: false }))
              setSameAsPrimary(false)
            }}
          />
        ) : (
          secondary && <WalletSummary wallet={secondary} onEdit={() => setEditing((s) => ({ ...s, secondary: true }))} />
        )}
      </section>
    </div>
  )
}
