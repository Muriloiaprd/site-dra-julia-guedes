"use client";

import { useEffect, useRef } from "react";

import type { StoryLayout } from "@/lib/story/types";

export interface ModelGroup {
  id: string;
  title: string;
  hint: string;
  items: StoryLayout[];
}

const ACCENT = "#00FF66";
const CHECKER = { backgroundImage: "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%)", backgroundSize: "10px 10px" };

function Thumb({ src, transparent, label }: { src?: string; transparent: boolean; label: string }) {
  return (
    <div className="absolute inset-0" style={transparent ? CHECKER : { background: "#0A0A0A" }}>
      {src
        ? <img src={src} alt="" aria-hidden className="h-full w-full object-cover" draggable={false} />
        : <div className="od-skeleton absolute inset-0 !rounded-none" aria-label={`Carregando ${label}`} />}
    </div>
  );
}

/**
 * Trilho de miniaturas abaixo da prévia: rola na horizontal sem barra aparente,
 * esmaece nas bordas e separa os grupos com um fio. O escolhido vem para o centro.
 */
export function ModelRail({ groups, selectedId, thumbs, transparent, onSelect, disabled }: {
  groups: ModelGroup[];
  selectedId: string;
  thumbs: Record<string, string>;
  transparent: boolean;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    // "nearest" no eixo vertical: so o trilho rola, o painel do modal fica onde esta
    refs.current[selectedId]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <div
      // shrink-0: no painel (coluna flex com altura maxima) um bloco rolavel encolhia e cortava o anel do escolhido
      className="od-no-scrollbar -mx-1 mt-3 flex shrink-0 items-center gap-2 overflow-x-auto px-6 py-2"
      style={{ maskImage: "linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent)" }}
      role="listbox"
      aria-label="Modelos"
      aria-orientation="horizontal"
    >
      {groups.map((g, gi) => (
        <div key={g.id} className="flex shrink-0 items-center gap-2">
          {gi > 0 && <span className="mx-1 h-16 w-px shrink-0 bg-white/10" aria-hidden />}
          {g.items.map((l) => {
            const on = l.id === selectedId;
            return (
              <button
                key={l.id}
                ref={(el) => { refs.current[l.id] = el; }}
                onClick={() => onSelect(l.id)}
                disabled={disabled}
                role="option"
                aria-selected={on}
                aria-label={l.label}
                title={l.label}
                className="relative w-[54px] shrink-0 overflow-hidden rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
                style={{
                  aspectRatio: "9 / 16",
                  opacity: on ? 1 : 0.62,
                  transform: on ? "scale(1.08)" : undefined,
                  boxShadow: on ? `0 0 0 2px ${ACCENT}, 0 6px 18px rgba(0,255,102,0.25)` : "inset 0 0 0 1px rgba(255,255,255,0.1)",
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.opacity = "0.62"; }}
              >
                <Thumb src={thumbs[l.id]} transparent={transparent} label={l.label} />
                {l.animated && (
                  <span className="absolute bottom-0.5 right-0.5 rounded px-0.5 text-[0.55rem] leading-tight" style={{ background: "rgba(0,0,0,0.65)" }} aria-hidden>🎬</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Galeria com todos os modelos em grade, por grupo, para escolher vendo tudo de uma vez. */
export function ModelGrid({ groups, selectedId, thumbs, transparent, onSelect }: {
  groups: ModelGroup[];
  selectedId: string;
  thumbs: Record<string, string>;
  transparent: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-6 pb-1">
      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`grupo-${g.id}`}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h4 id={`grupo-${g.id}`} className="font-display text-sm font-extrabold">{g.title}</h4>
            <span className="text-[0.7rem] text-brand-muted">{g.hint}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {g.items.map((l) => {
              const on = l.id === selectedId;
              return (
                <button key={l.id} onClick={() => onSelect(l.id)} aria-pressed={on} className="group text-left">
                  <div
                    className="relative overflow-hidden rounded-xl transition-transform duration-200 group-hover:-translate-y-0.5"
                    style={{
                      aspectRatio: "9 / 16",
                      boxShadow: on ? `0 0 0 2px ${ACCENT}, 0 10px 28px rgba(0,255,102,0.22)` : "inset 0 0 0 1px rgba(255,255,255,0.08)",
                    }}
                  >
                    <Thumb src={thumbs[l.id]} transparent={transparent} label={l.label} />
                    <div className="absolute left-1.5 top-1.5 flex gap-1">
                      {l.animated && <span className="rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold" style={{ background: "rgba(0,0,0,0.7)" }}>🎬 vídeo</span>}
                      {l.isNew && !l.animated && <span className="rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-black" style={{ background: ACCENT }}>novo</span>}
                    </div>
                    {on && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-black text-black" style={{ background: ACCENT }} aria-hidden>✓</span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-[0.72rem] font-semibold" style={on ? { color: ACCENT } : undefined}>{l.label}</p>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
