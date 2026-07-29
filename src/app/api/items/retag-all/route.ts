import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser } from "@/lib/supabase/server";
import { tagImage } from "@/lib/tagging";
import { embedItem, isEmbeddingConfigured } from "@/lib/embeddings";
import { extractPalette } from "@/lib/palette";

// re-tagging em lote: reprocessa o acervo existente com o prompt de tagging
// atual (ver lib/tagging.ts) e recomputa o embedding. Útil depois de melhorar
// o SYSTEM_PROMPT ou de introduzir um campo novo (ex: recipe_tags na
// migration_003) — sem isso o acervo antigo fica defasado, já que o tagging
// só roda uma vez, na criação (ver PRODUCT.md, "Capabilities and Constraints").
// Roda sequencial (não em paralelo) de propósito, pra não estourar rate limit
// da Anthropic/Voyage — aceitável pro volume de uma biblioteca pessoal.
export const maxDuration = 120;

function mediaTypeFromPath(path: string): "image/jpeg" | "image/png" | "image/webp" {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function POST(req: NextRequest) {
  if (!(await getAuthedUser())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const scope = body.scope === "all" ? "all" : "missing";
  // teto por chamada: serverless tem limite de duração (maxDuration abaixo),
  // e tagging roda sequencial — pra acervos grandes, clicar de novo continua
  // de onde parou (scope "missing" encolhe a cada rodada)
  const limit = Number.isFinite(body.limit) ? Math.min(Number(body.limit), 40) : 25;

  const supabase = createAdminClient();

  let query = supabase
    .from("items")
    .select("id, image_path, url, title, description, category, style, color, palette, tags, recipe_tags, site_recipe, embedding")
    .order("created_at", { ascending: true })
    .limit(limit);
  // "missing" pega item nunca taggeado com recipe (pré migration_003), sem
  // embedding (pré busca semântica) ou sem palette (pré migration_007) —
  // os três casos têm tratamento independente abaixo
  if (scope === "missing") {
    const conditions = ["recipe_tags.eq.{}", "site_recipe.is.null", "palette.eq.{}"];
    if (isEmbeddingConfigured()) conditions.push("embedding.is.null");
    query = query.or(conditions.join(","));
  }

  const { data: items, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!items || items.length === 0) return NextResponse.json({ processed: 0, failed: 0 });

  let processed = 0;
  let failed = 0;
  const failures: { id: string; error: string }[] = [];

  for (const item of items) {
    try {
      const needsTagging = (item.recipe_tags?.length ?? 0) === 0 || !item.site_recipe;
      const needsPalette = (item.palette?.length ?? 0) === 0;
      const update: Record<string, unknown> = {};
      let embeddingSource = {
        title: item.title,
        description: item.description,
        category: item.category,
        style: item.style ?? [],
        color: item.color,
        tags: item.tags ?? [],
        recipe_tags: item.recipe_tags ?? [],
      };

      if (needsTagging || needsPalette) {
        const { data: file, error: downloadError } = await supabase.storage.from("refs").download(item.image_path);
        if (downloadError || !file) throw new Error(downloadError?.message ?? "download falhou");
        const bytes = Buffer.from(await file.arrayBuffer());

        if (needsPalette) {
          try {
            update.palette = await extractPalette(bytes);
          } catch (e) {
            console.error("palette extraction failed", item.id, e);
          }
        }

        if (needsTagging) {
          const mediaType = mediaTypeFromPath(item.image_path);
          const tagging = await tagImage({
            imageBase64: bytes.toString("base64"),
            mediaType,
            urlHint: item.url ?? undefined,
          });

          update.title = tagging.title;
          update.description = tagging.description;
          update.category = tagging.category || null;
          update.style = tagging.style;
          update.color = tagging.color || null;
          update.tags = tagging.tags;
          update.recipe_tags = tagging.recipeTags;
          update.site_recipe = tagging.siteRecipe || null;
          embeddingSource = {
            title: tagging.title,
            description: tagging.description,
            category: tagging.category || null,
            style: tagging.style,
            color: tagging.color || null,
            tags: tagging.tags,
            recipe_tags: tagging.recipeTags,
          };
        }
      }

      // recomputa embedding sempre que a tag mudou OU quando ele nunca existiu —
      // dispensa re-rodar o tagging (chamada cara de visão) só pra backfillar embedding
      if (isEmbeddingConfigured() && (needsTagging || !item.embedding)) {
        try {
          update.embedding = await embedItem(embeddingSource);
        } catch (e) {
          console.error("embedding failed", item.id, e);
        }
      }

      if (Object.keys(update).length === 0) {
        processed++;
        continue;
      }

      const { error: updateError } = await supabase.from("items").update(update).eq("id", item.id);
      if (updateError) throw new Error(updateError.message);
      processed++;
    } catch (e) {
      failed++;
      failures.push({ id: item.id, error: e instanceof Error ? e.message : "erro desconhecido" });
    }
  }

  return NextResponse.json({ processed, failed, failures });
}
