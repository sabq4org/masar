import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  Home,
  LayoutTemplate,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
  Sunrise,
  UserCog,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { Me, ProjectRow } from "../lib/types";
import { api, queryClient } from "../lib/api";
import { useLive } from "../lib/useLive";
import { useI18n } from "../lib/i18n";
import { MasarLogo } from "./identity";
import { Avatar, ProjectDot } from "./bits";
import { Popover } from "./pickers";
import GlobalSearch from "./GlobalSearch";
import TaskPane from "./TaskPane";
import { TaskPaneProvider } from "../lib/taskPane";

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export default function Layout({ me, children }: { me: Me; children: React.ReactNode }) {
  return (
    <TaskPaneProvider>
      <LayoutInner me={me}>{children}</LayoutInner>
      <TaskPane />
    </TaskPaneProvider>
  );
}

function LayoutInner({ me, children }: { me: Me; children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { t, locale, setLocale, dir } = useI18n();
  const isRtl = dir === "rtl";
  useLive();
  type ThemeId = "paper" | "dawn" | "night";
  const THEME_ORDER: ThemeId[] = ["paper", "dawn", "night"];
  const [theme, setTheme] = useState<ThemeId>(() => {
    const v = document.documentElement.dataset.theme;
    return v === "night" || v === "dawn" ? v : "paper";
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem("masar-nav") !== "collapsed";
    } catch {
      return true;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const { data: notif } = useQuery<{ unread: number } | null>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30_000,
  });
  const { data: projectsData } = useQuery<ProjectRow[] | null>({ queryKey: ["/api/projects"] });
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const starred = projects.filter((p) => p.isStarred);

  const can = (perm?: string) =>
    !perm || me.permissions.includes("*") || me.permissions.includes(perm);

  const quickTask = useMutation({
    mutationFn: (title: string) => api("POST", "/api/tasks", { title, assigneeId: me.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/tasks"),
      });
    },
  });

  function toggleSidebar() {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    try {
      localStorage.setItem("masar-nav", next ? "expanded" : "collapsed");
    } catch {}
  }

  function cycleTheme() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]!;
    setTheme(next);
    if (next === "paper") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("masar-theme", next);
    } catch {}
  }

  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]!;
  const themeLabel = (id: ThemeId) =>
    id === "dawn" ? t("nav.themeDawn") : id === "night" ? t("nav.themeNight") : t("nav.themePaper");
  const ThemeIcon = theme === "night" ? Moon : theme === "dawn" ? Sunrise : Sun;

  async function logout() {
    await api("POST", "/api/auth/logout");
    queryClient.clear();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }

  useEffect(() => setMobileOpen(false), [location]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "n" || e.key === "N" || e.key === "ى") {
        e.preventDefault();
        setCreateOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const NAV_TOP = [
    { href: "/", label: t("nav.home"), icon: Home },
    { href: "/my", label: t("nav.myTasks"), icon: CheckCircle2 },
    { href: "/inbox", label: t("nav.inbox"), icon: Bell, badge: notif?.unread ?? 0 },
  ];
  const NAV_INSIGHTS = [
    { href: "/reports", label: t("nav.reports"), icon: BarChart3, perm: "reports.view" },
  ].filter((i) => can(i.perm));
  const NAV_ADMIN = [
    { href: "/teams", label: t("nav.teams"), icon: Users },
    { href: "/templates", label: t("nav.templates"), icon: LayoutTemplate, perm: "projects.manage" },
    { href: "/users", label: t("nav.users"), icon: UserCog, perm: "users.manage" },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ].filter((i) => can(i.perm));

  function NavLink({
    href,
    label,
    icon: Icon,
    badge,
  }: {
    href: string;
    label: string;
    icon: typeof Home;
    badge?: number;
  }) {
    const active = href === "/" ? location === "/" : location.startsWith(href);
    return (
      <Link
        href={href}
        className={clsx(
          "relative flex items-center gap-2.5 rounded-field px-3 py-1.5 text-sm font-semibold",
          active ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-line-soft",
        )}
      >
        <Icon size={17} strokeWidth={1.9} />
        <span className="flex-1 truncate">{label}</span>
        {(badge ?? 0) > 0 && (
          <span className="rounded-chip bg-saffron px-1.5 text-[11px] font-bold text-paper tabular-nums">
            {badge}
          </span>
        )}
      </Link>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_TOP.map((i) => (
          <NavLink key={i.href} {...i} />
        ))}

        {NAV_INSIGHTS.length > 0 && (
          <>
            <div className="px-3 pb-0.5 pt-3 text-[10px] font-bold uppercase text-ink-3">{t("nav.insights")}</div>
            {NAV_INSIGHTS.map((i) => (
              <NavLink key={i.href} {...i} />
            ))}
          </>
        )}

        {starred.length > 0 && (
          <>
            <div className="flex items-center gap-1 px-3 pb-0.5 pt-3 text-[10px] font-bold text-ink-3">
              <Star size={10} className="text-saffron" fill="currentColor" /> {t("nav.starred")}
            </div>
            {starred.map((p) => (
              <ProjectLink key={p.id} p={p} location={location} />
            ))}
          </>
        )}

        <div className="flex items-center px-3 pb-0.5 pt-3">
          <span className="flex-1 text-[10px] font-bold uppercase text-ink-3">{t("nav.projects")}</span>
          {can("projects.manage") && (
            <button
              onClick={() => setNewProjectOpen(true)}
              className="rounded p-0.5 text-ink-3 hover:text-saffron"
              title={t("projects.new")}
            >
              <Plus size={13} />
            </button>
          )}
        </div>
        {projects.slice(0, 14).map((p) => (
          <ProjectLink key={p.id} p={p} location={location} />
        ))}
        <Link
          href="/projects"
          className={clsx(
            "block rounded-field px-3 py-1.5 text-xs font-semibold",
            location === "/projects" ? "bg-accent-soft text-ink" : "text-ink-3 hover:bg-line-soft",
          )}
        >
          {t("nav.allProjects")} {projects.length > 14 && `(${projects.length})`}
        </Link>

        <div className="px-3 pb-0.5 pt-3 text-[10px] font-bold uppercase text-ink-3">{t("nav.space")}</div>
        {NAV_ADMIN.map((i) => (
          <NavLink key={i.href} {...i} />
        ))}
      </nav>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden">
      {/* ─── الشريط العلوي ─── */}
      <header className="masar-safe-top fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-surface px-3">
        <button
          onClick={() => (window.innerWidth < 1024 ? setMobileOpen(true) : toggleSidebar())}
          className="rounded p-1.5 text-ink-2 hover:text-saffron"
          aria-label={t("nav.menu")}
        >
          <Menu size={18} />
        </button>
        <Link href="/" className="hidden sm:block">
          <MasarLogo size={22} />
        </Link>

        <div className="relative me-1">
          <button
            onClick={() => setCreateOpen(!createOpen)}
            className="flex items-center gap-1 rounded-chip border border-line bg-paper py-1 pe-3 ps-1.5 text-xs font-bold text-ink-2 hover:border-saffron hover:text-saffron"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-chip bg-saffron text-paper">
              <Plus size={13} strokeWidth={3} />
            </span>
            {t("nav.create")}
          </button>
          <CreateMenu
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            me={me}
            canProject={can("projects.manage")}
            onNewProject={() => setNewProjectOpen(true)}
          />
        </div>

        <button
          onClick={() => setSearchOpen(true)}
          className="mx-auto flex h-8 w-full max-w-md items-center gap-2 rounded-chip border border-line bg-paper px-3 text-xs text-ink-3 hover:border-ink-3"
        >
          <Search size={13} />
          <span className="flex-1 text-start">{t("search")}</span>
          <span className="rounded border border-line px-1 font-latin text-[10px]">/</span>
        </button>

        <button
          type="button"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          className="rounded-field border border-line px-2 py-1 text-[11px] font-bold text-ink-2 hover:border-saffron hover:text-saffron"
          title={t("nav.language")}
        >
          {locale === "ar" ? "EN" : "ع"}
        </button>

        <button
          type="button"
          onClick={cycleTheme}
          className="rounded p-1.5 text-ink-3 hover:text-saffron"
          title={t("nav.themeSwitchTo", { name: themeLabel(nextTheme) })}
        >
          <ThemeIcon size={16} />
        </button>
        <div className="relative">
          <button onClick={() => setUserMenu(!userMenu)} className="flex items-center gap-1">
            <Avatar name={me.name} color={me.avatarColor} src={me.avatarUrl} size={8} />
            <ChevronDown size={12} className="text-ink-3" />
          </button>
          <Popover open={userMenu} onClose={() => setUserMenu(false)} align="end" className="w-52">
            <div className="border-b border-line-soft px-2 py-1.5">
              <div className="text-sm font-bold">{me.name}</div>
              <div className="text-[11px] text-ink-3" dir="ltr">{me.email}</div>
            </div>
            <Link
              href="/settings"
              onClick={() => setUserMenu(false)}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs font-semibold hover:bg-line-soft"
            >
              <Settings size={13} /> {t("nav.settingsProfile")}
            </Link>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs font-semibold text-danger hover:bg-danger/10"
            >
              <LogOut size={13} /> {t("login.logout")}
            </button>
          </Popover>
        </div>
      </header>

      <div className="flex flex-1 pt-12">
        <aside
          className={clsx(
            "fixed bottom-0 top-12 z-20 hidden w-60 border-line bg-surface lg:block",
            isRtl ? "border-l" : "border-r",
            sidebarOpen
              ? isRtl
                ? "right-0"
                : "left-0"
              : isRtl
                ? "-right-60"
                : "-left-60",
          )}
        >
          {sidebar}
        </aside>

        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setMobileOpen(false)} />
            <aside
              className={clsx(
                "fixed inset-y-0 z-50 w-[min(17rem,85vw)] border-line bg-surface lg:hidden",
                isRtl ? "right-0 border-l" : "left-0 border-r",
              )}
            >
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <MasarLogo size={24} />
                <button onClick={() => setMobileOpen(false)} className="text-ink-3 hover:text-ink" aria-label={t("close")}>
                  <X size={18} />
                </button>
              </div>
              {sidebar}
            </aside>
          </>
        )}

        <main
          className={clsx(
            "min-w-0 flex-1 overflow-x-hidden px-3 py-4 sm:px-5 lg:px-7",
            sidebarOpen ? (isRtl ? "lg:mr-60" : "lg:ml-60") : isRtl ? "lg:mr-0" : "lg:ml-0",
          )}
        >
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      {newProjectOpen && <NewProjectModal onClose={() => setNewProjectOpen(false)} />}
    </div>
  );
}

function ProjectLink({ p, location }: { p: ProjectRow; location: string }) {
  const href = `/projects/${p.id}`;
  const active = location.startsWith(href);
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2.5 rounded-field px-3 py-1.5 text-sm font-semibold",
        active ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-line-soft",
      )}
    >
      <ProjectDot color={p.color} size={10} />
      <span className="flex-1 truncate">{p.name}</span>
    </Link>
  );
}

/** قائمة «إنشاء»: مهمة سريعة أو مشروع (نموذج أسانا) */
function CreateMenu({
  open,
  onClose,
  me,
  canProject,
  onNewProject,
}: {
  open: boolean;
  onClose: () => void;
  me: Me;
  canProject: boolean;
  onNewProject: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (taskTitle: string) => api("POST", "/api/tasks", { title: taskTitle, assigneeId: me.id }),
    onSuccess: () => {
      setTitle("");
      setError(null);
      onClose();
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/tasks"),
      });
    },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <Popover open={open} onClose={onClose} className="w-72 p-2">
      <div className="mb-1 px-1 text-[10px] font-bold text-ink-3">{t("nav.newTask")}</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (title.trim()) create.mutate(title.trim());
        }}
        className="mb-1.5 flex items-center gap-1.5"
      >
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("tasks.writeTitle")}
          className="min-w-0 flex-1 rounded-field border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-saffron focus:outline-none"
        />
        <button
          type="submit"
          disabled={!title.trim() || create.isPending}
          className="rounded-field bg-accent px-2.5 py-1.5 text-xs font-bold text-paper disabled:opacity-40"
        >
          {create.isPending ? "…" : t("add")}
        </button>
      </form>
      {error && <div className="mb-1.5 px-1 text-[11px] font-semibold text-danger">{error}</div>}
      {canProject && (
        <button
          onClick={() => {
            onClose();
            onNewProject();
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs font-semibold hover:bg-line-soft"
        >
          <Plus size={13} /> {t("nav.newProject")}
        </button>
      )}
    </Popover>
  );
}

/** نافذة مشروع جديد */
export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#C2701E");
  const [error, setError] = useState<string | null>(null);
  const COLORS = ["#C2701E", "#33658A", "#2E7D5B", "#B0413E", "#A87A0E", "#46536B", "#5D8FB5", "#8C5A2E", "#274E6D", "#77705F"];
  const create = useMutation({
    mutationFn: () => api("POST", "/api/projects", { name: name.trim(), color }),
    onSuccess: (p: { id: number }) => {
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/projects"),
      });
      onClose();
      navigate(`/projects/${p.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-card border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 font-display text-lg font-bold">{t("projects.new")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (name.trim()) create.mutate();
          }}
        >
          <label className="mb-1 block text-xs font-bold text-ink-2">{t("projects.name")}</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("projects.namePlaceholder")}
            className="mb-3 w-full rounded-field border border-line bg-paper px-3 py-2 text-sm focus:border-saffron focus:outline-none"
          />
          <label className="mb-1 block text-xs font-bold text-ink-2">{t("projects.color")}</label>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={clsx("h-7 w-7 rounded-chip border-2", color === c ? "border-ink" : "border-transparent")}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
          {error && (
            <div className="mb-3 rounded-field border border-danger/30 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-field px-3 py-1.5 text-xs font-bold text-ink-3 hover:bg-line-soft">
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || create.isPending}
              className="rounded-field bg-accent px-4 py-1.5 text-xs font-bold text-paper hover:opacity-90 disabled:opacity-40"
            >
              {create.isPending ? t("projects.creating") : t("projects.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
