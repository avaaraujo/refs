import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { tagImage } from "@/lib/tagging";
import { captureScreenshot, extractDomain } from "@/lib/screenshot";
import { detectTech } from "@/lib/techDetect";
import { normalizeUrl } from "@/lib/normalizeUrl";
import { getAuthedUser } from "@/lib/supabase/server";
import { embedItem, isEmbeddingConfigured } from "@/lib/embeddings";
import { ITEM_COLUMNS } from "@/lib/types";
import { attachCollectionIds, attachCollectionIdsToOne, itemIdsInCollection } from "@/lib/collections";
import { extractPalette } from "@/lib/palette";

export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get("tag");
  const q = req.nextUrl.searchParams.get("q");
  const category = req.nextUrl.searchParams.get("category");
  const style = req.nextUrl.searchParams.get("style");
  const color = req.nextUrl.searchParams.get("color");
  const collectionId = req.nextUrl.searchParams.get("collection_id");
  const supabase = createAdminClient();

  // teto de segurança: sem isso, a query cresce sem limite conforme a
  // biblioteca acumula referências (uso pretendido do produto)
  let query = supabase
    .from("items")
    .select(ITEM_COLUMNS)
    .order("created_at", { ascending: false })
    .range(0, 499);
  if (tag) query = query.contains("tags", [tag]);
  if (category) query = query.eq("category", category);
  if (style) query = query.contains("style", [style]);
  if (color) query = query.eq("color", color);
  if (collectionId) {
    const ids = await itemIdsInCollection(supabase, collectionId);
    query = query.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: await attachCollectionIds(supabase, data ?? []) });
}

export async function POST(req: NextRequest) {
  if (!(await getAuthedUser())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const rawUrl = (formData.get("url") as string | null)?.trim() || null;
  const url = rawUrl ? normalizeUrl(rawUrl) : null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!file && !url) {
    return NextResponse.json({ error: "Envie um print ou um link." }, { status: 400 });
  }

  let bytes: Buffer;
  let mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg";

  try {
    if (file) {
      bytes = Buffer.from(await file.arrayBuffer());
      if (file.type === "image/png") mediaType = "image/png";
      else if (file.type === "image/webp") mediaType = "image/webp";
    } else {
      const shot = await captureScreenshot(url!);
      bytes = shot.bytes;
      mediaType = shot.mediaType;
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao processar imagem." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
  const path = `${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("refs")
    .upload(path, bytes, { contentType: mediaType, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  let tagging = {
    title: "Sem título",
    description: "",
    category: "",
    style: [] as string[],
    color: "",
    tags: [] as string[],
    recipeTags: [] as string[],
    siteRecipe: "",
  };
  try {
    tagging = await tagImage({
      imageBase64: bytes.toString("base64"),
      mediaType,
      urlHint: url ?? undefined,
    });
  } catch (e) {
    console.error("tagging failed", e);
  }

  const tech = url ? await detectTech(url) : [];

  let palette: string[] = [];
  try {
    palette = await extractPalette(bytes);
  } catch (e) {
    console.error("palette extraction failed", e);
  }

  let embedding: number[] | null = null;
  if (isEmbeddingConfigured()) {
    try {
      embedding = await embedItem({
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

  const { data, error: insertError } = await supabase
    .from("items")
    .insert({
      url,
      source_domain: url ? extractDomain(url) : null,
      image_path: path,
      title: tagging.title,
      description: tagging.description,
      category: tagging.category || null,
      style: tagging.style,
      color: tagging.color || null,
      palette,
      tech,
      tags: tagging.tags,
      recipe_tags: tagging.recipeTags,
      site_recipe: tagging.siteRecipe || null,
      notes,
      embedding,
    })
    .select(ITEM_COLUMNS)
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ item: await attachCollectionIdsToOne(supabase, data) }, { status: 201 });
}
