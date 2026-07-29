import sharp from "sharp";

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;
}

// extrai as cores dominantes reais do print (não a descrição textual da IA,
// ver lib/colorSwatch.ts que só aproxima "Cream & Orange" -> hex por
// palavra-chave). Reduz a imagem a uma amostra pequena, agrupa pixels em
// buckets grosseiros de RGB e devolve a média de cada bucket mais frequente
// — uma quantização simples, não k-means, mas suficiente pra "cores
// dominantes" de um swatch.
export async function extractPalette(imageBytes: Buffer, count = 5): Promise<string[]> {
  const { data, info } = await sharp(imageBytes)
    .resize(100, 100, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const step = 24;
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i + channels <= data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.round(r / step)},${Math.round(g / step)},${Math.round(b / step)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, count)
    .map((b) => rgbToHex(Math.round(b.r / b.count), Math.round(b.g / b.count), Math.round(b.b / b.count)));
}
