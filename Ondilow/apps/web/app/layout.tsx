import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ondilow",
  description: "Analise pessoal de treino - corrida, ciclismo e natacao",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800;900&display=swap"
        />
      </head>
      <body className="min-h-screen bg-brand-bg text-brand-text antialiased">{children}</body>
    </html>
  );
}
