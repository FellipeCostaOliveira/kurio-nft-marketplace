import Big from 'big.js'
import type { EthString } from '@/api/contracts'

// Cálculos em ETH com precisão decimal (nunca com float).
Big.DP = 18
Big.RM = Big.roundHalfUp

export const eth = (value: EthString | number | Big) => new Big(value)

export function ethAdd(...values: EthString[]): EthString {
  return values.reduce((acc, v) => acc.plus(v), new Big(0)).toString()
}

export function ethMul(value: EthString, qty: number): EthString {
  return new Big(value).times(qty).toString()
}

export function ethCmp(a: EthString, b: EthString): number {
  return new Big(a).cmp(b)
}

export function isEthString(value: string): boolean {
  return /^\d+(\.\d{1,18})?$/.test(value)
}

/**
 * Formata para exibição sem perder precisão: mantém até `maxDecimals` casas
 * e no mínimo 2, removendo zeros à direita além disso.
 */
export function formatEth(value: EthString, opts: { maxDecimals?: number; withUnit?: boolean } = {}): string {
  const { maxDecimals = 6, withUnit = true } = opts
  const b = new Big(value)
  let fixed = b.toFixed(maxDecimals)
  if (fixed.includes('.')) {
    fixed = fixed.replace(/0+$/, '')
    const [int, dec = ''] = fixed.split('.')
    fixed = `${int}.${dec.padEnd(2, '0')}`
  }
  return withUnit ? `${fixed} ETH` : fixed
}

/** Formato pt-BR para faixas (ex.: "0,02"). */
export function formatEthBr(value: EthString): string {
  return formatEth(value, { withUnit: false }).replace('.', ',')
}
