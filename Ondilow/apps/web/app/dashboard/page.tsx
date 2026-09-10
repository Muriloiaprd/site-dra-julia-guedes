"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchActivities, fetchMe, fetchPredictionsOverview, fetchRecords, uploadActivity,
  type ActivitySummary, type PersonalRecord, type TrainingRecommendation, type User,
} from "@/lib/api";
import {
  formatDistance, formatDuration, formatPace, formatRecordValue,
  recordLabel, sportColor, sportLabel,
} from "@/lib/utils";

// ── constants ──────────────────────────────────────────────────────────────

const WEEK_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTH_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const SPORT_EMOJI: Record<string, string> = {
  run: "🏃", trail_run: "🏔️", treadmill: "🏃", bike: "🚴", mtb: "🚵",
  gravel: "🚴", indoor_bike: "🚴", swim: "🏊", open_water_swim: "🏊", other: "⚡",
};
const SPORT_ICON_SRC: Record<string, string> = {
  run: "/icons/run.png", trail_run: "/icons/run.png", treadmill: "/icons/run.png",
  bike: "/icons/bike.png", mtb: "/icons/bike.png", gravel: "/icons/bike.png", indoor_bike: "/icons/bike.png",
  swim: "/icons/swim.png", open_water_swim: "/icons/swim.png",
};

function SportIcon({ sport, size = "70%" }: { sport: string; size?: string }) {
  const src = SPORT_ICON_SRC[sport];
  if (src) return <img src={src} alt="" style={{ width: size, height: size, objectFit: "contain" }} />;
  return <>{SPORT_EMOJI[sport] ?? "⚡"}</>;
}
type EvolMetric = "distance" | "pace" | "hr";
const EVOL_LABEL: Record<EvolMetric, string> = { distance: "Distância", pace: "Pace Médio", hr: "FC Média" };

// ── helpers ────────────────────────────────────────────────────────────────

function getMonday(): Date {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekDates(mon: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
  });
}

function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }

function nameFromEmail(email: string): string {
  const local = email.split("@")[0];
  const first = local.split(/[._-]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function calcWeekStats(acts: ActivitySummary[]) {
  const mon = getMonday();
  const prevMon = new Date(mon); prevMon.setDate(mon.getDate() - 7);
  const now = new Date();
  const cur = acts.filter(a => { const d = new Date(a.start_time); return d >= mon && d <= now; });
  const prev = acts.filter(a => { const d = new Date(a.start_time); return d >= prevMon && d < mon; });

  function agg(list: ActivitySummary[]) {
    const hrL = list.filter(a => a.avg_hr != null);
    const paceL = list.filter(a => a.avg_pace_s_per_km != null);
    return {
      distance: list.reduce((s, a) => s + (a.distance_m ?? 0), 0),
      duration: list.reduce((s, a) => s + a.duration_s, 0),
      avgHr: hrL.length ? Math.round(hrL.reduce((s, a) => s + a.avg_hr!, 0) / hrL.length) : 0,
      avgPace: paceL.length ? Math.round(paceL.reduce((s, a) => s + a.avg_pace_s_per_km!, 0) / paceL.length) : 0,
      elevation: Math.round(list.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0)),
      count: list.length,
    };
  }

  const c = agg(cur), p = agg(prev);
  return { cur: c, prev: p, curActs: cur };
}

type SparkMetric = "distance" | "duration" | "hr" | "pace" | "elevation";

function readinessFromRec(r: TrainingRecommendation | null): number {
  if (!r) return 72;
  switch (r.type) {
    case "hard": return 85;
    case "moderate": return 68;
    case "easy": return 50;
    case "rest": return 28;
    default: return 72;
  }
}

function statusHeadline(readiness: number): string {
  if (readiness >= 80) return "Pronto para evoluir";
  if (readiness >= 60) return "Bom momento para treinar";
  if (readiness >= 40) return "Treine com moderação";
  return "Priorize a recuperação";
}

function statusSubtitle(readiness: number, rec: TrainingRecommendation | null): string {
  if (rec?.detail) return rec.detail;
  if (readiness >= 80) return "Seu corpo responde bem aos estímulos. Mantenha o foco na consistência.";
  if (readiness >= 60) return "Recuperação em dia — sustente o ritmo com consistência.";
  if (readiness >= 40) return "Sinais de fadiga moderada. Ajuste a intensidade de hoje.";
  return "Carga acumulada alta. Priorize sono e recuperação ativa.";
}

function readinessTag(readiness: number): string {
  if (readiness >= 80) return "Alta";
  if (readiness >= 60) return "Boa";
  if (readiness >= 40) return "Moderada";
  return "Baixa";
}

function readinessColor(readiness: number): string {
  if (readiness >= 80) return "#00FF66";
  if (readiness >= 60) return "#C6FF00";
  if (readiness >= 40) return "#FF8C00";
  return "#ff4757";
}

function recoveryTag(pct: number): string {
  if (pct >= 70) return "Boa";
  if (pct >= 45) return "Moderada";
  return "Baixa";
}

// ── icons ──────────────────────────────────────────────────────────────────

function IconZap({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
}
function IconBars({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="6"/></svg>;
}
function IconHeart({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>;
}
function IconCheckCircle({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 5-5"/></svg>;
}

// ── SparkLine ──────────────────────────────────────────────────────────────

function SparkLine({ data, color = "#00FF66", h = 36 }: { data: number[]; color?: string; h?: number }) {
  const nonZero = data.filter(v => v > 0);
  if (nonZero.length < 2) return <div style={{ height: h, width: 80 }} />;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const W = 80;
  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: h - ((v - min) / range) * (h - 6) - 3,
  }));
  const pts = coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `M 0 ${h} ${coords.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")} L ${W} ${h} Z`;
  const uid = `sl${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${uid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── ProgressRing ───────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 80, color = "#00FF66", colorTo, sublabel }: {
  pct: number; size?: number; color?: string; colorTo?: string; sublabel?: string;
}) {
  const to = colorTo ?? color;
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const uid = `pr${color.replace(/[^a-z0-9]/gi, "")}${size}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a1a1a" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={`url(#${uid})`} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ filter: `drop-shadow(0 0 5px ${color}55)`, transition: "stroke-dashoffset 1s ease" }}
      />
      <text x={size/2} y={size/2 + (sublabel ? -3 : 5)} textAnchor="middle" fill="#fff"
        style={{ fontFamily: "'Poppins',sans-serif", fontSize: size * 0.22, fontWeight: 800 }}>
        {pct}%
      </text>
      {sublabel && (
        <text x={size/2} y={size/2 + size * 0.18} textAnchor="middle" fill="#aaa"
          style={{ fontSize: size * 0.1 }}>
          {sublabel}
        </text>
      )}
    </svg>
  );
}

// ── EvolutionChart ─────────────────────────────────────────────────────────

function EvolutionChart({ activities, metric, period }: {
  activities: ActivitySummary[]; metric: EvolMetric; period: string;
}) {
  const days = ({ "7D": 7, "30D": 30, "3M": 90, "6M": 180, "1A": 365 } as Record<string, number>)[period] ?? 30;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);

  const pts = activities
    .filter(a => new Date(a.start_time) >= cutoff)
    .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
    .map(a => ({
      date: new Date(a.start_time),
      v: metric === "distance" ? (a.distance_m ?? 0) / 1000
        : metric === "pace" ? (a.avg_pace_s_per_km ?? 0)
        : (a.avg_hr ?? 0),
    }))
    .filter(p => p.v > 0);

  if (pts.length < 2) return (
    <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "#8f8f8f", fontSize: "0.8rem" }}>
      Atividades insuficientes no período
    </div>
  );

  const vv = pts.map(p => p.v);
  const max = Math.max(...vv), min = Math.min(...vv), range = max - min || 1;
  const W = 500, H = 130, PAD = 6;

  const mapped = pts.map((p, i) => ({
    x: (i / (pts.length - 1)) * W,
    y: H - ((p.v - min) / range) * (H - PAD * 2) - PAD,
    v: p.v, date: p.date,
  }));

  const linePts = mapped.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `M ${mapped[0].x} ${H} ${mapped.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")} L ${mapped[mapped.length-1].x} ${H} Z`;

  function fmtV(v: number) {
    if (metric === "distance") return `${v.toFixed(1)} km`;
    if (metric === "pace") return formatPace(v);
    return `${Math.round(v)} bpm`;
  }

  const labelIdxs = [0, Math.floor(mapped.length / 2), mapped.length - 1].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        <defs>
          <linearGradient id="evol-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00FF66" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#00FF66" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(t => (
          <line key={t} x1="0" y1={H * t} x2={W} y2={H * t} stroke="#161616" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#evol-fill)" />
        <polyline points={linePts} fill="none" stroke="#00FF66" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(0,255,102,0.3))" }} />
        {mapped.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#00FF66"
            style={{ filter: "drop-shadow(0 0 3px rgba(0,255,102,0.5))" }} />
        ))}
        {labelIdxs.map(i => (
          <text key={i} x={mapped[i].x} y={H - 2} textAnchor={i === 0 ? "start" : i === mapped.length - 1 ? "end" : "middle"}
            fill="#777" style={{ fontSize: 8.5, fontFamily: "system-ui" }}>
            {mapped[i].date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── MonthCalendar ──────────────────────────────────────────────────────────

function MonthCalendar({ activities }: { activities: ActivitySummary[] }) {
  const today = new Date();
  const year = today.getFullYear(), month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const days = Array.from({ length: lastDay.getDate() }, (_, i) => i + 1);

  const actsByDay = new Map<number, ActivitySummary[]>();
  activities.forEach(a => {
    const d = new Date(a.start_time);
    if (d.getMonth() === month && d.getFullYear() === year) {
      const key = d.getDate();
      actsByDay.set(key, [...(actsByDay.get(key) ?? []), a]);
    }
  });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 3 }}>
        {["Se", "Te", "Qu", "Qu", "Se", "Sá", "Do"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: "0.55rem", color: "#8f8f8f", padding: "1px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const dayActs = actsByDay.get(day) ?? [];
          const d = new Date(year, month, day);
          const isToday = sameDay(d, today);
          const isFuture = d > today;
          const color = dayActs[0] ? sportColor(dayActs[0].sport) : undefined;
          return (
            <div key={day} title={dayActs.length ? `${dayActs.length} atividade(s)` : undefined} style={{
              aspectRatio: "1", borderRadius: 5, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 1,
              background: isToday ? "rgba(0,255,102,0.12)" : dayActs.length ? `${color}10` : "transparent",
              border: isToday ? "1px solid rgba(0,255,102,0.4)" : dayActs.length ? `1px solid ${color}25` : "1px solid transparent",
            }}>
              <span style={{ fontSize: "0.58rem", color: isToday ? "#00FF66" : isFuture ? "#767676" : dayActs.length ? "#bbb" : "#8f8f8f", fontWeight: isToday ? 700 : 400 }}>
                {day}
              </span>
              {dayActs.length > 0 && (
                <div style={{ width: 3, height: 3, borderRadius: "50%", background: color }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ActivityModal ──────────────────────────────────────────────────────────

function activityMetricValue(a: ActivitySummary, metric: SparkMetric): number {
  if (metric === "distance") return (a.distance_m ?? 0) / 1000;
  if (metric === "duration") return a.duration_s / 3600;
  if (metric === "elevation") return a.elevation_gain_m ?? 0;
  if (metric === "hr") return a.avg_hr ?? 0;
  return a.avg_pace_s_per_km ?? 0;
}

function ActivityModal({ activity, activities, onClose }: {
  activity: ActivitySummary; activities: ActivitySummary[]; onClose: () => void;
}) {
  const idx = activities.findIndex(a => a.id === activity.id);
  const prev = idx >= 0 ? activities[idx + 1] : undefined;
  const color = sportColor(activity.sport);

  function series(metric: SparkMetric): number[] {
    const start = idx >= 0 ? idx : 0;
    return activities.slice(start, start + 8).reverse().map(a => activityMetricValue(a, metric));
  }

  function trend(cur: number | null | undefined, prevVal: number | null | undefined): number | null {
    if (cur == null || prevVal == null || !prevVal) return null;
    return Math.round(((cur - prevVal) / prevVal) * 100);
  }

  const metrics: { label: string; value: string; trend: number | null; spark: number[]; color: string; inv?: boolean }[] = [
    { label: "Distância", value: activity.distance_m != null ? formatDistance(activity.distance_m) : "—", trend: trend(activity.distance_m, prev?.distance_m), spark: series("distance"), color: "#00FF66" },
    { label: "Tempo", value: formatDuration(activity.duration_s), trend: trend(activity.duration_s, prev?.duration_s), spark: series("duration"), color: "#C6FF00" },
    { label: "Pace Médio", value: activity.avg_pace_s_per_km != null ? formatPace(activity.avg_pace_s_per_km) : "—", trend: trend(activity.avg_pace_s_per_km, prev?.avg_pace_s_per_km), spark: series("pace"), color: "#00BFFF", inv: true },
    { label: "FC Média", value: activity.avg_hr != null ? `${activity.avg_hr} bpm` : "—", trend: trend(activity.avg_hr, prev?.avg_hr), spark: series("hr"), color: "#FF6B35", inv: true },
    { label: "Elevação", value: activity.elevation_gain_m != null ? `${Math.round(activity.elevation_gain_m)} m` : "—", trend: trend(activity.elevation_gain_m, prev?.elevation_gain_m), spark: series("elevation"), color: "#A78BFA" },
  ];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1.5rem",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 18, padding: "1.5rem",
        maxWidth: 720, width: "100%", maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>
              <SportIcon sport={activity.sport} size="72%" />
            </div>
            <div>
              <h3 style={{ fontFamily: "'Poppins',sans-serif", fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>{activity.title ?? sportLabel(activity.sport)}</h3>
              <p style={{ fontSize: "0.75rem", color: "#9d9d9d", margin: "2px 0 0" }}>
                {sportLabel(activity.sport)} · {new Date(activity.start_time).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid #232323", borderRadius: 100, width: 30, height: 30, color: "#b0b0b0", cursor: "pointer", fontSize: "0.9rem", flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.7rem" }}>
          {metrics.map(m => (
            <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1e1e1e", borderRadius: 12, padding: "0.85rem 0.7rem" }}>
              <div style={{ fontSize: "0.6rem", color: "#b0b0b0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: "1.1rem", fontWeight: 800, marginBottom: 6 }}>{m.value}</div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 4 }}>
                {m.trend === null
                  ? <span style={{ fontSize: "0.6rem", color: "#767676" }}>—</span>
                  : <span style={{ fontSize: "0.6rem", fontWeight: 600, color: (m.inv ? m.trend < 0 : m.trend > 0) ? "#00FF66" : m.trend === 0 ? "#9d9d9d" : "#ff4757" }}>
                      {m.trend > 0 ? "↑" : m.trend < 0 ? "↓" : "–"} {Math.abs(m.trend)}%
                    </span>}
                <SparkLine data={m.spark} color={m.color} h={24} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.1rem" }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid #1a1a1a", borderRadius: 10, padding: "0.6rem 0.8rem" }}>
            <div style={{ fontSize: "0.58rem", color: "#9d9d9d", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fonte</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, marginTop: 2 }}>{activity.source}</div>
          </div>
          {activity.avg_speed_kmh != null && (
            <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid #1a1a1a", borderRadius: 10, padding: "0.6rem 0.8rem" }}>
              <div style={{ fontSize: "0.58rem", color: "#9d9d9d", textTransform: "uppercase", letterSpacing: "0.06em" }}>Vel. Média</div>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, marginTop: 2 }}>{activity.avg_speed_kmh.toFixed(1)} km/h</div>
            </div>
          )}
        </div>

        <Link href={`/activities/${activity.id}`} style={{ display: "block", textAlign: "center", marginTop: "1.1rem", padding: "0.55rem", borderRadius: 10, background: "rgba(0,255,102,0.08)", border: "1px solid rgba(0,255,102,0.22)", fontSize: "0.78rem", color: "#00FF66", textDecoration: "none", fontWeight: 700 }}>
          Ver página completa da atividade →
        </Link>
      </div>
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<TrainingRecommendation | null>(null);
  const [evolMetric, setEvolMetric] = useState<EvolMetric>("distance");
  const [evolPeriod, setEvolPeriod] = useState("30D");
  const [modalActivity, setModalActivity] = useState<ActivitySummary | null>(null);

  useEffect(() => {
    fetchMe().then(u => { if (!u) { router.push("/login"); return; } setUser(u); });
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [acts, recs] = await Promise.all([fetchActivities(200, 0, undefined, "365"), fetchRecords()]);
      setActivities(acts);
      setRecords(recs);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);
  useEffect(() => {
    if (user) fetchPredictionsOverview().then(d => setRecommendation(d.recommendation)).catch(() => {});
  }, [user]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadMsg(null);
    try {
      const r = await uploadActivity(file);
      const imp = r.imported.filter(x => !x.duplicate).length;
      const dup = r.imported.filter(x => x.duplicate).length;
      setUploadMsg(imp > 0 ? `${imp} importada(s)${dup ? `, ${dup} ignorada(s)` : ""}.` : "Processado.");
      load();
    } catch (err) { setUploadMsg(err instanceof Error ? err.message : "Erro"); }
    finally { setUploading(false); e.target.value = ""; }
  }

  const today = new Date();
  const mon = getMonday();
  const days = weekDates(mon);
  const stats = useMemo(() => calcWeekStats(activities), [activities]);
  const lastActivity = activities[0] ?? null;

  const weekGoal = 5;
  const readiness = readinessFromRec(recommendation);
  const weekLoadH = stats.cur.duration / 3600;
  const weekLoadPct = Math.min(100, Math.round((weekLoadH / 8) * 100));
  const recoveryPct = Math.max(15, 100 - weekLoadPct);
  const prevWeekLoadH = stats.prev.duration / 3600;
  const prevWeekLoadPct = Math.min(100, Math.round((prevWeekLoadH / 8) * 100));
  const prevRecoveryPct = Math.max(15, 100 - prevWeekLoadPct);
  const recoveryDelta = stats.prev.count > 0 ? recoveryPct - prevRecoveryPct : null;
  const todayLabel = today.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#767676" }}>Carregando...</div>
  );

  const name = nameFromEmail(user.email);

  // ── style tokens ──
  const card: React.CSSProperties = { background: "rgba(17,17,17,0.97)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "1.2rem" };
  const cardAccent: React.CSSProperties = { background: "rgba(0,255,102,0.035)", border: "1px solid rgba(0,255,102,0.1)", borderRadius: 16, padding: "1.2rem" };

  function secLabel(text: string) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.8rem" }}>
        <div style={{ width: 14, height: 2, background: "#00FF66", borderRadius: 1 }} />
        <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#00FF66" }}>{text}</span>
      </div>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", paddingBottom: "3rem" }}>

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "1rem 2rem", borderBottom: "1px solid #141414", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <h1 style={{ fontFamily: "'Poppins',sans-serif", fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>Olá, {name}</h1>
            <span style={{ fontSize: "0.95rem" }}>⚡</span>
          </div>
          <p style={{ fontSize: "0.73rem", color: "#777", marginTop: 1 }}>Disciplina hoje, resultados amanhã.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#111", border: "1px solid #1e1e1e", borderRadius: 100, padding: "0.34rem 0.8rem", fontSize: "0.72rem", color: "#999" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {todayLabel}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", background: "rgba(0,255,102,0.07)", border: "1px solid rgba(0,255,102,0.25)", borderRadius: 100, padding: "0.34rem 0.8rem", fontSize: "0.72rem", color: "#00FF66", fontWeight: 600, transition: "box-shadow .2s" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow = "0 0 14px rgba(0,255,102,0.2)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = "none")}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
            {uploading ? "Enviando…" : "Importar"}
            <input type="file" className="hidden" accept=".fit,.gpx,.tcx,.csv" onChange={handleUpload} disabled={uploading} />
          </label>
          {uploadMsg && <span style={{ fontSize: "0.68rem", color: "#00FF66" }}>✓ {uploadMsg}</span>}
        </div>
      </div>

      <div style={{ padding: "1.25rem 2rem" }}>

        {/* ─── ROW 1: STATUS + ÚLTIMA ATIVIDADE + PRÓXIMO TREINO ───────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 300px", gap: "1rem", marginBottom: "1rem" }}>

          {/* Status do Atleta */}
          <div style={{
            gridColumn: "1", gridRow: "1",
            display: "flex", flexDirection: "column", justifyContent: "center",
            background: "linear-gradient(135deg, #0c1a10 0%, #0a1208 100%)",
            border: "1px solid rgba(0,255,102,0.14)", borderRadius: 14, padding: "0.7rem 1rem",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", right: -30, top: -30, width: 160, height: 160, background: "radial-gradient(ellipse, rgba(0,255,102,0.06) 0%, transparent 65%)", pointerEvents: "none" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 1fr", alignItems: "center", gap: 0 }}>

              {/* Headline */}
              <div style={{ paddingRight: "0.8rem" }}>
                <div style={{ fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#00FF66", marginBottom: 3 }}>Status do Atleta</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: "0.98rem", fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap" }}>
                    {statusHeadline(readiness)}
                  </span>
                  <span style={{ color: "#00FF66", display: "flex", flexShrink: 0 }}><IconZap size={13} /></span>
                  <Link href="/predictions" style={{ fontSize: "0.64rem", color: "#00FF66", textDecoration: "none", fontWeight: 700, marginLeft: 2, whiteSpace: "nowrap" }}>
                    análise →
                  </Link>
                </div>
              </div>

              {/* Prontidão */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 0.6rem", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                <ProgressRing pct={readiness} size={38} color={readinessColor(readiness)} colorTo={readiness >= 80 ? "#C6FF00" : undefined} />
                <div>
                  <div style={{ fontSize: "0.55rem", color: "#b0b0b0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Prontidão</div>
                  <div style={{ fontSize: "0.66rem", fontWeight: 700, color: readinessColor(readiness) }}>{readinessTag(readiness)}</div>
                </div>
              </div>

              {/* Carga semanal */}
              <div style={{ padding: "0 0.6rem", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#00FF66", marginBottom: 3 }}>
                  <IconBars size={11} />
                  <span style={{ fontSize: "0.55rem", color: "#b0b0b0", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Carga</span>
                </div>
                <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: "0.92rem", fontWeight: 800, lineHeight: 1, marginBottom: 4 }}>
                  {weekLoadH.toFixed(1)}<span style={{ fontSize: "0.62rem", fontWeight: 600, color: "#9d9d9d" }}> /8h</span>
                </div>
                <div style={{ height: 3, background: "#242424", borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${weekLoadPct}%`, background: "linear-gradient(90deg, #00FF66, #C6FF00)", borderRadius: 100, transition: "width 1s ease" }} />
                </div>
              </div>

              {/* Recuperação */}
              <div style={{ padding: "0 0.6rem", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#00FF66", marginBottom: 3 }}>
                  <IconHeart size={11} />
                  <span style={{ fontSize: "0.55rem", color: "#b0b0b0", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Recup.</span>
                </div>
                <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: "0.92rem", fontWeight: 800, lineHeight: 1, marginBottom: 3 }}>
                  {recoveryTag(recoveryPct)}
                </div>
                <span style={{ fontSize: "0.58rem", fontWeight: 600, color: recoveryDelta === null ? "#9d9d9d" : recoveryDelta > 0 ? "#00FF66" : recoveryDelta < 0 ? "#ff4757" : "#9d9d9d" }}>
                  {recoveryDelta === null ? "—" : recoveryDelta > 0 ? "↑ melhorando" : recoveryDelta < 0 ? "↓ em queda" : "estável"}
                </span>
              </div>

              {/* Treinos da semana */}
              <div style={{ padding: "0 0 0 0.6rem", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#00FF66", marginBottom: 3 }}>
                  <IconCheckCircle size={11} />
                  <span style={{ fontSize: "0.55rem", color: "#b0b0b0", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Treinos</span>
                </div>
                <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: "0.92rem", fontWeight: 800, lineHeight: 1, marginBottom: 4 }}>
                  {stats.cur.count}<span style={{ fontSize: "0.62rem", fontWeight: 600, color: "#9d9d9d" }}> /{weekGoal}</span>
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  {Array.from({ length: weekGoal }, (_, i) => {
                    const done = i < stats.cur.count;
                    return (
                      <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 100,
                        background: done ? "linear-gradient(90deg, #00FF66, #C6FF00)" : "#242424",
                      }} />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Última Atividade */}
          <div style={{ ...card, gridColumn: "2", gridRow: "1", padding: "0.7rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 14, height: 2, background: "#00FF66", borderRadius: 1 }} />
                <span style={{ fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#00FF66" }}>Última Atividade</span>
              </div>
              {lastActivity && (
                <button onClick={() => setModalActivity(lastActivity)} style={{ fontSize: "0.64rem", color: "#00FF66", background: "transparent", border: "1px solid rgba(0,255,102,0.3)", borderRadius: 100, padding: "0.16rem 0.6rem", cursor: "pointer", fontWeight: 700 }}>
                  Veja →
                </button>
              )}
            </div>
            {lastActivity ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem" }}><SportIcon sport={lastActivity.sport} size="100%" /></span>
                  <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: "0.85rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {lastActivity.title ?? sportLabel(lastActivity.sport)}
                  </span>
                  <span style={{ fontSize: "0.6rem", color: "#9d9d9d", whiteSpace: "nowrap" }}>
                    {new Date(lastActivity.start_time).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                  {lastActivity.distance_m != null && (
                    <div><div style={{ fontSize: "0.85rem", fontWeight: 800, fontFamily: "'Poppins',sans-serif" }}>{formatDistance(lastActivity.distance_m)}</div><div style={{ fontSize: "0.5rem", color: "#9d9d9d" }}>dist.</div></div>
                  )}
                  <div><div style={{ fontSize: "0.85rem", fontWeight: 800, fontFamily: "'Poppins',sans-serif" }}>{formatDuration(lastActivity.duration_s)}</div><div style={{ fontSize: "0.5rem", color: "#9d9d9d" }}>tempo</div></div>
                  {lastActivity.avg_pace_s_per_km != null && (
                    <div><div style={{ fontSize: "0.85rem", fontWeight: 800, fontFamily: "'Poppins',sans-serif" }}>{formatPace(lastActivity.avg_pace_s_per_km)}</div><div style={{ fontSize: "0.5rem", color: "#9d9d9d" }}>pace</div></div>
                  )}
                  {lastActivity.avg_hr != null && (
                    <div><div style={{ fontSize: "0.85rem", fontWeight: 800, fontFamily: "'Poppins',sans-serif" }}>{lastActivity.avg_hr}</div><div style={{ fontSize: "0.5rem", color: "#9d9d9d" }}>bpm</div></div>
                  )}
                  {lastActivity.elevation_gain_m != null && (
                    <div><div style={{ fontSize: "0.85rem", fontWeight: 800, fontFamily: "'Poppins',sans-serif" }}>{Math.round(lastActivity.elevation_gain_m)}m</div><div style={{ fontSize: "0.5rem", color: "#9d9d9d" }}>elev.</div></div>
                  )}
                </div>
              </>
            ) : (
              <p style={{ fontSize: "0.75rem", color: "#9d9d9d" }}>Nenhuma atividade registrada.</p>
            )}
          </div>

          {/* Visão Semanal */}
          <div style={{ ...card, gridColumn: "1 / 3", gridRow: "2", padding: "0.75rem 0.9rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.55rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 14, height: 2, background: "#00FF66", borderRadius: 1 }} />
                <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#00FF66" }}>Visão Semanal</span>
              </div>
              <Link href="/activities" style={{ fontSize: "0.66rem", color: "#9d9d9d", textDecoration: "none" }}>Ver calendário →</Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {days.map((d, i) => {
                const isToday = sameDay(d, today);
                const isFuture = d > today;
                const dayActs = stats.curActs.filter(a => sameDay(new Date(a.start_time), d));
                const sport = dayActs[0]?.sport;
                const hasActivity = !!sport;
                const accent = isToday ? "#00FF66" : hasActivity ? "#FFC145" : null;
                return (
                  <div key={i} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "0.6rem 0.35rem",
                    borderRadius: 12, position: "relative",
                    background: accent ? "linear-gradient(160deg, #1e1e1e 0%, #0a0a0a 100%)" : "rgba(255,255,255,0.015)",
                    boxShadow: accent ? `-2px -2px 6px rgba(255,255,255,0.04), 4px 5px 14px rgba(0,0,0,0.6), inset 0 0 0 1px ${accent}28` : "none",
                    border: accent ? "none" : "1px solid #171717",
                    transition: "all .2s",
                  }}>
                    {hasActivity && !isToday && (
                      <div style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: "50%", background: "#00FF66", boxShadow: "0 0 5px rgba(0,255,102,0.8)" }} />
                    )}
                    <div style={{
                      width: "84%", aspectRatio: "1", borderRadius: 12,
                      background: accent ? `radial-gradient(circle at 50% 35%, ${accent}48, ${accent}12 75%)` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${accent ? `${accent}55` : "#232323"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.5rem",
                      boxShadow: accent ? `0 0 14px ${accent}55, inset 0 0 10px ${accent}30` : undefined,
                    }}>
                      {sport ? <SportIcon sport={sport} size="82%" /> : isFuture ? <span style={{ fontSize: "0.75rem", color: "#8f8f8f" }}>{d.getDate()}</span> : <span style={{ fontSize: "0.68rem", color: "#767676" }}>—</span>}
                    </div>
                    <div style={{ fontSize: "0.64rem", fontWeight: 800, color: accent ?? (isFuture ? "#9d9d9d" : "#767676"), lineHeight: 1.15, textAlign: "center" }}>
                      {sport ? sportLabel(sport).split(" ")[0] : isFuture ? "Planejado" : "Descanso"}
                    </div>
                    {accent && <div style={{ width: "55%", height: 1, background: `${accent}55` }} />}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.56rem", fontWeight: 700, color: accent ?? "#aaaaaa" }}>{WEEK_LABELS[i]}</div>
                      <div style={{ fontSize: "0.5rem", color: accent ? `${accent}99` : "#767676", marginTop: 1 }}>
                        {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Próximo Treino */}
          <div style={{ ...card, gridColumn: "3", gridRow: "1 / 3" }}>
            {secLabel("Próximo Treino")}
            {recommendation ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: `${recommendation.color}18`, border: `1px solid ${recommendation.color}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>
                    🏃
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: "0.95rem" }}>{recommendation.label}</div>
                    <div style={{ fontSize: "0.7rem", color: "#aaaaaa", marginTop: 1 }}>Recomendado para hoje</div>
                  </div>
                </div>
                {recommendation.detail && (
                  <p style={{ fontSize: "0.78rem", color: "#b0b0b0", lineHeight: 1.65, padding: "0.55rem 0.7rem", background: "rgba(255,255,255,0.03)", borderRadius: 8, borderLeft: `2px solid ${recommendation.color}77`, marginBottom: 12 }}>
                    {recommendation.detail}
                  </p>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.7rem", color: "#aaaaaa", marginBottom: 12 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {today.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                </div>
                <Link href="/predictions" style={{ display: "block", textAlign: "center", padding: "0.48rem", borderRadius: 10, background: "rgba(0,255,102,0.07)", border: "1px solid rgba(0,255,102,0.18)", fontSize: "0.75rem", color: "#00FF66", textDecoration: "none", fontWeight: 600 }}>
                  Ver detalhes →
                </Link>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎯</div>
                <p style={{ fontSize: "0.8rem", color: "#aaaaaa" }}>Sem recomendação disponível</p>
                <Link href="/predictions" style={{ display: "inline-block", marginTop: 10, fontSize: "0.74rem", color: "#00FF66", textDecoration: "none" }}>Ver previsões →</Link>
              </div>
            )}
          </div>
        </div>

        {/* ─── EVOLUÇÃO + PRÓXIMOS TREINOS ────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 270px", gap: "1rem", marginBottom: "1rem" }}>

          {/* Gráfico de evolução */}
          <div style={{ ...card }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
              {secLabel("Evolução do Desempenho")}
              <div style={{ display: "flex", gap: 3 }}>
                {(["7D", "30D", "3M", "6M", "1A"] as const).map(p => (
                  <button key={p} onClick={() => setEvolPeriod(p)} style={{
                    background: evolPeriod === p ? "rgba(0,255,102,0.1)" : "transparent",
                    border: evolPeriod === p ? "1px solid rgba(0,255,102,0.28)" : "1px solid #2a2a2a",
                    borderRadius: 100, padding: "0.14rem 0.45rem",
                    fontSize: "0.65rem", color: evolPeriod === p ? "#00FF66" : "#aaaaaa",
                    cursor: "pointer", fontWeight: evolPeriod === p ? 700 : 400,
                  }}>{p}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 2, marginBottom: "0.75rem", borderBottom: "1px solid #141414", paddingBottom: "0.5rem" }}>
              {(["distance", "pace", "hr"] as EvolMetric[]).map(m => (
                <button key={m} onClick={() => setEvolMetric(m)} style={{
                  background: "transparent", border: "none",
                  borderBottom: evolMetric === m ? "2px solid #00FF66" : "2px solid transparent",
                  padding: "0.18rem 0.6rem", fontSize: "0.74rem",
                  color: evolMetric === m ? "#00FF66" : "#aaaaaa",
                  cursor: "pointer", fontWeight: evolMetric === m ? 600 : 400,
                  marginBottom: -1,
                }}>{EVOL_LABEL[m]}</button>
              ))}
            </div>
            {loading
              ? <div style={{ height: 130, background: "rgba(255,255,255,0.018)", borderRadius: 8 }} />
              : <EvolutionChart activities={activities} metric={evolMetric} period={evolPeriod} />}
          </div>

          {/* Próximos treinos (placeholder visual) */}
          <div style={{ ...card }}>
            {secLabel("Próximos Treinos")}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {days.filter(d => d > today).slice(0, 4).map((d, i) => {
                const items = [
                  { name: "Corrida leve", detail: "10 km · 5:40–6:00/km", color: "#00FF66" },
                  { name: "Recuperação", detail: "8 km · 6:10/km", color: "#888" },
                  { name: "Intervalado", detail: "8×1 km · 4:50/km", color: "#C6FF00" },
                  { name: "Longão", detail: "28 km · 5:20/km", color: "#00BFFF" },
                ];
                const item = items[i % items.length];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.55rem 0.7rem", borderRadius: 10, background: "rgba(255,255,255,0.015)", border: "1px solid #161616" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, boxShadow: `0 0 6px ${item.color}66`, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.74rem", fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: "0.64rem", color: "#9d9d9d", marginTop: 1 }}>
                        {WEEK_LABELS[(d.getDay() + 6) % 7]} · {d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} · {item.detail}
                      </div>
                    </div>
                  </div>
                );
              })}
              {days.filter(d => d > today).length === 0 && (
                <p style={{ fontSize: "0.77rem", color: "#9d9d9d", textAlign: "center", padding: "1rem 0" }}>Semana encerrada</p>
              )}
            </div>
          </div>
        </div>

        {/* ─── ATIVIDADES + COLUNA DIREITA ────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: "1rem" }}>

          {/* Atividades Recentes */}
          <div style={{ ...card }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {secLabel("Atividades Recentes")}
              <Link href="/activities" style={{ fontSize: "0.68rem", color: "#9d9d9d", textDecoration: "none", marginBottom: "0.8rem" }}>Ver todas →</Link>
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[1,2,3].map(i => <div key={i} style={{ height: 58, borderRadius: 10, background: "rgba(255,255,255,0.018)" }} />)}
              </div>
            ) : activities.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏃</div>
                <p style={{ fontSize: "0.86rem", color: "#b0b0b0" }}>Nenhuma atividade ainda.</p>
                <p style={{ fontSize: "0.75rem", color: "#9d9d9d", marginTop: 4 }}>Use <span style={{ color: "#00FF66" }}>Importar</span> para adicionar.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {activities.slice(0, 8).map(a => {
                  const color = sportColor(a.sport);
                  return (
                    <div key={a.id} onClick={() => setModalActivity(a)} style={{
                        display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 10,
                        padding: "0.65rem 0.8rem", borderRadius: 10,
                        border: "1px solid #161616", background: "rgba(255,255,255,0.015)",
                        cursor: "pointer", transition: "border-color .18s, background .18s",
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}30`; (e.currentTarget as HTMLDivElement).style.background = `${color}06`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#161616"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.015)"; }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}14`, border: `1px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                          <SportIcon sport={a.sport} size="72%" />
                        </div>
                        <div>
                          <div style={{ fontSize: "0.83rem", fontWeight: 600 }}>{a.title ?? sportLabel(a.sport)}</div>
                          <div style={{ fontSize: "0.68rem", color: "#aaaaaa", marginTop: 1 }}>
                            {new Date(a.start_time).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: "0.76rem", textAlign: "right" }}>
                          {a.distance_m && (
                            <div><div style={{ fontWeight: 700 }}>{formatDistance(a.distance_m)}</div><div style={{ fontSize: "0.6rem", color: "#9d9d9d" }}>dist.</div></div>
                          )}
                          <div><div style={{ fontWeight: 700 }}>{formatDuration(a.duration_s)}</div><div style={{ fontSize: "0.6rem", color: "#9d9d9d" }}>tempo</div></div>
                          {a.avg_pace_s_per_km && (
                            <div><div style={{ fontWeight: 700 }}>{formatPace(a.avg_pace_s_per_km)}</div><div style={{ fontSize: "0.6rem", color: "#9d9d9d" }}>pace</div></div>
                          )}
                          {a.avg_hr && (
                            <div><div style={{ fontWeight: 700, color }}>{a.avg_hr}</div><div style={{ fontSize: "0.6rem", color: "#9d9d9d" }}>bpm</div></div>
                          )}
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <span style={{ fontSize: "0.58rem", color: "#00FF66", background: "rgba(0,255,102,0.07)", border: "1px solid rgba(0,255,102,0.18)", borderRadius: 100, padding: "0.08rem 0.4rem" }}>Concluído</span>
                          </div>
                        </div>
                      </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coluna direita */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Recordes */}
            <div style={{ ...card }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {secLabel("Recordes Pessoais")}
                <Link href="/metrics" style={{ fontSize: "0.65rem", color: "#9d9d9d", textDecoration: "none", marginBottom: "0.8rem" }}>Ver todos →</Link>
              </div>
              {records.length === 0 ? (
                <p style={{ fontSize: "0.75rem", color: "#9d9d9d", textAlign: "center", padding: "0.75rem 0" }}>Sem recordes ainda</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {records.slice(0, 6).map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.42rem 0", borderBottom: i < Math.min(records.length, 6) - 1 ? "1px solid #141414" : "none" }}>
                      <div>
                        <div style={{ fontSize: "0.6rem", color: "#9d9d9d", fontWeight: 600 }}>{sportLabel(r.sport)}</div>
                        <div style={{ fontSize: "0.79rem", fontWeight: 500, color: "#e6e6e6" }}>{recordLabel(r.record_type)}</div>
                      </div>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#00FF66" }}>{formatRecordValue(r.value, r.unit)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Meta principal */}
            <div style={{ ...cardAccent }}>
              {secLabel("Meta Principal")}
              <div style={{ textAlign: "center", paddingTop: "0.25rem" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: 6 }}>🏁</div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>Configure sua meta</div>
                <p style={{ fontSize: "0.73rem", color: "#b0b0b0", lineHeight: 1.55, marginBottom: 12 }}>
                  Defina uma corrida alvo e acompanhe seu progresso em direção ao objetivo.
                </p>
                <Link href="/predictions" style={{ display: "inline-block", padding: "0.42rem 0.9rem", background: "rgba(0,255,102,0.08)", border: "1px solid rgba(0,255,102,0.28)", borderRadius: 100, fontSize: "0.72rem", color: "#00FF66", textDecoration: "none", fontWeight: 600 }}>
                  Ver plano completo →
                </Link>
              </div>
            </div>

            {/* Calendário */}
            <div style={{ ...card }}>
              {secLabel(`Calendário — ${MONTH_PT[today.getMonth()]}`)}
              {loading
                ? <div style={{ height: 100, background: "rgba(255,255,255,0.018)", borderRadius: 8 }} />
                : <MonthCalendar activities={activities} />}
            </div>
          </div>
        </div>
      </div>

      {modalActivity && (
        <ActivityModal activity={modalActivity} activities={activities} onClose={() => setModalActivity(null)} />
      )}
    </main>
  );
}
