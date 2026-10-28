import { http, HttpResponse } from 'msw'
import type { LoginRequest, RegisterRequest, Session } from '@/api/contracts'
import { fieldErrorsOf, loginSchema, registerServerSchema } from '@/api/schemas'
import { createSession, findUserByEmail, findUserByUsername, hashPassword, nextId, persist, publicUser, state } from '../db'
import { bearer, config, errorResponse, requireUser, withNetwork } from '../network'
import { API } from './api-base'

export const authHandlers = [
  http.post(
    `${API}/auth/register`,
    withNetwork(async ({ request }) => {
      const body = (await request.json()) as RegisterRequest
      const parsed = registerServerSchema.safeParse(body)
      if (!parsed.success) return errorResponse(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fieldErrors: fieldErrorsOf(parsed.error) })
      if (findUserByEmail(body.email)) return errorResponse(409, 'EMAIL_TAKEN', 'Já existe uma conta com este e-mail.', { fieldErrors: { email: 'Já existe uma conta com este e-mail.' } })
      if (findUserByUsername(body.username))
        return errorResponse(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', { fieldErrors: { username: 'Este nome de usuário já está em uso.' } })
      const id = nextId('usr')
      const salt = `salt-${id}`
      state.users[id] = {
        id,
        username: body.username,
        displayName: body.username,
        email: body.email.toLowerCase(),
        salt,
        passwordHash: await hashPassword(salt, body.password),
        ensName: '',
        walletNickname: '',
        avatarUrl: null,
        profileVersion: 1,
        updatedAt: new Date().toISOString(),
      }
      state.wallets[id] = { primary: null, secondary: null }
      state.favorites[id] = []
      persist()
      const s = createSession(id, config.sessionTtlMs)
      const session: Session = { ...s, user: publicUser(state.users[id]) }
      return HttpResponse.json(session, { status: 201 })
    }),
  ),

  http.post(
    `${API}/auth/login`,
    withNetwork(async ({ request }) => {
      const body = (await request.json()) as LoginRequest
      const parsed = loginSchema.safeParse(body)
      if (!parsed.success) return errorResponse(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fieldErrors: fieldErrorsOf(parsed.error) })
      const user = findUserByEmail(body.email)
      const ok = user && (await hashPassword(user.salt, body.password)) === user.passwordHash
      if (!user || !ok) return errorResponse(401, 'UNAUTHENTICATED', 'E-mail ou senha incorretos.', { fieldErrors: { password: 'E-mail ou senha incorretos.' } })
      const s = createSession(user.id, config.sessionTtlMs)
      const session: Session = { ...s, user: publicUser(user) }
      return HttpResponse.json(session)
    }),
  ),

  http.get(
    `${API}/auth/session`,
    withNetwork(({ request }) => {
      const auth = requireUser(request)
      if (!auth.ok) return auth.response
      const token = bearer(request)!
      return HttpResponse.json({ user: publicUser(auth.user), expiresAt: new Date(state.sessions[token].expiresAt).toISOString() })
    }),
  ),

  http.post(
    `${API}/auth/logout`,
    withNetwork(({ request }) => {
      const token = bearer(request)
      if (token) {
        delete state.sessions[token]
        delete state.connections[token]
        persist()
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
