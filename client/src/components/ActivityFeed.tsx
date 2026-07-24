import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { History } from "lucide-react";
import { Avatar, ProjectDot } from "./bits";
import { relTime } from "../lib/dates";
import { PROJECT_STATUS_META } from "../lib/types";
import { useTaskPane } from "../lib/taskPane";
import { useI18n } from "../lib/i18n";
import type { MsgKey } from "../locales/en";

interface FeedItem {
  key: string;
  kind: "task" | "comment" | "status_update";
  action: string;
  detail: any;
  createdAt: string;
  user: { id: number; name: string; avatarColor: string; avatarUrl?: string | null } | null;
  task: { id: number; title: string; isCompleted: boolean } | null;
  project: { id: number; name: string; color: string } | null;
}

const ACTION_DOTS: Record<string, string> = {
  completed: "var(--masar-success)",
  uncompleted: "var(--masar-wait)",
  created: "var(--masar-review)",
  commented: "var(--masar-saffron)",
  status_update: "var(--masar-ink-2)",
};

/** خط النشاط — كل خطوة في المساحة، لحظيًا (المسؤول يرى كل شيء) */
export default function ActivityFeed() {
  const { t } = useI18n();
  const pane = useTaskPane();
  const [limit, setLimit] = useState(25);
  const { data } = useQuery<{ items: FeedItem[]; scope: "all" | "mine" } | null>({
    queryKey: [`/api/activity?limit=${limit}`],
    refetchInterval: 60_000,
  });
  const items = data?.items ?? [];

  const verbOf = (action: string) => {
    const key = `activity.verb.${action}` as MsgKey;
    const v = t(key);
    return v === key ? t("activity.verb.generic") : v;
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card lg:col-span-2">
      <div className="mb-1 flex items-center gap-2">
        <History size={15} className="text-ink-3" />
        <span className="text-sm font-bold">{t("activity.title")}</span>
        <span className="rounded-chip bg-line-soft px-1.5 text-[10px] font-bold text-ink-3">
          {data?.scope === "all" ? t("activity.scopeAll") : t("activity.scopeMine")}
        </span>
        <span className="ms-auto flex items-center gap-1 text-[10px] font-semibold text-ink-3">
          <span className="masar-urgent-dot inline-block h-1.5 w-1.5 rounded-chip bg-success" />
          {t("activity.live")}
        </span>
      </div>

      <div className="relative mt-3 ps-0 pe-[7px]">
        {/* السطر الساري العمودي */}
        <span className="absolute bottom-2 end-[10px] top-1 w-px bg-line" aria-hidden />
        <div className="space-y-0.5">
          {items.map((item) => {
            const dot = ACTION_DOTS[item.action] ?? "var(--masar-line)";
            const statusMeta =
              item.kind === "status_update" && item.detail?.statusType
                ? PROJECT_STATUS_META[item.detail.statusType]
                : null;
            const statusLabel =
              item.kind === "status_update" && item.detail?.statusType
                ? t(`status.${item.detail.statusType}` as MsgKey)
                : null;
            return (
              <div
                key={item.key}
                role={item.task ? "button" : undefined}
                tabIndex={item.task ? 0 : undefined}
                onClick={() => item.task && pane.open(item.task.id)}
                onKeyDown={(e) => e.key === "Enter" && item.task && pane.open(item.task.id)}
                className={clsx(
                  "relative flex items-start gap-2.5 rounded-field py-1.5 ps-2 pe-4",
                  item.task && "cursor-pointer hover:bg-line-soft/40",
                )}
              >
                {/* نقطة الخط */}
                <span
                  className="absolute end-0 top-3 h-2 w-2 rounded-chip ring-4 ring-[var(--masar-surface)]"
                  style={{ background: dot }}
                  aria-hidden
                />
                {item.user ? (
                  <Avatar
                    name={item.user.name}
                    color={item.user.avatarColor}
                    src={item.user.avatarUrl}
                    size={6}
                  />
                ) : (
                  <span className="h-6 w-6 flex-none rounded-chip bg-line-soft" />
                )}
                <div className="min-w-0 flex-1 text-xs leading-relaxed">
                  <span className="font-bold">{item.user?.name ?? t("activity.system")}</span>{" "}
                  <span className="text-ink-2">{verbOf(item.action)}</span>{" "}
                  {item.task && (
                    <span className={clsx("font-semibold", item.task.isCompleted && "text-ink-3")}>
                      «{item.task.title}»
                    </span>
                  )}
                  {statusMeta && statusLabel && (
                    <span
                      className="mx-1 rounded-chip px-1.5 py-px text-[10px] font-bold"
                      style={{ background: statusMeta.color + "22", color: statusMeta.color }}
                    >
                      {statusLabel}
                    </span>
                  )}
                  {item.kind === "comment" && item.detail?.preview && (
                    <span className="text-ink-3">: {item.detail.preview}</span>
                  )}
                  {item.project && (
                    <span className="ms-1.5 inline-flex items-center gap-1 text-[10px] text-ink-3">
                      <ProjectDot color={item.project.color} size={6} />
                      {item.project.name}
                    </span>
                  )}
                </div>
                <span className="flex-none pt-0.5 text-[10px] tabular-nums text-ink-3">
                  {relTime(item.createdAt)}
                </span>
              </div>
            );
          })}
          {!items.length && (
            <div className="py-8 text-center text-xs text-ink-3">{t("activity.empty")}</div>
          )}
        </div>
      </div>

      {items.length >= limit && (
        <button
          onClick={() => setLimit((l) => Math.min(l + 25, 100))}
          className="mt-2 w-full rounded-field border border-line-soft py-1.5 text-xs font-semibold text-ink-3 hover:border-saffron hover:text-saffron"
        >
          {t("activity.loadMore")}
        </button>
      )}
    </section>
  );
}
