/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite rodar dois `next dev` na mesma pasta sem corromper o cache
  // compartilhado (ex.: NEXT_DIST_DIR=.next-preview). Padrao inalterado.
  // `next build`/`next start` (NODE_ENV=production) usam .next-prod: o modo
  // rapido do iPhone nunca pisa no cache do `next dev` rodando ao lado.
  distDir: process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === "production" ? ".next-prod" : ".next"),
  experimental: {
    // O proxy do rewrite corta em 30s por padrao. O Gemini free tier leva
    // 30-45s so na fila, entao a Duni caia sempre em timeout. Fica acima do
    // timeout da propria API (180s em coach_service._GEMINI_TIMEOUT_MS).
    proxyTimeout: 240_000,
  },
  // Carga (/metrics) e Previsoes (/predictions) viraram uma aba so, Desempenho.
  async redirects() {
    return [
      { source: "/metrics", destination: "/performance", permanent: false },
      { source: "/predictions", destination: "/performance", permanent: false },
    ];
  },
  async rewrites() {
    const api = process.env.API_URL || "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${api}/:path*` }];
  },
};

export default nextConfig;
