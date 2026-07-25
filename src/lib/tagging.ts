import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type TaggingResult = {
  title: string;
  description: string;
  category: string;
  style: string[];
  color: string;
  tags: string[];
};

const SYSTEM_PROMPT = `Você analisa prints de design (sites, apps, produtos digitais) para uma biblioteca de referências visuais.
Dado um print, responda em JSON puro (sem markdown, sem comentários) com este formato exato:
{
  "title": "nome curto e descritivo (max 6 palavras)",
  "description": "1 frase objetiva sobre o que é a referência",
  "category": "uma categoria curta (ex: Landing Page, Dashboard, Mobile App, Onboarding, Pricing, E-commerce, Portfolio)",
  "style": ["2 a 4 adjetivos de estilo visual, capitalizados, ex: Minimal, Editorial, Brutalist, Glassmorphism, Dark Mode"],
  "color": "descrição curta da paleta dominante, capitalizada, ex: Black & White, Pastel, High Contrast, Monochrome Green",
  "tags": ["5 a 10 tags curtas em inglês, minúsculas, sem espaços (hífen se precisar), cobrindo categoria, estilo, cor, tipografia e padrões de UI notáveis"]
}

Responda só o JSON.`;

export async function tagImage(params: {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  urlHint?: string;
}): Promise<TaggingResult> {
  const { imageBase64, mediaType, urlHint } = params;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: urlHint
              ? `Contexto: este print veio de ${urlHint}`
              : "Analise este print e gere o JSON pedido.",
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return {
      title: String(parsed.title ?? "Sem título"),
      description: String(parsed.description ?? ""),
      category: String(parsed.category ?? ""),
      style: Array.isArray(parsed.style) ? parsed.style.map(String) : [],
      color: String(parsed.color ?? ""),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    };
  } catch {
    return { title: "Sem título", description: "", category: "", style: [], color: "", tags: [] };
  }
}
