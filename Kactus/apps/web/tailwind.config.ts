import type { Config } from "tailwindcss";

/**
 * Design system Kactus — tokens centralizados.
 * Os mesmos valores existem como variaveis CSS em app/globals.css (--od-*)
 * e como constantes JS em lib/theme.ts (para SVG/Recharts). Ao mudar um,
 * mude os tres.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0A0A0A",
          surface: "#111111",
          surfaceElevated: "#161616",
          surfaceGlass: "rgba(17,17,17,0.72)",
          border: "#1E1E1E",
          borderStrong: "#2A2A2A",
          text: "#FFFFFF",
          textSecondary: "#B8B8B8",
          muted: "#888888",
          textTertiary: "#7C7C7C",
          accent: "#00FF66",
          accentHover: "#C6FF00",
          accentSoft: "rgba(0,255,102,0.08)",
          accentGlow: "rgba(0,255,102,0.35)",
          lime: "#C6FF00",
          info: "#00BFFF",
          warning: "#FFC145",
          success: "#00FF66",
          danger: "#F85149",
        },
        kactus: {
          bg: "#0A0A0A",
          surface: "#111111",
          border: "#1e1e1e",
          border2: "#2a2a2a",
          green: "#00FF66",
          lime: "#C6FF00",
          muted: "#888888",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Poppins", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "metric-xl": ["2.75rem", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "800" }],
        "metric-lg": ["1.75rem", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "700" }],
        "metric-md": ["1.25rem", { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "700" }],
        label: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.16em", fontWeight: "700" }],
      },
      borderRadius: {
        card: "20px",
        tile: "14px",
      },
      boxShadow: {
        card: "inset 0 1px 0 0 rgba(255,255,255,0.04), 0 24px 48px -32px rgba(0,0,0,0.9)",
        glow: "0 0 0 1px rgba(0,255,102,0.28), 0 0 28px -6px rgba(0,255,102,0.45)",
        "glow-sm": "0 0 16px -4px rgba(0,255,102,0.55)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "od-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(0,255,102,0.55)" },
          "70%": { boxShadow: "0 0 0 7px rgba(0,255,102,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(0,255,102,0)" },
        },
        "od-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "od-fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "od-scan": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "od-breathe": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        "od-dash": {
          "0%": { strokeDashoffset: "600" },
          "100%": { strokeDashoffset: "0" },
        },
      },
      animation: {
        "od-pulse": "od-pulse 2.2s cubic-bezier(0.4,0,0.6,1) infinite",
        "od-shimmer": "od-shimmer 1.8s linear infinite",
        "od-fade-up": "od-fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both",
        "od-scan": "od-scan 2.8s ease-in-out infinite",
        "od-breathe": "od-breathe 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
