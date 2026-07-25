export type ScreenshotResult = {
  bytes: Buffer;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
};

/** Segundos de espera antes do print — cobre animação de entrada da maioria dos sites. */
export const DEFAULT_CAPTURE_DELAY = 3;
export const MAX_CAPTURE_DELAY = 15;

export async function captureScreenshot(
  url: string,
  opts: { delay?: number } = {},
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
    viewport_width: "1400",
    viewport_height: "900",
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

  const res = await fetch(`https://api.screenshotone.com/take?${params}`);
  if (!res.ok) {
    throw new Error(`Falha ao capturar screenshot: ${await readError(res)}`);
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
