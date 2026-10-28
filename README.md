# Kurio — Marketplace de NFTs

Implementação do desafio frontend **Kurio NFT Marketplace** em React + TypeScript, fiel ao layout do Figma, com descoberta, compra e conta do colecionador funcionando sobre APIs REST e eventos Socket.IO **simulados com MSW**.

> Arquitetura, contratos, política de cache/sessão, reconciliação REST × Socket.IO, decisões de UX e desvios do Figma: veja **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Stack

| Responsabilidade | Tecnologia |
|---|---|
| Interface | React 19 |
| Linguagem | TypeScript (strict) |
| Roteamento | TanStack Router (rotas por código, search params tipados, rotas protegidas) |
| Estado remoto | TanStack Query 5 |
| Cliente HTTP | Axios (instância única em `src/api/http.ts`) |
| Tempo real | socket.io-client 4 |
| Estilo | Tailwind CSS 4 + tokens do Figma |
| Componentes | shadcn/ui (Radix) adaptados à identidade Kurio |
| Mocking | MSW 2 (`http` + `ws.link`) + `@mswjs/socket.io-binding` |
| Testes E2E / visual | Playwright |
| Auditoria | Lighthouse 13 |
| Build | Vite 8 |

## Setup

Requisitos: **Node 20.19+** (testado com Node 22) e npm.

```bash
npm ci                      # instala exatamente o lockfile
npx playwright install chromium   # navegador dos testes (uma vez)
npm run dev                 # http://localhost:5173 com mocks ativos
```

A aplicação roda inteira no navegador: não há backend. O Service Worker do MSW (`public/mockServiceWorker.js`) intercepta as chamadas REST do Axios, e o `ws.link` do MSW intercepta o WebSocket do `socket.io-client`.

## Variáveis de ambiente

Copie `.env.example` para `.env` (o repositório já traz um `.env` com os valores padrão).

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` | Ativa a camada MSW (REST + Socket.IO). Obrigatória no build de demonstração. |
| `VITE_API_URL` | `/api` | Base das chamadas REST do Axios. |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.test` | Endpoint Socket.IO (interceptado pelo MSW). |
| `VITE_MOCK_SCENARIO` | `default` | Cenário inicial dos mocks (ver tabela abaixo). |

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` / `npm run dev:mocks` | Desenvolvimento com mocks |
| `npm run build` | Verificação de tipos + build otimizado |
| `npm run build:demo` | Build de demonstração (força `VITE_ENABLE_MOCKS=true`) — é o que vai para o deploy |
| `npm run preview` | Serve o build em `http://localhost:4173` |
| `npm run typecheck` | `tsc -b` (app + configs + testes) |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright (sobe build:demo + preview automaticamente) |
| `npm run test:e2e:update` | Regenera as baselines visuais |
| `npm run test:e2e:report` | Abre o relatório HTML (`playwright-report/`) |
| `npm run lighthouse` | Auditoria Lighthouse (3 execuções × página × perfil, mediana) |
| `npm run check` | typecheck + lint + build:demo + testes |

Para usar um Chromium já instalado nos testes: `PW_CHROMIUM_PATH=/caminho/chromium npm run test:e2e`. Na auditoria: `CHROME_PATH=/caminho/chrome npm run lighthouse`.

## Ícones de login social

Os botões “Continuar com Google/Facebook” usam os ícones oficiais fornecidos pelos provedores, em `public/brand/`:

- `google.svg` — “G” recortado do pacote oficial *Sign in with Google* (`signin-assets.zip`).
- `facebook.png` — logo “f” oficial, com fundo transparente.

O componente aceita `.svg` ou `.png`; se um arquivo faltar, o botão exibe um ícone neutro.

## Credenciais fictícias

| Usuário | E-mail | Senha | Observações |
|---|---|---|---|
| Ana Ribeiro | `ana@kurio.test` | `Kurio@2026` | Carteira principal (MetaMask/Ethereum) e secundária (Coinbase/Polygon), 2 favoritos |
| Bruno Sato | `bruno@kurio.test` | `Kurio@2026` | Sem carteiras cadastradas, 1 favorito |

As senhas só existem nos mocks como **hash SHA-256 com salt** (`src/mocks/fixtures.ts`); o cliente nunca persiste senha — apenas token, expiração e dados públicos do usuário.

**Cupons:** `KURIO10` (10%), `GENESIS5` (0,05 ETH), `LANCAMENTO` (expirado); qualquer outro é inválido.

## Cenários simulados

Escolha o cenário de qualquer uma destas formas:

1. **Painel “Cenários”** (botão flutuante no canto inferior esquerdo da demo; no mobile, aba na borda esquerda). A lista é agrupada pelos itens do enunciado, a página recarrega ao trocar de cenário e o botão mostra qual cenário está ativo;
2. **URL:** `https://<app>/?scenario=payment-declined` (adicione `&mock-reset=1` para também resetar os dados);
3. **Console:** `window.__kurio.setScenario('slow')`;
4. **REST:** `fetch('/api/__mock/scenario', { method: 'POST', body: JSON.stringify({ name: 'slow' }) })`.

| Cenário | Efeito |
|---|---|
| `default` | Sucesso, latência 60–180 ms (determinística, semente fixa) |
| `slow` | Latência 2,2–2,6 s (skeletons visíveis) |
| `variable-latency` | Latência 0,1–2,4 s |
| `out-of-order` | Listagem alterna respostas lentas/rápidas (respostas fora de ordem) |
| `offline` | REST sem conexão (`HttpResponse.error()`) |
| `server-error` | `GET /api/nfts` responde 500 duas vezes e depois recupera |
| `empty-catalog` | Catálogo vazio |
| `session-expired` | Sessões expiram em 20 s |
| `unauthorized` | Perfil e carteiras respondem 403 |
| `validation-error` | Perfil/carteiras respondem 422 com erros de campo do servidor |
| `coupon-error` | Aplicar cupom responde 503 uma vez (extra, usado nos testes; fora do painel) |
| `price-change` | O preço do 1º item sobe 0,10 ETH no instante da confirmação (gera `nft.updated` + 409 `QUOTE_OUTDATED`) |
| `sold-out` | A edição do 1º item esgota no instante da confirmação |
| `order-timeout` | O pedido é criado, mas a resposta demora 12 s (o cliente estoura o timeout de 8 s e recupera pelo mesmo `Idempotency-Key`) |
| `payment-declined` | O pagamento é recusado |
| `wallet-rejected` | A 1ª conexão da carteira é recusada |
| `wallet-disconnect` | A carteira desconecta no envio do pedido (428) |
| `favorite-failure` | A 1ª mutation de favoritos responde 500 (rollback otimista) |
| `socket-offline` | O servidor Socket.IO recusa conexões (fallback por polling + reconciliação ao voltar) |

**Reset:** painel → “Resetar tudo (dados + sessão)”, `?mock-reset=1`, `window.__kurio.reset()` ou `POST /api/__mock/reset`. O reset restaura integralmente o cenário conhecido (fixtures + configuração).

### Controles de eventos (tempo real)

Todos alteram o “servidor” simulado; o efeito chega ao app **pelo socket.io-client** (nunca por setters na UI):

```js
__kurio.updateNft('nft-001', { price: '1.50' })                          // nft.updated
__kurio.updateNft('nft-001', { editions: [{ id: 'e50', available: 0 }] }) // esgota edição
__kurio.replayLastEvent()            // duplicata (mesmo id e versão)
__kurio.sendStaleNftEvent('nft-001', '0.01')  // evento com versão antiga
__kurio.dropSockets()                // derruba conexões (o cliente reconecta)
__kurio.setSocketOffline(true)       // mantém o socket fora do ar
__kurio.expireSessions()             // invalida todas as sessões
__kurio.settleOrder('<id>', 'confirm' | 'decline')
```

## Como reproduzir os fluxos de falha

| Fluxo | Passos |
|---|---|
| Skeletons + falha + nova tentativa | Abra `/?scenario=server-error&mock-reset=1` → aparecem skeletons, depois o erro “Não foi possível carregar o catálogo” → “Tentar novamente”. |
| Respostas fora de ordem | `/?scenario=out-of-order` → clique rápido em “Novos lançamentos” e “Em alta”: o resultado final sempre corresponde à última aba. |
| Sessão expirada no checkout | Entre, vá a `/pagamento`, preencha algo e use “Expirar sessão” no painel → ao clicar em “Confirmar compra” o login reabre; após entrar, o formulário continua preenchido. |
| Preço muda com item no carrinho | Com `nft-001` no carrinho, painel → “Alterar preço #042”: aviso, resumo atualizado e checkout bloqueado até “Entendi, atualizar carrinho”. |
| Cotação desatualizada na confirmação | `?scenario=price-change`, compre um item → “Confirmar e pagar” é recusado, as mudanças aparecem e é preciso confirmar de novo. |
| Timeout com recuperação idempotente | `?scenario=order-timeout` → “Confirmar e pagar” → após ~8 s aparece “Verificando seu pedido…” e o app recupera **o mesmo pedido** (veja `__kurio.orders()`). |
| Pagamento recusado | `?scenario=payment-declined` → o pedido termina recusado e os itens permanecem no carrinho. |
| Carteira recusa/desconecta | `?scenario=wallet-rejected` ou `wallet-disconnect`. |
| Desconexão com pedido pendente | Crie um pedido, `__kurio.setSocketOffline(true)`, recarregue a página (continua pendente, sem nova compra), `__kurio.settleOrder(id,'confirm')`, `__kurio.setSocketOffline(false)` → reconecta, reconcilia e mostra o recibo. |
| Favoritos com rollback | `?scenario=favorite-failure` → favoritar volta ao estado anterior com aviso; nova tentativa funciona. |

## Testes

```bash
npm run test:e2e            # todos os projetos: chromium-desktop (1440), chromium-mobile (390), chromium-tablet (768, @responsive)
npx playwright test --project=chromium-desktop e2e/checkout.spec.ts
```

- Cada teste parte de um **contexto novo** + `?mock-reset=1` (estado isolado e determinístico).
- Relógio controlado com `page.clock` (expiração por TTL), latência pelos cenários e eventos disparados pelo controle dos mocks.
- REST passa pelos handlers MSW; tempo real passa pelo `socket.io-client`.
- Relatório HTML em `playwright-report/`; traces e screenshots das falhas em `test-results/`.
- Baselines visuais versionadas em `e2e/__screenshots__/` (início, detalhe, carrinho e pagamento × desktop/mobile), geradas em Linux/Chromium. Em outro sistema operacional, a renderização de fontes pode diferir alguns pixels: nesse caso, gere as baselines locais com `npm run test:e2e:update` e rode de novo.
- **CI:** `.github/workflows/ci.yml` roda typecheck, lint, build de demonstração e toda a suíte Playwright a cada push/PR, publicando o relatório HTML (`playwright-report`) e, em falhas, os traces (`test-results`) como artefatos.

## Lighthouse

```bash
npm run build:demo && npm run lighthouse
```

Resultados em `lighthouse/SUMMARY.md`, `lighthouse/summary.json` e relatórios HTML/JSON por execução em `lighthouse/reports/`. Configuração versionada em `lighthouse/config.mjs`. Análise dos resultados em [ARCHITECTURE.md › Performance](./ARCHITECTURE.md#performance-e-lighthouse).

## Deploy (Vercel)

1. Suba o repositório para o GitHub.
2. Na Vercel: **Add New → Project → Import** do repositório. O `vercel.json` já define `npm run build:demo`, saída `dist` e o rewrite de SPA (acesso direto e refresh de qualquer rota).
3. Em **Environment Variables**, os valores de `.env.example` já são os padrões (o `.env` versionado também é lido no build).

Netlify/Cloudflare Pages: build `npm run build:demo`, diretório `dist`; o arquivo `public/_redirects` cuida do fallback de SPA.

O deploy contém os mocks e o tempo real funcionando (o MSW roda no navegador do avaliador).
