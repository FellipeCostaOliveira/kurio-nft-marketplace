# Kurio — Marketplace de NFTs

## 1. Setup

**Requisitos:** Node **20.19+** (testado com Node 22) e npm. Não há backend: a aplicação roda inteira no navegador, com as APIs REST e o Socket.IO simulados pelo MSW.

```bash
git clone https://github.com/gvm7stack/kurio-nft-marketplace.git
cd kurio-nft-marketplace
npm ci                              # instala exatamente as versões do package-lock.json
npm run dev                         # abre em http://localhost:5173 com os mocks ativos
```

Para rodar os testes, instale uma vez o navegador do Playwright:

```bash
npx playwright install chromium
```

Como funciona por baixo: o Service Worker do MSW (`public/mockServiceWorker.js`) intercepta as chamadas REST feitas pelo Axios, e o `ws.link` do MSW com `@mswjs/socket.io-binding` intercepta a conexão WebSocket do `socket.io-client`. Os dados simulados ficam no `localStorage` do navegador, então sobrevivem a refresh até você fazer o reset.

> **Windows:** se o `npm ci` falhar com `EBUSY`, feche o VS Code e qualquer terminal com `npm run dev` aberto, apague a pasta `node_modules` e rode `npm ci` de novo.

## 2. Variáveis de ambiente

O repositório já traz um `.env` com os valores padrão. Para personalizar, copie `.env.example` para `.env`.

| Variável | Padrão | Para que serve |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` | Liga a camada MSW (REST + Socket.IO). Obrigatória no build de demonstração e no deploy. |
| `VITE_API_URL` | `/api` | Endereço base das chamadas REST do Axios. |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.test` | Endereço do Socket.IO (interceptado pelo MSW, não é um servidor real). |
| `VITE_MOCK_SCENARIO` | `default` | Cenário com que a aplicação começa (lista na seção 4). Pode ser trocado depois, sem rebuild. |

## 3. Credenciais fictícias

| Usuário | E-mail | Senha | Nome de usuário | O que tem |
|---|---|---|---|---|
| Ana Ribeiro | `ana@kurio.test` | `Kurio@2026` | `ana.colecionadora` | Carteira principal (MetaMask / Ethereum), carteira secundária (Coinbase / Polygon) e 2 favoritos |
| Bruno Sato | `bruno@kurio.test` | `Kurio@2026` | `bruno.cunhador` | Nenhuma carteira cadastrada e 1 favorito |

Também dá para criar uma conta nova em **Cadastrar**. Ela fica salva nos dados simulados até o reset.

**Cupons de desconto:**

| Cupom | Resultado |
|---|---|
| `KURIO10` | 10% de desconto |
| `GENESIS5` | 0,05 ETH de desconto |
| `LANCAMENTO` | Cupom expirado (mostra erro) |
| qualquer outro | Cupom inválido (mostra erro) |

As senhas existem só nos mocks, como **hash SHA-256 com salt** (`src/mocks/fixtures.ts`). O navegador nunca guarda senha, só o token da sessão, a expiração e os dados públicos do usuário.

## 4. Seleção e reset dos cenários

Todos os cenários são **determinísticos**: usam uma semente fixa, então o mesmo cenário produz sempre o mesmo resultado.

### 4.1 Como selecionar um cenário

| Forma | Como fazer |
|---|---|
| **Painel na tela** (mais fácil) | Clique no botão **Cenários** com ícone de frasco, no canto inferior esquerdo (no celular, é a aba estreita na borda esquerda). Escolha o cenário na lista. A página recarrega, o botão passa a mostrar o cenário ativo e aparece uma dica de como testá-lo. A lista é agrupada pelos itens do enunciado. |
| **Pela URL** | Abra `/?scenario=<nome>`, por exemplo `http://localhost:5173/?scenario=payment-declined`. Acrescente `&mock-reset=1` para também apagar os dados. |
| **Pela variável de ambiente** | `VITE_MOCK_SCENARIO=<nome>` no `.env` define o cenário inicial. |
| **Pelo console do navegador** (F12) | `__kurio.setScenario('slow')` |
| **Por REST** | `fetch('/api/__mock/scenario', { method: 'POST', body: JSON.stringify({ name: 'slow' }) })` |

### 4.2 Cenários disponíveis

| Item do enunciado | Cenário | O que acontece |
|---|---|---|
| Sucesso e resultado vazio | `default` | Tudo funciona, com latência de 60 a 180 ms e pagamento confirmado |
| | `empty-catalog` | O catálogo volta vazio |
| Latência variável e respostas fora de ordem | `slow` | Todas as respostas levam de 2,2 a 2,6 s (os skeletons ficam visíveis) |
| | `variable-latency` | Respostas levam entre 0,1 e 2,4 s |
| | `out-of-order` | A listagem alterna respostas lentas e rápidas, chegando fora de ordem |
| Falhas de conexão e HTTP 4xx/5xx | `offline` | As chamadas REST falham por falta de conexão |
| | `server-error` | O catálogo responde 500 duas vezes e depois volta a funcionar |
| | `favorite-failure` | A primeira ação de favoritar responde 500 |
| | `socket-offline` | O servidor Socket.IO recusa conexões |
| Sessão expirada e acesso não autorizado | `session-expired` | Toda sessão expira 20 s depois do login |
| | `unauthorized` | Perfil e carteiras respondem 403 |
| Conflito de cadastro ou validação de formulário | `validation-error` | Perfil e carteiras respondem 422 com erros por campo vindos do servidor |
| | *(qualquer cenário)* | Cadastro com e-mail ou nome de usuário já existente responde 409 |
| Cupom inválido ou expirado | *(qualquer cenário)* | Use os cupons `LANCAMENTO` (expirado) ou `XPTO` (inválido) |
| Preço alterado ou edição esgotada durante a compra | `price-change` | O preço do 1º item sobe 0,10 ETH no momento de confirmar o pagamento |
| | `sold-out` | A edição do 1º item esgota no momento de confirmar o pagamento |
| Timeout após criação do pedido | `order-timeout` | O pedido é criado, mas a resposta demora 12 s. O app desiste em 8 s e recupera o mesmo pedido |
| Pagamento confirmado e recusado | `default` | O pagamento é confirmado |
| | `payment-declined` | O pagamento é recusado |
| Extras de carteira | `wallet-rejected` | A primeira conexão da carteira é recusada |
| | `wallet-disconnect` | A carteira desconecta ao enviar o pedido (428) |
| Uso interno dos testes | `coupon-error` | Aplicar cupom responde 503 uma vez (não aparece no painel) |

### 4.3 Como resetar

O reset restaura os dados originais (NFTs, usuários, carrinhos, pedidos, favoritos) e volta ao cenário `default`.

| Forma | Como fazer |
|---|---|
| **Painel na tela** | Botão **Resetar tudo (dados + sessão)**. Também faz logout e volta para a página inicial. |
| **Pela URL** | Abra `/?mock-reset=1`, ou `/?scenario=<nome>&mock-reset=1` para resetar já em outro cenário. |
| **Pelo console** | `__kurio.reset()` |
| **Por REST** | `fetch('/api/__mock/reset', { method: 'POST' })` |

### 4.4 Controles de eventos em tempo real

Os comandos abaixo alteram o "servidor" simulado. O efeito chega na tela **pelo `socket.io-client`**, nunca por atalho direto na interface. Os botões do painel (**Derrubar socket**, **Expirar sessão**, **Alterar preço #042**, **Reenviar evento**) fazem o mesmo.

```js
__kurio.updateNft('nft-001', { price: '1.50' })                           // envia nft.updated com o novo preço
__kurio.updateNft('nft-001', { editions: [{ id: 'e50', available: 0 }] }) // esgota a edição 1/50
__kurio.replayLastEvent()                     // reenvia o último evento (duplicata: mesmo id e versão)
__kurio.sendStaleNftEvent('nft-001', '0.01')  // envia um evento com versão antiga
__kurio.dropSockets()                         // derruba as conexões (o app reconecta sozinho)
__kurio.setSocketOffline(true)                // mantém o socket fora do ar até chamar com false
__kurio.expireSessions()                      // invalida todas as sessões
__kurio.settleOrder('<id>', 'confirm')        // confirma um pedido pendente ('decline' recusa)
__kurio.orders()                              // lista os pedidos criados
```

## 5. Comandos de execução

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com os mocks em `http://localhost:5173` |
| `npm run dev:mocks` | O mesmo, forçando `VITE_ENABLE_MOCKS=true` |
| `npm run build` | Verificação de tipos e build otimizado em `dist/` |
| `npm run build:demo` | Build de demonstração com os mocks ligados (é o que vai para o deploy) |
| `npm run preview` | Serve o build em `http://localhost:4173` |
| `npm run typecheck` | Verificação de tipos (`tsc -b`) |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Todos os testes Playwright (gera o build de demonstração e sobe o preview sozinho) |
| `npm run test:e2e:update` | Gera de novo as imagens de referência da regressão visual |
| `npm run test:e2e:report` | Abre o relatório HTML dos testes |
| `npm run lighthouse` | Auditoria Lighthouse: 3 medições por página e perfil, com a mediana |
| `npm run check` | Roda typecheck, lint, build de demonstração e testes, em sequência |

Para usar um Chromium já instalado: `PW_CHROMIUM_PATH=/caminho/do/chromium npm run test:e2e`. Na auditoria: `CHROME_PATH=/caminho/do/chrome npm run lighthouse`.

## 6. Como reproduzir os fluxos de falha

Antes de cada fluxo, abra a URL indicada (ela já escolhe o cenário e reseta os dados) ou selecione o cenário no painel. Para entrar, use `ana@kurio.test` / `Kurio@2026`.

### Catálogo e carregamento

| Fluxo | Como reproduzir | O que deve acontecer |
|---|---|---|
| Resultado vazio | `/?scenario=empty-catalog&mock-reset=1`, ou busque `xyzxyz` em qualquer cenário | Mensagem de nenhum NFT encontrado, com opção de limpar os filtros |
| Skeletons, falha e nova tentativa | `/?scenario=server-error&mock-reset=1` | Skeletons, depois o erro "Não foi possível carregar o catálogo". Clicando em **Tentar novamente** (até duas vezes), o catálogo carrega |
| Lentidão | `/?scenario=slow&mock-reset=1` | Skeletons com brilho animado por cerca de 2 s em catálogo, detalhe e resumo do carrinho, sem a página "pular" |
| Respostas fora de ordem | `/?scenario=out-of-order&mock-reset=1` e clique rápido em **Novos lançamentos** e depois em **Em alta** | O resultado final sempre corresponde à última aba clicada |
| Sem conexão | `/?scenario=offline&mock-reset=1` | Mensagem de falha de conexão com opção de tentar de novo |
| NFT inexistente | Abra `/nft/nao-existe` | Página "NFT não encontrado" com link para explorar o catálogo |

### Conta e sessão

| Fluxo | Como reproduzir | O que deve acontecer |
|---|---|---|
| Conflito no cadastro | Em **Cadastrar**, use o e-mail `ana@kurio.test` ou o usuário `ana.colecionadora` | Erro 409 no campo correspondente, com foco nele |
| Validação no formulário | Envie cadastro ou login com campos vazios ou e-mail inválido | Erros embaixo de cada campo, lidos pelo leitor de tela, com foco no primeiro campo inválido |
| Validação vinda do servidor | `/?scenario=validation-error&mock-reset=1`, entre e salve o perfil | Erros 422 aparecem nos campos indicados pelo servidor |
| Acesso não autorizado | `/?scenario=unauthorized&mock-reset=1`, entre e abra **Meu perfil** | Mensagem de acesso negado, sem mostrar dados de ninguém |
| Sessão expirada | `/?scenario=session-expired&mock-reset=1`, entre e espere 20 s; ou use **Expirar sessão** no painel. Depois faça algo que exija login (favoritar, abrir o perfil) | O app avisa que a sessão expirou e pede login de novo. Depois de entrar, você volta para onde estava |
| Sessão expirada no checkout | Entre, vá ao pagamento, digite algo na observação e clique em **Expirar sessão** no painel. Depois clique em **Confirmar compra** | O login reabre e, depois de entrar, o formulário continua preenchido |

### Carrinho e compra

| Fluxo | Como reproduzir | O que deve acontecer |
|---|---|---|
| Cupom inválido ou expirado | No carrinho, aplique `XPTO` (inválido) ou `LANCAMENTO` (expirado) | Mensagem de erro no campo do cupom e o total não muda |
| Preço muda com o item no carrinho | Coloque o Emerald Ape #042 no carrinho e clique em **Alterar preço #042** no painel | Aviso de mudança, resumo atualizado e checkout bloqueado até clicar em **Entendi, atualizar carrinho** |
| Preço alterado na confirmação | `/?scenario=price-change&mock-reset=1`, compre um item até **Confirmar e pagar** | A confirmação é recusada por cotação desatualizada, as mudanças aparecem e é preciso confirmar de novo |
| Edição esgotada na confirmação | `/?scenario=sold-out&mock-reset=1`, compre um item até **Confirmar e pagar** | Aviso de edição esgotada e a compra não é concluída |
| Clique repetido | Clique várias vezes seguidas em **Confirmar e pagar** | Só um pedido é criado |
| Timeout com recuperação | `/?scenario=order-timeout&mock-reset=1`, compre até **Confirmar e pagar** | Depois de cerca de 8 s aparece "Verificando seu pedido…" e o app recupera **o mesmo pedido**, sem duplicar (confira com `__kurio.orders()` no console) |
| Pagamento confirmado | Cenário `default`, compre um item | Recibo com identificação da transação, itens, taxas e total |
| Pagamento recusado | `/?scenario=payment-declined&mock-reset=1`, compre um item | O pedido termina como recusado e os itens continuam no carrinho |
| Carteira recusa | `/?scenario=wallet-rejected&mock-reset=1`, vá até a revisão do pedido e clique em **Conectar carteira** | Na primeira vez a conexão é recusada com mensagem de erro; na segunda funciona |
| Carteira desconecta | `/?scenario=wallet-disconnect&mock-reset=1`, compre até **Confirmar e pagar** | Aviso de que a carteira desconectou, pedindo para conectar de novo antes de enviar |

### Tempo real e conexão

| Fluxo | Como reproduzir | O que deve acontecer |
|---|---|---|
| Socket cai e volta | Clique em **Derrubar socket** no painel | O indicador de tempo real no cabeçalho (ponto colorido) mostra a desconexão e volta sozinho. Ao reconectar, os dados são conferidos de novo com a API |
| Evento duplicado | Clique em **Alterar preço #042** e depois em **Reenviar evento** | O aviso aparece só uma vez |
| Evento antigo | No console: `__kurio.sendStaleNftEvent('nft-001', '0.01')` | O preço não volta para um valor antigo |
| Queda com pedido pendente | Crie um pedido, rode `__kurio.setSocketOffline(true)` no console e recarregue a página. Depois rode `__kurio.settleOrder('<id>', 'confirm')` e `__kurio.setSocketOffline(false)` | Depois de recarregar, o pedido continua pendente, sem compra nova. Ao reconectar, o recibo aparece |
| Favoritar com falha | `/?scenario=favorite-failure&mock-reset=1`, entre e favorite um NFT | O coração volta ao estado anterior com um aviso. Na segunda tentativa funciona |
