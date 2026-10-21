"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { usePrintTela } from "@/components/PrintTela";
import { clearToken, fetchMe, fetchProfile, type User } from "@/lib/api";
import { clearSnapshot } from "@/lib/offlineSnapshot";
import { useFocusTrap } from "@/lib/useFocusTrap";

type NavItem = { href: string; label: string; short?: string; icon: ReactNode; ai?: boolean };

const ico = (children: ReactNode) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const ICONS = {
  dashboard: ico(<><rect x="3" y="3" width="8" height="10" rx="2" /><rect x="13" y="3" width="8" height="6" rx="2" /><rect x="13" y="11" width="8" height="10" rx="2" /><rect x="3" y="15" width="8" height="6" rx="2" /></>),
  activities: ico(<path d="M3 12h4l3 8 4-16 3 8h4" />),
  calendar: ico(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>),
  load: ico(<><path d="M3 20h18" /><path d="M6 16v-4" /><path d="M10 16V8" /><path d="M14 16v-6" /><path d="M18 16V5" /></>),
  coach: ico(<><path d="M12 3a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3 3 3 0 0 0 3 3" /><path d="M12 3a3 3 0 0 1 3 3 3 3 0 0 1 3 3 3 3 0 0 1 0 6 3 3 0 0 1-3 3 3 3 0 0 1-3 3" /><path d="M12 3v18" /><path d="M9 9.5h1.5M13.5 14.5H15" /></>),
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
      { href: "/calendar", label: "Calendário", icon: ICONS.calendar },
      { href: "/performance", label: "Desempenho", icon: ICONS.load },
    ],
  },
  {
    label: "Inteligência",
    items: [{ href: "/coach", label: "Duni · treinadora", short: "Duni", icon: ICONS.coach, ai: true }],
  },
];

const PROFILE_ITEM: NavItem = { href: "/profile", label: "Perfil", icon: ICONS.profile };
const ALL_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), PROFILE_ITEM];
// Desempenho fica na folha "Mais"; o calendário de treinos ganhou o lugar na barra
const MOBILE_PRIMARY = ["/dashboard", "/activities", "/calendar", "/coach"];

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

  const abaAtual = ALL_ITEMS.find((i) => isActive(pathname, i.href));
  const print = usePrintTela(abaAtual?.label ?? (pathname.split("/")[1] || "tela"));

  function handleLogout() {
    clearToken();
    clearSnapshot();
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
        {/* a logo e o destaque da sidebar: brilho verde centrado atras dela */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64" style={{ background: "radial-gradient(ellipse 90% 70% at 50% 28%, rgba(0,255,102,0.13), transparent 70%)" }} />

        <Link href="/dashboard" className="relative flex h-[88px] items-center justify-center px-4 lg:h-auto lg:pb-7 lg:pt-8" aria-label="Kactus — Dashboard">
          <Logo size={110} stacked compactBelowLg />
        </Link>

        <nav className="relative flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-2" aria-label="Navegação lateral">
          {/* sem titulo de grupo: so um divisor fino entre os grupos, pra menu discreto */}
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className="mb-3">
              {gi > 0 && <div className="mx-auto mb-3 h-px w-6 bg-white/5 lg:mx-3 lg:w-auto" />}
              <ul className="space-y-0.5" aria-label={group.label}>
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
          <button
            onClick={print.gerar}
            disabled={print.gerando}
            title="Gera uma imagem da aba aberta inteira"
            className="mt-1 block w-full text-center text-[0.6rem] font-medium text-brand-muted/70 transition-colors hover:text-white disabled:opacity-50 lg:px-3 lg:text-left"
          >
            Print Tela
          </button>
        </div>
      </aside>

      {/* ───────── Mobile: top bar ───────── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 md:hidden"
        style={{
          height: "calc(3.5rem + env(safe-area-inset-top))",
          paddingTop: "env(safe-area-inset-top)",
          background: "rgba(10,10,10,0.82)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Link href="/dashboard" aria-label="Kactus — Dashboard"><Logo size={30} /></Link>
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
            className="od-panel od-panel-glass od-nav-sheet absolute inset-x-3 animate-od-fade-up overflow-hidden !p-2"
            style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
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
            <button
              onClick={() => { setMoreOpen(false); print.gerar(); }}
              disabled={print.gerando}
              className="block w-full px-3 pb-1 pt-1.5 text-left text-[0.66rem] font-medium text-brand-muted/70 disabled:opacity-50"
            >
              Print Tela
            </button>
          </div>
        </div>
      )}

      {print.aviso}
    </>
  );
}
