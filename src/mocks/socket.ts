/**
 * "Servidor" Socket.IO simulado via MSW (ws.link) + @mswjs/socket.io-binding.
 * O cliente real (socket.io-client, transporte websocket) conecta normalmente;
 * os frames Engine.IO/Socket.IO são codificados pelo binding.
 *
 * Limitações do transporte simulado (documentadas no ARCHITECTURE.md):
 *  - apenas transporte "websocket" (sem long-polling);
 *  - apenas namespace "/" e sem rooms nativas (a audiência é filtrada aqui);
 *  - heartbeat Engine.IO (ping "2") é emitido manualmente por este handler.
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { lookupSession } from './db'
import { config } from './network'
import { bus, type AnyEvent } from './realtime-bus'

export const SOCKET_URL = ((import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'wss://realtime.kurio.test').replace(/\/$/, '')

// O MSW remove o prefixo "/socket.io/" do caminho ao comparar; o link usa só a origem.
const link = ws.link(SOCKET_URL)

interface Conn {
  id: number
  userId: string | null
  token: string | null
  emit: (event: string, payload: unknown) => void
  close: () => void
}

const connections = new Set<Conn>()
let seq = 0

bus.subscribe((event: AnyEvent, audience) => {
  for (const c of connections) {
    // Isolamento: eventos com audiência só vão para conexões autenticadas daquele usuário.
    if (audience && c.userId !== audience) continue
    c.emit(event.type, event)
  }
})

export const socketHandlers = [
  link.addEventListener('connection', (connection) => {
    if (config.socketOffline) {
      connection.client.close(4000, 'offline')
      return
    }
    const io = toSocketIo(connection)
    const conn: Conn = {
      id: ++seq,
      userId: null,
      token: null,
      emit: (event, payload) => {
        try {
          io.client.emit(event, payload)
        } catch {
          /* conexão já fechada */
        }
      },
      close: () => connection.client.close(4001, 'server drop'),
    }
    connections.add(conn)
    // Heartbeat Engine.IO v4: servidor envia ping "2", cliente responde "3".
    const ping = setInterval(() => {
      try {
        connection.client.send('2')
      } catch {
        clearInterval(ping)
      }
    }, 20000)

    io.client.on('session.hello', (_event, payload: { token: string | null }) => {
      const lookup = lookupSession(payload?.token ?? null)
      conn.token = payload?.token ?? null
      conn.userId = lookup.status === 'valid' ? lookup.user.id : null
      conn.emit('session.ready', { userId: conn.userId })
    })

    connection.client.addEventListener('close', () => {
      clearInterval(ping)
      connections.delete(conn)
    })
  }),
]

export const socketControl = {
  /** Derruba todas as conexões (o cliente reconecta sozinho, salvo se socketOffline). */
  dropAll() {
    for (const c of [...connections]) c.close()
  },
  count() {
    return connections.size
  },
  clients() {
    return [...connections].map((c) => ({ id: c.id, userId: c.userId }))
  },
  /** Reentrega um evento arbitrário (ex.: versão antiga) pelo socket, para testes de tolerância. */
  inject(event: AnyEvent, audience: string | null = null) {
    for (const c of connections) {
      if (audience && c.userId !== audience) continue
      c.emit(event.type, event)
    }
  },
}
