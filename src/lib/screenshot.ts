import sharp from "sharp";

export type ScreenshotResult = {
  bytes: Buffer;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
};

/** Segundos de espera antes do print — cobre animação de entrada da maioria dos sites. */
export const DEFAULT_CAPTURE_DELAY = 3;
export const MAX_CAPTURE_DELAY = 15;

const SPREAD_WIDTH = 1400;
const SPREAD_HEIGHT = 900;
// frações da altura total (já descontada a altura do próprio recorte) onde
// cada um dos 4 prints começa: hero, ~1/3, ~2/3, e o mais perto possível do
// rodapé — sempre cobre a página inteira disponível, não importa a altura
const SPREAD_FRACTIONS = [0, 1 / 3, 2 / 3, 1];

export async function captureScreenshot(
  url: string,
  opts: { delay?: number; fullPage?: boolean } = {},
): Promise<ScreenshotResult> {
  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
  if (!accessKey) {
    throw new Error("SCREENSHOTONE_ACCESS_KEY não configurada.");
  }

  const delay = Math.min(
    Math.max(Math.round(opts.delay ?? DEFAULT_CAPTURE_DELAY), 0),
    MAX_CAPTURE_DELAY,
  );

  const params = new URLSearchParams({
    access_key: accessKey,
    url,
    viewport_width: String(SPREAD_WIDTH),
    viewport_height: String(SPREAD_HEIGHT),
    format: "jpg",
    image_quality: "85",
    // espera a rede sossegar e ainda dá um tempo pra animação de entrada terminar
    wait_until: "networkidle2",
    delay: String(delay),
    // overlays que estragam print de referência visual
    block_cookie_banners: "true",
    block_ads: "true",
    block_chats: "true",
    // a imagem é guardada no nosso storage; cache do provedor só atrapalha recaptura
    cache: "false",
  });
  if (opts.fullPage) {
    params.set("full_page", "true");
    // full-page (scroll + stitch) demora bem mais que um viewport só —
    // sites com animação/lazy-load pesados batem no timeout padrão
    params.set("timeout", "60");
    params.set("full_page_scroll_delay", "300");
  }

  const res = await fetch(`https://api.screenshotone.com/take?${params}`);
  if (!res.ok) {
    console.error("screenshotone failed", await readError(res));
    throw new Error(
      "Não consegui capturar o print desse site automaticamente (ele pode estar bloqueando bots). Envie um print manualmente.",
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const mediaType: ScreenshotResult["mediaType"] = contentType.includes("png")
    ? "image/png"
    : contentType.includes("webp")
      ? "image/webp"
      : "image/jpeg";
  const arrayBuffer = await res.arrayBuffer();
  return { bytes: Buffer.from(arrayBuffer), mediaType };
}

// 4 prints espalhados pela página (hero, ~1/3, ~2/3, perto do rodapé) em vez
// de só o hero — uma única captura full-page + recorte local com sharp, pra
// não gastar 4 chamadas de API nem 4 cargas de página (mais rápido e mais
// barato). O primeiro recorte (índice 0, sempre o hero) é quem vira a capa
// do item; os outros 3 viram prints adicionais (ver lib/itemImages.ts).
export async function captureSpreadScreenshots(
  url: string,
  opts: { delay?: number } = {},
): Promise<ScreenshotResult[]> {
  let full: ScreenshotResult;
  try {
    full = await captureScreenshot(url, { ...opts, fullPage: true });
  } catch (e) {
    // sites com animação/scroll pesado às vezes nunca "sossegam" o
    // suficiente pro full-page terminar dentro do timeout — cai pro print
    // de viewport só (comportamento de antes dessa feature) em vez de falhar
    // a recaptura inteira por causa dos prints extras
    console.error("full-page capture failed, falling back to single shot", e);
    const single = await captureScreenshot(url, opts);
    return [single];
  }
  const meta = await sharp(full.bytes).metadata();
  const width = meta.width ?? SPREAD_WIDTH;
  const height = meta.height ?? SPREAD_HEIGHT;
  const cropHeight = Math.min(SPREAD_HEIGHT, height);
  const scrollRange = height - cropHeight;

  // página curta (sem altura real pra espalhar os recortes): os 4 sairiam
  // quase idênticos, então devolve só o hero
  if (scrollRange < cropHeight * 0.15) {
    const bytes = await sharp(full.bytes).extract({ left: 0, top: 0, width, height: cropHeight }).toBuffer();
    return [{ bytes, mediaType: full.mediaType }];
  }

  const shots: ScreenshotResult[] = [];
  for (const fraction of SPREAD_FRACTIONS) {
    const top = Math.round(fraction * scrollRange);
    const bytes = await sharp(full.bytes).extract({ left: 0, top, width, height: cropHeight }).toBuffer();
    shots.push({ bytes, mediaType: full.mediaType });
  }
  return shots;
}

/** ScreenshotOne devolve o motivo real do erro em JSON; cai pro status se não vier. */
async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error_message || body?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
