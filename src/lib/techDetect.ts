type Signature = { label: string; test: (html: string, headers: Headers) => boolean };

const SIGNATURES: Signature[] = [
  { label: "Next.js", test: (h) => h.includes("__NEXT_DATA__") || h.includes("/_next/static") },
  { label: "Nuxt", test: (h) => h.includes("__NUXT__") },
  { label: "React", test: (h) => h.includes("data-reactroot") || h.includes("react-dom") },
  { label: "Vue", test: (h) => h.includes("data-v-app") || /__vue__|vue\.js/.test(h) },
  { label: "Svelte", test: (h) => h.includes("svelte-") },
  { label: "Webflow", test: (h) => h.includes("webflow.js") || h.includes("data-wf-page") },
  { label: "Framer", test: (h) => h.includes("framerusercontent.com") },
  { label: "WordPress", test: (h) => h.includes("wp-content") || h.includes("wp-includes") },
  { label: "Shopify", test: (h) => h.includes("cdn.shopify.com") || h.includes("Shopify.theme") },
  { label: "Tailwind CSS", test: (h) => /class="[^"]*(flex|grid|px-|py-|text-\w+-\d{3})/.test(h) },
  { label: "GSAP", test: (h) => h.includes("gsap.min.js") || h.includes("gsap.js") },
  { label: "Three.js", test: (h) => h.includes("three.min.js") || h.includes("three.module.js") },
  { label: "Lenis", test: (h) => h.toLowerCase().includes("lenis") },
  { label: "Vercel", test: (_h, headers) => (headers.get("server") ?? "").includes("Vercel") || (headers.get("x-vercel-id") ?? "") !== "" },
  { label: "Netlify", test: (_h, headers) => (headers.get("server") ?? "").toLowerCase().includes("netlify") },
  { label: "Cloudflare", test: (_h, headers) => (headers.get("server") ?? "").toLowerCase().includes("cloudflare") },
];

export async function detectTech(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RefsBot/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    const html = await res.text();
    const found = SIGNATURES.filter((sig) => sig.test(html, res.headers)).map((sig) => sig.label);
    return [...new Set(found)];
  } catch {
    return [];
  }
}
