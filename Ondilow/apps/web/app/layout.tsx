import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ondilow",
  description: "Analise pessoal de treino - corrida, ciclismo e natacao",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-brand-bg text-brand-text antialiased">{children}</body>
    </html>
  );
}
