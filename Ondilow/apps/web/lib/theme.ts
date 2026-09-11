/**
 * Tokens do design system em JS — para SVG inline e Recharts, que nao leem
 * classes Tailwind. Espelham tailwind.config.ts e as variaveis --od-* do CSS.
 */
export const C = {
  bg: "#0A0A0A",
  surface: "#111111",
  surfaceElevated: "#161616",
  border: "#1E1E1E",
  borderStrong: "#2A2A2A",
  grid: "rgba(255,255,255,0.05)",
  text: "#FFFFFF",
  textSecondary: "#B8B8B8",
  muted: "#888888",
  textTertiary: "#6E6E6E",
  accent: "#00FF66",
  lime: "#C6FF00",
  info: "#00BFFF",
  warning: "#FFC145",
  danger: "#F85149",
} as const;

/** Verde translucido em diferentes intensidades (fundos, glows). */
export const accentAlpha = (a: number) => `rgba(0,255,102,${a})`;

/** Adiciona alpha (0-1) a uma cor hex #RRGGBB. */
export function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Props padrao de eixo para Recharts — grid discreto, labels legiveis. */
export const axisProps = {
  stroke: "transparent",
  tick: { fill: C.muted, fontSize: 11, fontFamily: "Inter, system-ui, sans-serif" },
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  stroke: C.grid,
  strokeDasharray: "2 6",
  vertical: false,
} as const;

export const FONT_DISPLAY = "'Poppins', Inter, system-ui, sans-serif";
