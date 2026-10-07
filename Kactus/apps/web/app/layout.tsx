import type { Metadata, Viewport } from "next";
import { RegistrarSW } from "@/components/RegistrarSW";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kactus",
  description: "Analise pessoal de treino - corrida, ciclismo e natacao",
  applicationName: "Kactus",
  // iPhone: "Adicionar à Tela de Início" abre em tela cheia, conteudo por baixo da barra de status
  appleWebApp: { capable: true, title: "Kactus", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  // Libera env(safe-area-inset-*) para respeitar entalhe e barra inferior do iPhone
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Fontes vem de public/fonts, declaradas em globals.css */}
        <link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="stylesheet" href="/landing.css" />
      </head>
      <body className="min-h-screen bg-brand-bg text-brand-text antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
