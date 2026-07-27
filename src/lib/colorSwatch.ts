// aproxima a paleta textual gerada pela IA (ex: "Cream & Orange") pra hex,
// só pra render de swatches — não é a cor real extraída do print
const COLOR_MAP: Record<string, string> = {
  black: "#0a0a0a",
  white: "#ffffff",
  gray: "#8a8a8a",
  grey: "#8a8a8a",
  charcoal: "#333333",
  cream: "#f2ecd8",
  ivory: "#fffff0",
  beige: "#e8ddc7",
  tan: "#d2b48c",
  sand: "#dcc7a1",
  brown: "#6b4a2f",
  orange: "#e8641c",
  rust: "#b5511e",
  red: "#c0392b",
  maroon: "#6d1f1f",
  coral: "#f08a6c",
  pink: "#f2a6c4",
  magenta: "#c2278c",
  purple: "#7d4fae",
  violet: "#8f5fd6",
  lavender: "#c9b8f0",
  indigo: "#4b3f9e",
  blue: "#2b5fc0",
  navy: "#1b2a4a",
  teal: "#1f8a8a",
  cyan: "#3fc6d6",
  turquoise: "#3fd6c6",
  green: "#3f8f4f",
  lime: "#88bd26",
  olive: "#7a7a3f",
  mint: "#9fe0c0",
  yellow: "#e8d23f",
  gold: "#c9a227",
  silver: "#c4c4c4",
  dark: "#1a1a1a",
  light: "#f4f2ec",
};

export function colorSwatches(colorText: string | null, max = 3): string[] {
  if (!colorText) return [];
  const words = colorText.toLowerCase().match(/[a-zà-ú]+/g) ?? [];
  const hexes: string[] = [];
  for (const w of words) {
    const hex = COLOR_MAP[w];
    if (hex && !hexes.includes(hex)) hexes.push(hex);
    if (hexes.length === max) break;
  }
  return hexes;
}
