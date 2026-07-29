// distância perceptual entre cores (CIE76 ΔE, em espaço Lab) — usada pra
// busca por cor "próxima" em vez de bater nome de texto ("Black & Silver"
// vs "Black & White" nunca vão casar por string, mas são visualmente
// parecidas o suficiente pra aparecer juntas numa busca por preto).
// ΔE ~1 é imperceptível, ~10 é nitidamente diferente, ~50+ é bem distante.

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  // matriz sRGB D65
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;
  return [x, y, z];
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  // whitepoint D65
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

export function deltaE(labA: [number, number, number], labB: [number, number, number]): number {
  const dl = labA[0] - labB[0];
  const da = labA[1] - labB[1];
  const db = labA[2] - labB[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

// menor distância entre uma cor e QUALQUER swatch da paleta do item — um
// item "casa" com a busca se pelo menos uma das suas cores dominantes for
// próxima o suficiente, não precisa ser a cor mais forte da paleta
export function closestDistance(pickedHex: string, palette: string[]): number {
  if (palette.length === 0) return Infinity;
  const pickedLab = hexToLab(pickedHex);
  return Math.min(...palette.map((hex) => deltaE(pickedLab, hexToLab(hex))));
}
