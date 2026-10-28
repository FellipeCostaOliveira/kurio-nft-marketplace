/**
 * Painel de cenários (somente com VITE_ENABLE_MOCKS=true). Faz parte da camada de mocks:
 * apenas chama o controle do "servidor" simulado — nunca altera estado da UI diretamente.
 * Ao trocar de cenário a página é recarregada, para que o efeito (skeletons, erros, etc.)
 * apareça na hora em vez de depender do cache já carregado.
 */
import { useEffect, useState } from 'react'
import { FlaskConical, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { safeStorage } from '@/lib/utils'
import { mockControl } from './control'
import { SCENARIOS, type ScenarioName } from './scenarios'

const NOTICE_KEY = 'kurio.mock.notice'

/** Dica do que fazer para observar cada cenário. */
const HOW_TO: Partial<Record<ScenarioName, string>> = {
  default: 'Tudo funcionando normalmente; compras terminam confirmadas. Cupom inválido/expirado: use um código qualquer ou LANCAMENTO no carrinho.',
  slow: 'Navegue entre páginas ou troque filtros: os skeletons aparecem por ~2 s.',
  'variable-latency': 'Troque filtros e abra NFTs: cada resposta demora um tempo diferente.',
  'out-of-order': 'Clique rápido em “Novos lançamentos” e depois “Em alta”: o resultado final é sempre o da última aba.',
  offline: 'As chamadas REST falham: veja a mensagem de erro e o botão “Tentar novamente”.',
  'server-error': 'O catálogo falha 2 vezes; clique em “Tentar novamente” até carregar.',
  'empty-catalog': 'O catálogo aparece vazio.',
  'session-expired': 'Faça login e espere ~25 s; ao navegar, o login reabre com “Sua sessão expirou”.',
  unauthorized: 'Faça login e abra o Perfil ou Carteiras: aparece “sem permissão”.',
  'validation-error': 'Faça login, abra o Perfil e clique em Salvar: o servidor devolve erro no campo usuário.',
  'coupon-error': 'No carrinho, aplique KURIO10: falha 1 vez e funciona na 2ª tentativa.',
  'price-change': 'Faça login, compre e clique em “Confirmar e pagar”: o preço muda e exige nova confirmação.',
  'sold-out': 'Faça login, compre e clique em “Confirmar e pagar”: a edição esgota e a compra é barrada.',
  'order-timeout': 'Faça login e pague: após ~8 s aparece “Verificando seu pedido…” e o mesmo pedido é recuperado.',
  'payment-declined': 'Faça login e finalize uma compra: o pagamento é recusado e os itens ficam no carrinho.',
  'wallet-rejected': 'Na revisão do pedido, “Conectar carteira” é recusado 1 vez.',
  'wallet-disconnect': 'Conecte a carteira e clique em “Confirmar e pagar”: a carteira desconecta.',
  'favorite-failure': 'Faça login e clique em um coração: volta ao estado anterior com aviso; a 2ª tentativa funciona.',
  'socket-offline': 'O ponto ao lado da lupa fica cinza: o tempo real está fora do ar.',
}

/**
 * Cenários exibidos no painel, agrupados pelos itens do enunciado (seção 6 — “Mocking com MSW”).
 * Cupom inválido/expirado não precisa de cenário: basta usar os códigos LANCAMENTO (expirado)
 * ou qualquer código inexistente no carrinho.
 */
const PANEL_GROUPS: Array<{ label: string; items: ScenarioName[] }> = [
  { label: 'Sucesso e resultado vazio', items: ['default', 'empty-catalog'] },
  { label: 'Lentidão, latência variável e respostas fora de ordem', items: ['slow', 'variable-latency', 'out-of-order'] },
  { label: 'Falhas de conexão e HTTP 4xx/5xx', items: ['offline', 'server-error', 'favorite-failure', 'socket-offline'] },
  { label: 'Sessão expirada e acesso não autorizado', items: ['session-expired', 'unauthorized'] },
  { label: 'Conflito / validação de formulário', items: ['validation-error'] },
  { label: 'Preço alterado ou edição esgotada na compra', items: ['price-change', 'sold-out'] },
  { label: 'Timeout após criar o pedido (idempotência)', items: ['order-timeout'] },
  { label: 'Pagamento confirmado e recusado', items: ['payment-declined'] },
  { label: 'Carteira: recusa e desconexão', items: ['wallet-rejected', 'wallet-disconnect'] },
]

function clearClientState() {
  for (const k of Object.keys(localStorage)) if (k.startsWith('kurio.') && !k.startsWith('kurio.mock')) safeStorage.remove(k)
  try {
    sessionStorage.clear()
  } catch {
    /* ignora */
  }
}

export default function MockPanel() {
  const [scenario, setScenario] = useState<ScenarioName>(() => mockControl.getConfig().scenario)
  const [open, setOpen] = useState(() => !!safeStorage.get(NOTICE_KEY, sessionStorage))
  const [info, setInfo] = useState<string | null>(() => safeStorage.get(NOTICE_KEY, sessionStorage))

  useEffect(() => safeStorage.remove(NOTICE_KEY, sessionStorage), [])

  const apply = (name: ScenarioName) => {
    setScenario(name)
    mockControl.setScenario(name)
    safeStorage.set(NOTICE_KEY, `Cenário ativo: ${SCENARIOS[name]}. ${HOW_TO[name] ?? ''}`, sessionStorage)
    location.reload()
  }

  const custom = scenario !== 'default'

  return (
    <div className={`fixed z-[60] text-xs md:bottom-3 md:left-3 md:top-auto ${open ? 'left-2 top-16' : 'left-0 top-[58%]'}`}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex items-center gap-1.5 rounded-r-full border border-l-0 px-1.5 py-2 font-semibold shadow-lg md:rounded-full md:border-l md:px-3 md:py-1.5 ${
            custom ? 'border-[#f0b27a] bg-primary text-primary-foreground' : 'border-primary bg-background/90 text-primary opacity-70 hover:bg-accent hover:opacity-100 md:opacity-100'
          }`}
          aria-label={custom ? `Abrir painel de cenários simulados (cenário ativo: ${SCENARIOS[scenario]})` : 'Abrir painel de cenários simulados'}
          data-testid="mock-panel-toggle"
        >
          <FlaskConical className="size-3.5" aria-hidden="true" />
          <span className="hidden max-w-56 truncate md:inline">{custom ? `Cenário: ${SCENARIOS[scenario]}` : 'Cenários'}</span>
        </button>
      ) : (
        <section aria-label="Painel de cenários simulados" className="w-[min(92vw,320px)] rounded-md border border-primary bg-surface p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Simulação (MSW)</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar painel">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <label htmlFor="mock-scenario" className="mb-1 block text-[11px] text-muted-foreground">
            Cenário (a página recarrega ao trocar)
          </label>
          <select
            id="mock-scenario"
            value={scenario}
            onChange={(e) => apply(e.target.value as ScenarioName)}
            className="h-8 w-full rounded-sm border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            data-testid="mock-scenario-select"
          >
            {!PANEL_GROUPS.some((g) => g.items.includes(scenario)) && <option value={scenario}>{SCENARIOS[scenario]}</option>}
            {PANEL_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((s) => (
                  <option key={s} value={s}>
                    {s === 'default' ? 'Padrão: sucesso (pagamento confirmado)' : SCENARIOS[s]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => {
                mockControl.dropSockets()
                setInfo('Socket derrubado: o ponto ao lado da lupa fica cinza e reconecta sozinho, sincronizando os dados.')
              }}
            >
              Derrubar socket
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => {
                mockControl.expireSessions()
                setInfo('Sessão expirada no servidor: na próxima ação logada (navegar, salvar, pagar) o login reabre.')
              }}
            >
              Expirar sessão
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => {
                const n = mockControl.nft('nft-001')
                if (n) mockControl.updateNft('nft-001', { price: (Number(n.price) + 0.1).toFixed(2) })
                setInfo('Preço do Emerald Ape #042 subiu 0,10 ETH (evento nft.updated). Com ele no carrinho, aparece o aviso.')
              }}
            >
              Alterar preço #042
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => {
                const ev = mockControl.replayLastEvent()
                setInfo(ev ? 'Último evento reenviado (duplicata): o app ignora e nada muda.' : 'Nenhum evento enviado ainda. Use “Alterar preço #042” antes.')
              }}
            >
              Reenviar evento
            </Button>
          </div>
          <Button
            size="sm"
            className="mt-3 h-7 w-full text-[11px]"
            onClick={() => {
              mockControl.reset('default')
              clearClientState()
              location.assign('/')
            }}
          >
            Resetar tudo (dados + sessão)
          </Button>
          <p className="mt-2 text-[11px] leading-relaxed text-accent-foreground" aria-live="polite" data-testid="mock-panel-info">
            {info ?? HOW_TO[scenario]}
          </p>
        </section>
      )}
    </div>
  )
}
