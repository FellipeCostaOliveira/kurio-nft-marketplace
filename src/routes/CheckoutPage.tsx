import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, MoreVertical, Plug, Unplug, Wallet as WalletIcon } from 'lucide-react'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { CollectorInfo, CreateOrderRequest, Network, Quote, Wallet, WalletType } from '@/api/contracts'
import { NETWORKS, WALLET_TYPES } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import { qk } from '@/api/queryKeys'
import { collectorSchema } from '@/api/schemas'
import { ErrorState, RequireAuth } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { EnsSuffixSelect } from '@/components/ui/ens-suffix-select'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Checkbox, RadioGroup, RadioGroupItem, Skeleton } from '@/components/ui/misc'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePendingOrders, useProfile, useWallets } from '@/features/account/hooks'
import { CouponForm, SummaryRows } from '@/features/cart/CartSummary'
import { useCart, useCartScope, useQuote } from '@/features/cart/hooks'
import { QuoteIssues } from '@/features/cart/QuoteIssues'
import { attemptFor, clearAttempt, getAttempt, loadDraft, markAttemptOrder, saveDraft } from '@/features/checkout/attempt'
import { formatEth } from '@/lib/eth'
import { useZodForm } from '@/lib/form'
import { useSession } from '@/lib/session'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn, shortHash } from '@/lib/utils'

const EMPTY: CollectorInfo = {
  displayName: '',
  username: '',
  network: '' as Network,
  profileName: '',
  walletAddress: '',
  secondaryAddress: '',
  walletType: '' as WalletType,
  referralCode: '',
  email: '',
  ensName: '',
  ensSuffix: '.eth',
  note: '',
}

function fromWallet(w: Wallet, base: CollectorInfo): CollectorInfo {
  return {
    ...base,
    displayName: base.displayName || w.displayName,
    network: w.network,
    profileName: w.profileName,
    walletAddress: w.address,
    secondaryAddress: w.secondaryAddress,
    walletType: w.walletType,
    referralCode: base.referralCode || w.referralCode,
    email: base.email || w.email,
    ensName: base.ensName || w.ensName,
  }
}

type ConnState = { status: 'idle' | 'connecting' | 'connected' | 'rejected' | 'disconnected'; address?: string; message?: string }

function LinesList({ quote }: { quote?: Quote }) {
  if (!quote)
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  return (
    <ul className="flex flex-col gap-2">
      {quote.lines.map((l) => (
        <li key={l.itemId} className="flex items-center gap-3 rounded-sm bg-surface p-1.5 text-xs">
          <img src={l.image.srcSm} alt="" width={40} height={40} className="size-10 rounded-sm object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {l.name} <span className="font-normal text-muted-foreground">(x {l.quantity})</span>
            </p>
            <p className="text-[11px] text-primary">
              ID do token: {l.tokenId} · {l.editionLabel}
            </p>
          </div>
          <p className="font-semibold text-primary">{formatEth(l.lineTotal)}</p>
        </li>
      ))}
    </ul>
  )
}

function CheckoutInner() {
  usePageTitle('Pagamento')
  const id = useId()
  const session = useSession()
  const userId = session.user!.id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const scope = useCartScope()
  const cart = useCart()
  const wallets = useWallets()
  const profile = useProfile()
  const pending = usePendingOrders()

  const registered = useMemo(() => [wallets.data?.primary, wallets.data?.secondary].filter((w): w is Wallet => !!w), [wallets.data])
  const [walletId, setWalletId] = useState<string>('')
  const form = useZodForm(collectorSchema, { ...EMPTY, ...(loadDraft(userId) ?? {}) } as CollectorInfo)
  const network = (form.values.network || 'ethereum') as Network
  const quote = useQuote(network, cart.data)
  const [showCoupon, setShowCoupon] = useState(false)
  const [conn, setConn] = useState<ConnState>({ status: 'idle' })
  const [reviewQuote, setReviewQuote] = useState<Quote | null>(null)
  const [submitState, setSubmitState] = useState<{ kind: 'idle' | 'verifying' | 'error'; message?: string }>({ kind: 'idle' })
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null)
  const inflight = useRef(false)
  const isMobile = useIsMobile()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const prefilled = useRef(false)

  // Pré-preenchimento: rascunho > carteira principal > perfil.
  useEffect(() => {
    if (prefilled.current || !wallets.data || !profile.data) return
    prefilled.current = true
    const draft = loadDraft(userId)
    const first = registered[0]
    if (first) setWalletId((w) => w || first.id)
    else setWalletId('external')
    if (!draft) {
      const base: CollectorInfo = { ...EMPTY, displayName: profile.data.displayName, username: profile.data.username, email: profile.data.email, ensName: profile.data.ensName }
      form.setValues(first ? fromWallet(first, base) : base)
    }
  }, [wallets.data, profile.data, registered, userId, form])

  // Rascunho só é salvo depois do pré-preenchimento (evita gravar o formulário vazio).
  useEffect(() => {
    if (prefilled.current) saveDraft(userId, form.values)
  }, [userId, form.values])

  const external = walletId === 'external'
  const selectWallet = (idv: string) => {
    setWalletId(idv)
    setConn({ status: 'idle' })
    const w = registered.find((x) => x.id === idv)
    if (w) form.setValues((v) => fromWallet(w, v))
  }

  const connect = useMutation({
    mutationFn: () => api.wallets.connect(walletId, network, external ? form.values.walletAddress : undefined),
    onMutate: () => setConn({ status: 'connecting' }),
    onSuccess: (c) => setConn({ status: 'connected', address: c.address }),
    onError: (e) => setConn({ status: 'rejected', message: e instanceof ApiError ? e.message : 'Falha ao conectar a carteira.' }),
  })
  const disconnect = useMutation({ mutationFn: () => api.wallets.disconnect(), onSettled: () => setConn({ status: 'disconnected', message: 'Carteira desconectada.' }) })

  // Mudou carteira ou rede: conexão anterior deixa de valer.
  useEffect(() => setConn((c) => (c.status === 'connected' ? { status: 'idle' } : c)), [network, walletId])

  const createOrder = useMutation({
    mutationFn: ({ body, key }: { body: CreateOrderRequest; key: string }) => api.orders.create(body, key),
  })

  const items = cart.data?.items ?? []
  const quoteIsStale = !!reviewQuote && !!quote.data && quote.data.version !== reviewQuote.version

  /** 1) valida campos 2) revalida cotação na API 3) abre a revisão. */
  const startReview = async () => {
    setCheckoutNotice(null)
    const data = form.validate()
    if (!data) {
      setDetailsOpen(true)
      setCheckoutNotice('Revise os campos destacados do formulário.')
      return
    }
    if (!walletId) {
      setCheckoutNotice('Selecione uma carteira.')
      return
    }
    try {
      const fresh = await qc.fetchQuery({ queryKey: [...qk.quote(scope, network), cart.data?.version ?? 0], queryFn: () => api.quote(network), staleTime: 0 })
      if (fresh.issues.length > 0) {
        setCheckoutNotice('Preço ou disponibilidade mudaram. Revise as alterações antes de continuar.')
        return
      }
      setSubmitState({ kind: 'idle' })
      setReviewQuote(fresh)
    } catch (e) {
      setCheckoutNotice(e instanceof ApiError ? e.message : 'Não foi possível validar a cotação.')
    }
  }

  const refreshReview = async () => {
    const fresh = await qc.fetchQuery({ queryKey: [...qk.quote(scope, network), cart.data?.version ?? 0], queryFn: () => api.quote(network), staleTime: 0 })
    if (fresh.issues.length > 0) {
      setReviewQuote(null)
      setCheckoutNotice('Preço ou disponibilidade mudaram. Revise as alterações antes de continuar.')
    } else setReviewQuote(fresh)
  }

  const submit = async (retry = 0): Promise<void> => {
    if (!reviewQuote || inflight.current) return // bloqueia cliques repetidos
    const body: CreateOrderRequest = { quoteId: reviewQuote.id, quoteVersion: reviewQuote.version, network, walletId, collector: form.values }
    const attempt = attemptFor(userId, body)
    inflight.current = true
    setSubmitState(retry ? { kind: 'verifying', message: 'Não recebemos a resposta do servidor. Verificando seu pedido com a mesma tentativa…' } : { kind: 'idle' })
    try {
      const order = await createOrder.mutateAsync({ body, key: attempt.key })
      markAttemptOrder(userId, order.id)
      qc.setQueryData(qk.order(userId, order.id), order)
      void qc.invalidateQueries({ queryKey: qk.orders(userId, 'pending') })
      inflight.current = false
      setReviewQuote(null)
      void navigate({ to: '/pedido/$orderId', params: { orderId: order.id }, replace: true })
    } catch (err) {
      inflight.current = false
      const e = err instanceof ApiError ? err : null
      if (e && (e.code === 'TIMEOUT' || e.code === 'NETWORK_ERROR')) {
        if (retry < 1) {
          // Reenvio automático com a MESMA chave: recupera o pedido se ele foi criado.
          setSubmitState({ kind: 'verifying', message: 'Não recebemos a resposta do servidor. Verificando seu pedido…' })
          await new Promise((r) => setTimeout(r, 800))
          return submit(retry + 1)
        }
        setSubmitState({ kind: 'error', message: 'Ainda sem resposta do servidor. Seu pedido não será duplicado: tente novamente para verificar.' })
        return
      }
      if (e?.code === 'QUOTE_OUTDATED') {
        const fresh = (e.details as { quote?: Quote } | undefined)?.quote
        if (fresh) qc.setQueryData([...qk.quote(scope, network), cart.data?.version ?? 0], fresh)
        void qc.invalidateQueries({ queryKey: qk.cart(scope) })
        setReviewQuote(null)
        setCheckoutNotice(`${e.message}${fresh && reviewQuote ? ` Total anterior ${formatEth(reviewQuote.total)} → novo total ${formatEth(fresh.total)}.` : ''}`)
        return
      }
      if (e?.code === 'WALLET_DISCONNECTED') {
        setConn({ status: 'disconnected', message: e.message })
        setSubmitState({ kind: 'error', message: e.message })
        return
      }
      if (e?.code === 'IDEMPOTENCY_CONFLICT') clearAttempt(userId)
      if (e?.code === 'VALIDATION_ERROR' && Object.keys(e.fieldErrors).length) {
        setReviewQuote(null)
        setDetailsOpen(true)
        form.setServerErrors(e.fieldErrors)
      }
      if (e && (e.code === 'SESSION_EXPIRED' || e.code === 'UNAUTHENTICATED')) {
        setReviewQuote(null)
        return
      }
      setSubmitState({ kind: 'error', message: e?.message ?? 'Não foi possível enviar o pedido.' })
    }
  }

  const pendingOrder = pending.data?.[0]
  const attempt = getAttempt(userId)

  if (cart.isError) return <ErrorState className="mx-auto mt-10 max-w-xl" error={cart.error} onRetry={() => void cart.refetch()} title="Não foi possível carregar seu carrinho" />

  const err = form.errors
  const v = form.values

  const formBody = (
    <>
          <h2 id={`${id}-title`} className="mb-4 text-sm font-semibold">
            Perfil do colecionador
          </h2>
          <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
            <Field id={`${id}-dn`} label="Nome de exibição" required error={err.displayName}>
              {(p) => <Input {...p} value={v.displayName} onChange={(e) => form.set('displayName', e.target.value)} autoComplete="name" />}
            </Field>
            <Field id={`${id}-un`} label="Nome de usuário" required error={err.username}>
              {(p) => <Input {...p} value={v.username} onChange={(e) => form.set('username', e.target.value)} autoComplete="username" />}
            </Field>
            <Field id={`${id}-net`} label="Rede" required error={err.network}>
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
            <Field id={`${id}-pn`} label="Nome do perfil" required error={err.profileName}>
              {(p) => <Input {...p} value={v.profileName} onChange={(e) => form.set('profileName', e.target.value)} />}
            </Field>
            <Field id={`${id}-addr`} label="Endereço da carteira" required error={err.walletAddress} hint={!external ? 'Definido pela carteira cadastrada selecionada.' : undefined}>
              {(p) => <Input {...p} value={v.walletAddress} readOnly={!external} onChange={(e) => form.set('walletAddress', e.target.value)} placeholder="Endereço 0x da carteira" className={cn(!external && 'opacity-80')} spellCheck={false} />}
            </Field>
            <Field id={`${id}-sec`} label="ENS ou carteira secundária (opcional)" error={err.secondaryAddress} className="sm:pt-[22px]" srOnlyLabel>
              {(p) => <Input {...p} value={v.secondaryAddress} onChange={(e) => form.set('secondaryAddress', e.target.value)} placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} />}
            </Field>
            <Field id={`${id}-wt`} label="Tipo de carteira" required error={err.walletType}>
              {(p) => (
                <Select value={v.walletType || undefined} onValueChange={(x) => form.set('walletType', x as WalletType)} disabled={!external}>
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
            <Field id={`${id}-ref`} label="Código de indicação" required error={err.referralCode}>
              {(p) => <Input {...p} value={v.referralCode} onChange={(e) => form.set('referralCode', e.target.value)} />}
            </Field>
            <Field id={`${id}-em`} label="E-mail" required error={err.email}>
              {(p) => <Input {...p} type="email" value={v.email} onChange={(e) => form.set('email', e.target.value)} autoComplete="email" />}
            </Field>
            <Field id={`${id}-ens`} label="Nome ENS" required error={err.ensName}>
              {(p) => (
                <div className="flex gap-2">
                  <EnsSuffixSelect />
                  <Input {...p} value={v.ensName} onChange={(e) => form.set('ensName', e.target.value)} aria-label="Nome ENS" />
                </div>
              )}
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Checkbox
              id={`${id}-other`}
              checked={external}
              onCheckedChange={(c) => {
                if (c) selectWallet('external')
                else if (registered[0]) selectWallet(registered[0].id)
              }}
              disabled={registered.length === 0}
            />
            <label htmlFor={`${id}-other`} className="text-xs">
              Usar outra carteira?
            </label>
            {registered.length === 0 && (
              <Link to="/perfil/carteiras" className="text-xs text-link underline">
                Cadastrar carteira
              </Link>
            )}
          </div>
          <Field id={`${id}-note`} label="Observação do colecionador (opcional)" error={err.note} className="mt-5 sm:max-w-[48%]">
            {(p) => <Textarea {...p} value={v.note} onChange={(e) => form.set('note', e.target.value)} maxLength={500} />}
          </Field>
    </>
  )

  const reviewDialog = (
      <Dialog open={!!reviewQuote} onOpenChange={(o) => !o && !createOrder.isPending && submitState.kind !== 'verifying' && setReviewQuote(null)}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Revise seu pedido</DialogTitle>
          <DialogDescription>Confira itens, valores, carteira e rede antes de enviar. Os valores abaixo vêm da cotação atual da API.</DialogDescription>
          {reviewQuote && (
            <div className="mt-4 flex flex-col gap-4">
              <LinesList quote={reviewQuote} />
              <SummaryRows quote={reviewQuote} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-sm bg-background p-3 text-xs">
                <dt className="text-muted-foreground">Rede</dt>
                <dd>{NETWORKS.find((n) => n.id === network)?.name}</dd>
                <dt className="text-muted-foreground">Carteira</dt>
                <dd>
                  {external ? 'Outra carteira' : registered.find((w) => w.id === walletId)?.nickname} · {shortHash(v.walletAddress)}
                </dd>
                <dt className="text-muted-foreground">Colecionador</dt>
                <dd>
                  {v.displayName} · {v.email}
                </dd>
              </dl>

              {quoteIsStale && (
                <div role="alert" className="rounded-sm border border-primary bg-accent p-3 text-xs text-accent-foreground" data-testid="review-stale">
                  A cotação mudou enquanto você revisava. Atualize para confirmar com os valores atuais.
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => void refreshReview()}>
                    Revisar novamente
                  </Button>
                </div>
              )}

              <div className="rounded-sm border border-border p-3 text-xs" aria-live="polite" data-testid="wallet-connection">
                {conn.status === 'connected' ? (
                  <p className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-success">
                      <CheckCircle2 className="size-4" aria-hidden="true" /> Carteira conectada · {shortHash(conn.address ?? '')}
                    </span>
                    <button type="button" className="flex items-center gap-1 text-link underline" onClick={() => disconnect.mutate()}>
                      <Unplug className="size-3.5" aria-hidden="true" /> Desconectar
                    </button>
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(conn.status === 'rejected' || conn.status === 'disconnected') && <p className="text-destructive">{conn.message}</p>}
                    <Button variant="outline" size="sm" onClick={() => connect.mutate()} loading={connect.isPending} data-testid="connect-wallet">
                      <Plug aria-hidden="true" /> {conn.status === 'rejected' || conn.status === 'disconnected' ? 'Tentar conectar novamente' : 'Conectar carteira'}
                    </Button>
                  </div>
                )}
              </div>

              <div aria-live="assertive" className="text-xs">
                {submitState.kind === 'verifying' && (
                  <p className="flex items-center gap-2 text-accent-foreground" data-testid="order-verifying">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {submitState.message}
                  </p>
                )}
                {submitState.kind === 'error' && (
                  <p className="text-destructive" data-testid="order-error">
                    {submitState.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setReviewQuote(null)} disabled={createOrder.isPending || submitState.kind === 'verifying'}>
                  Voltar
                </Button>
                <Button
                  onClick={() => void submit()}
                  disabled={conn.status !== 'connected' || quoteIsStale || submitState.kind === 'verifying'}
                  loading={createOrder.isPending}
                  data-testid="pay-button"
                >
                  {submitState.kind === 'error' ? 'Tentar novamente' : `Confirmar e pagar ${formatEth(reviewQuote.total)}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
  )

  const pendingBanner = (
    <>
      {pendingOrder && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-primary bg-accent px-3 py-2 text-xs text-accent-foreground" data-testid="pending-order-banner">
          <span>
            <Loader2 className="mr-1 inline size-3.5 animate-spin" aria-hidden="true" />
            Você tem um pedido aguardando confirmação{attempt?.orderId === pendingOrder.id ? ' desta tentativa' : ''}. Não é preciso comprar de novo.
          </span>
          <Link to="/pedido/$orderId" params={{ orderId: pendingOrder.id }} className="font-semibold underline">
            Acompanhar pedido
          </Link>
        </div>
      )}

    </>
  )

  if (isMobile) {
    const PROVIDERS: Array<{ id: WalletType; name: string; badge: React.ReactNode }> = [
      { id: 'walletconnect', name: 'WalletConnect', badge: 'W' },
      { id: 'metamask', name: 'MetaMask', badge: 'M' },
      { id: 'coinbase', name: 'Coinbase Wallet', badge: <WalletIcon className="size-4" aria-hidden="true" /> },
    ]
    return (
      <div className="pb-32">
        <MobileTopBar title="Pagamento com carteira" fallback="/carrinho" />
        <div className="px-4">
          {pendingBanner}
          {/* Mudanças de preço/estoque no topo: ficam visíveis acima do botão fixo. */}
          <div className="mt-3">
            <QuoteIssues quote={quote.data} onAcknowledged={() => setCheckoutNotice(null)} />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Carteira conectada</h2>
            <Link to="/perfil/carteiras" className="text-sm font-semibold text-primary">
              Trocar carteira
            </Link>
          </div>
          {wallets.isPending ? (
            <Skeleton className="mt-3 h-36 w-full rounded-2xl" />
          ) : registered.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-surface p-4 text-sm">
              Você ainda não cadastrou carteiras.{' '}
              <Link to="/perfil/carteiras" className="text-link underline">
                Cadastrar carteira
              </Link>{' '}
              ou informe o endereço em “Dados do colecionador”.
            </p>
          ) : (
            <RadioGroup value={walletId} onValueChange={selectWallet} aria-label="Carteira para pagamento" className="mt-3 gap-3">
              {registered.map((w) => {
                const title = w.slot === 'primary' ? 'Principal' : 'Reserva'
                const net = NETWORKS.find((n) => n.id === w.network)?.name
                const handle = w.secondaryAddress.endsWith('.eth') ? w.secondaryAddress : shortHash(w.address)
                return (
                  <div key={w.id} className={cn('relative flex items-center gap-4 rounded-2xl bg-surface px-4 py-4', walletId === w.id && 'ring-1 ring-primary/40')}>
                    <RadioGroupItem value={w.id} id={`${id}-w-${w.id}`} aria-label={`${title}: ${w.nickname}, ${handle}, rede ${net}`} />
                    <label htmlFor={`${id}-w-${w.id}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block text-base font-bold">{title}</span>
                      <span className="block truncate text-sm text-[#c9a27c]">{handle}</span>
                      <span className="block text-sm text-[#c9a27c]">
                        Rede {w.slot === 'primary' ? 'principal ' : ''}
                        {net}
                      </span>
                    </label>
                    <Link to="/perfil/carteiras" className="rounded p-1 text-foreground/80" aria-label={`Gerenciar carteira ${title}`}>
                      <MoreVertical className="size-5" aria-hidden="true" />
                    </Link>
                  </div>
                )
              })}
            </RadioGroup>
          )}

          <h2 className="mt-6 text-base font-bold" id={`${id}-providers`}>
            Carteira e rede
          </h2>
          <RadioGroup value={v.walletType || undefined} onValueChange={(x) => form.set('walletType', x as WalletType)} aria-labelledby={`${id}-providers`} className="mt-3 gap-3">
            {PROVIDERS.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface px-4 py-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-[#3a2418] text-sm font-bold text-primary" aria-hidden="true">
                  {p.badge}
                </span>
                <span className="flex-1 text-sm">{p.name}</span>
                <RadioGroupItem value={p.id} aria-label={p.name} />
              </label>
            ))}
          </RadioGroup>
          {err.walletType && <p className="mt-2 text-xs text-destructive">{err.walletType}</p>}

          <details className="mt-6 rounded-2xl bg-surface p-4 [&_summary::-webkit-details-marker]:hidden" open={detailsOpen} onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}>
            <summary className="flex cursor-pointer items-center justify-between text-sm font-bold" data-testid="collector-toggle">
              Dados do colecionador
              <ChevronDown className={cn('size-4 transition-transform', detailsOpen && 'rotate-180')} aria-hidden="true" />
            </summary>
            <form
              ref={form.formRef}
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                void startReview()
              }}
              aria-labelledby={`${id}-title`}
              className="mt-4 min-w-0"
            >
              {formBody}
            </form>
          </details>

          <div className="mt-4">
            {quote.isError && !quote.data && <ErrorState error={quote.error} onRetry={() => void quote.refetch()} title="Falha ao calcular a cotação" className="py-6" />}
          </div>
          <p className="mt-2 flex items-baseline justify-end gap-6 text-base font-bold">
            Total:
            <span className="text-xl text-primary" data-testid="summary-total">
              {quote.data ? formatEth(quote.data.total) : '—'}
            </span>
          </p>
          <div aria-live="polite" className="mt-3 text-xs">
            {checkoutNotice && (
              <p className="flex items-start gap-1.5 rounded-xl border border-destructive/60 bg-destructive/10 px-3 py-2 text-destructive" data-testid="checkout-notice">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {checkoutNotice}
              </p>
            )}
          </div>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-5 pt-6">
          <button
            type="button"
            onClick={() => void startReview()}
            disabled={items.length === 0 || !quote.data || (quote.data?.issues.length ?? 0) > 0 || quote.isFetching}
            className="h-14 w-full rounded-full bg-gradient-to-r from-[#e0a06a] to-[#b8743c] text-base font-semibold text-primary-foreground shadow-md disabled:opacity-55"
            data-testid="confirm-purchase"
          >
            Confirmar compra
          </button>
        </div>
        {reviewDialog}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 pt-6">
      <nav aria-label="Trilha" className="text-xs">
        <ol className="flex gap-1">
          <li>
            <Link to="/" className="hover:text-primary">
              Início
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/carrinho" className="hover:text-primary">
              Mercado
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">Pagamento</li>
        </ol>
      </nav>
      <h1 className="sr-only">Pagamento</h1>

      {pendingBanner}

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form
          ref={form.formRef}
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void startReview()
          }}
          aria-labelledby={`${id}-title`}
          className="min-w-0"
        >
          {formBody}
        </form>

        <aside aria-labelledby={`${id}-nfts`} className="min-w-0">
          <h2 id={`${id}-nfts`} className="text-sm font-semibold">
            Seus NFTs
          </h2>
          <div className="mb-2 mt-3 flex justify-between text-xs font-semibold">
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>
          {items.length === 0 && !cart.isPending ? (
            <p className="rounded-sm bg-surface p-4 text-xs">
              Seu carrinho está vazio.{' '}
              <Link to="/" className="text-link underline">
                Explorar NFTs
              </Link>
            </p>
          ) : (
            <LinesList quote={quote.data} />
          )}
          <div className="mt-3">
            {showCoupon || cart.data?.coupon ? (
              <CouponForm currentCode={cart.data?.coupon?.code ?? null} compact />
            ) : (
              <button type="button" className="w-full text-center text-xs hover:text-primary" onClick={() => setShowCoupon(true)}>
                Tem um código promocional? <span className="text-primary underline">Aplique aqui</span>
              </button>
            )}
          </div>
          <div className="mt-3">
            <QuoteIssues quote={quote.data} onAcknowledged={() => setCheckoutNotice(null)} />
            {quote.isError && !quote.data ? <ErrorState error={quote.error} onRetry={() => void quote.refetch()} title="Falha ao calcular a cotação" className="py-6" /> : <SummaryRows quote={items.length ? quote.data : undefined} updating={quote.isFetching} />}
          </div>

          <fieldset className="mt-5">
            <legend className="mb-3 w-full text-center text-sm font-semibold">Carteira e rede</legend>
            {wallets.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <RadioGroup value={walletId} onValueChange={selectWallet} aria-label="Carteira para pagamento">
                <label className={cn('flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2.5 text-xs', external ? 'border-primary' : 'border-border')}>
                  <RadioGroupItem value="external" aria-label="Outra carteira compatível" />
                  <span className="rounded-sm bg-band px-2 py-0.5 text-[9px] font-semibold tracking-wider">METAMASK · WALLETCONNECT · COINBASE</span>
                </label>
                {registered.map((w) => (
                  <label key={w.id} className={cn('flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2.5 text-xs', walletId === w.id ? 'border-primary bg-surface' : 'border-border')}>
                    <RadioGroupItem value={w.id} />
                    <span className="flex-1">
                      {WALLET_TYPES.find((t) => t.id === w.walletType)?.name}
                      <span className="block text-[11px] text-muted-foreground">
                        {w.nickname} · {shortHash(w.address)} · {w.slot === 'primary' ? 'principal' : 'secundária'}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          </fieldset>

          <div aria-live="polite" className="mt-3 text-xs">
            {checkoutNotice && (
              <p className="flex items-start gap-1.5 rounded-sm border border-destructive/60 bg-destructive/10 px-3 py-2 text-destructive" data-testid="checkout-notice">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {checkoutNotice}
              </p>
            )}
          </div>
          <Button
            className="mt-4 w-full"
            onClick={() => void startReview()}
            disabled={items.length === 0 || !quote.data || (quote.data?.issues.length ?? 0) > 0 || quote.isFetching}
            data-testid="confirm-purchase"
          >
            Confirmar compra
          </Button>
        </aside>
      </div>

      {reviewDialog}
    </div>
  )
}

export function CheckoutPage() {
  return (
    <RequireAuth>
      <CheckoutInner />
    </RequireAuth>
  )
}
