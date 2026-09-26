"use client";

import { useId, type ReactNode } from "react";
import { C, withAlpha } from "@/lib/theme";

/* ─────────────────────── Radial gauge ─────────────────────── */

export function RadialGauge({
  value, size = 148, stroke = 10, color = C.accent, children, ticks = true,
}: {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  ticks?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2 - 6;
  const cx = size / 2;
  // arco de 270° (abre embaixo), estilo instrumento de cockpit
  const sweep = 270;
  const circ = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * circ;
  const filled = (pct / 100) * arcLen;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={C.accent} />
            <stop offset="100%" stopColor={color === C.accent ? C.lime : color} />
          </linearGradient>
          <filter id={`f${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g transform={`rotate(135 ${cx} ${cx})`}>
          <circle
            cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
            strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round"
          />
          <circle
            cx={cx} cy={cx} r={r} fill="none" stroke={`url(#g${id})`} strokeWidth={stroke}
            strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" filter={`url(#f${id})`}
            className="od-gauge-arc"
          />
        </g>
        {ticks && Array.from({ length: 28 }, (_, i) => {
          const a = ((135 + (i / 27) * sweep) * Math.PI) / 180;
          const r1 = r + stroke / 2 + 5;
          const r2 = r1 + (i % 9 === 0 ? 5 : 2.5);
          const on = i / 27 <= pct / 100;
          return (
            <line
              key={i}
              x1={cx + r1 * Math.cos(a)} y1={cx + r1 * Math.sin(a)}
              x2={cx + r2 * Math.cos(a)} y2={cx + r2 * Math.sin(a)}
              stroke={on ? withAlpha(C.accent, 0.55) : "rgba(255,255,255,0.12)"} strokeWidth={1}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ─────────────────────── Sparkline ─────────────────────── */

export function Sparkline({
  data, color = C.accent, height = 36, width = 120, responsive = false, fill = true, strokeWidth = 1.6, invert = false,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  responsive?: boolean;
  fill?: boolean;
  strokeWidth?: number;
  invert?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const values = data.filter((v) => Number.isFinite(v));
  if (values.length < 2) return <div style={{ height, width: responsive ? "100%" : width }} />;
  const max = Math.max(...values), min = Math.min(...values), range = max - min || 1;
  const W = width;
  const pad = 3;
  const coords = values.map((v, i) => {
    const t = (v - min) / range;
    return {
      x: (i / (values.length - 1)) * W,
      y: pad + (invert ? t : 1 - t) * (height - pad * 2),
    };
  });
  const line = coords.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${height} L0 ${height} Z`;
  const last = coords[coords.length - 1];
  return (
    <svg
      width={responsive ? "100%" : W} height={height} viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none" className="block overflow-visible" aria-hidden
    >
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#s${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {!responsive && <circle cx={last.x} cy={last.y} r={2.4} fill={color} />}
    </svg>
  );
}

/* ─────────────────────── Pulse line (ECG) ─────────────────────── */

/** Linha de pulso decorativa para fundos de cards de "monitor". */
export function PulseLine({ className = "", color = C.accent }: { className?: string; color?: string }) {
  return (
    <svg className={`pointer-events-none ${className}`} viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 70 H150 L170 70 L182 40 L196 98 L210 20 L224 88 L236 70 H330 L346 70 L356 54 L368 80 L378 70 H600"
        fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
        className="od-ecg"
      />
    </svg>
  );
}

/* ─────────────────────── Chart tooltip ─────────────────────── */

export function ChartTooltipBox({ title, rows, footer }: {
  title?: ReactNode;
  rows: { label: ReactNode; value: ReactNode; color?: string }[];
  footer?: ReactNode;
}) {
  return (
    <div className="od-tooltip">
      {title && <div className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-brand-muted">{title}</div>}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-5 text-xs">
            <span className="flex items-center gap-1.5 text-brand-textSecondary">
              {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color, boxShadow: `0 0 6px ${r.color}` }} />}
              {r.label}
            </span>
            <span className="od-num text-[0.8rem] text-white">{r.value}</span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-2 border-t border-white/5 pt-1.5 text-[0.68rem] text-brand-muted">{footer}</div>}
    </div>
  );
}

export function LegendDot({ color, label, dashed = false }: { color: string; label: ReactNode; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.72rem] text-brand-muted">
      {dashed
        ? <span className="inline-block h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: color }} />
        : <span className="inline-block h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${withAlpha(color.startsWith("#") ? color : C.accent, 0.6)}` }} />}
      {label}
    </span>
  );
}
