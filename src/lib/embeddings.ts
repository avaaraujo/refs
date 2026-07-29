import type { Item } from "./types";

// texto usado pra gerar o embedding: mesma ideia do brief (ver lib/brief.ts),
// mas sem formatação — só o conteúdo semântico que a busca precisa comparar
export function embeddingText(fields: {
  title: string | null;
  description: string | null;
  category: string | null;
  style: string[];
  color: string | null;
  tags: string[];
  recipe_tags: string[];
}): string {
  return [
    fields.title,
    fields.description,
    fields.category,
    fields.style.join(", "),
    fields.color,
    fields.tags.join(", "),
    fields.recipe_tags.join(", "),
  ]
    .filter(Boolean)
    .join(". ");
}

// Voyage AI é a parceira recomendada pela Anthropic pra embeddings (a API da
// Anthropic não gera embeddings diretamente). voyage-3-lite: 512 dimensões,
// barato o suficiente pro volume de uma biblioteca pessoal.
const VOYAGE_MODEL = "voyage-3-lite";
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

async function voyageEmbed(input: string | string[], inputType: "document" | "query"): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY não configurada.");

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input, model: VOYAGE_MODEL, input_type: inputType }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Voyage AI falhou (${res.status}): ${body}`);
  }

  const json = await res.json();
  return (json.data as { embedding: number[] }[]).map((d) => d.embedding);
}

// embedding de um item pra armazenar (input_type "document" — otimizado pro
// lado que é buscado, não pro lado que busca)
export async function embedItem(item: {
  title: string | null;
  description: string | null;
  category: string | null;
  style: string[];
  color: string | null;
  tags: string[];
  recipe_tags: string[];
}): Promise<number[]> {
  const [embedding] = await voyageEmbed(embeddingText(item), "document");
  return embedding;
}

// embedding de uma query de busca (input_type "query" — otimizado pro lado
// que busca; Voyage recomenda usar tipos diferentes pros dois lados)
export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await voyageEmbed(query, "query");
  return embedding;
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

export type { Item };
