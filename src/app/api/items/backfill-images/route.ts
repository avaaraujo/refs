import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser } from "@/lib/supabase/server";
import { captureSpreadScreenshots } from "@/lib/screenshot";
import { addItemImage } from "@/lib/itemImages";

// backfill dos prints espalhados (ver lib/screenshot.ts) pras refs criadas
// antes dessa feature existir: elas só têm a capa (item_images vazio). Não
// mexe na capa já existente, só busca uma captura full-page nova e sobe os
// recortes 1/3, 2/3 e rodapé como prints adicionais. Roda sequencial e em
// lotes pequenos (captura full-page + até 3 uploads por item é pesado) —
// clicar de novo continua de onde parou, igual o retag-all.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!(await getAuthedUser())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  // cada item pode levar até 60s (timeout da captura full-page, ver
  // lib/screenshot.ts) — lote menor que o do retag-all pra não estourar o
  // maxDuration da function em dias ruins de rede
  const limit = Number.isFinite(body.limit) ? Math.min(Math.max(Number(body.limit), 1), 10) : 5;

  const supabase = createAdminClient();

  const { data: linkRows, error: linkError } = await supabase.from("item_images").select("item_id");
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  const idsWithImages = new Set((linkRows ?? []).map((r) => r.item_id));

  const { data: candidates, error: candidatesError } = await supabase
    .from("items")
    .select("id, url")
    .not("url", "is", null)
    .order("created_at", { ascending: true })
    .range(0, 499);
  if (candidatesError) return NextResponse.json({ error: candidatesError.message }, { status: 500 });

  const missing = (candidates ?? []).filter((item) => !idsWithImages.has(item.id)).slice(0, limit);
  if (missing.length === 0) return NextResponse.json({ processed: 0, failed: 0 });

  let processed = 0;
  let failed = 0;
  const failures: { id: string; error: string }[] = [];

  for (const item of missing) {
    try {
      const shots = await captureSpreadScreenshots(item.url!);
      // página curta: captureSpreadScreenshots já devolveu só 1 recorte, nada
      // pra adicionar além da capa que a ref já tem
      for (const shot of shots.slice(1)) {
        const ext = shot.mediaType === "image/png" ? "png" : shot.mediaType === "image/webp" ? "webp" : "jpg";
        const path = `${randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("refs")
          .upload(path, shot.bytes, { contentType: shot.mediaType, upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        await addItemImage(supabase, item.id, path);
      }
      processed++;
    } catch (e) {
      failed++;
      failures.push({ id: item.id, error: e instanceof Error ? e.message : "erro desconhecido" });
    }
  }

  return NextResponse.json({ processed, failed, failures });
}
