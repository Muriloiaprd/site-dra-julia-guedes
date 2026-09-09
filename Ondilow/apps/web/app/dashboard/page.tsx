"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/Logo";
import { clearToken, fetchMe } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe().then((user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setEmail(user.email);
      setLoading(false);
    });
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-brand-muted">Carregando...</main>;
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b border-brand-border px-6 py-4">
        <Logo />
        <div className="flex items-center gap-4 text-sm">
          <span className="text-brand-muted">{email}</span>
          <button onClick={handleLogout} className="text-brand-accent hover:underline">
            Sair
          </button>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-brand-muted">
          Setup concluido. As atividades, metricas e graficos chegam nos proximos sprints.
        </p>
      </section>
    </main>
  );
}
