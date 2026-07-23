import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ListTodo,
  FolderKanban,
  Users,
  CalendarDays,
  BarChart3,
  Bell,
  UserCog,
  SlidersHorizontal,
  LayoutTemplate,
  LogOut,
  Moon,
  Sun,
  PanelRightClose,
  PanelRightOpen,
  Menu,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { Me } from "../lib/types";
import { api, queryClient } from "../lib/api";
import { useLive } from "../lib/useLive";
import { MasarLogo } from "./identity";

const NAV = [
  { href: "/", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/my", label: "مهامي", icon: ListTodo },
  { href: "/projects", label: "المشاريع", icon: FolderKanban },
  { href: "/templates", label: "القوالب", icon: LayoutTemplate, perm: "projects.manage" },
  { href: "/teams", label: "الفرق", icon: Users },
  { href: "/calendar", label: "التقويم", icon: CalendarDays },
  { href: "/reports", label: "التقارير", icon: BarChart3, perm: "reports.view" },
  { href: "/inbox", label: "الإشعارات", icon: Bell },
];

const ADMIN_NAV = [
  { href: "/users", label: "المستخدمون", icon: UserCog, perm: "users.manage" },
  { href: "/settings", label: "سير العمل", icon: SlidersHorizontal, perm: "workflow.manage" },
];

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export default function Layout({ me, children }: { me: Me; children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  useLive();
  const [night, setNight] = useState(
    () => document.documentElement.dataset.theme === "night",
  );
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("masar-nav") === "collapsed";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: notif } = useQuery<{ unread: number } | null>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30_000,
  });

  const can = (perm?: string) =>
    !perm || me.permissions.includes("*") || me.permissions.includes(perm);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("masar-nav", next ? "collapsed" : "expanded");
    } catch {}
  }

  function toggleNight() {
    const next = !night;
    setNight(next);
    if (next) document.documentElement.dataset.theme = "night";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("masar-theme", next ? "night" : "paper");
    } catch {}
  }

  async function logout() {
    await api("POST", "/api/auth/logout");
    queryClient.clear();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "n" || e.key === "N" || e.key === "ى") {
        e.preventDefault();
        if (location !== "/my") setLocation("/my");
        requestAnimationFrame(() => {
          document.getElementById("masar-quick-add")?.focus();
        });
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        const search = document.getElementById("masar-search");
        if (search) {
          search.focus();
          return;
        }
        if (location !== "/projects") setLocation("/projects");
        requestAnimationFrame(() => {
          document.getElementById("masar-search")?.focus();
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [location, setLocation]);

  function NavLink({
    href,
    label,
    icon: Icon,
    compact,
  }: {
    href: string;
    label: string;
    icon: typeof ListTodo;
    compact?: boolean;
  }) {
    const active = href === "/" ? location === "/" : location.startsWith(href);
    const badge = href === "/inbox" ? (notif?.unread ?? 0) : 0;
    return (
      <Link
        href={href}
        title={compact ? label : undefined}
        className={clsx(
          "relative flex items-center rounded-field text-sm font-semibold",
          compact ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
          active ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-line-soft",
        )}
      >
        {active && !compact && (
          <span className="absolute -right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-chip bg-saffron" />
        )}
        {active && compact && (
          <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-chip bg-saffron" />
        )}
        <Icon size={18} strokeWidth={1.8} />
        {!compact && <span className="flex-1">{label}</span>}
        {!compact && badge > 0 && (
          <span className="rounded-chip bg-saffron px-1.5 text-xs font-bold text-paper tabular-nums">
            {badge}
          </span>
        )}
        {compact && badge > 0 && (
          <span className="absolute -left-0.5 -top-0.5 h-2 w-2 rounded-chip bg-saffron" />
        )}
      </Link>
    );
  }

  const adminItems = ADMIN_NAV.filter((i) => can(i.perm));
  const navItems = NAV.filter((i) => can(i.perm));

  const sidebarInner = (compact: boolean, onNavigate?: () => void) => (
    <>
      <div
        className={clsx(
          "flex items-center border-b border-line",
          compact ? "justify-center px-2 py-4" : "justify-between px-4 py-4",
        )}
      >
        {compact ? (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-chip bg-ink text-sm font-bold text-paper"
            title="مسار"
          >
            م
          </span>
        ) : (
          <MasarLogo size={28} />
        )}
        {!compact && (
          <button
            onClick={toggleCollapsed}
            className="hidden text-ink-3 hover:text-saffron lg:block"
            title="طي الشريط"
          >
            <PanelRightClose size={18} strokeWidth={1.8} />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" onClick={onNavigate}>
        {navItems.map((i) => (
          <NavLink key={i.href} {...i} compact={compact} />
        ))}
        {adminItems.length > 0 && (
          <>
            {!compact && (
              <div className="px-3 pb-1 pt-4 text-[11px] font-bold text-ink-3">الإدارة</div>
            )}
            {compact && <div className="my-2 border-t border-line-soft" />}
            {adminItems.map((i) => (
              <NavLink key={i.href} {...i} compact={compact} />
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-line p-2">
        {compact ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-chip text-sm font-bold text-paper"
              style={{ background: me.avatarColor }}
              title={me.name}
            >
              {me.name.slice(0, 1)}
            </span>
            <button
              onClick={toggleCollapsed}
              title="توسيع الشريط"
              className="hidden text-ink-3 hover:text-saffron lg:block"
            >
              <PanelRightOpen size={16} strokeWidth={1.8} />
            </button>
            <button
              onClick={toggleNight}
              title={night ? "الوضع الورقي" : "حبر الليل"}
              className="text-ink-3 hover:text-saffron"
            >
              {night ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
            </button>
            <button onClick={logout} title="خروج" className="text-ink-3 hover:text-danger">
              <LogOut size={16} strokeWidth={1.8} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2 py-1">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-chip text-sm font-bold text-paper"
              style={{ background: me.avatarColor }}
            >
              {me.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{me.name}</div>
            </div>
            <button
              onClick={toggleNight}
              title={night ? "الوضع الورقي" : "حبر الليل"}
              className="text-ink-3 hover:text-saffron"
            >
              {night ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
            </button>
            <button onClick={logout} title="خروج" className="text-ink-3 hover:text-danger">
              <LogOut size={16} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* ديسكتوب */}
      <aside
        className={clsx(
          "fixed inset-y-0 right-0 z-30 hidden flex-col border-l border-line bg-surface lg:flex",
          collapsed ? "w-14" : "w-56",
        )}
      >
        {sidebarInner(collapsed)}
      </aside>

      {/* موبايل: زر فتح */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-surface px-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-ink-2 hover:text-saffron"
          aria-label="القائمة"
        >
          <Menu size={20} />
        </button>
        <MasarLogo size={22} />
      </header>

      {/* موبايل: درج */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-64 flex-col border-l border-line bg-surface lg:hidden">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute left-3 top-4 text-ink-3 hover:text-ink"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
            {sidebarInner(false, () => setMobileOpen(false))}
          </aside>
        </>
      )}

      <main
        className={clsx(
          "min-w-0 flex-1 p-4 pt-16 lg:p-5 lg:pt-5",
          collapsed ? "lg:mr-14" : "lg:mr-56",
        )}
      >
        {children}
      </main>
    </div>
  );
}
