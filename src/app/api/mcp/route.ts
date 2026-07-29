import { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedQuery, isEmbeddingConfigured } from "@/lib/embeddings";
import { buildItemBrief, buildBoardBrief } from "@/lib/brief";
import { ITEM_COLUMNS, type Item } from "@/lib/types";
import { itemIdsInCollection } from "@/lib/collections";

// Endpoint MCP (Streamable HTTP, ver spec do Model Context Protocol) que
// expõe a biblioteca de refs pro Claude Code consumir como contexto de
// direcionamento visual em OUTROS projetos (ver PRODUCT.md — esse é o caso
// de uso central do produto: "fonte de direcionamento visual a ser
// consultada pelo Claude Code"). Leitura só, sem auth: a biblioteca já é
// pública pra leitura (só add/apagar exige login).
export const maxDuration = 30;

async function resolveCollectionId(name: string | undefined): Promise<string | null | undefined> {
  if (!name) return undefined;
  const supabase = createAdminClient();
  const { data } = await supabase.from("collections").select("id").ilike("name", name).maybeSingle();
  return data?.id ?? null;
}

function textFallbackFilter(items: Item[], query: string): Item[] {
  const q = query.toLowerCase();
  return items.filter((i) =>
    `${i.title ?? ""} ${i.description ?? ""} ${i.tags.join(" ")} ${i.recipe_tags.join(" ")}`
      .toLowerCase()
      .includes(q),
  );
}

function getServer() {
  const server = new McpServer(
    { name: "refs-avaaraujo", version: "1.0.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Biblioteca pessoal de referências visuais de design (refs.avaaraujo.com). Use search_refs pra achar referências relevantes a um projeto (por busca em linguagem natural e/ou filtros) e leia os briefs retornados como direção de estilo — paleta, tipografia, composição, padrões de UI — antes de tomar decisões visuais num projeto novo. list_collections e list_tags ajudam a descobrir o vocabulário disponível antes de filtrar.",
    },
  );

  server.registerTool(
    "search_refs",
    {
      title: "Buscar referências visuais",
      description:
        "Busca na biblioteca de referências por linguagem natural (busca semântica quando configurada, senão por texto) combinada com filtros exatos de categoria, cor, tag e coleção. Devolve o brief de cada referência (título, categoria, estilo, paleta, tags, recipe_tags e um site_recipe pronto pra colar num prompt) — use isso como direção visual pro projeto atual.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Busca em linguagem natural, ex: 'dashboard escuro e editorial com serifa'"),
        category: z.string().optional().describe("categoria exata, ex: Landing Page, Dashboard"),
        color: z.string().optional().describe("paleta exata, ex: Black & White, Pastel"),
        tag: z.string().optional().describe("tag exata"),
        collection: z.string().optional().describe("nome da coleção"),
        limit: z.number().int().min(1).max(50).optional().default(10),
      },
    },
    async ({ query, category, color, tag, collection, limit }) => {
      const supabase = createAdminClient();
      const collectionId = await resolveCollectionId(collection);
      if (collectionId === null) {
        return { content: [{ type: "text", text: `Nenhuma coleção chamada "${collection}".` }] };
      }

      let items: Item[] = [];

      if (query && isEmbeddingConfigured()) {
        const queryEmbedding = await embedQuery(query);
        const { data: matches, error: matchError } = await supabase.rpc("match_items", {
          query_embedding: queryEmbedding,
          match_count: Math.max(limit * 3, 30),
          filter_category: category ?? null,
          filter_collection_id: collectionId ?? null,
        });
        if (matchError) return { content: [{ type: "text", text: `Erro na busca: ${matchError.message}` }], isError: true };
        const ids = (matches ?? []).map((m: { id: string }) => m.id);
        if (ids.length === 0) return { content: [{ type: "text", text: "Nenhuma referência encontrada." }] };
        const { data } = await supabase.from("items").select(ITEM_COLUMNS).in("id", ids);
        const byId = new Map((data ?? []).map((i) => [i.id, i as Item]));
        items = ids.map((id: string) => byId.get(id)).filter((i: Item | undefined): i is Item => Boolean(i));
        if (tag) items = items.filter((i) => i.tags.includes(tag));
      } else {
        let dbQuery = supabase.from("items").select(ITEM_COLUMNS).order("created_at", { ascending: false }).limit(200);
        if (category) dbQuery = dbQuery.eq("category", category);
        if (color) dbQuery = dbQuery.eq("color", color);
        if (tag) dbQuery = dbQuery.contains("tags", [tag]);
        if (collectionId) {
          const ids = await itemIdsInCollection(supabase, collectionId);
          dbQuery = dbQuery.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
        }
        const { data, error } = await dbQuery;
        if (error) return { content: [{ type: "text", text: `Erro na busca: ${error.message}` }], isError: true };
        items = (data ?? []) as Item[];
        if (query) items = textFallbackFilter(items, query);
      }

      items = items.slice(0, limit);
      if (items.length === 0) return { content: [{ type: "text", text: "Nenhuma referência encontrada com esses filtros." }] };

      const text = items
        .map((item, i) => `--- Referência ${i + 1} (id: ${item.id}) ---\n${buildItemBrief(item)}`)
        .join("\n\n");
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "get_item_brief",
    {
      title: "Brief de uma referência específica",
      description: "Devolve o brief completo (com site_recipe, o prompt pronto pra recriar a direção visual) de uma referência pelo id.",
      inputSchema: { id: z.string().describe("id da referência (uuid)") },
    },
    async ({ id }) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.from("items").select(ITEM_COLUMNS).eq("id", id).maybeSingle();
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      if (!data) return { content: [{ type: "text", text: "Referência não encontrada." }], isError: true };
      const item = data as Item;
      const brief = buildItemBrief(item);
      const text = item.site_recipe ? `${brief}\n\nSite recipe:\n${item.site_recipe}` : brief;
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "get_board_brief",
    {
      title: "Brief agregado (tendências do acervo ou de um recorte)",
      description:
        "Agrega o acervo inteiro ou um recorte dele (por tag, categoria ou coleção) num resumo de tendência: categorias, estilos, paletas e tags mais recorrentes. Use pra entender o tom geral de uma coleção/projeto antes de puxar itens específicos com search_refs.",
      inputSchema: {
        tag: z.string().optional(),
        category: z.string().optional(),
        collection: z.string().optional().describe("nome da coleção"),
      },
    },
    async ({ tag, category, collection }) => {
      const supabase = createAdminClient();
      const collectionId = await resolveCollectionId(collection);
      if (collectionId === null) {
        return { content: [{ type: "text", text: `Nenhuma coleção chamada "${collection}".` }] };
      }

      let dbQuery = supabase.from("items").select(ITEM_COLUMNS).order("created_at", { ascending: false }).limit(500);
      if (tag) dbQuery = dbQuery.contains("tags", [tag]);
      if (category) dbQuery = dbQuery.eq("category", category);
      if (collectionId) {
        const ids = await itemIdsInCollection(supabase, collectionId);
        dbQuery = dbQuery.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
      }

      const { data, error } = await dbQuery;
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };

      const scopeLabel = [collection, tag ? `tag: ${tag}` : null, category].filter(Boolean).join(", ") || undefined;
      return { content: [{ type: "text", text: buildBoardBrief((data ?? []) as Item[], scopeLabel) }] };
    },
  );

  server.registerTool(
    "list_collections",
    {
      title: "Listar coleções",
      description: "Lista as coleções nomeadas existentes na biblioteca (agrupamentos por projeto/intenção, ver get_board_brief e search_refs).",
      inputSchema: {},
    },
    async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.from("collections").select("name, created_at").order("name");
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      if (!data || data.length === 0) return { content: [{ type: "text", text: "Nenhuma coleção criada ainda." }] };
      return { content: [{ type: "text", text: data.map((c) => c.name).join("\n") }] };
    },
  );

  server.registerTool(
    "list_tags",
    {
      title: "Listar tags e categorias em uso",
      description: "Lista as tags, categorias e paletas de cor mais frequentes no acervo — útil pra descobrir o vocabulário exato antes de filtrar com search_refs.",
      inputSchema: {},
    },
    async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.from("items").select("tags, category, color").limit(500);
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };

      function topCounts(values: string[], max: number): string {
        const counts = new Map<string, number>();
        for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
        return [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, max)
          .map(([v, c]) => `${v} (${c})`)
          .join(", ");
      }

      const rows = data ?? [];
      const text = [
        `Categorias: ${topCounts(rows.map((r) => r.category).filter((c): c is string => Boolean(c)), 20)}`,
        `Cores: ${topCounts(rows.map((r) => r.color).filter((c): c is string => Boolean(c)), 20)}`,
        `Tags: ${topCounts(rows.flatMap((r) => r.tags ?? []), 40)}`,
      ].join("\n");
      return { content: [{ type: "text", text }] };
    },
  );

  return server;
}

async function handleMcpRequest(req: NextRequest): Promise<Response> {
  const server = getServer();
  // stateless: sem sessionIdGenerator, cada request cria server+transport
  // próprios — combina com o modelo serverless do Next.js (sem garantia de
  // a mesma instância atender duas chamadas seguidas)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handleMcpRequest as GET, handleMcpRequest as POST, handleMcpRequest as DELETE };
