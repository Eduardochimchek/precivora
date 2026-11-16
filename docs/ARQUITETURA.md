# Arquitetura do Precivora

## Princípios

1. **Local-first.** O dispositivo é a fonte da verdade. Nada depende de rede.
2. **Regras de negócio puras.** Tudo o que calcula (unidades, comparação, combustível, otimizador de lista, recomendações, análises) vive em `src/services` como funções sem estado e sem acesso a banco, testadas isoladamente.
3. **Uma porta de escrita.** As telas não gravam direto no banco: usam `src/repositories`, que limpam texto, validam com Zod (`services/schemas.ts`) e registram a atividade. Os mesmos esquemas validam backups importados.
4. **Leitura reativa.** As telas leem com `useLiveQuery` (Dexie), então qualquer gravação atualiza todas as telas abertas.

## Camadas

```
features (telas) ──lê──▶ hooks/useData (useLiveQuery) ──▶ db (Dexie/IndexedDB)
      │                                                     ▲
      └─grava─▶ repositories ──valida─▶ services/schemas ───┘
      └─calcula─▶ services (puros)
```

## Banco (IndexedDB via Dexie)

| Tabela | Conteúdo | Índices principais |
|---|---|---|
| `segments` | tipos de lugar (Mercado, Farmácia, Combustível + criados pelo usuário); `mode: 'fuel'` ativa as telas de combustível | `order` |
| `stores` | **todos os lugares** (mercados, farmácias, postos…), cada um com `segmentId` | `name`, `segmentId` |
| `products` | item genérico (só o nome é obrigatório), embalagem, marca, categoria, tipo de lugar | `nameKey`, `brandId`, `categoryId`, `barcode`, `segmentId` |
| `brands`, `categories` | marcas e categorias (categoria pode ser de um tipo de lugar) | `nameKey` / `name`, `segmentId` |
| `prices` | preço anotado ou confirmado em compra (`source`) | `productId`, `storeId`, `[productId+date]`, `purchaseId` |
| `fuelPrices` | preço de combustível com data e hora (`stationId` aponta para um lugar de tipo combustível) | `stationId`, `[fuel+date]` |
| `reviews` | avaliação pessoal (uma por produto/marca) | `[targetType+targetId]` |
| `purchases`, `purchaseItems` | compras reais | `storeId`, `date`, `purchaseId` |
| `lists`, `listItems` | listas de compras | `listId` |
| `categoryBudgets` | limite por categoria | `&categoryId` |
| `activities` | últimas atividades (máx. 300) | `createdAt` |
| `settings` | preferências (chave/valor) | `key` |

**Versionamento:** cada mudança de esquema ganha um `this.version(n)` com `upgrade()` em `db/database.ts` e o `SCHEMA_VERSION` sobe. A v2 criou a chave de busca sem acentos; a v3 criou os tipos de lugar, moveu os postos para `stores` com o tipo Combustível (mantendo os IDs, então preços e compras continuam ligados) e removeu a tabela `stations`. Os tipos padrão têm IDs fixos (`seg-mercado`, `seg-farmacia`, `seg-combustivel`) para backups de aparelhos diferentes se reconhecerem. O backup grava o `schemaVersion`: arquivos antigos são migrados ao importar e arquivos de versões mais novas são recusados com uma mensagem clara.

**IDs** são UUID v4 gerados no aparelho. Isso permite mesclar backups sem colisão e, no futuro, sincronizar sem depender de um servidor para numerar registros.

## Decisões de cálculo

- **Unidades:** cada unidade tem uma dimensão (massa, volume, contagem, pacote, caixa) e um fator para a unidade-base (kg, L, un). Só produtos da mesma dimensão são comparados por preço por unidade; misturas geram aviso.
- **Recente × histórico × confirmado:** preço “recente” é o último de cada mercado dentro do limite configurado (padrão 30 dias; combustível 7). O app nunca diz que um lugar *está* mais barato quando só há registros antigos.
- **Lista inteira:** usa o último preço de cada item em cada mercado ativo. A compra dividida testa todas as combinações de mercados (até 14; acima disso, uma heurística) e soma o custo de deslocamento de cada mercado extra. Com a preferência “um só mercado”, só sugere dividir acima da economia mínima definida.
- **Recomendações:** a nota pessoal pesa 50%, o preço por unidade relativo ao menor 35% e a tendência 15%. Favorito soma bônus; “não comprar novamente” vai para o fim. Cada sugestão lista os motivos.
- **Economia estimada:** para cada item comprado, diferença positiva entre a média dos preços que você registrou para o produto (fora daquela compra) e o preço pago.

## PWA

- `vite-plugin-pwa` (Workbox `generateSW`) pré-armazena o app inteiro; navegação cai no `index.html`.
- `registerType: 'prompt'`: uma versão nova só é ativada quando o usuário toca em **Atualizar**. O service worker troca só os arquivos do app; o IndexedDB não é tocado.
- O splash inicial está no próprio `index.html` (aparece antes do JavaScript) e some quando o banco abriu, as configurações carregaram e o tema foi aplicado.
- `theme-color` e o estilo da barra do iOS acompanham o tema. Safe areas (`env(safe-area-inset-*)`) são respeitadas no topo e na navegação inferior.
- Limitações: no iOS a cor da barra de status segue o tema do sistema e o `apple-mobile-web-app-status-bar-style`, sem controle fino. PWA não tem acesso a notificações em segundo plano no iOS antigo nem a recursos nativos como um app Android.

## Segurança

- Entradas validadas com Zod e textos limpos de caracteres de controle e limitados em tamanho.
- Importação: limite de 50 MB, JSON validado registro a registro, IDs repetidos e referências quebradas recusados, tudo numa transação (ou entra tudo, ou nada).
- Imagens de produto são reduzidas no aparelho (máx. 480 px, cerca de 300 KB) e só aceitas como `data:image/(jpeg|png|webp)`.
- CSV exportado neutraliza fórmulas (`=`, `+`, `-`, `@`) para evitar injeção ao abrir no Excel.
- React escapa todo o conteúdo; não há `dangerouslySetInnerHTML`.
- Sem segredos, sem variáveis de ambiente, sem chamadas a APIs.
