"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AiOrb } from "@/components/dashboard/CoachCard";
import { Markdown } from "@/components/ui/Markdown";
import { Panel } from "@/components/ui/primitives";
import { fetchAdherence, postActivityComment, type AdherenceItem } from "@/lib/api";
import { parseLocalDate, toISODate, WEEK_LABELS } from "@/lib/athlete";
import { coachErrorMessage } from "@/lib/coachErrors";
import { formatDuration, formatPaceShort } from "@/lib/utils";

const VOLUME: Record<NonNullable<AdherenceItem["volume"]>, { label: string; color: string }> = {
  cumpriu: { label: "Cumpriu", color: "#00FF66" },
  a_mais: { label: "Fez a mais", color: "#FFC145" },
  a_menos: { label: "Fez a menos", color: "#FFC145" },
};

const PACE: Record<NonNullable<AdherenceItem["ritmo"]>, string> = {
  no_ritmo: "no ritmo",
  mais_rapido: "mais rápido que o alvo",
  mais_lento: "mais lento que o alvo",
};

function dayLabel(iso: string): string {
  const today = toISODate(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === today) return "Hoje";
  if (iso === toISODate(y)) return "Ontem";
  const d = parseLocalDate(iso);
  return `${WEEK_LABELS[(d.getDay() + 6) % 7]} ${d.getDate()}`;
}

const km = (m: number | null) => (m ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : null);

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="od-badge !normal-case !tracking-normal" style={{ color, background: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}44` }}>
      {children}
    </span>
  );
}

function Row({ it, onComment }: { it: AdherenceItem; onComment: (it: AdherenceItem) => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = it.planned;
  const a = it.actual;
  const planned = [km(p.distance_m), p.duration_s ? formatDuration(p.duration_s) : null, p.ritmo].filter(Boolean).join(" · ");
  const done = a
    ? [km(a.distance_m), a.moving_s ? formatDuration(a.moving_s) : null, a.pace_s_per_km ? `${formatPaceShort(a.pace_s_per_km)}/km` : null, a.avg_hr ? `FC ${a.avg_hr}` : null]
        .filter(Boolean).join(" · ")
    : "Não houve treino nesse dia";

  async function ask() {
    setAsking(true);
    setError(null);
    try {
      await onComment(it);
      setOpen(true);
    } catch (e) {
      const m = coachErrorMessage(e);
      setError(`${m.title}. ${m.detail}`);
    } finally {
      setAsking(false);
    }
  }

  return (
    <li className="od-tile space-y-2.5 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-brand-muted">{dayLabel(it.date)}</span>
          <h3 className="truncate text-[0.95rem] font-semibold">{it.title}</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {it.status === "skipped" ? <Badge color="#F85149">Pulou</Badge> : it.volume && <Badge color={VOLUME[it.volume].color}>{VOLUME[it.volume].label}{it.ratio != null && it.volume !== "cumpriu" ? ` · ${Math.round(it.ratio * 100)}%` : ""}</Badge>}
          {it.ritmo && <Badge color={it.ritmo === "no_ritmo" ? "#00FF66" : "#00BFFF"}>{PACE[it.ritmo]}</Badge>}
        </div>
      </div>
      <dl className="grid gap-2 text-[0.8rem] sm:grid-cols-2">
        <div className="rounded-lg bg-white/[0.03] px-3 py-2">
          <dt className="od-metric-label">Planejado</dt>
          <dd className="mt-0.5 text-brand-textSecondary">{planned || p.intensity || "—"}</dd>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-3 py-2">
          <dt className="od-metric-label">Feito</dt>
          <dd className="mt-0.5 text-brand-textSecondary">{done}</dd>
        </div>
      </dl>
      {a && (
        <div className="flex flex-wrap items-center gap-2">
          {it.comment ? (
            <button type="button" onClick={() => setOpen((o) => !o)} className="od-btn od-btn-ghost od-btn-sm" aria-expanded={open}>
              {open ? "Esconder comentário" : "Ver comentário da Duni"}
            </button>
          ) : (
            <button type="button" onClick={ask} disabled={asking} className="od-btn od-btn-secondary od-btn-sm">
              {asking ? "A Duni está lendo o treino…" : "Pedir comentário da Duni"}
            </button>
          )}
          <Link href={`/activities/${a.activity_id}`} className="od-link-action">Ver treino →</Link>
        </div>
      )}
      {error && <p className="text-xs text-brand-danger">{error}</p>}
      {open && it.comment && (
        <div className="flex gap-2.5 rounded-xl px-3 py-2.5" style={{ background: "rgba(0,255,102,0.04)", boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.16)" }}>
          <AiOrb size={26} active={false} />
          <div className="min-w-0 text-[0.84rem]"><Markdown text={it.comment.text} /></div>
        </div>
      )}
    </li>
  );
}

/**
 * Planejado × feito dos últimos dias. O comentário é o da atividade (a Duni já lê o
 * planejado do dia) e só é pedido quando o atleta clica.
 */
export function AdherencePanel({ days = 7, limit, className = "" }: { days?: number; limit?: number; className?: string }) {
  const [items, setItems] = useState<AdherenceItem[] | null>(null);

  useEffect(() => {
    fetchAdherence(days).then(setItems).catch(() => setItems([]));
  }, [days]);

  async function comment(it: AdherenceItem) {
    if (!it.actual) return;
    const res = await postActivityComment(it.actual.activity_id);
    setItems((list) => (list ?? []).map((x) => (x.id === it.id && res.comment
      ? { ...x, comment: { text: res.comment, generated_at: res.generated_at ?? new Date().toISOString(), model_used: res.model_used ?? null } }
      : x)));
  }

  if (!items || items.length === 0) return null;
  const shown = limit ? items.slice(0, limit) : items;
  const done = items.filter((i) => i.status === "done").length;

  return (
    <Panel className={className} aria-label="Planejado × feito">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="od-label">Planejado × feito</h2>
        <span className="text-xs text-brand-muted">
          <strong className="od-num text-white">{done}</strong> de {items.length} treino{items.length === 1 ? "" : "s"} planejado{items.length === 1 ? "" : "s"} nos últimos {days} dias
        </span>
      </div>
      <ul className="space-y-2">
        {shown.map((it) => <Row key={it.id} it={it} onComment={comment} />)}
      </ul>
      {limit && items.length > limit && (
        <Link href="/coach" className="od-link-action mt-3 inline-block">Ver todos na Duni →</Link>
      )}
    </Panel>
  );
}
