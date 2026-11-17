# Roadmap

## Fase 1 — MVP (concluída)

Produtos, marcas e categorias · mercados · postos · preços · comparador · combustíveis com calculadora flex · avaliações pessoais · sugestões explicadas · listas com comparação da lista inteira · histórico de compras · orçamento · backup e restauração · PWA offline · tema claro/escuro/automático · app Android (Capacitor) · importação de nota fiscal (NFC-e de SC) · boas-vindas e apresentação guiada.

## Fase 2 — Inteligência

- **Alertas de preço:** “avise quando o arroz ficar abaixo de R$ X” (local, verificado ao registrar preços; notificações push dependem de suporte do navegador).
- **Leitor de código de barras:** `BarcodeDetector` onde existir, com alternativa em WebAssembly (ex.: ZXing) para iOS. O campo `barcode` já existe e é indexado.
- **Nota fiscal de outros estados:** a importação já funciona para SC no app Android (a consulta abre numa tela nativa, sem proxy). Falta testar e ajustar outros estados que seguem o layout nacional e decidir o que fazer com estados que exigem captcha interativo.
- **Backup automático na nuvem:** opção de salvar o backup no Google Drive da própria pessoa, com o banco continuando local.
- **Tendências:** projeção simples de preço e sazonalidade por produto.
- **Dados públicos da ANP:** o levantamento semanal de preços de combustíveis é público (dados.gov.br). Proposta: tabela separada `referencePrices` (somente leitura, com fonte e data), baixada sob demanda pelo usuário e **nunca misturada** com os preços que ele anotou. O app passa a mostrar “média da ANP no município” como referência. Só implementar depois de confirmar formato, licença e frequência dos dados.

## Fase 3 — Social

- Contas opcionais (o app continua 100% utilizável sem conta).
- Compartilhamento familiar de listas e preços.
- Avaliações coletivas, em tabela própria (`communityReviews`), separadas das notas pessoais.
- Preços colaborativos e comparação regional, com moderação e reputação para conter preços falsos.

## Fase 4 — Comercial

- Sincronização em nuvem entre dispositivos.
- Recursos premium opcionais (ex.: histórico ilimitado na nuvem, relatórios avançados). As funções básicas continuam gratuitas e completas.
- Apps nas lojas (TWA no Android; Capacitor se for necessário recurso nativo).
- Integrações externas (encartes, programas de fidelidade), sempre com consentimento explícito.

## Arquitetura proposta para a sincronização (não implementada)

```
Aparelho (IndexedDB, fonte local)          Nuvem (opcional)
┌────────────────────────────┐   push/pull   ┌───────────────────────────┐
│ tabelas pessoais           │◀────────────▶ │ API de sync (por usuário) │
│ outbox de mudanças         │   (HTTPS)     │ Postgres + Row Level Sec. │
│ referencePrices (somente   │◀──────────────│ dados públicos / coletivos│
│  leitura)                  │               └───────────────────────────┘
└────────────────────────────┘
```

- **Separação de dados:** pessoais (tabelas atuais), públicos de referência (`referencePrices`), coletivos (`community*`) e configurações individuais (`settings`). Cada grupo com regras de privacidade próprias.
- **Identidade de registros:** os UUIDs gerados no aparelho já permitem sincronizar sem renumerar.
- **Conflitos:** `updatedAt` em todas as entidades permite “última gravação vence” por campo; para listas compartilhadas, um CRDT simples (ex.: Yjs ou Automerge) evita perder itens marcados em dois aparelhos.
- **Implementação sugerida:** Dexie Cloud (menor esforço, compatível com o banco atual) ou Supabase com uma fila de mudanças (*outbox*) local.
- **Privacidade:** sincronização desligada por padrão, criptografia em trânsito e exportação/exclusão de conta a qualquer momento.
