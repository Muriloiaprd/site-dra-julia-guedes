"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchActivities, fetchMe, fetchPredictionsOverview, fetchRecords, uploadActivity,
  type ActivitySummary, type PersonalRecord, type TrainingRecommendation, type User,
} from "@/lib/api";
import {
  formatDistance, formatDuration, formatRecordValue, recordLabel, sportColor, sportLabel,
} from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getMonday(): Date {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekDates(mon: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0];
  const first = local.split(/[._-]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function calcStats(acts: ActivitySummary[]) {
  const mon = getMonday();
  const prevMon = new Date(mon);
  prevMon.setDate(mon.getDate() - 7);
  const now = new Date();

  const curActs = acts.filter(a => { const d = new Date(a.start_time); return d >= mon && d <= now; });
  const prevActs = acts.filter(a => { const d = new Date(a.start_time); return d >= prevMon && d < mon; });

  function agg(list: ActivitySummary[]) {
    const hrList = list.filter(a => a.avg_hr != null);
    return {
      distance: list.reduce((s, a) => s + (a.distance_m ?? 0), 0),
      duration: list.reduce((s, a) => s + a.duration_s, 0),
      calories: Math.round(list.reduce((s, a) => s + (a.duration_s / 60) * 8, 0)),
      avgHr: hrList.length ? Math.round(hrList.reduce((s, a) => s + a.avg_hr!, 0) / hrList.length) : 0,
      elevation: Math.round(list.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0)),
      count: list.length,
    };
  }

  const cur = agg(curActs), prev = agg(prevActs);

  function trend(a: number, b: number): number | null {
    if (!b || !a) return null;
    return Math.round(((a - b) / b) * 100);
  }

  return {
    cur, prev, curActs, prevActs,
    trends: {
      distance: trend(cur.distance, prev.distance),
      duration: trend(cur.duration, prev.duration),
      calories: trend(cur.calories, prev.calories),
      avgHr: trend(cur.avgHr, prev.avgHr),
      elevation: trend(cur.elevation, prev.elevation),
    },
  };
}

// ─── sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label, value, trend, icon,
}: {
  label: string; value: string; trend: number | null; icon: React.ReactNode;
}) {
  const up = trend !== null && trend > 0;
  const down = trend !== null && trend < 0;
  return (
    <div style={{
      background: "rgba(17,17,17,0.95)", border: "1px solid #1e1e1e",
      borderRadius: 16, padding: "1.1rem 1.25rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <span style={{ color: "#00FF66", opacity: 0.85, display: "flex" }}>{icon}</span>
        <span style={{ fontSize: "0.68rem", color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: "1.4rem", fontWeight: 800, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      {trend !== null ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.7rem", fontWeight: 600, color: up ? "#00FF66" : down ? "#ff4757" : "#888" }}>
          {up ? "↑" : down ? "↓" : "–"} {Math.abs(trend)}%
          <span style={{ color: "#444", fontWeight: 400 }}> vs sem. ant.</span>
        </div>
      ) : (
        <div style={{ fontSize: "0.7rem", color: "#444" }}>sem comparativo</div>
      )}
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84">
      <circle cx="42" cy="42" r={r} fill="none" stroke="#1a1a1a" strokeWidth="6" />
      <circle cx="42" cy="42" r={r} fill="none"
        stroke="url(#rg)" strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 42 42)"
        style={{ filter: "drop-shadow(0 0 6px rgba(0,255,102,0.5))", transition: "stroke-dashoffset 1s ease" }}
      />
      <defs>
        <linearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00FF66" />
          <stop offset="100%" stopColor="#C6FF00" />
        </linearGradient>
      </defs>
      <text x="42" y="47" textAnchor="middle" fill="#fff"
        style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Poppins', sans-serif" }}>
        {pct}%
      </text>
    </svg>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<TrainingRecommendation | null>(null);

  useEffect(() => {
    fetchMe().then(u => {
      if (!u) { router.push("/login"); return; }
      setUser(u);
    });
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [acts, recs] = await Promise.all([
        fetchActivities(100, 0, undefined, "30"),
        fetchRecords(),
      ]);
      setActivities(acts);
      setRecords(recs.slice(0, 6));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  useEffect(() => {
    if (user) {
      fetchPredictionsOverview()
        .then(d => setRecommendation(d.recommendation))
        .catch(() => {});
    }
  }, [user]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const result = await uploadActivity(file);
      const imported = result.imported.filter(r => !r.duplicate).length;
      const dups = result.imported.filter(r => r.duplicate).length;
      setUploadMsg(
        imported > 0
          ? `${imported} importada(s)${dups ? `, ${dups} ignorada(s)` : ""}.`
          : "Processado."
      );
      load();
    } catch (err: unknown) {
      setUploadMsg(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const today = new Date();
  const mon = getMonday();
  const days = weekDates(mon);
  const stats = calcStats(activities);
  const weekGoal = 5;
  const weekPct = Math.min(100, Math.round((stats.cur.count / weekGoal) * 100));

  const todayLabel = today.toLocaleDateString("pt-BR", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#555" }}>
        Carregando...
      </div>
    );
  }

  const name = nameFromEmail(user.email);

  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff" }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: "1.1rem 2rem", borderBottom: "1px solid #1a1a1a",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontFamily: "'Poppins',sans-serif", fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Olá, {name}
            </h1>
            <span style={{ fontSize: "1rem" }}>⚡</span>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#555", marginTop: 2 }}>Disciplina hoje, resultados amanhã.</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* data */}
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "#111", border: "1px solid #1e1e1e", borderRadius: 100,
            padding: "0.38rem 0.9rem", fontSize: "0.78rem", color: "#666",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {todayLabel}
          </div>

          {/* upload */}
          <label style={{
            display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
            background: "rgba(0,255,102,0.07)", border: "1px solid rgba(0,255,102,0.25)",
            borderRadius: 100, padding: "0.38rem 0.9rem",
            fontSize: "0.78rem", color: "#00FF66", fontWeight: 600, transition: "box-shadow .2s",
          }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow = "0 0 14px rgba(0,255,102,0.2)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = "none")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
            {uploading ? "Enviando…" : "Importar"}
            <input type="file" className="hidden" accept=".fit,.gpx,.tcx,.csv" onChange={handleUpload} disabled={uploading} />
          </label>

          {uploadMsg && (
            <span style={{ fontSize: "0.72rem", color: "#00FF66" }}>✓ {uploadMsg}</span>
          )}
        </div>
      </div>

      <div style={{ padding: "1.5rem 2rem", maxWidth: 1400 }}>

        {/* ── TRAINING BANNER ── */}
        <div style={{
          borderRadius: 20, padding: "1.75rem 2.25rem",
          background: "linear-gradient(135deg, #0d1a11 0%, #0a130a 50%, #080e08 100%)",
          border: "1px solid rgba(0,255,102,0.13)",
          display: "grid", gridTemplateColumns: "1fr auto auto",
          gap: "2rem", alignItems: "center", marginBottom: "1.25rem",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", right: "28%", top: "50%", transform: "translateY(-50%)",
            width: 320, height: 180,
            background: "radial-gradient(ellipse, rgba(0,255,102,0.05) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div>
            <Link href="/predictions" style={{ display: "inline-block", textDecoration: "none" }}>
              <span style={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#00FF66" }}>
                ← MEUS TREINOS
              </span>
            </Link>
            <h2 style={{ fontFamily: "'Poppins',sans-serif", fontSize: "1.8rem", fontWeight: 900, lineHeight: 1.1, marginTop: 6, marginBottom: 8 }}>
              {recommendation ? `Treino ${recommendation.label}` : "Bom treino hoje!"}
            </h2>
            <p style={{ color: "#777", fontSize: "0.87rem", marginBottom: "1rem", maxWidth: 420, lineHeight: 1.6 }}>
              {recommendation?.detail ?? "Registre sua atividade de hoje e acompanhe sua evolução."}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", fontSize: "0.78rem", color: "#555" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00FF66" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {today.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
              </span>
              {stats.cur.distance > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00FF66" strokeWidth="2">
                    <path d="M3 12h18m-6-6 6 6-6 6" />
                  </svg>
                  {formatDistance(stats.cur.distance)} esta semana
                </span>
              )}
            </div>
          </div>

          {/* progress ring */}
          <div style={{ textAlign: "center", minWidth: 120 }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <ProgressRing pct={weekPct} />
            </div>
            <div style={{ marginTop: 5, fontSize: "0.68rem", color: "#666" }}>Progresso da semana</div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#00FF66", marginTop: 2 }}>
              {stats.cur.count} de {weekGoal} treinos
            </div>
            <div style={{ marginTop: 8, height: 3, borderRadius: 100, background: "#1a1a1a", width: "100%", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 100, width: `${weekPct}%`,
                background: "linear-gradient(90deg, #00FF66, #C6FF00)",
                transition: "width 1s ease",
              }} />
            </div>
          </div>

          {/* right quote */}
          <div style={{
            borderLeft: "1px solid #1a1a1a", paddingLeft: "1.5rem",
            maxWidth: 170, fontSize: "0.8rem", color: "#444", lineHeight: 1.65, fontStyle: "italic",
          }}>
            Cada quilômetro te aproxima do seu objetivo.
          </div>
        </div>

        {/* ── STATS ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
          <StatCard
            label="Distância Semanal"
            value={formatDistance(stats.cur.distance)}
            trend={stats.trends.distance}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18m-6-6 6 6-6 6" /></svg>}
          />
          <StatCard
            label="Tempo de Treino"
            value={formatDuration(stats.cur.duration)}
            trend={stats.trends.duration}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
          />
          <StatCard
            label="Calorias Est."
            value={`${stats.cur.calories.toLocaleString("pt-BR")} kcal`}
            trend={stats.trends.calories}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>}
          />
          <StatCard
            label="FC Média"
            value={stats.cur.avgHr ? `${stats.cur.avgHr} bpm` : "—"}
            trend={stats.trends.avgHr}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>}
          />
          <StatCard
            label="Elevação Acum."
            value={`${stats.cur.elevation.toLocaleString("pt-BR")} m`}
            trend={stats.trends.elevation}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
          />
        </div>

        {/* ── BODY ── */}
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1.25rem" }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Records */}
            <div style={{ background: "rgba(17,17,17,0.95)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#00FF66" }}>
                  Recordes Pessoais
                </span>
                <Link href="/metrics" style={{ fontSize: "0.68rem", color: "#444", textDecoration: "none" }}>
                  Ver todos →
                </Link>
              </div>
              {records.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "#444", textAlign: "center", padding: "1rem 0", lineHeight: 1.6 }}>
                  Nenhum recorde ainda.<br />Importe atividades para começar.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {records.map((r, i) => (
                    <div key={`${r.sport}-${r.record_type}`} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.55rem 0",
                      borderBottom: i < records.length - 1 ? "1px solid #161616" : "none",
                    }}>
                      <div>
                        <div style={{ fontSize: "0.65rem", color: "#444" }}>{sportLabel(r.sport)}</div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 500 }}>{recordLabel(r.record_type)}</div>
                      </div>
                      <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#00FF66" }}>
                        {formatRecordValue(r.value, r.unit)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quote */}
            <div style={{
              background: "rgba(0,255,102,0.04)", border: "1px solid rgba(0,255,102,0.1)",
              borderRadius: 16, padding: "1.1rem 1.25rem",
            }}>
              <p style={{ fontSize: "0.82rem", color: "#666", lineHeight: 1.65, fontStyle: "italic" }}>
                "O limite é você quem coloca. Continue."
              </p>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Weekly calendar */}
            <div style={{ background: "rgba(17,17,17,0.95)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#00FF66" }}>
                  Semana de Treino
                </span>
                <Link href="/activities" style={{ fontSize: "0.68rem", color: "#444", textDecoration: "none" }}>
                  Ver calendário →
                </Link>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                {days.map((d, i) => {
                  const isToday = sameDay(d, today);
                  const dayActs = stats.curActs.filter(a => sameDay(new Date(a.start_time), d));
                  const sport = dayActs[0]?.sport;
                  const color = sport ? sportColor(sport) : undefined;
                  const label = sport ? sportLabel(sport).split(" ")[0] : "";
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: "0.65rem", color: "#444", fontWeight: 600 }}>{DAY_LABELS[i]}</span>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: isToday
                          ? (color ? `${color}20` : "rgba(0,255,102,0.1)")
                          : (color ? `${color}14` : "rgba(255,255,255,0.025)"),
                        border: isToday
                          ? `2px solid ${color ?? "#00FF66"}`
                          : `1px solid ${color ? `${color}30` : "#1a1a1a"}`,
                        fontSize: "0.78rem", fontWeight: 700,
                        color: isToday ? (color ?? "#00FF66") : (color ?? "#444"),
                        boxShadow: isToday ? `0 0 10px ${(color ?? "#00FF66")}30` : undefined,
                        transition: "all .2s",
                      }}>
                        {d.getDate()}
                      </div>
                      <span style={{ fontSize: "0.52rem", color: color ?? "#2a2a2a", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
                        {label || "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent activities */}
            <div style={{ background: "rgba(17,17,17,0.95)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#00FF66" }}>
                  Treinos Recentes
                </span>
                <Link href="/activities" style={{ fontSize: "0.68rem", color: "#444", textDecoration: "none" }}>
                  Ver todos →
                </Link>
              </div>

              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: 54, borderRadius: 10, background: "rgba(255,255,255,0.025)" }} />
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem 0", color: "#444" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🏃</div>
                  <p style={{ fontSize: "0.87rem", fontWeight: 500, color: "#666" }}>Nenhuma atividade ainda.</p>
                  <p style={{ fontSize: "0.78rem", marginTop: 4, color: "#444" }}>
                    Use o botão <span style={{ color: "#00FF66" }}>Importar</span> no topo para começar.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {activities.slice(0, 8).map(a => {
                    const color = sportColor(a.sport);
                    const emoji = a.sport === "run" || a.sport === "trail_run" || a.sport === "treadmill" ? "🏃"
                      : a.sport === "bike" || a.sport === "mtb" || a.sport === "gravel" || a.sport === "indoor_bike" ? "🚴"
                      : a.sport === "swim" || a.sport === "open_water_swim" ? "🏊"
                      : "⚡";
                    return (
                      <Link key={a.id} href={`/activities/${a.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "0.65rem 0.85rem", borderRadius: 10,
                          border: "1px solid #1a1a1a", background: "rgba(255,255,255,0.02)",
                          cursor: "pointer", transition: "border-color .2s, background .2s",
                        }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = `${color}40`;
                            (e.currentTarget as HTMLDivElement).style.background = `${color}08`;
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = "#1a1a1a";
                            (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)";
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 9,
                              background: `${color}16`, border: `1px solid ${color}30`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "1rem",
                            }}>
                              {emoji}
                            </div>
                            <div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                                {a.title ?? sportLabel(a.sport)}
                              </div>
                              <div style={{ fontSize: "0.7rem", color: "#555" }}>
                                {new Date(a.start_time).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 14, fontSize: "0.8rem", textAlign: "right" }}>
                            {a.distance_m && (
                              <div>
                                <div style={{ fontWeight: 700 }}>{formatDistance(a.distance_m)}</div>
                                <div style={{ fontSize: "0.62rem", color: "#444" }}>dist.</div>
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700 }}>{formatDuration(a.duration_s)}</div>
                              <div style={{ fontSize: "0.62rem", color: "#444" }}>tempo</div>
                            </div>
                            {a.avg_hr && (
                              <div>
                                <div style={{ fontWeight: 700, color }}>{a.avg_hr} bpm</div>
                                <div style={{ fontSize: "0.62rem", color: "#444" }}>FC</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
