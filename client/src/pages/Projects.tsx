import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Plus, Star, Users } from "lucide-react";
import { api, queryClient } from "../lib/api";
import type { Me, ProjectRow } from "../lib/types";
import { PROJECT_STATUS_META } from "../lib/types";
import type { MsgKey } from "../locales/en";
import { Spinner } from "../components/bits";
import { NewProjectModal } from "../components/Layout";
import { useI18n } from "../lib/i18n";

/** المشاريع — شبكة بطاقات بأسلوب أسانا مع المفضلة */
export default function Projects({ me }: { me: Me }) {
  const { t } = useI18n();
  const [newOpen, setNewOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const key = `/api/projects${showArchived ? "?archived=1" : ""}`;
  const { data, isLoading } = useQuery<ProjectRow[] | null>({ queryKey: [key] });
  const projects = Array.isArray(data) ? data : [];
  const canManage = me.permissions.includes("*") || me.permissions.includes("projects.manage");

  const star = useMutation({
    mutationFn: ({ id, starred }: { id: number; starred: boolean }) =>
      api(starred ? "DELETE" : "POST", `/api/projects/${id}/star`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
  });

  const sorted = [...projects].sort((a, b) => Number(b.isStarred) - Number(a.isStarred));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-display text-xl font-bold">{t("projects.title")}</h1>
        <div className="flex-1" />
        <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-semibold text-ink-3">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="accent-[var(--masar-saffron)]"
          />
          {t("projects.archived")}
        </label>
        {canManage && (
          <button
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-1.5 rounded-field bg-accent px-3 py-1.5 text-xs font-bold text-paper hover:opacity-90"
          >
            <Plus size={14} /> {t("projects.new")}
          </button>
        )}
      </div>

      {isLoading && <Spinner />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {canManage && !showArchived && (
          <button
            onClick={() => setNewOpen(true)}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line text-ink-3 hover:border-saffron hover:text-saffron"
          >
            <Plus size={20} />
            <span className="text-xs font-bold">{t("projects.create")}</span>
          </button>
        )}
        {sorted.map((p) => {
          const pct = p.taskCount ? Math.round(((p.doneCount ?? 0) / p.taskCount) * 100) : 0;
          const statusMeta = p.currentStatus ? PROJECT_STATUS_META[p.currentStatus] : null;
          const statusLabel = p.currentStatus
            ? t(`status.${p.currentStatus}` as MsgKey)
            : null;
          return (
            <div
              key={p.id}
              className="group relative rounded-card border border-line bg-surface p-4 shadow-card transition hover:border-ink-3/40"
            >
              <div className="mb-2.5 flex items-start gap-2.5">
                <span
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-field text-base font-bold text-paper"
                  style={{ background: p.color }}
                >
                  {p.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/projects/${p.id}`} className="block truncate text-sm font-bold hover:text-saffron">
                    {p.name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-3 tabular-nums">
                    <span>{t("projects.tasks", { n: p.taskCount ?? 0 })}</span>
                    {(p.memberCount ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Users size={10} /> {p.memberCount}
                      </span>
                    )}
                    {statusMeta && statusLabel && (
                      <span
                        className="rounded-chip px-1.5 font-bold"
                        style={{ background: statusMeta.color + "22", color: statusMeta.color }}
                      >
                        {statusLabel}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => star.mutate({ id: p.id, starred: !!p.isStarred })}
                  className={clsx(
                    "flex-none rounded p-1",
                    p.isStarred ? "text-saffron" : "text-ink-3 opacity-0 hover:text-saffron group-hover:opacity-100",
                  )}
                  title={p.isStarred ? t("projects.unstar") : t("projects.star")}
                >
                  <Star size={15} fill={p.isStarred ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="relative h-1 w-full overflow-hidden rounded-chip bg-line-soft">
                <div
                  className="absolute inset-y-0 end-0 rounded-chip"
                  style={{ width: `${pct}%`, background: p.color }}
                />
              </div>
              <div className="mt-1 text-start text-[10px] text-ink-3 tabular-nums">{t("ui.percent", { n: pct })}</div>
            </div>
          );
        })}
        {!isLoading && !projects.length && !canManage && (
          <div className="col-span-full rounded-card border border-dashed border-line py-14 text-center text-sm text-ink-3">
            {t("projects.empty")}
          </div>
        )}
      </div>

      {newOpen && <NewProjectModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}
