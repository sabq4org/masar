import { useState } from "react";
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

export default function Layout({ me, children }: { me: Me; children: React.ReactNode }) {
  const [location] = useLocation();
  useLive();
  const [night, setNight] = useState(
    () => document.documentElement.dataset.theme === "night",
  );

  const { data: notif } = useQuery<{ unread: number } | null>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30_000,
  });

  const can = (perm?: string) =>
    !perm || me.permissions.includes("*") || me.permissions.includes(perm);

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

  function NavLink({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: typeof ListTodo;
  }) {
    const active = href === "/" ? location === "/" : location.startsWith(href);
    const badge = href === "/inbox" ? (notif?.unread ?? 0) : 0;
    return (
      <Link
        href={href}
        className={clsx(
          "relative flex items-center gap-3 rounded-field px-3 py-2 text-sm font-semibold",
          active ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-line-soft",
        )}
      >
        {/* نقطة «أنت هنا» الزعفرانية */}
        {active && (
          <span className="absolute -right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-chip bg-saffron" />
        )}
        <Icon size={18} strokeWidth={1.8} />
        <span className="flex-1">{label}</span>
        {badge > 0 && (
          <span className="rounded-chip bg-saffron px-1.5 text-xs font-bold text-paper tabular-nums">
            {badge}
          </span>
        )}
      </Link>
    );
  }

  const adminItems = ADMIN_NAV.filter((i) => can(i.perm));

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 right-0 flex w-56 flex-col border-l border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <MasarLogo />
          <div className="mt-1.5 text-[11px] font-medium text-ink-3">صحيفة سبق</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.filter((i) => can(i.perm)).map((i) => (
            <NavLink key={i.href} {...i} />
          ))}
          {adminItems.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-4 text-[11px] font-bold text-ink-3">الإدارة</div>
              {adminItems.map((i) => (
                <NavLink key={i.href} {...i} />
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-line p-3">
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
        </div>
      </aside>
      <main className="mr-56 flex-1 p-6">{children}</main>
    </div>
  );
}
