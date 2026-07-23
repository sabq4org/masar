import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import clsx from "clsx";
import { Search, X } from "lucide-react";
import { Avatar, CheckCircle, ProjectDot } from "./bits";
import { useTaskPane } from "../lib/taskPane";

interface SearchResults {
  tasks: {
    id: number;
    title: string;
    isCompleted: boolean;
    project?: { id: number; name: string; color: string } | null;
    assignee?: { id: number; name: string; avatarColor: string } | null;
  }[];
  projects: { id: number; name: string; color: string }[];
  users: { id: number; name: string; avatarColor: string }[];
}

/** البحث الشامل — نافذة أسانا العلوية */
export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const pane = useTaskPane();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setDebounced("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { data } = useQuery<SearchResults | null>({
    queryKey: [`/api/search?q=${encodeURIComponent(debounced)}`],
    enabled: open && debounced.length > 0,
    staleTime: 5_000,
  });

  if (!open) return null;
  const results = data ?? { tasks: [], projects: [], users: [] };
  const empty =
    debounced && !results.tasks.length && !results.projects.length && !results.users.length;

  return (
    <div className="fixed inset-0 z-[80] bg-ink/20 p-4 pt-16" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-xl overflow-hidden rounded-card border border-line bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Search size={16} className="text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في المهام والمشاريع والأشخاص…"
            className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button onClick={onClose} className="text-ink-3 hover:text-ink" aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[26rem] overflow-y-auto p-2">
          {!debounced && (
            <div className="px-3 py-6 text-center text-xs text-ink-3">
              اكتب للبحث… <span className="mx-1 rounded border border-line px-1 font-latin">/</span> يفتح البحث من أي مكان
            </div>
          )}
          {empty && <div className="px-3 py-6 text-center text-xs text-ink-3">لا نتائج لـ«{debounced}»</div>}

          {results.tasks.length > 0 && (
            <>
              <div className="px-2 py-1 text-[10px] font-bold text-ink-3">المهام</div>
              {results.tasks.map((t) => (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onClose();
                    pane.open(t.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onClose();
                      pane.open(t.id);
                    }
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-field px-2 py-1.5 text-right hover:bg-line-soft"
                >
                  <CheckCircle checked={t.isCompleted} size={15} />
                  <span className={clsx("min-w-0 flex-1 truncate text-sm font-semibold", t.isCompleted && "text-ink-3")}>
                    {t.title}
                  </span>
                  {t.project && (
                    <span className="flex flex-none items-center gap-1 text-[11px] text-ink-3">
                      <ProjectDot color={t.project.color} size={7} />
                      {t.project.name}
                    </span>
                  )}
                </div>
              ))}
            </>
          )}

          {results.projects.length > 0 && (
            <>
              <div className="px-2 py-1 text-[10px] font-bold text-ink-3">المشاريع</div>
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onClose();
                    navigate(`/projects/${p.id}`);
                  }}
                  className="flex w-full items-center gap-2 rounded-field px-2 py-1.5 text-right text-sm font-semibold hover:bg-line-soft"
                >
                  <ProjectDot color={p.color} size={10} />
                  {p.name}
                </button>
              ))}
            </>
          )}

          {results.users.length > 0 && (
            <>
              <div className="px-2 py-1 text-[10px] font-bold text-ink-3">الأشخاص</div>
              {results.users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    onClose();
                    navigate("/teams");
                  }}
                  className="flex w-full items-center gap-2 rounded-field px-2 py-1.5 text-right text-sm font-semibold hover:bg-line-soft"
                >
                  <Avatar name={u.name} color={u.avatarColor} size={6} />
                  {u.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
