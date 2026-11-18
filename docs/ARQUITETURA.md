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
| `receiptLinks` | vínculo “item da nota neste lugar → produto” (pelo código do item ou pela descrição) | `placeId`, `[placeId+key]` |

**Versionamento:** cada mudança de esquema ganha um `this.version(n)` com `upgrade()` em `db/database.ts` e o `SCHEMA_VERSION` sobe. A v2 criou a chave de busca sem acentos; a v3 criou os tipos de lugar, moveu os postos para `stores` com o tipo Combustível (mantendo os IDs, então preços e compras continuam ligados) e removeu a tabela `stations`; a v4 trouxe a importação de nota fiscal (CNPJ do lugar, `receiptKey` na compra e no preço de combustível, tabela `receiptLinks`). Os tipos padrão têm IDs fixos (`seg-mercado`, `seg-farmacia`, `seg-combustivel`) para backups de aparelhos diferentes se reconhecerem. O backup grava o `schemaVersion`: arquivos antigos são migrados ao importar e arquivos de versões mais novas são recusados com uma mensagem clara.

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
- Sem segredos, sem variáveis de ambiente, sem chamadas a APIs próprias.
- Nota fiscal: a página da Fazenda abre numa tela nativa separada (`NfceBrowserActivity`), só com `https://`. O app não automatiza nem contorna a verificação de segurança do site: quem passa por ela é a pessoa. Depois disso, o app lê o HTML que já está na tela, interpreta com `DOMParser` (sem executar nada dele) e valida tudo antes de gravar.

## Nota fiscal (NFC-e)

```
QR Code (leitor do Google) ─▶ link da Fazenda ─▶ tela nativa com WebView (verificação feita pela pessoa)
     └─ ou chave digitada ─▶ consulta de SC        └─▶ HTML da nota ─▶ services/nfce (leitura pura, testada)
                                                     ─▶ repositories/receipts (lugar pelo CNPJ, produtos pelos vínculos)
                                                     ─▶ tela de conferência ─▶ compra + preços confirmados (ou preços de combustível)
```

- `services/nfce.ts` lê o layout nacional da consulta (classes `txtTit`, `Rqtd`, `RUN`, `RvlUnit`, `valor`) e, se elas faltarem, o texto da página. Também extrai a chave, sugere a embalagem pela descrição (“5KG”, “2L”) e o combustível pela descrição do item.
- A importação roda numa transação: lugar novo, produtos novos, vínculos e a compra entram juntos ou nada entra.
- A mesma chave não é importada duas vezes.
- Só abre link de QR Code de domínio `.gov.br` que traga a chave; QR de cardápio, Pix ou site qualquer recebe aviso e não é aberto.

## Código de barras do produto

- No app, `scanProductBarcode` (em `app/nfceNative.ts`) usa o mesmo leitor do Google, limitado a EAN-13, EAN-8 e UPC-A.
- `services/productLookup.ts` confere o dígito verificador e consulta a API v2 do Open Food Facts; quando a resposta indica outro tipo de produto (beleza, pet, geral), repete na base irmã. Só o número do código sai do aparelho.
- O formulário preenche só o que está vazio (nome, marca, embalagem); a foto é baixada em segundo plano (o servidor de imagens demora) e reduzida como qualquer foto. Código já usado em outro produto oferece abrir ou usar o existente.

## Preços da ANP

- `services/anp.ts` lê os CSVs “últimas 4 semanas” do levantamento de preços da ANP (latin-1, `;`, cabeçalho por nome de coluna) e ignora GLP e linhas inválidas.
- `repositories/anp.ts` grava pelo CNPJ do posto; postos pesquisados que ainda não existem são cadastrados nas cidades onde a pessoa já tem posto (cidade com o mesmo nome em dois estados só quando um posto conhecido confirma o estado). A mesma coleta (posto, combustível e dia, com observação “ANP …”) não entra duas vezes.
- `app/anpNative.ts` baixa pelo `CapacitorHttp` (o site da ANP não manda CORS, então não funciona no navegador) e decodifica o base64 como windows-1252. O automático roda ao abrir ou voltar ao app, só com a opção ligada, no Wi-Fi e no máximo a cada 2 dias.

## Produto parecido entre notas

- `services/productMatch.ts`: expande abreviações comuns de NFC-e, separa o tamanho da embalagem (5 kg ≠ 1 kg é sempre outro produto) e compara palavras (aceitando prefixo, “feij” ~ “feijão”). Compara com nome + marca + tamanho de cada produto e com as descrições de notas já ligadas a ele em qualquer lugar.
- Na conferência: semelhança alta liga sozinho com o selo “Parecido”; média só sugere (“Talvez seja”).

## Backup automático

- `app/autoBackup.ts` grava o backup completo em `Documentos/Precivora/Automatico` (Capacitor Filesystem) ao abrir/voltar ao app quando passou o intervalo; apaga as cópias além do limite. Ajustes: `autoBackup`, `autoBackupDays`, `autoBackupKeep`, `lastAutoBackupAt`, `lastAutoBackupBytes`.

## Localização e mapa

- `services/geo.ts`: distância (haversine), rua/número a partir do endereço livre, pedidos ao Nominatim (rua com número; se falhar, bairro) e leitura da resposta (recusa cidade diferente).
- `app/geocodeRunner.ts`: localiza em segundo plano os lugares sem coordenadas, um pedido a cada 1,1 s (regra do Nominatim), com User-Agent próprio no app. Precisão guardada em `geo` (`exact`, `street`, `area`, `none`); ordem: favoritos, postos com preço, outros postos e o resto; “não encontrado” tenta de novo depois de 30 dias; mudar o endereço apaga a localização.
- `app/location.ts`: posição do aparelho (plugin de geolocalização no app; `navigator.geolocation` no navegador), só sob ação da pessoa e guardada por 5 minutos na sessão.
- `app/useLocate.tsx`: passo único do “Perto de mim” e do filtro por distância. Sem permissão ou com a localização do Android desligada, mostra antes um aviso explicando o uso; desligada, chama o plugin nativo `LocationSettings` (`LocationSettingsPlugin.java`, `SettingsClient` do Google Play Services), que abre a janela do Google para ligar sem sair do app. Desistir em qualquer etapa não mostra erro.
- `features/map/MapPage.tsx`: Leaflet com os tiles do OpenStreetMap (no tema escuro, um filtro CSS escurece o mapa).

