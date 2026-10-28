# Arquitetura — Kurio NFT Marketplace

## Visão geral

```
UI (React + shadcn/ui + Tailwind)
  │  hooks por feature (useCart, useQuote, useOrder, useToggleFavorite…)
  ▼
TanStack Query  ◄──── realtime.ts (socket.io-client) ── nft.updated / order.updated
  │  queryFn / mutationFn tipadas                            ▲
  ▼                                                          │
api/endpoints.ts → api/http.ts (Axios: auth, X-Cart-Id, timeout 8 s, ApiError)
  │                                                          │
══╪════════════════════ fronteira de rede ═══════════════════╪═══════════
  ▼                                                          │
MSW Service Worker → handlers REST (src/mocks/handlers/*)    │
                       │                                     │
                       ▼                                     │
                 db.ts (estado + localStorage) ── bus ── socket.ts (ws.link + @mswjs/socket.io-binding)
```

- **Contratos tipados** (`src/api/contracts.ts`) são a fonte única de tipos para handlers MSW, Axios, cache e UI. Regras de validação compartilhadas em `src/api/schemas.ts` (zod) são usadas pelos formulários e pelos handlers.
- **Nenhum componente, hook ou cliente Axios contém dados fictícios** ou caminhos alternativos de negócio: tudo passa pela rede simulada. A única conexão entre app e mocks é a ativação por configuração (`VITE_ENABLE_MOCKS`) e o sinal `networkReady`.
- O painel “Cenários” (`src/mocks/MockPanel.tsx`) pertence à camada de mocks e só chama o controle do servidor simulado.

### Estrutura

```
src/
  api/          contratos, schemas, Axios, endpoints, chaves de cache, erros
  app/          router (TanStack Router), queryClient, layout raiz
  components/   ui/ (shadcn adaptados), layout/ (header, footer), estados (erro, 404, auth)
  features/     catalog, cart, checkout, auth, account (hooks + componentes de domínio)
  realtime/     cliente socket.io (versionamento, dedupe, reconciliação)
  routes/       páginas
  mocks/        fixtures, db, cenários, rede, handlers REST, servidor Socket.IO, controle, painel
  lib/          eth (big.js), sessão, formulários, utilidades
e2e/            Playwright + baselines visuais
lighthouse/     configuração, sumário e relatórios
```

## Contratos REST

Base: `VITE_API_URL` (`/api`). Erros sempre no formato:

```json
{ "error": { "code": "AVAILABILITY_CONFLICT", "message": "…", "fieldErrors": { "campo": "…" }, "details": {}, "retryable": false } }
```

| Código | HTTP | Uso |
|---|---|---|
| `VALIDATION_ERROR` | 400/422 | Campos inválidos (`fieldErrors`) |
| `UNAUTHENTICATED` / `SESSION_EXPIRED` | 401 | Sem sessão / sessão inválida ou expirada |
| `FORBIDDEN` | 403 | Falta de permissão |
| `NOT_FOUND` | 404 | Recurso inexistente (pedidos de outro usuário também respondem 404) |
| `EMAIL_TAKEN` / `USERNAME_TAKEN` | 409 | Conflito de cadastro/perfil |
| `AVAILABILITY_CONFLICT` | 409 | Quantidade acima da disponibilidade por edição |
| `QUOTE_OUTDATED` | 409 | Cotação enviada difere da atual (`details.quote` traz a nova) |
| `IDEMPOTENCY_CONFLICT` | 409 | Mesma `Idempotency-Key` com conteúdo diferente |
| `COUPON_INVALID` / `COUPON_EXPIRED` | 422 | Cupom |
| `WALLET_REJECTED` | 403 | Usuário recusou a conexão |
| `WALLET_DISCONNECTED` | 428 | Carteira não conectada/desconectada no envio |
| `TRANSIENT` | 5xx | Falha transitória (`retryable: true`) |

O cliente acrescenta `NETWORK_ERROR`, `TIMEOUT` e `CANCELED` (normalizados em `api/errors.ts`).

| Recurso | Método e rota | Corpo / parâmetros | Resposta |
|---|---|---|---|
| Sessão | `POST /auth/register` | `{ username, email, password }` | `201 Session` |
| | `POST /auth/login` | `{ email, password }` | `Session { token, expiresAt, user }` |
| | `GET /auth/session` | Bearer | `{ user, expiresAt }` |
| | `POST /auth/logout` | Bearer | `204` |
| NFTs | `GET /nfts` | `q, collections, networks, minPrice, maxPrice, sort, tab, page, pageSize` | `CatalogResponse { items, page, total, totalPages, facets, query }` |
| | `GET /nfts/featured` | — | `{ spotlight }` |
| | `GET /nfts/:id` | — | `NftDetail` (editions, gallery, reviews, related, `version`) |
| Favoritos | `GET /favorites` | Bearer | `{ nftIds, items }` |
| | `PUT /favorites/:nftId` · `DELETE /favorites/:nftId` | Bearer | `204` |
| Carrinho | `GET /cart` | Bearer **ou** `X-Cart-Id` (visitante) | `Cart { items, coupon, version }` |
| | `POST /cart/items` | `{ nftId, editionId, quantity }` | `Cart` |
| | `PATCH /cart/items/:id` · `DELETE /cart/items/:id` | `{ quantity }` | `Cart` |
| | `PUT /cart/coupon` · `DELETE /cart/coupon` | `{ code }` | `Cart` |
| | `POST /cart/acknowledge` | `{ adjustQuantities }` | `Cart` (aceita preços/estoques atuais) |
| | `POST /cart/merge` | `{ guestCartId }` (Bearer) | `Cart` (visitante → usuário) |
| Cotação | `POST /quote` | `{ network }` | `Quote { id, version, lines, subtotal, discount, networkFee, total, coupon, issues }` |
| Pedidos | `POST /orders` | header `Idempotency-Key`; `{ quoteId, quoteVersion, network, walletId, collector }` | `201 Order` (replay: `200` + `Idempotent-Replay: true`) |
| | `GET /orders/:id` · `GET /orders?status=pending` | Bearer | `Order` / `{ items }` |
| Perfil | `GET /profile` · `PATCH /profile` | `ProfileUpdate` | `Profile` |
| | `PUT /profile/avatar` (multipart `avatar`) · `DELETE /profile/avatar` | ≤ 1 MB, PNG/JPG/WebP | `Profile` |
| | `POST /profile/password` | `{ currentPassword, newPassword }` | `204` |
| Carteiras | `GET /wallets` | Bearer | `{ primary, secondary }` |
| | `PUT /wallets/:slot` | `WalletInput` (+ `X-Same-As-Primary`) | `Wallet` |
| | `POST /wallets/:id/connect` · `DELETE /wallets/connection` | `{ network, address? }` | `WalletConnection` / `204` |
| Controle (só mocks) | `/__mock/*` | reset, cenário, NFT, socket, sessões, eventos | — |

**Valores monetários:** ETH trafega sempre como **string decimal** (`"1.19"`). Somas e multiplicações usam `big.js` (`src/lib/eth.ts`) tanto nos mocks quanto na UI; quantidades são inteiras. **A cotação da API é a referência** de totais: a UI nunca soma preços para exibir subtotal/total.

## Eventos Socket.IO

Transporte: `socket.io-client` com `transports: ['websocket']` em `VITE_SOCKET_URL`, interceptado por `ws.link(SOCKET_URL)` do MSW e codificado/decodificado por `@mswjs/socket.io-binding`.

```ts
interface RealtimeEvent<T, R, D> {
  id: string                       // identidade estável (duplicatas compartilham o id)
  type: T                          // 'nft.updated' | 'order.updated'
  resource: { type: R; id: string }
  version: number                  // versão do recurso após o evento
  occurredAt: string
  data: D
}
```

| Evento | `data` | Efeito no cliente |
|---|---|---|
| `nft.updated` | `name, price, previousPrice, editions[{id, available}], totalAvailable, changes[]` | Atualiza detalhe, listas, destaque, favoritos e relacionados no cache; se o NFT está no carrinho, invalida carrinho e cotação e anuncia a mudança (toast `aria-live`). |
| `order.updated` | `{ userId, order }` | Atualiza o pedido; confirmado/recusado invalida carrinho/cotação e anuncia o resultado. |
| `session.hello` (cliente → servidor) | `{ token }` | Associa a conexão ao usuário. |
| `session.ready` (servidor → cliente) | `{ userId }` | Confirma a associação. |

**Ordem, duplicatas e versões** (`src/realtime/realtime.ts`): o cliente guarda os `id`s já vistos e a maior versão conhecida por recurso (considerando também a versão vinda do REST). Evento repetido ou com versão ≤ conhecida é descartado — o estado nunca regride nem reaplica efeitos (toasts têm `id` estável). Respostas REST mais antigas que o último evento são “promovidas” com os dados do evento (`withKnownNftState`) para não regredir.

**Isolamento:** o servidor só envia `order.updated` às conexões do dono; o cliente ainda descarta eventos cujo `userId` difira da sessão atual. Em login/logout/troca de usuário o socket inteiro é fechado (`removeAllListeners` + `disconnect`) e outro é aberto com o novo token.

**Reconciliação REST × Socket.IO:** a cada reconexão (`connect` após o primeiro) o cliente invalida as consultas ativas de NFTs, catálogo, carrinho, cotação e dados do usuário — o REST é a fonte da verdade. Pedidos pendentes também fazem polling (10 s com socket conectado, 2,5 s sem socket), garantindo recuperação mesmo se um evento se perder.

### Limitações do transporte simulado

- Apenas transporte **websocket** (o binding não emula long-polling) e apenas o namespace `/`; não há rooms nativas — a audiência é filtrada pelo handler.
- O heartbeat Engine.IO (ping `2`) é emitido manualmente a cada 20 s pelo handler.
- O MSW remove o prefixo `/socket.io/` ao comparar URLs, por isso o `ws.link` usa só a origem.
- O `engine.io-client` captura `globalThis.WebSocket` no import; por isso o `socket.io-client` é importado dinamicamente **depois** que o MSW sobe.
- **Service Worker encerrado pelo navegador:** o `mockServiceWorker.js` guarda em memória as abas que atende. Quando o Chrome encerra o worker por inatividade (aba em segundo plano), essa lista se perde e as chamadas passariam direto para o servidor (404). A camada de mocks (`keepWorkerAttached`, em `mocks/browser.ts`) reenvia `MOCK_ACTIVATE` ao voltar para a aba e antes de requisições após alguns segundos sem confirmação; o teste `e2e/mocks.spec.ts` encerra o worker via CDP e verifica a recuperação.
- O “servidor” vive na aba: duas abas têm servidores independentes (o estado persistido em `localStorage` é compartilhado, as conexões não).

## Sessão

- `POST /auth/login|register` devolve `{ token, expiresAt, user }`. O cliente persiste **apenas** isso em `localStorage` (`kurio.session`) — nunca a senha.
- Após refresh, `GET /auth/session` revalida a sessão (e a cada 60 s).
- Qualquer `401 SESSION_EXPIRED/UNAUTHENTICATED` para o token atual marca a sessão como **expirada**: o diálogo de login abre **sobre a tela atual**; rotas privadas mostram “Sua sessão expirou” sem perder a URL. No checkout, o formulário é salvo continuamente em `sessionStorage` e restaurado após o novo login.
- Acesso direto a rota privada sem sessão → `/entrar?redirect=<rota>`; após autenticar, retorna ao destino (somente caminhos internos são aceitos).
- **Logout / troca de usuário:** remove todo o cache sob `['user', userId]`, carrinho e cotação daquele usuário, encerra o socket e abre um novo (anônimo ou do novo usuário).

## Carrinho

- O carrinho vive **na API**. Visitantes usam um identificador `guest_<uuid>` (header `X-Cart-Id`, persistido no navegador); usuários usam o carrinho da conta.
- Ao autenticar, `POST /cart/merge` mescla os itens do visitante no carrinho do usuário (respeitando disponibilidade) e o id de visitante é rotacionado.
- Cada item guarda o **preço aceito** (`acknowledgedPrice`). A cotação compara com o preço atual e lista `issues` (`PRICE_CHANGED`, `UNAVAILABLE`, `QUANTITY_EXCEEDS`). O checkout fica bloqueado até o usuário revisar (“Entendi, atualizar carrinho” → `POST /cart/acknowledge`).
- Após pedido **confirmado**, o servidor remove do carrinho somente as quantidades compradas; em falha/recusa os itens são preservados (e a reserva de estoque é liberada).

## Checkout, idempotência e pedidos

1. Validação dos campos do layout (mesmas regras do servidor).
2. **Revalidação**: nova cotação é buscada na API; se houver `issues`, a revisão não abre.
3. **Revisão** em diálogo com os valores da cotação, carteira, rede e conexão simulada (conectar / recusa / desconectar). Se um `nft.updated` mudar a cotação durante a revisão, o botão de pagar é bloqueado até “Revisar novamente”.
4. **Envio** com `Idempotency-Key` derivada da tentativa (hash do conteúdo: cotação, rede, carteira, dados). A chave fica em `sessionStorage`:
   - cliques repetidos: trava síncrona + botão desabilitado;
   - timeout/erro de rede: reenvio automático com a **mesma chave** → o servidor devolve o **mesmo pedido** (200, `Idempotent-Replay`);
   - conteúdo diferente com a mesma chave → 409 `IDEMPOTENCY_CONFLICT`;
   - o servidor revalida preço, disponibilidade, cupom e taxa; divergência → 409 `QUOTE_OUTDATED` com a nova cotação e nova confirmação obrigatória.
5. **Pedido** nasce `pending` (estoque reservado) e termina `confirmed` ou `declined` (terminais). A confirmação só aparece para pedido confirmado pela simulação. `/pagamento` avisa se existe pedido pendente (recuperação após refresh), e `/pedido/:id` recupera o estado via REST + eventos.
6. **Recibo**: renderizado exclusivamente do snapshot do pedido (linhas, preços, taxas, total). Alterações posteriores no catálogo não o afetam. Hash da transação e “Ver no Etherscan” são simulados (`/explorador/:hash`).

## Estratégia de cache (TanStack Query)

| Dado | Chave | staleTime | Observações |
|---|---|---|---|
| Catálogo | `['catalog','list', query]` | 30 s | `keepPreviousData` (indicador “Atualizando…”), `AbortSignal` cancela requisições obsoletas, eco de `query` validado |
| Destaque | `['catalog','featured']` | 60 s | |
| Detalhe | `['nft', id]` | 30 s | 404 não é re-tentado |
| Carrinho | `['cart', scope]` (`user:<id>` / `guest:<id>`) | 10 s | mutations escrevem a resposta no cache e invalidam a cotação |
| Cotação | `['quote', scope, network, cartVersion]` | 15 s | muda de chave a cada versão do carrinho |
| Privados | `['user', userId, …]` (favoritos, perfil, carteiras, pedidos) | 60 s (pedido: 0) | removidos em bloco no logout/troca |
| Sessão | `['session', userId]` | 60 s | refetch a cada 60 s |

- **Retries:** queries re-tentam 1× apenas erros transitórios (5xx/rede/timeout); 4xx nunca. Mutations **não** re-tentam automaticamente (evita duplicação) — pedidos usam idempotência explícita.
- **Atualização otimista com rollback:** favoritos (`useToggleFavorite`): `onMutate` aplica, `onError` restaura o snapshot e avisa, `onSettled` revalida. Coberto pelo cenário `favorite-failure`.
- **Invalidação:** mutations do carrinho → cotação; pedido confirmado/recusado → carrinho + cotação; `nft.updated` → patch direto em listas/detalhe + invalidação de carrinho/cotação; reconexão do socket → invalidação ampla de consultas ativas.
- `refetchOnWindowFocus` e `refetchOnReconnect` ativos.

## Mocks (MSW)

- **Rede:** `withNetwork()` envolve todos os handlers REST: offline (`HttpResponse.error()`), regras de falha por método/rota (HTTP, rede, timeout, com contador “falha N vezes”), latência pseudoaleatória com semente fixa e modo fora de ordem.
- **Estado:** `db.ts` mantém catálogo (estado mutável por NFT com versão), usuários (hash+salt), sessões, favoritos, carrinhos, carteiras, conexões, cotações, pedidos e chaves de idempotência; persiste em `localStorage` (debounce + flush no `pagehide`) e é restaurado pelo reset.
- **Consistência REST ⇄ eventos:** toda mudança de preço/estoque (controle, reserva, liberação, cenários) passa por `updateNft`/`reserve`/`release`, que incrementam a versão e publicam no barramento → o handler Socket.IO entrega aos clientes. O REST lê o mesmo estado.
- **Fixtures:** 239 NFTs determinísticos em 9 coleções e 3 redes (os 9 primeiros reproduzem o Figma), 2 usuários, cupons e taxas por rede.
- **Ativação:** `VITE_ENABLE_MOCKS=true` (inclusive no build de demonstração). O MSW inicia logo após o primeiro frame; o Axios aguarda `networkReady` antes de cada requisição.

## Acessibilidade

- Link “Pular para o conteúdo”, foco visível em todos os controles (`:focus-visible` com contraste), foco movido para `<main>` em navegações.
- Diálogos e drawers (Radix): foco preso, `Esc` fecha e o foco volta ao gatilho (incluindo o diálogo de login aberto programaticamente).
- Labels associadas, `aria-invalid`, `aria-describedby` para dicas/erros, foco no primeiro campo inválido, obrigatoriedade anunciada (“obrigatório”) além do asterisco.
- Edições como `radiogroup` com setas; filtros como botões `aria-pressed`; paginação com `aria-current`.
- Feedback de mutations e de tempo real em regiões `aria-live` (toasts Sonner, resumo do carrinho, avisos de preço, status do pedido).
- Estados não dependem só de cor (texto “esgotada”, risco, ícones, rótulos).
- Imagens das obras com `alt` descritivo; imagens decorativas com `alt=""`.
- `prefers-reduced-motion` desativa shimmer e animações.

**Ajustes em relação ao layout:** indicadores de carrossel (pontos) e ícones de compartilhamento ganharam área de toque de 24×24 px (o ponto visual mantém o tamanho do Figma); textos laranja sobre fundo escuro usam `#d28a4c`/`#e0a86f`/`#f2b27a` (contraste ≥ 4,5:1); campos obrigatórios ganham texto para leitores de tela; adicionado indicador de status do tempo real (ponto verde/cinza com texto oculto).

## Decisões de UX e desvios do Figma

- **Assets:** as 4 ilustrações originais em alta resolução (≈1024 px) foram recortadas em quadrado e convertidas para WebP (640 px e 320 px, `srcset`), com variações para a galeria (close, espelhada, tom quente). Fonte: Roboto Mono (variável, self-hosted via Fontsource), a mais próxima da tipografia mono do layout.
- **Busca:** o Figma não tem campo de busca visível; foi adicionado na barra do catálogo e o ícone de lupa do header leva até ele.
- **Contagens de “Rede”** são calculadas a partir das fixtures (o Figma mostra 119/78/86, inconsistentes com o total das coleções).
- **Nome ENS:** o seletor “.eth ⌄” do Figma foi mantido; hoje ele só oferece “.eth”, o único sufixo aceito pela API.
- **Login social (Google/Facebook):** fora do escopo do enunciado (que exige login integrado à API simulada). Os botões usam os ícones oficiais e, ao clicar, informam que a opção está indisponível nesta versão, sem simular sucesso.
- **Login/cadastro** são diálogos (como no Figma) também acessíveis pelas rotas `/entrar` e `/cadastro`.
- **Confirmação** é um diálogo sobre a página (como no Figma) com estados pendente/recusado.
- **Mobile (< 768 px) segue os frames mobile do Figma:** início com busca “Explorar coleções” + botão de filtros, hero em cartão e grade escalonada de 2 colunas; barra de navegação inferior (início, favoritos, explorar, carrinho, perfil); detalhe com voltar/favoritar no topo, painel arredondado e barra fixa “Qtd. / Comprar NFT / carrinho”; carrinho em cartões com resumo arredondado; “Pagamento com carteira” com carteiras cadastradas e app de carteira (WalletConnect/MetaMask/Coinbase); login e cadastro em tela cheia. Telas imersivas (detalhe, carrinho, pagamento, pedido, login) não exibem header/rodapé.
- **Pagamento mobile:** o frame não mostra o formulário, mas o enunciado exige os dados do colecionador — eles ficam na seção recolhível “Dados do colecionador” (pré-preenchida; abre sozinha se houver erro). Avisos de mudança de preço/estoque aparecem no topo para não ficarem sob o botão fixo.
- **Carrinho mobile:** além do stepper do Figma, cada cartão tem um ícone de lixeira para remover o item.
- **Avisos (toasts) no mobile** aparecem acima das barras fixas, para não cobrir os botões do topo.
- **Perfil/carteiras/confirmação no mobile:** sem frame específico, seguem o mesmo padrão (navegação do perfil em grade, formulários em uma coluna).
- **Itens fora do escopo:** no menu do perfil (Atividade, Ofertas, Arquivos baixados, Suporte) mantêm o visual do Figma, sem navegação e anunciados como “indisponível nesta versão” para leitores de tela; Criadores, Aprenda, editorial, newsletter, login social e recuperação de senha mostram aviso — nada simula sucesso.
- **“Comprar”** no detalhe adiciona ao carrinho e leva ao carrinho; o atalho de carrinho do card usa a edição 1/50.
- **Checkout:** endereço e tipo de carteira vêm da carteira cadastrada selecionada (somente leitura); “Usar outra carteira?” libera os campos.

## Performance e Lighthouse

Resultados (mediana de 3 execuções, Lighthouse 13.6, Chromium 153 headless, container Linux com 2 CPUs) — detalhes em `lighthouse/SUMMARY.md`:

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | 70 | 100 | 100 | 100 | 4,9 s | 0,001 | 493 ms |
| Início | desktop | **99** | **100** | **100** | **100** | 0,9 s | 0 | 4 ms |
| Detalhe | mobile | 70 | 100 | 100 | 100 | 4,7 s | 0 | 531 ms |
| Detalhe | desktop | **99** | **100** | **100** | **100** | 1,0 s | 0,001 | 4 ms |

Accessibility, Best Practices e SEO ficam em 100 em todas as páginas e perfis; Performance atinge a meta no desktop (99). Otimizações aplicadas:

- Hero com `preload` + `fetchpriority="high"`, dimensões fixas e `aspect-ratio` (CLS ≈ 0).
- Rotas, catálogo, diálogo de login, painel de mocks e `socket.io-client` em chunks sob demanda; Zod fora do bundle inicial.
- MSW iniciado após o primeiro frame (não disputa banda com o caminho crítico).
- `<main>` com altura mínima: o rodapé não “sobe” enquanto rotas lazy carregam (removeu CLS de 0,16 no detalhe/desktop).
- Imagens WebP responsivas (`srcset`), lazy fora da dobra; fontes self-hosted com `font-display: swap`.

**Abaixo da meta (Performance mobile, 70):** análise dos relatórios (`lighthouse/reports/*-mobile-*.json`):

- **Elemento de LCP:** no mobile não é o hero, e sim a imagem do **primeiro card do catálogo** — no Figma mobile os cards são maiores que a arte do hero. Do LCP de ~4,8 s, quase todo o tempo é *element render delay*: TTFB, atraso e download da imagem somam ~55 ms; o card só pode ser pintado quando os dados do catálogo chegam.
- **Por que os dados demoram:** o catálogo vem da API simulada, que roda **no próprio navegador** (MSW + Socket.IO simulado). O runtime de mocks (`mocks-vendor`, ~161 KB gzip) custa ~640 ms de CPU sob a emulação mobile (CPU 4×), e o React ~840 ms. Esses dois blocos também respondem por quase todo o TBT (~500 ms).
- **O que já foi feito:** hero com `preload`/`fetchpriority`, rotas, catálogo, diálogos, painel de mocks e `socket.io-client` em chunks sob demanda; MSW iniciado após o primeiro frame; Zod fora do bundle inicial; skeletons com dimensões fixas (CLS ≈ 0); imagens WebP responsivas.
- **O que não foi feito, de propósito:** remover os mocks da auditoria ou alterar a composição do Figma só para trocar o elemento de LCP — o enunciado veda “simplificações exclusivas para melhorar a pontuação”. Com uma API real (sem o runtime de mocks no cliente), esse bloco de CPU e a espera dos dados deixam de existir; no desktop, onde o custo de CPU não é multiplicado, a mesma página atinge 99.

## Limitações conhecidas

- O ambiente usado no desenvolvimento não permitia baixar o Chromium do Playwright; os testes foram executados com um Chromium 153 (`PW_CHROMIUM_PATH`). As baselines visuais podem exigir `npm run test:e2e:update` em outro sistema operacional (renderização de fontes).
- Integrações reais (blockchain, extensões de carteira, gateways) estão fora do escopo; a conexão de carteira é simulada por sessão.
- O estado simulado é por navegador (localStorage); não há sincronização entre dispositivos.
