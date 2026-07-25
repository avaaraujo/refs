export type ScreenshotResult = {
  bytes: Buffer;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
};

export async function captureScreenshot(url: string): Promise<ScreenshotResult> {
  const shotUrl = `https://image.thum.io/get/width/1400/crop/900/noanimate/${url}`;
  const res = await fetch(shotUrl);
  if (!res.ok) {
    throw new Error(`Falha ao capturar screenshot (${res.status})`);
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

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
