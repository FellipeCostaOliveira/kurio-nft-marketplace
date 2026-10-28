/**
 * Barramento interno dos mocks: o "servidor" publica eventos aqui e o handler
 * Socket.IO (ws.link + @mswjs/socket.io-binding) os entrega aos clientes conectados.
 * A UI nunca chama este módulo — os eventos chegam pelo socket.io-client.
 */
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts'

export type AnyEvent = NftUpdatedEvent | OrderUpdatedEvent
type Listener = (event: AnyEvent, audience: string | null) => void

const listeners = new Set<Listener>()
const history: Array<{ event: AnyEvent; audience: string | null }> = []

export const bus = {
  publish(event: AnyEvent, audience: string | null = null) {
    history.push({ event, audience })
    if (history.length > 200) history.shift()
    for (const l of listeners) l(event, audience)
  },
  /** Reentrega um evento já publicado (duplicata com mesmo id/versão). */
  replay(index = -1) {
    const entry = history.at(index)
    if (!entry) return null
    for (const l of listeners) l(entry.event, entry.audience)
    return entry.event
  },
  history() {
    return history.slice()
  },
  subscribe(l: Listener) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  clearHistory() {
    history.length = 0
  },
}
