import type { Item } from "./types";

// texto pronto pra colar como contexto de direcionamento visual num prompt
// de Claude (ver PRODUCT.md — esse é o caso de uso central do "consumo por IA")
export function buildItemBrief(item: Item, notes?: string | null): string {
  const lines: string[] = [`Referência visual: ${item.title ?? "Sem título"}`];
  if (item.source_domain) lines.push(`Fonte: ${item.source_domain}`);
  lines.push("");

  if (item.category) lines.push(`Categoria: ${item.category}`);
  if (item.style.length > 0) lines.push(`Estilo: ${item.style.join(", ")}`);
  if (item.color) lines.push(`Paleta: ${item.color}`);
  if (item.tech.length > 0) lines.push(`Stack observada: ${item.tech.join(", ")}`);
  if (item.tags.length > 0) lines.push(`Elementos: ${item.tags.join(", ")}`);
  if (item.recipe_tags?.length > 0) lines.push(`Recipe: ${item.recipe_tags.join("; ")}`);

  if (item.description) {
    lines.push("");
    lines.push(`Resumo: ${item.description}`);
  }

  const finalNotes = notes ?? item.notes;
  if (finalNotes) lines.push(`Notas: ${finalNotes}`);

  return lines.join("\n");
}

function topCounts(values: string[], max: number): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
}

function formatCounts(pairs: [string, number][]): string {
  return pairs.map(([v, c]) => (c > 1 ? `${v} (${c})` : v)).join(", ");
}

// mesma ideia do brief de item, mas agregando o conjunto atual (respeita
// filtro de tag/busca) num resumo de tendência — ver PRODUCT.md, "observatório
// pessoal de tendências e padrões de UI"
export function buildBoardBrief(items: Item[], scopeLabel?: string): string {
  if (items.length === 0) return "Nenhuma referência nesse filtro.";

  const categories = topCounts(
    items.map((i) => i.category).filter((c): c is string => Boolean(c)),
    6,
  );
  const styles = topCounts(items.flatMap((i) => i.style), 8);
  const colors = topCounts(
    items.map((i) => i.color).filter((c): c is string => Boolean(c)),
    6,
  );
  const tech = topCounts(items.flatMap((i) => i.tech), 6);
  const tags = topCounts(items.flatMap((i) => i.tags), 12);

  const lines: string[] = [
    `Board de referências: ${items.length} ite${items.length === 1 ? "m" : "ns"}${scopeLabel ? ` (${scopeLabel})` : ""}`,
    "",
  ];
  if (categories.length > 0) lines.push(`Categorias predominantes: ${formatCounts(categories)}`);
  if (styles.length > 0) lines.push(`Estilos recorrentes: ${formatCounts(styles)}`);
  if (colors.length > 0) lines.push(`Paletas recorrentes: ${formatCounts(colors)}`);
  if (tech.length > 0) lines.push(`Stack observada: ${formatCounts(tech)}`);
  if (tags.length > 0) lines.push(`Tags mais frequentes: ${formatCounts(tags)}`);

  lines.push("");
  lines.push("Use os estilos e paletas recorrentes acima como direção visual de tom pro projeto.");

  return lines.join("\n");
}
