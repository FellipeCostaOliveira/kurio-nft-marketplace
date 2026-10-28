/**
 * Regras de validação compartilhadas entre formulários (cliente) e handlers MSW (servidor).
 * O servidor ainda pode retornar erros próprios (conflitos, regras de negócio).
 */
import { z } from 'zod'

const required = (label: string) => z.string().trim().min(1, `${label} é obrigatório.`)

export const usernameRule = required('Nome de usuário')
  .min(3, 'Use ao menos 3 caracteres.')
  .max(24, 'Use no máximo 24 caracteres.')
  .regex(/^[a-z0-9._]+$/, 'Use apenas letras minúsculas, números, ponto ou sublinhado.')

export const emailRule = required('E-mail').pipe(z.email('Informe um e-mail válido.'))

export const passwordRule = z
  .string()
  .min(8, 'A senha precisa ter ao menos 8 caracteres.')
  .regex(/[A-Z]/, 'Inclua ao menos uma letra maiúscula.')
  .regex(/[0-9]/, 'Inclua ao menos um número.')
  .regex(/[^A-Za-z0-9]/, 'Inclua ao menos um símbolo.')

export const ensRule = required('Nome ENS')
  .min(3, 'Use ao menos 3 caracteres.')
  .max(32, 'Use no máximo 32 caracteres.')
  .regex(/^[a-z0-9-]+$/, 'Use letras minúsculas, números ou hífen (sem ".eth").')

export const networkRule = z.enum(['ethereum', 'polygon', 'solana'], { error: 'Selecione uma rede.' })
export const walletTypeRule = z.enum(['metamask', 'walletconnect', 'coinbase', 'phantom'], { error: 'Selecione uma carteira.' })

const EVM = /^0x[a-fA-F0-9]{40}$/
const SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export const loginSchema = z.object({
  email: emailRule,
  password: z.string().min(1, 'Senha é obrigatória.'),
})

export const registerSchema = z
  .object({
    username: usernameRule,
    email: emailRule,
    password: passwordRule,
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem.' })

export const registerServerSchema = z.object({ username: usernameRule, email: emailRule, password: passwordRule })

export const profileSchema = z.object({
  displayName: required('Nome de exibição').min(2, 'Use ao menos 2 caracteres.').max(40, 'Use no máximo 40 caracteres.'),
  username: usernameRule,
  email: emailRule,
  ensName: ensRule,
  ensSuffix: z.literal('.eth'),
  walletNickname: required('Apelido da carteira').min(2, 'Use ao menos 2 caracteres.').max(30, 'Use no máximo 30 caracteres.'),
})

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem.' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'A nova senha deve ser diferente da atual.' })

export const passwordServerSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordRule })

const walletBase = z.object({
  displayName: required('Nome de exibição').max(40, 'Use no máximo 40 caracteres.'),
  nickname: required('Apelido da carteira').max(30, 'Use no máximo 30 caracteres.'),
  network: networkRule,
  profileName: required('Nome do perfil').max(40, 'Use no máximo 40 caracteres.'),
  address: required('Endereço da carteira'),
  secondaryAddress: z.string().trim().max(64, 'Use no máximo 64 caracteres.'),
  walletType: walletTypeRule,
  referralCode: required('Código de indicação').regex(/^[A-Za-z0-9]{4,12}$/, 'Use de 4 a 12 letras ou números.'),
  email: emailRule,
  ensName: ensRule,
  ensSuffix: z.literal('.eth'),
})

interface WalletLike {
  network: 'ethereum' | 'polygon' | 'solana'
  address: string
  walletType: 'metamask' | 'walletconnect' | 'coinbase' | 'phantom'
  secondaryAddress: string
}

function walletRefinement(v: WalletLike, ctx: z.RefinementCtx, addressPath = 'address') {
  const ok = v.network === 'solana' ? SOL.test(v.address) : EVM.test(v.address)
  if (!ok)
    ctx.addIssue({
      code: 'custom',
      path: [addressPath],
      message: v.network === 'solana' ? 'Informe um endereço Solana válido (base58).' : 'Informe um endereço 0x com 40 caracteres hexadecimais.',
    })
  if (v.walletType === 'phantom' && v.network !== 'solana')
    ctx.addIssue({ code: 'custom', path: ['walletType'], message: 'Phantom está disponível apenas na rede Solana.' })
  if (v.walletType === 'metamask' && v.network === 'solana')
    ctx.addIssue({ code: 'custom', path: ['walletType'], message: 'MetaMask não suporta a rede Solana.' })
  if (v.secondaryAddress && !/^[a-z0-9-]+\.eth$/.test(v.secondaryAddress) && !EVM.test(v.secondaryAddress) && !SOL.test(v.secondaryAddress))
    ctx.addIssue({ code: 'custom', path: ['secondaryAddress'], message: 'Use um nome ENS (ex.: nome.eth) ou um endereço válido.' })
}

export const walletSchema = walletBase.superRefine((v, ctx) => walletRefinement(v, ctx))

export const collectorSchema = walletBase
  .omit({ nickname: true, address: true })
  .extend({
    username: usernameRule,
    walletAddress: required('Endereço da carteira'),
    note: z.string().max(500, 'Use no máximo 500 caracteres.'),
  })
  .superRefine((v, ctx) => walletRefinement({ ...v, address: v.walletAddress }, ctx, 'walletAddress'))

export const couponSchema = z.object({ code: z.string().trim().min(1, 'Digite um código promocional.').max(20, 'Código muito longo.') })

/** Converte erros do zod em { campo: mensagem } (primeira mensagem por campo). */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}
