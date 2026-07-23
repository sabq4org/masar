import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ListTodo, FolderKanban, Bell, LogOut } from "lucide-react";
import clsx from "clsx";
import type { Me } from "../lib/types";
import { api, queryClient } from "../lib/api";

const NAV = [
  { href: "/", label: "مهامي", icon: ListTodo },
  { href: "/projects", label: "المشاريع", icon: FolderKanban },
  { href: "/inbox", label: "الإشعارات", icon: Bell },
];

export default function Layout({ me, children }: { me: Me; children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: notif } = useQuery<{ unread: number } | null>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30_000,
  });

  async function logout() {
    await api("POST", "/api/auth/logout");
    queryClient.clear();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 right-0 flex w-56 flex-col border-l border-line bg-white">
        <div className="border-b border-line px-5 py-4">
          <div className="text-2xl font-extrabold text-accent">مسار</div>
          <div className="text-xs text-ink-3">صحيفة سبق</div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            const badge = href === "/inbox" ? (notif?.unread ?? 0) : 0;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold",
                  active ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-line-soft",
                )}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {badge > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2 px-2 py-1">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: me.avatarColor }}
            >
              {me.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{me.name}</div>
            </div>
            <button onClick={logout} title="خروج" className="text-ink-3 hover:text-red-600">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="mr-56 flex-1 p-6">{children}</main>
    </div>
  );
}
