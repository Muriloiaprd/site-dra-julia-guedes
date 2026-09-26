"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StatusDot } from "@/components/ui/primitives";
import { relativeDay } from "@/lib/utils";

export interface HeaderAlert {
  id: string;
  tone: "accent" | "warning" | "danger";
  title: string;
  detail?: string;
  href?: string;
}

const TONE_COLOR = { accent: "#00FF66", warning: "#FFC145", danger: "#F85149" } as const;

export function DashboardHeader({
  name, avatarUrl, syncState, lastActivityIso, alerts,
}: {
  name: string;
  avatarUrl: string | null;
  syncState: "loading" | "ok" | "error";
  lastActivityIso: string | null;
  alerts: HeaderAlert[];
}) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const sync = syncState === "loading"
    ? { color: "#FFC145", text: "Sincronizando dados…", pulse: true }
    : syncState === "error"
      ? { color: "#F85149", text: "Falha na sincronização", pulse: false }
      : { color: "#00FF66", text: `Dados sincronizados${lastActivityIso ? ` · última atividade ${relativeDay(lastActivityIso)}` : ""}`, pulse: true };

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const urgent = alerts.some((a) => a.tone !== "accent");

  return (
    <header className="relative z-20 mb-6 flex flex-col gap-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[0.7rem] font-medium text-brand-textSecondary" style={{ background: "rgba(255,255,255,0.03)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
          <StatusDot color={sync.color} pulse={sync.pulse} size={6} />
          <span className="truncate">{sync.text}</span>
        </div>
        <h1 className="font-display text-[1.9rem] font-extrabold leading-none tracking-tight sm:text-[2.35rem]">
          Olá, {name} <span className="inline-block align-middle text-[0.8em]" style={{ filter: "drop-shadow(0 0 12px rgba(255,220,0,0.45))" }}>⚡</span>
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          Disciplina hoje. <span className="text-brand-textSecondary">Resultados amanhã.</span>
          <span className="ml-2 hidden capitalize text-brand-textTertiary sm:inline">· {today}</span>
        </p>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        <div className="relative" ref={popRef}>
          <button
            type="button"
            className="od-icon-btn"
            aria-label={`Alertas${alerts.length ? ` (${alerts.length})` : ""}`}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {alerts.length > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[0.6rem] font-bold text-black"
                style={{ background: urgent ? "#FFC145" : "#00FF66", boxShadow: `0 0 10px ${urgent ? "rgba(255,193,69,0.6)" : "rgba(0,255,102,0.6)"}` }}
              >
                {alerts.length}
              </span>
            )}
          </button>
          {open && (
            <div className="od-panel od-panel-glass absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] animate-od-fade-up !p-2" role="dialog" aria-label="Alertas">
              <div className="od-label od-label-plain px-2.5 pb-2 pt-1.5">Alertas do sistema</div>
              {alerts.length === 0 ? (
                <p className="px-2.5 pb-3 text-sm text-brand-muted">Tudo em ordem. Nenhum alerta no momento.</p>
              ) : (
                <ul className="space-y-1">
                  {alerts.map((a) => {
                    const body = (
                      <div className="flex gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.04]">
                        <span className="mt-1.5"><StatusDot color={TONE_COLOR[a.tone]} size={7} /></span>
                        <div className="min-w-0">
                          <p className="text-[0.82rem] font-semibold text-white">{a.title}</p>
                          {a.detail && <p className="mt-0.5 text-xs text-brand-muted">{a.detail}</p>}
                        </div>
                      </div>
                    );
                    return <li key={a.id}>{a.href ? <Link href={a.href} onClick={() => setOpen(false)}>{body}</Link> : body}</li>;
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <Link href="/profile" className="od-icon-btn" aria-label="Configurações do perfil">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>

        <Link href="/profile" className="ml-1 hidden md:block" aria-label="Perfil">
          <div
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full transition-shadow duration-200 hover:shadow-glow"
            style={{ background: avatarUrl ? "#111" : "linear-gradient(135deg, #00FF66, #C6FF00)", boxShadow: "0 0 0 2px #0A0A0A, 0 0 0 3px rgba(0,255,102,0.4)" }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              : <span className="text-sm font-extrabold text-black">{name.charAt(0).toUpperCase()}</span>}
          </div>
        </Link>
      </div>
    </header>
  );
}
