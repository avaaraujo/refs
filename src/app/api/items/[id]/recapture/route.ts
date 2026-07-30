import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { tagImage } from "@/lib/tagging";
import { captureSpreadScreenshots, DEFAULT_CAPTURE_DELAY } from "@/lib/screenshot";
import { getAuthedUser } from "@/lib/supabase/server";
import { embedItem, isEmbeddingConfigured } from "@/lib/embeddings";
import { ITEM_COLUMNS } from "@/lib/types";
import { attachCollectionIdsToOne } from "@/lib/collections";
import { attachImagesToOne, addItemImage } from "@/lib/itemImages";
import { extractPalette } from "@/lib/palette";

// captura full-page (com delay) + tagging por IA passam bem dos 10s padrão
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthedUser())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const delay = Number.isFinite(body?.delay) ? Number(body.delay) : DEFAULT_CAPTURE_DELAY;

  const supabase = createAdminClient();

  const { data: item, error: fetchError } = await supabase
    .from("items")
    .select("url, image_path")
    .eq("id", id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 404 });
  }
  if (!item.url) {
    return NextResponse.json(
      { error: "Esta referência veio de um print enviado à mão, não tem link para recapturar." },
      { status: 400 },
    );
  }

  let bytes: Buffer;
  let mediaType: "image/jpeg" | "image/png" | "image/webp";
  let extraShots: { bytes: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp" }[] = [];
  try {
    const [hero, ...rest] = await captureSpreadScreenshots(item.url, { delay });
    bytes = hero.bytes;
    mediaType = hero.mediaType;
    extraShots = rest;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao capturar screenshot." },
      { status: 400 },
    );
  }

  // caminho novo em vez de sobrescrever: a URL pública muda e nem browser nem CDN
  // servem a imagem antiga em cache
  const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
  const newPath = `${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("refs")
    .upload(newPath, bytes, { contentType: mediaType, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // o print antigo estava errado, então o tagging derivado dele também estava.
  // notes é escrito à mão pelo dono — fica intacto.
  const update: Record<string, unknown> = { image_path: newPath };
  try {
    update.palette = await extractPalette(bytes);
  } catch (e) {
    console.error("palette extraction failed", e);
  }
  try {
    const tagging = await tagImage({
      imageBase64: bytes.toString("base64"),
      mediaType,
      urlHint: item.url,
    });
    update.title = tagging.title;
    update.description = tagging.description;
    update.category = tagging.category || null;
    update.style = tagging.style;
    update.color = tagging.color || null;
    update.tags = tagging.tags;
    update.recipe_tags = tagging.recipeTags;
    update.site_recipe = tagging.siteRecipe || null;

    if (isEmbeddingConfigured()) {
      try {
        update.embedding = await embedItem({
          title: tagging.title,
          description: tagging.description,
          category: tagging.category || null,
          style: tagging.style,
          color: tagging.color || null,
          tags: tagging.tags,
          recipe_tags: tagging.recipeTags,
        });
      } catch (e) {
        console.error("embedding failed", e);
      }
    }
  } catch (e) {
    console.error("re-tagging failed", e);
  }

  const { data, error: updateError } = await supabase
    .from("items")
    .update(update)
    .eq("id", id)
    .select(ITEM_COLUMNS)
    .single();

  if (updateError) {
    // não deixa o upload novo órfão no storage
    await supabase.storage.from("refs").remove([newPath]);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // só agora o print antigo é descartável; falhar aqui não invalida a recaptura
  await supabase.storage.from("refs").remove([item.image_path]);

  // troca os prints adicionais pelos novos recortes espalhados — os antigos
  // vieram da página como ela estava antes, não fazem mais sentido junto de
  // uma capa recapturada. Busca de novo (em vez de reusar uma leitura feita
  // antes da captura, que pode levar dezenas de segundos) pra evitar duplicar
  // prints se um backfill em lote tiver adicionado algo nesse meio-tempo.
  // Falhar aqui também não invalida a recaptura da capa.
  const { data: oldExtraImages } = await supabase.from("item_images").select("id, image_path").eq("item_id", id);
  if (oldExtraImages && oldExtraImages.length > 0) {
    await supabase.from("item_images").delete().eq("item_id", id);
    await supabase.storage.from("refs").remove(oldExtraImages.map((img) => img.image_path));
  }
  for (const shot of extraShots) {
    try {
      const extraExt = shot.mediaType === "image/png" ? "png" : shot.mediaType === "image/webp" ? "webp" : "jpg";
      const extraPath = `${randomUUID()}.${extraExt}`;
      const { error: extraUploadError } = await supabase.storage
        .from("refs")
        .upload(extraPath, shot.bytes, { contentType: shot.mediaType, upsert: false });
      if (extraUploadError) throw new Error(extraUploadError.message);
      await addItemImage(supabase, id, extraPath);
    } catch (e) {
      console.error("extra screenshot upload failed", e);
    }
  }

  return NextResponse.json({ item: await attachImagesToOne(supabase, await attachCollectionIdsToOne(supabase, data)) });
}
