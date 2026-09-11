"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState, Panel, Skeleton } from "@/components/ui/primitives";
import type { PersonalRecord } from "@/lib/api";
import { formatClock, formatPaceShort, relativeDay, sportLabel } from "@/lib/utils";

const RECORD_META: Record<string, { label: string; km?: number; order: number }> = {
  fastest_1k: { label: "1 KM", km: 1, order: 1 },
  fastest_5k: { label: "5 KM", km: 5, order: 2 },
  fastest_10k: { label: "10 KM", km: 10, order: 3 },
  fastest_21k: { label: "21 KM", km: 21.0975, order: 4 },
  fastest_42k: { label: "42 KM", km: 42.195, order: 5 },
  fastest_100m_swim: { label: "100 M NADO", order: 6 },
  fastest_400m_swim: { label: "400 M NADO", order: 7 },
  best_power_5min: { label: "POT. 5 MIN", order: 8 },
  best_power_20min: { label: "POT. 20 MIN", order: 9 },
  best_power_60min: { label: "POT. 60 MIN", order: 10 },
  max_power_1s: { label: "PICO POT.", order: 11 },
  longest_ride: { label: "MAIOR PEDAL", order: 12 },
  longest_swim: { label: "MAIOR NADO", order: 13 },
  max_hr_recorded: { label: "FC MÁX", order: 14 },
};

const FEATURED_ORDER = ["longest_run", "longest_ride", "longest_swim"];
const FEATURED_LABEL: Record<string, string> = { longest_run: "Maior longão", longest_ride: "Maior pedal", longest_swim: "Maior nado" };

function valueParts(r: PersonalRecord): { value: string; unit: string } {
  switch (r.unit) {
    case "seconds": return { value: formatClock(r.value), unit: "" };
    case "meters": return r.value >= 1000 ? { value: (r.value / 1000).toFixed(2), unit: "km" } : { value: String(Math.round(r.value)), unit: "m" };
    case "watts": return { value: String(Math.round(r.value)), unit: "W" };
    case "bpm": return { value: String(Math.round(r.value)), unit: "bpm" };
    default: return { value: r.value.toFixed(1), unit: r.unit };
  }
}

function isRecent(iso: string, days = 30) {
  return Date.now() - new Date(iso).getTime() < days * 86400000;
}

function Trophy({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}

export function Records({ records, loading, className = "" }: { records: PersonalRecord[]; loading: boolean; className?: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const featured = FEATURED_ORDER.map((t) => records.find((r) => r.record_type === t)).find(Boolean) ?? null;
  const rest = records
    .filter((r) => r !== featured && r.record_type !== "longest_run")
    .sort((a, b) => (RECORD_META[a.record_type]?.order ?? 99) - (RECORD_META[b.record_type]?.order ?? 99));
  const visible = expanded ? rest : rest.slice(0, 4);

  const open = (r: PersonalRecord) => { if (r.activity_id) router.push(`/activities/${r.activity_id}`); };

  return (
    <Panel className={className} aria-label="Recordes pessoais">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="od-label">Recordes pessoais</h2>
        {records.length > 0 && <span className="text-xs text-brand-muted"><strong className="od-num text-white">{records.length}</strong> conquistas</span>}
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-28" /><div className="grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div></div>
      ) : records.length === 0 ? (
        <EmptyState icon={<Trophy size={20} />} title="Sem recordes ainda" description="Seus melhores esforços aparecem aqui automaticamente." />
      ) : (
        <>
          {featured && (() => {
            const v = valueParts(featured);
            return (
              <button
                type="button"
                onClick={() => open(featured)}
                className="group relative mb-3 block w-full overflow-hidden rounded-tile p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
                style={{
                  background: "radial-gradient(420px 160px at 100% 0%, rgba(198,255,0,0.16), transparent 70%), linear-gradient(135deg, #131a0c 0%, #0e110c 55%, #0d0d0d 100%)",
                  boxShadow: "inset 0 0 0 1px rgba(198,255,0,0.22), 0 18px 40px -26px rgba(198,255,0,0.45)",
                }}
              >
                <svg className="pointer-events-none absolute -right-6 -top-4 h-36 w-56 opacity-30" viewBox="0 0 220 140" fill="none" aria-hidden>
                  {[0, 1, 2, 3, 4].map((k) => (
                    <path key={k} d={`M0 ${110 - k * 18} C 50 ${80 - k * 18}, 110 ${130 - k * 18}, 220 ${70 - k * 18}`} stroke="#C6FF00" strokeOpacity={0.5 - k * 0.08} />
                  ))}
                </svg>
                <div className="relative flex items-center gap-2 text-brand-lime">
                  <Trophy />
                  <span className="text-[0.66rem] font-bold uppercase tracking-[0.16em]">{FEATURED_LABEL[featured.record_type]}</span>
                  <span className="od-badge od-badge-gold ml-auto !text-[0.58rem]">PR</span>
                </div>
                <div className="relative mt-2 flex items-end gap-2">
                  <span className="od-num text-[2.6rem] leading-none" style={{ textShadow: "0 0 28px rgba(198,255,0,0.35)" }}>{v.value}</span>
                  <span className="mb-1 font-display text-sm font-bold uppercase text-brand-lime">{v.unit}</span>
                </div>
                <div className="relative mt-1.5 text-[0.72rem] text-brand-muted">
                  {sportLabel(featured.sport)} · {new Date(featured.achieved_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </button>
            );
          })()}

          <div className="grid grid-cols-2 gap-2.5">
            {visible.map((r) => {
              const meta = RECORD_META[r.record_type];
              const v = valueParts(r);
              const fresh = isRecent(r.achieved_at);
              const pace = meta?.km && r.unit === "seconds" ? formatPaceShort(r.value / meta.km) : null;
              return (
                <button
                  key={`${r.sport}-${r.record_type}`}
                  type="button"
                  onClick={() => open(r)}
                  disabled={!r.activity_id}
                  className="od-tile group relative p-3.5 text-left transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[inset_0_0_0_1px_rgba(0,255,102,0.3)]"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[0.66rem] font-bold uppercase tracking-[0.12em] text-brand-textSecondary">{meta?.label ?? r.record_type}</span>
                    {fresh
                      ? <span className="od-badge od-badge-gold !px-1.5 !py-0 !text-[0.55rem]">Novo</span>
                      : <span className="od-badge !px-1.5 !py-0 !text-[0.55rem]">PR</span>}
                  </div>
                  <div className="od-num mt-2 text-[1.45rem] leading-none">
                    {v.value}{v.unit && <span className="ml-1 font-sans text-[0.7rem] font-semibold text-brand-muted">{v.unit}</span>}
                  </div>
                  <div className="mt-1.5 truncate text-[0.66rem] text-brand-muted">
                    {pace ? `${pace}/km · ` : ""}{relativeDay(r.achieved_at)}
                  </div>
                </button>
              );
            })}
          </div>

          {rest.length > 4 && (
            <button type="button" onClick={() => setExpanded((e) => !e)} className="od-link-action mt-3">
              {expanded ? "Mostrar menos" : `Ver todos (${rest.length})`} <span aria-hidden>{expanded ? "↑" : "↓"}</span>
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
