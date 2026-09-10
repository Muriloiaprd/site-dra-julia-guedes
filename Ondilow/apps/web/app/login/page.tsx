"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Logo } from "@/components/Logo";
import { login, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Speed lines animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    const lines: { x: number; y: number; w: number; speed: number; opacity: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 18; i++) {
      lines.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        w: 80 + Math.random() * 200,
        speed: 2 + Math.random() * 3,
        opacity: 0.06 + Math.random() * 0.12,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      lines.forEach((l) => {
        const grad = ctx.createLinearGradient(l.x, 0, l.x + l.w, 0);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.5, `rgba(0,255,102,${l.opacity})`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(l.x, l.y, l.w, 1);
        l.x += l.speed;
        if (l.x > window.innerWidth + 50) l.x = -l.w;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await login(email, password);
      setToken(token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{ background: "#0A0A0A" }}
      className="relative flex min-h-screen items-center justify-center px-4"
    >
      {/* speed lines canvas */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0" />

      {/* radial glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 55% at 50% 50%, rgba(0,255,102,0.055) 0%, transparent 70%)",
        }}
      />

      {/* card */}
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "rgba(17,17,17,0.9)",
          border: "1px solid rgba(0,255,102,0.18)",
          boxShadow: "0 0 60px rgba(0,255,102,0.07), 0 24px 48px rgba(0,0,0,0.6)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* top border glow */}
        <div
          className="absolute left-0 right-0 top-0 h-px rounded-t-2xl"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(0,255,102,0.5), transparent)",
          }}
        />

        {/* logo */}
        <div className="mb-8 flex justify-center">
          <Logo size={40} />
        </div>

        {/* heading */}
        <h1
          className="mb-1 text-center text-2xl font-black tracking-tight"
          style={{ fontFamily: "'Poppins', sans-serif", color: "#fff" }}
        >
          Bem-vindo de volta
        </h1>
        <p className="mb-7 text-center text-sm" style={{ color: "#888" }}>
          Entre para continuar sua evolução
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* email */}
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#888" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: "#0A0A0A",
                border: "1px solid #2a2a2a",
                color: "#fff",
              }}
              onFocus={(e) => {
                e.target.style.border = "1px solid rgba(0,255,102,0.5)";
                e.target.style.boxShadow = "0 0 0 3px rgba(0,255,102,0.08)";
              }}
              onBlur={(e) => {
                e.target.style.border = "1px solid #2a2a2a";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          {/* password */}
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#888" }}
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: "#0A0A0A",
                border: "1px solid #2a2a2a",
                color: "#fff",
              }}
              onFocus={(e) => {
                e.target.style.border = "1px solid rgba(0,255,102,0.5)";
                e.target.style.boxShadow = "0 0 0 3px rgba(0,255,102,0.08)";
              }}
              onBlur={(e) => {
                e.target.style.border = "1px solid #2a2a2a";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          {/* error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(248,81,73,0.08)",
                border: "1px solid rgba(248,81,73,0.2)",
                color: "#ff9999",
              }}
            >
              ⚠ {error}
            </div>
          )}

          {/* submit */}
          <button
            type="submit"
            disabled={loading}
            className="group relative mt-2 w-full overflow-hidden rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50"
            style={{
              fontFamily: "'Poppins', sans-serif",
              background: "linear-gradient(90deg, #00FF66, #C6FF00)",
              color: "#000",
              letterSpacing: "0.04em",
            }}
            onMouseEnter={(e) => {
              if (!loading)
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 0 24px rgba(0,255,102,0.4), 0 0 60px rgba(0,255,102,0.15)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="rgba(0,0,0,0.3)" strokeWidth="2"/>
                  <path d="M7 2 A5 5 0 0 1 12 7" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Entrando...
              </span>
            ) : (
              "Entrar na Plataforma"
            )}
          </button>
        </form>

        {/* footer */}
        <p className="mt-6 text-center text-xs" style={{ color: "#444" }}>
          Ondilow · Corrida Sem Limites
        </p>
      </div>

    </main>
  );
}
