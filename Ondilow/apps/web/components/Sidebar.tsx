"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { clearToken, fetchMe, fetchProfile, type User } from "@/lib/api";
import { useFocusTrap } from "@/lib/useFocusTrap";

type NavItem = { href: string; label: string; short?: string; icon: ReactNode; ai?: boolean };

const ico = (children: ReactNode) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const ICONS = {
  dashboard: ico(<><rect x="3" y="3" width="8" height="10" rx="2" /><rect x="13" y="3" width="8" height="6" rx="2" /><rect x="13" y="11" width="8" height="10" rx="2" /><rect x="3" y="15" width="8" height="6" rx="2" /></>),
  activities: ico(<path d="M3 12h4l3 8 4-16 3 8h4" />),
  load: ico(<><path d="M3 20h18" /><path d="M6 16v-4" /><path d="M10 16V8" /><path d="M14 16v-6" /><path d="M18 16V5" /></>),
  predictions: ico(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>),
  coach: ico(<><path d="M12 3a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3 3 3 0 0 0 3 3" /><path d="M12 3a3 3 0 0 1 3 3 3 3 0 0 1 3 3 3 3 0 0 1 0 6 3 3 0 0 1-3 3 3 3 0 0 1-3 3" /><path d="M12 3v18" /><path d="M9 9.5h1.5M13.5 14.5H15" /></>),
  equipment: ico(<><path d="M4 16c0-2 1-3 3-3.5l3-.8 2.5-4.2c.4-.7 1.4-.8 2-.2l1.2 1.2" /><path d="M4 16h14.5a1.5 1.5 0 0 1 1.5 1.5V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2Z" /><path d="M9.5 12.5 11 14M12 11.5l1.5 1.5" /></>),
  import: ico(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>),
  profile: ico(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>),
  logout: ico(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>),
  more: ico(<><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>),
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Performance",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "Início", icon: ICONS.dashboard },
      { href: "/activities", label: "Atividades", icon: ICONS.activities },
      { href: "/metrics", label: "Carga", icon: ICONS.load },
      { href: "/predictions", label: "Previsões", icon: ICONS.predictions },
    ],
  },
  {
    label: "Inteligência",
    items: [{ href: "/coach", label: "Treinador IA", short: "Coach IA", icon: ICONS.coach, ai: true }],
  },
  {
    label: "Gestão",
    items: [
      { href: "/equipment", label: "Equipamentos", icon: ICONS.equipment },
      { href: "/import", label: "Importar", icon: ICONS.import },
    ],
  },
];

const PROFILE_ITEM: NavItem = { href: "/profile", label: "Perfil", icon: ICONS.profile };
const ALL_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), PROFILE_ITEM];
const MOBILE_PRIMARY = ["/dashboard", "/activities", "/coach", "/metrics"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function AiBadge() {
  return (
    <span className="ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[0.58rem] font-bold tracking-[0.12em] text-brand-accent" style={{ background: "rgba(0,255,102,0.08)", boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.25)" }}>
      <span className="h-1.5 w-1.5 rounded-full bg-brand-accent animate-od-pulse" />
      IA
    </span>
  );
}

function Avatar({ user, avatarUrl, size = 32 }: { user: User | null; avatarUrl: string | null; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-black"
      style={{
        width: size, height: size,
        background: avatarUrl ? "#111" : "linear-gradient(135deg, #00FF66, #C6FF00)",
        boxShadow: "0 0 0 2px #0A0A0A, 0 0 0 3px rgba(0,255,102,0.35)",
      }}
    >
      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (user?.email[0] ?? "·").toUpperCase()}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    fetchMe().then((u) => { if (u) setUser(u); });
    fetchProfile().then((p) => { setAvatarUrl(p.avatar_data_url); setFullName(p.full_name); }).catch(() => {});
  }, []);

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const sheetRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(sheetRef, moreOpen, () => setMoreOpen(false), moreBtnRef);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  const displayName = fullName?.trim() || user?.email.split("@")[0] || "";

  return (
    <>
      {/* ───────── Desktop (lg: completa · md: rail compacto) ───────── */}
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen flex-col md:flex md:w-[76px] lg:w-60"
        style={{
          background: "linear-gradient(180deg, rgba(12,12,12,0.96) 0%, rgba(9,9,9,0.98) 100%)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40" style={{ background: "radial-gradient(ellipse 80% 100% at 30% 0%, rgba(0,255,102,0.07), transparent 70%)" }} />

        <Link href="/dashboard" className="relative flex h-[72px] items-center justify-center px-5 lg:justify-start" aria-label="Ondilow — Dashboard">
          <Logo size={30} textClassName="hidden lg:flex" />
        </Link>

        <nav className="relative flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-2" aria-label="Navegação lateral">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <div className="mb-2 hidden px-3 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-brand-textTertiary lg:block">
                {group.label}
              </div>
              <div className="mx-auto mb-2 h-px w-6 bg-white/5 lg:hidden" />
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={item.label}
                        aria-current={active ? "page" : undefined}
                        className={`od-nav-item justify-center lg:justify-start ${active ? "is-active" : ""}`}
                      >
                        <span className="od-nav-icon relative shrink-0">
                          {item.icon}
                          {item.ai && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand-accent animate-od-pulse lg:hidden" />}
                        </span>
                        <span className="hidden truncate lg:inline">{item.label}</span>
                        {item.ai && <span className="hidden lg:inline-flex lg:ml-auto"><AiBadge /></span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="relative border-t border-white/5 px-3 pb-4 pt-3">
          <Link
            href="/profile"
            title="Perfil"
            aria-current={isActive(pathname, "/profile") ? "page" : undefined}
            className={`od-nav-item mb-1 justify-center lg:justify-start ${isActive(pathname, "/profile") ? "is-active" : ""}`}
          >
            <Avatar user={user} avatarUrl={avatarUrl} size={28} />
            <span className="hidden min-w-0 flex-1 lg:block">
              <span className="block truncate text-[0.8rem] font-semibold text-white">{displayName || "Perfil"}</span>
              <span className="block truncate text-[0.66rem] text-brand-muted">Perfil do atleta</span>
            </span>
          </Link>
          <button
            onClick={handleLogout}
            title="Sair"
            className="od-nav-item w-full justify-center hover:!bg-[rgba(248,81,73,0.08)] hover:!text-brand-danger lg:justify-start"
          >
            <span className="od-nav-icon shrink-0">{ICONS.logout}</span>
            <span className="hidden lg:inline">Sair</span>
          </button>
        </div>
      </aside>

      {/* ───────── Mobile: top bar ───────── */}
      <header
        className="sticky top-0 z-40 flex h-14 items-center justify-between px-4 md:hidden"
        style={{ background: "rgba(10,10,10,0.82)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Link href="/dashboard" aria-label="Ondilow — Dashboard"><Logo size={26} /></Link>
        <Link href="/profile" aria-label="Perfil"><Avatar user={user} avatarUrl={avatarUrl} size={30} /></Link>
      </header>

      {/* ───────── Mobile: bottom nav ───────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
        style={{ background: "rgba(10,10,10,0.9)", backdropFilter: "blur(18px)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegação inferior"
      >
        <ul className="grid h-16 grid-cols-5">
          {MOBILE_PRIMARY.map((href) => {
            const item = ALL_ITEMS.find((i) => i.href === href)!;
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-full flex-col items-center justify-center gap-1 text-[0.62rem] font-semibold transition-colors ${active ? "text-brand-accent" : "text-brand-muted"}`}
                >
                  {active && <span className="absolute top-0 h-[2px] w-8 rounded-b-full bg-brand-accent" style={{ boxShadow: "0 0 10px rgba(0,255,102,0.8)" }} />}
                  <span className="relative" style={active ? { filter: "drop-shadow(0 0 6px rgba(0,255,102,0.6))" } : undefined}>
                    {item.icon}
                    {item.ai && <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-brand-accent animate-od-pulse" />}
                  </span>
                  {item.short ?? item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              ref={moreBtnRef}
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              className={`flex h-full w-full flex-col items-center justify-center gap-1 text-[0.62rem] font-semibold ${moreOpen || ALL_ITEMS.some((i) => !MOBILE_PRIMARY.includes(i.href) && isActive(pathname, i.href)) ? "text-brand-accent" : "text-brand-muted"}`}
            >
              {ICONS.more}
              Mais
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mais opções de navegação"
            className="od-panel od-panel-glass od-nav-sheet absolute inset-x-3 bottom-[76px] animate-od-fade-up overflow-hidden !p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {ALL_ITEMS.filter((i) => !MOBILE_PRIMARY.includes(i.href)).map((item) => (
              <Link key={item.href} href={item.href} className={`od-nav-item ${isActive(pathname, item.href) ? "is-active" : ""}`}>
                <span className="od-nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <div className="my-1 h-px bg-white/5" />
            <button onClick={handleLogout} className="od-nav-item w-full text-brand-danger">
              <span className="od-nav-icon">{ICONS.logout}</span>
              Sair
            </button>
          </div>
        </div>
      )}
    </>
  );
}
