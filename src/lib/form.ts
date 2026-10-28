import { useCallback, useRef, useState } from 'react'
import type { z } from 'zod'
import { fieldErrorsOf } from '@/api/schemas'

/**
 * Formulário controlado com validação zod (mesmas regras do servidor simulado).
 * Revalida por campo após a 1ª tentativa de envio e foca o 1º campo inválido.
 */
export function useZodForm<T extends object>(schema: z.ZodType, initial: T) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [attempted, setAttempted] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const focusFirstInvalid = useCallback(() => {
    setTimeout(() => {
      const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      el?.focus()
    }, 0)
  }, [])

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value }
        if (attempted) {
          const r = schema.safeParse(next)
          const fe = r.success ? {} : fieldErrorsOf(r.error)
          setErrors((old) => {
            const copy = { ...old }
            if (fe[key as string]) copy[key as string] = fe[key as string]
            else delete copy[key as string]
            return copy
          })
        }
        return next
      })
    },
    [attempted, schema],
  )

  const validate = useCallback((): T | null => {
    setAttempted(true)
    const r = schema.safeParse(values)
    if (r.success) {
      setErrors({})
      return values
    }
    setErrors(fieldErrorsOf(r.error))
    focusFirstInvalid()
    return null
  }, [schema, values, focusFirstInvalid])

  const setServerErrors = useCallback(
    (fe: Record<string, string>) => {
      setErrors(fe)
      focusFirstInvalid()
    },
    [focusFirstInvalid],
  )

  const reset = useCallback((next: T) => {
    setValues(next)
    setErrors({})
    setAttempted(false)
  }, [])

  return { values, errors, set, setValues, validate, setServerErrors, reset, formRef }
}
