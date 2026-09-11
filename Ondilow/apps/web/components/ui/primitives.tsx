"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/* ───────────────────────── Panel ───────────────────────── */

type PanelVariant = "default" | "hero" | "accent" | "flush" | "glass";

const PANEL_CLASS: Record<PanelVariant, string> = {
  default: "od-panel",
  hero: "od-panel od-panel-hero",
  accent: "od-panel od-panel-accent",
  flush: "od-panel-flush",
  glass: "od-panel od-panel-glass",
};

export function Panel({
  children, variant = "default", interactive = false, className = "", style, as: Tag = "section", onClick, ...rest
}: {
  children: ReactNode;
  variant?: PanelVariant;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: "section" | "div" | "article";
  onClick?: () => void;
  "aria-label"?: string;
}) {
  return (
    <Tag
      className={`${PANEL_CLASS[variant]} ${interactive ? "od-interactive" : ""} ${className}`}
      style={style}
      onClick={onClick}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ───────────────────── Section label ───────────────────── */

export function SectionLabel({
  children, action, accent = false, className = "",
}: {
  children: ReactNode;
  action?: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-center justify-between gap-3 ${className}`}>
      <h2 className={`od-label ${accent ? "od-label-accent" : ""}`}>{children}</h2>
      {action}
    </div>
  );
}

export function LinkAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="od-link-action">
      {children}
      <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

/* ───────────────────────── Metric ───────────────────────── */

const METRIC_SIZE = {
  xl: "text-[2.25rem] sm:text-[2.75rem]",
  lg: "text-[1.625rem] sm:text-[1.875rem]",
  md: "text-[1.25rem]",
  sm: "text-[1rem]",
} as const;

const UNIT_SIZE = {
  xl: "text-base",
  lg: "text-sm",
  md: "text-xs",
  sm: "text-[0.7rem]",
} as const;

export function Metric({
  value, unit, label, size = "md", color, align = "left", sub,
}: {
  value: ReactNode;
  unit?: string;
  label?: ReactNode;
  size?: keyof typeof METRIC_SIZE;
  color?: string;
  align?: "left" | "right" | "center";
  sub?: ReactNode;
}) {
  return (
    <div className={align === "right" ? "text-right" : align === "center" ? "text-center" : ""}>
      {label && <div className="od-metric-label mb-1.5">{label}</div>}
      <div className={`od-num ${METRIC_SIZE[size]} leading-none`} style={color ? { color } : undefined}>
        {value}
        {unit && <span className={`ml-1 font-sans font-semibold text-brand-muted ${UNIT_SIZE[size]}`}>{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs text-brand-muted">{sub}</div>}
    </div>
  );
}

/* ─────────────────────── Status dot ─────────────────────── */

export function StatusDot({ color = "#00FF66", pulse = false, size = 7 }: { color?: string; pulse?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${pulse ? "animate-od-pulse" : ""}`}
      style={{ width: size, height: size, background: color, boxShadow: pulse ? undefined : `0 0 8px ${color}` }}
    />
  );
}

/* ───────────────────── Progress bars ───────────────────── */

export function ProgressBar({
  value, color, height = 6, className = "", glow = true,
}: {
  value: number; // 0-100
  color?: string;
  height?: number;
  className?: string;
  glow?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`od-track ${className}`} style={{ height }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="od-track-fill"
        style={{
          width: `${pct}%`,
          background: color ?? "linear-gradient(90deg, #00FF66, #C6FF00)",
          boxShadow: glow ? `0 0 12px ${color ?? "rgba(0,255,102,0.55)"}` : undefined,
        }}
      />
    </div>
  );
}

export function SegmentBar({ total, filled, height = 6 }: { total: number; filled: number; height?: number }) {
  return (
    <div className="flex gap-1" aria-label={`${filled} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="flex-1 rounded-full transition-colors duration-500"
          style={{
            height,
            background: i < filled ? "linear-gradient(90deg, #00FF66, #C6FF00)" : "rgba(255,255,255,0.07)",
            boxShadow: i < filled ? "0 0 10px rgba(0,255,102,0.45)" : undefined,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────── Trend badge ─────────────────────── */

/**
 * Mostra variacao percentual. `invert` = valores menores sao melhores (pace).
 */
export function TrendBadge({
  pct, invert = false, suffix, className = "",
}: {
  pct: number | null;
  invert?: boolean;
  suffix?: string;
  className?: string;
}) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className={`text-xs text-brand-textTertiary ${className}`}>—</span>;
  }
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct;
  const good = invert ? rounded < 0 : rounded > 0;
  const color = rounded === 0 ? "#888888" : good ? "#00FF66" : "#FFC145";
  const arrow = rounded === 0 ? "■" : rounded > 0 ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${className}`} style={{ color }}>
      <span className="text-[0.6rem]">{arrow}</span>
      {Math.abs(rounded).toFixed(1)}%
      {suffix && <span className="font-normal text-brand-muted">{suffix}</span>}
    </span>
  );
}

/* ──────────────────────── Segmented ──────────────────────── */

export function Segmented<T extends string | number>({
  options, value, onChange, size = "sm", ariaLabel,
}: {
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <div className="od-segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`od-segmented-item ${size === "md" ? "px-3.5 py-1.5 text-[0.8rem]" : "px-2.5 py-1 text-[0.72rem]"} ${active ? "is-active" : ""}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────── Page header ─────────────────────── */

export function PageHeader({
  kicker, title, description, actions, icon,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="relative mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-4">
        {icon && <div className="od-icon-tile hidden sm:flex">{icon}</div>}
        <div className="min-w-0">
          {kicker && <div className="od-label od-label-accent mb-2">{kicker}</div>}
          <h1 className="font-display text-[1.6rem] font-extrabold leading-tight tracking-tight sm:text-[1.9rem]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-brand-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageContainer({ children, width = "wide" }: { children: ReactNode; width?: "narrow" | "medium" | "wide" }) {
  const max = width === "narrow" ? "max-w-3xl" : width === "medium" ? "max-w-5xl" : "max-w-[1440px]";
  return <main className={`relative mx-auto w-full ${max} px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8`}>{children}</main>;
}

/* ─────────────────────── Empty / skeleton ─────────────────────── */

export function EmptyState({
  icon, title, description, action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      {icon && <div className="od-icon-tile mb-2">{icon}</div>}
      <p className="font-semibold text-brand-text">{title}</p>
      {description && <p className="max-w-sm text-sm text-brand-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`od-skeleton ${className}`} style={style} />;
}

export function Alert({ tone = "danger", title, children, action }: {
  tone?: "danger" | "warning" | "accent";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`od-alert od-alert-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-brand-textSecondary" : ""}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
