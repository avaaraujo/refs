# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Uso pessoal e single-user (dono do projeto, deploy em refs.avaaraujo.com). Sem plano de login compartilhado ou multi-usuário.

## Product Purpose

Refs é uma biblioteca pessoal de referências visuais de design (sites, apps, produtos digitais). O dono salva prints ou links, o sistema captura screenshot automaticamente e tageia por IA (categoria, estilo, cor, tags), e a biblioteca vira: (1) arquivo de inspiração/swipe para os próprios projetos, (2) observatório pessoal de tendências e padrões de UI do mercado, e (3) fonte de direcionamento visual a ser consultada pelo Claude Code ao começar novos projetos — as referências salvas aqui devem poder orientar decisões de estilo em outros produtos do dono (ex: ava.cheap).

## Positioning

Diferente de um board genérico (Pinterest, Are.na), o pipeline é feito para consumo por IA desde a entrada: cada referência é automaticamente descrita e tageada em campos estruturados (categoria, estilo, cor, tags) no momento do save, não exige curadoria manual, e o conteúdo é pensado para ser relido por um agente (Claude Code) como contexto de direcionamento visual de outros projetos — não só para navegação humana.

## Operating Context

Fluxo de uso: colar um link (o print é capturado automaticamente do site) ou enviar um print manualmente, com nota opcional -> IA gera título, descrição, categoria, estilo, cor, tags e recipe -> item entra na grade masonry da biblioteca. Navegação por busca textual/semântica, filtro de tags/categoria/cor/coleção. Itens podem ser agrupados numa coleção nomeada (ex: "direção do ava.cheap"). Autenticação simples (email+senha via Supabase Auth) só é necessária para adicionar/apagar/organizar; a biblioteca é visível sem login. O acervo também é consultável programaticamente por um agente (Claude Code) via o endpoint MCP.

## Capabilities and Constraints

- Stack: Next.js 16 + React 19 + Tailwind v4, Supabase (Postgres + Storage + Auth), Anthropic SDK (claude-sonnet-5) para tagging de imagem, Voyage AI (voyage-3-lite) para embeddings de busca semântica.
- Captura de screenshot automática a partir de URL (`src/lib/screenshot.ts`); upload manual de imagem como alternativa.
- Tagging por IA roda na criação do item; re-tagging em lote disponível (`/api/items/retag-all`, botão na Library) pra atualizar o acervo depois de melhorar o prompt de tagging.
- Busca semântica via embedding do texto do item (Voyage AI, `src/lib/embeddings.ts` + `supabase/migration_005_embeddings.sql`) — precisa de `VOYAGE_API_KEY`; sem a chave, a busca cai pra substring simples.
- Coleções nomeadas (`collections` table, `items.collection_id`) agrupam itens por projeto/intenção, complementando as tags geradas por IA.
- Endpoint MCP (`/api/mcp`, Streamable HTTP) expõe a biblioteca pra qualquer cliente MCP (Claude Code) com as tools `search_refs`, `get_item_brief`, `get_board_brief`, `list_collections`, `list_tags` — leitura só, sem auth, já que a biblioteca é pública pra leitura.
- Single-user: sem RLS no banco ainda (comentado no schema.sql como decisão deliberada, "por enquanto").
- Bucket de storage público (`refs`) para os prints.

## Evidence on Hand

Nenhum conteúdo de exemplo, testimonial ou caso de uso a fabricar — a biblioteca começa vazia e cresce com o uso real do dono.

## Product Principles

- Fricção mínima para salvar: colar um link (ou print) deve bastar; a estrutura (título, categoria, tags) é gerada, não digitada.
- Estruturado para reuso por IA: cada campo gerado precisa ser útil tanto para busca humana quanto como contexto legível por um agente.
- Ferramenta pessoal, não produto multi-tenant: decisões de auth/permissão podem ficar simples enquanto o uso for single-user.
- A biblioteca deve funcionar tanto como banco de inspiração quanto como leitura de tendência — os campos de tagging (categoria, estilo, cor) existem para sustentar as duas leituras.
