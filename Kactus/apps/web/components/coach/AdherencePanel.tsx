"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DuniAvatar } from "@/components/DuniAvatar";
import { Markdown } from "@/components/ui/Markdown";
import { Panel, Skeleton } from "@/components/ui/primitives";
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

function Badges({ it }: { it: AdherenceItem }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {it.status === "skipped" ? <Badge color="#F85149">Pulou</Badge> : it.volume && <Badge color={VOLUME[it.volume].color}>{VOLUME[it.volume].label}{it.ratio != null && it.volume !== "cumpriu" ? ` · ${Math.round(it.ratio * 100)}%` : ""}</Badge>}
      {it.ritmo && <Badge color={it.ritmo === "no_ritmo" ? "#00FF66" : "#00BFFF"}>{PACE[it.ritmo]}</Badge>}
    </div>
  );
}

/** Planejado ao lado do feito, o comentário da Duni (pedido só no clique) e o link do treino. */
function RowBody({ it, onComment }: { it: AdherenceItem; onComment: (it: AdherenceItem) => Promise<void> }) {
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
    <>
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
          <DuniAvatar size={26} active={false} />
          <div className="min-w-0 text-[0.84rem]"><Markdown text={it.comment.text} /></div>
        </div>
      )}
    </>
  );
}

/** Uma linha por treino (dia, nome, km planejado → feito e o selo); tocar abre o planejado, o feito e a Duni. */
function CompactRow({ it, onComment }: { it: AdherenceItem; onComment: (it: AdherenceItem) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="od-tile overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[3.6rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-white/[0.02] sm:grid-cols-[4.2rem_minmax(0,1fr)_8.5rem_auto]"
      >
        <span className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{dayLabel(it.date)}</span>
        <span className="truncate text-[0.88rem] font-semibold">{it.title}</span>
        <span className="od-num col-start-2 row-start-2 text-[0.74rem] text-brand-textSecondary sm:col-start-auto sm:row-start-auto sm:text-right">
          {km(it.planned.distance_m) ?? "—"} <span className="text-brand-muted">→</span> {it.actual ? km(it.actual.distance_m) ?? "feito" : "—"}
        </span>
        <span className="col-start-3 row-span-2 row-start-1 flex items-center gap-2 sm:col-start-auto sm:row-span-1 sm:row-start-auto">
          <Badges it={it} />
          <span className={`text-brand-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
        </span>
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-white/5 px-4 pb-3.5 pt-3">
          <RowBody it={it} onComment={onComment} />
        </div>
      )}
    </li>
  );
}

/** Planejado × feito dos últimos `days` dias; o comentário é o da atividade e só é pedido no clique. */
export function useAdherence(days: number, enabled = true) {
  const [items, setItems] = useState<AdherenceItem[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    fetchAdherence(days).then(setItems).catch(() => setItems([]));
  }, [days, enabled, version]);

  async function comment(it: AdherenceItem) {
    if (!it.actual) return;
    const res = await postActivityComment(it.actual.activity_id);
    setItems((list) => (list ?? []).map((x) => (x.id === it.id && res.comment
      ? { ...x, comment: { text: res.comment, generated_at: res.generated_at ?? new Date().toISOString(), model_used: res.model_used ?? null } }
      : x)));
  }

  /** Busca de novo (o plano mudou). */
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { items, comment, reload };
}

/** Verde cumpriu · amarelo fez a mais ou a menos · vermelho pulou. */
function squareColor(it: AdherenceItem) {
  if (it.status === "skipped") return "#F85149";
  return it.volume === "a_mais" || it.volume === "a_menos" ? "#FFC145" : "#00FF66";
}

const kmNum = (m: number) => (m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: m >= 10000 ? 0 : 1 });

/** Placar do período: quantos cumpriu, km planejados × feitos e um quadradinho por treino. */
export function AdherenceScore({ items, days }: { items: AdherenceItem[] | null; days: number }) {
  if (!items) return <Panel aria-label="Placar"><Skeleton className="h-16" /></Panel>;
  const done = items.filter((i) => i.status === "done").length;
  const plannedM = items.reduce((s, i) => s + (i.planned.distance_m ?? 0), 0);
  const doneM = items.reduce((s, i) => s + (i.actual?.distance_m ?? 0), 0);
  const ordem = [...items].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Panel aria-label={`Placar dos últimos ${days} dias`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="od-label od-label-accent">Placar · últimos {days} dias</h2>
        {items.length > 0 && <span className="text-[0.7rem] text-brand-muted">um quadradinho por treino planejado</span>}
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-brand-muted">Nenhum treino planejado nos últimos {days} dias.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <p className="text-sm text-brand-textSecondary"><strong className="od-num text-[1.35rem] text-white">{done} de {items.length}</strong> cumpridos</p>
            <p className="text-sm text-brand-textSecondary">
              <strong className="od-num text-white">{kmNum(plannedM)} km</strong> planejados × <strong className="od-num text-white">{kmNum(doneM)} km</strong> feitos
            </p>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Treinos do período, do mais antigo ao mais recente">
            {ordem.map((it) => {
              const label = `${dayLabel(it.date)}: ${it.title} — ${it.status === "skipped" ? "pulou" : it.volume ? VOLUME[it.volume].label.toLowerCase() : "feito"}`;
              return <li key={it.id} title={label} aria-label={label} className="h-4 w-4 rounded" style={{ background: squareColor(it), boxShadow: `0 0 8px ${squareColor(it)}55` }} />;
            })}
          </ul>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] text-brand-muted">
            {[["#00FF66", "Cumpriu"], ["#FFC145", "Fez a mais ou a menos"], ["#F85149", "Pulou"]].map(([c, l]) => (
              <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{l}</span>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

/** A lista do Planejado × feito em linhas compactas (aba Comparar do calendário). */
export function AdherenceList({ items, onComment }: { items: AdherenceItem[] | null; onComment: (it: AdherenceItem) => Promise<void> }) {
  if (!items) return null;
  if (items.length === 0) return <p className="text-sm text-brand-muted">Quando houver treino planejado nos últimos dias, ele aparece aqui com o que você fez.</p>;
  return (
    <ul className="space-y-2" aria-label="Planejado × feito">
      {items.map((it) => <CompactRow key={it.id} it={it} onComment={onComment} />)}
    </ul>
  );
}
