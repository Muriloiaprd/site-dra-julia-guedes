/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite rodar dois `next dev` na mesma pasta sem corromper o cache
  // compartilhado (ex.: NEXT_DIST_DIR=.next-preview). Padrao inalterado.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    const api = process.env.API_URL || "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${api}/:path*` }];
  },
};

export default nextConfig;
