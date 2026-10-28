import { http, HttpResponse } from 'msw'
import type { Network, PasswordChangeRequest, ProfileUpdate, WalletConnection, WalletInput, WalletSlot } from '@/api/contracts'
import { fieldErrorsOf, passwordServerSchema, profileSchema, walletSchema } from '@/api/schemas'
import { findUserByEmail, findUserByUsername, findWallet, hashPassword, persist, profileOf, saveWallet, state, walletsOf, type UserRecord } from '../db'
import { bearer, config, errorResponse, requireUser, setConfig, withNetwork } from '../network'
import { API } from './api-base'

const MAX_AVATAR = 1024 * 1024

function bumpProfile(u: UserRecord) {
  u.profileVersion += 1
  u.updatedAt = new Date().toISOString()
  persist()
}

async function fileToDataUrl(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return `data:${file.type};base64,${btoa(bin)}`
}

export const accountHandlers = [
  http.get(
    `${API}/profile`,
    withNetwork(({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      return HttpResponse.json(profileOf(auth.user))
    }),
  ),

  http.patch(
    `${API}/profile`,
    withNetwork(async ({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const body = (await request.json()) as ProfileUpdate
      const parsed = profileSchema.safeParse(body)
      if (!parsed.success) return errorResponse(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fieldErrors: fieldErrorsOf(parsed.error) })
      const byEmail = findUserByEmail(body.email)
      if (byEmail && byEmail.id !== auth.user.id)
        return errorResponse(409, 'EMAIL_TAKEN', 'Este e-mail já está em uso.', { fieldErrors: { email: 'Este e-mail já está em uso por outra conta.' } })
      const byUsername = findUserByUsername(body.username)
      if (byUsername && byUsername.id !== auth.user.id)
        return errorResponse(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', { fieldErrors: { username: 'Este nome de usuário já está em uso.' } })
      Object.assign(auth.user, {
        displayName: parsed.data.displayName,
        username: parsed.data.username,
        email: parsed.data.email.toLowerCase(),
        ensName: parsed.data.ensName,
        walletNickname: parsed.data.walletNickname,
      })
      bumpProfile(auth.user)
      return HttpResponse.json(profileOf(auth.user))
    }),
  ),

  http.put(
    `${API}/profile/avatar`,
    withNetwork(async ({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const form = await request.formData()
      const file = form.get('avatar')
      if (!(file instanceof File)) return errorResponse(422, 'VALIDATION_ERROR', 'Envie uma imagem.', { fieldErrors: { avatar: 'Envie uma imagem.' } })
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type))
        return errorResponse(422, 'VALIDATION_ERROR', 'Formato não suportado.', { fieldErrors: { avatar: 'Use PNG, JPG ou WebP.' } })
      if (file.size > MAX_AVATAR) return errorResponse(422, 'VALIDATION_ERROR', 'Imagem muito grande.', { fieldErrors: { avatar: 'A imagem deve ter até 1 MB.' } })
      auth.user.avatarUrl = await fileToDataUrl(file)
      bumpProfile(auth.user)
      return HttpResponse.json(profileOf(auth.user))
    }),
  ),

  http.delete(
    `${API}/profile/avatar`,
    withNetwork(({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      auth.user.avatarUrl = null
      bumpProfile(auth.user)
      return HttpResponse.json(profileOf(auth.user))
    }),
  ),

  http.post(
    `${API}/profile/password`,
    withNetwork(async ({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const body = (await request.json()) as PasswordChangeRequest
      const parsed = passwordServerSchema.safeParse(body)
      if (!parsed.success) return errorResponse(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fieldErrors: fieldErrorsOf(parsed.error) })
      const current = await hashPassword(auth.user.salt, body.currentPassword)
      if (current !== auth.user.passwordHash)
        return errorResponse(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', { fieldErrors: { currentPassword: 'Senha atual incorreta.' } })
      auth.user.passwordHash = await hashPassword(auth.user.salt, body.newPassword)
      bumpProfile(auth.user)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // ---------- Carteiras ----------
  http.get(
    `${API}/wallets`,
    withNetwork(({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      return HttpResponse.json(walletsOf(auth.user.id))
    }),
  ),

  http.put(
    `${API}/wallets/:slot`,
    withNetwork(async ({ request, params }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const slot = params.slot as WalletSlot
      if (slot !== 'primary' && slot !== 'secondary') return errorResponse(404, 'NOT_FOUND', 'Slot de carteira inexistente.')
      const body = (await request.json()) as WalletInput
      const parsed = walletSchema.safeParse(body)
      if (!parsed.success) return errorResponse(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fieldErrors: fieldErrorsOf(parsed.error) })
      const other = walletsOf(auth.user.id)[slot === 'primary' ? 'secondary' : 'primary']
      if (other && other.address.toLowerCase() === body.address.toLowerCase() && slot === 'secondary' && request.headers.get('x-same-as-primary') !== 'true')
        return errorResponse(409, 'VALIDATION_ERROR', 'Este endereço já está cadastrado como carteira principal.', {
          fieldErrors: { address: 'Este endereço já está cadastrado como carteira principal. Marque "Igual à carteira principal" para reutilizá-lo.' },
        })
      return HttpResponse.json(saveWallet(auth.user.id, slot, parsed.data))
    }),
  ),

  http.post(
    `${API}/wallets/:walletId/connect`,
    withNetwork(async ({ request, params }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const { network, address } = (await request.json()) as { network: Network; address?: string }
      const walletId = String(params.walletId)
      const wallet = walletId === 'external' ? null : findWallet(auth.user.id, walletId)
      if (walletId !== 'external' && !wallet) return errorResponse(404, 'NOT_FOUND', 'Carteira não encontrada.')
      if (config.walletConnect === 'reject') {
        // recusa uma vez; nova tentativa conecta
        setConfig({ ...config, walletConnect: 'connect' })
        return errorResponse(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira. Tente novamente quando estiver pronto.')
      }
      const conn: WalletConnection = { walletId, network, address: wallet?.address ?? address ?? '', connectedAt: new Date().toISOString() }
      state.connections[bearer(request)!] = conn
      persist()
      return HttpResponse.json(conn)
    }),
  ),

  http.delete(
    `${API}/wallets/connection`,
    withNetwork(({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      state.connections[bearer(request)!] = null
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
