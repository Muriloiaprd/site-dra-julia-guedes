import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokens de marca Ondilow - placeholders neutros ate as imagens finais chegarem.
        brand: {
          bg: "#0A0A0A",
          surface: "#111111",
          border: "#1e1e1e",
          text: "#FFFFFF",
          muted: "#888888",
          accent: "#00FF66",
          accentHover: "#C6FF00",
          success: "#00FF66",
          danger: "#f85149",
        },
        ondilow: {
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
      },
    },
  },
  plugins: [],
};

export default config;
