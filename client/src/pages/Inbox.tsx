import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Archive, BellOff, CheckCheck, Mail } from "lucide-react";
import { api, queryClient } from "../lib/api";
import type { NotificationRow } from "../lib/types";
import { Avatar, Spinner } from "../components/bits";
import { relTime } from "../lib/dates";
import { useTaskPane } from "../lib/taskPane";

/** الوارد — نموذج أسانا: الأنشطة غير المؤرشفة ثم الأرشيف */
export default function Inbox() {
  const pane = useTaskPane();
  const [tab, setTab] = useState<"inbox" | "archive">("inbox");
  const { data, isLoading } = useQuery<{ items: NotificationRow[]; unread: number } | null>({
    queryKey: ["/api/notifications"],
  });

  const items = data?.items ?? [];
  const inbox = items.filter((n) => !n.isRead);
  const archive = items.filter((n) => n.isRead);
  const list = tab === "inbox" ? inbox : archive;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  const mark = useMutation({
    mutationFn: ({ id, read }: { id: number; read: boolean }) =>
      api("POST", `/api/notifications/${id}/${read ? "read" : "unread"}`),
    onSuccess: invalidate,
  });
  const readAll = useMutation({
    mutationFn: () => api("POST", "/api/notifications/read-all"),
    onSuccess: invalidate,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 font-display text-xl font-bold">الوارد</h1>
      <div className="mb-3 flex items-center border-b border-line">
        {(
          [
            ["inbox", `الأنشطة${inbox.length ? ` (${inbox.length})` : ""}`],
            ["archive", "الأرشيف"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              "border-b-2 px-3 py-1.5 text-xs font-semibold",
              tab === key ? "border-saffron text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        {tab === "inbox" && inbox.length > 0 && (
          <button
            onClick={() => readAll.mutate()}
            className="flex items-center gap-1 pb-1 text-xs font-semibold text-ink-3 hover:text-saffron"
          >
            <CheckCheck size={13} /> أرشفة الكل
          </button>
        )}
      </div>

      {isLoading && <Spinner />}

      <div className="divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface">
        {list.map((n) => (
          <div
            key={n.id}
            onClick={() => {
              if (n.taskId) pane.open(n.taskId);
              if (!n.isRead) mark.mutate({ id: n.id, read: true });
            }}
            className={clsx(
              "group flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-line-soft/40",
              !n.isRead && "bg-accent-soft/20",
            )}
          >
            {n.actor ? (
              <Avatar name={n.actor.name} color={n.actor.avatarColor} src={n.actor.avatarUrl} size={8} />
            ) : (
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-chip bg-line-soft text-ink-3">
                <Mail size={14} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className={clsx("text-sm", !n.isRead && "font-bold")}>{n.title}</div>
              {n.body && <div className="mt-0.5 truncate text-xs text-ink-3">{n.body}</div>}
              <div className="mt-0.5 text-[10px] text-ink-3">{relTime(n.createdAt)}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                mark.mutate({ id: n.id, read: !n.isRead });
              }}
              className="hidden flex-none rounded p-1.5 text-ink-3 hover:bg-line-soft hover:text-ink group-hover:block"
              title={n.isRead ? "إعادة إلى الوارد" : "أرشفة"}
            >
              {n.isRead ? <Mail size={14} /> : <Archive size={14} />}
            </button>
          </div>
        ))}
        {!isLoading && !list.length && (
          <div className="flex flex-col items-center gap-2 py-14 text-ink-3">
            <BellOff size={22} />
            <span className="text-sm">
              {tab === "inbox" ? "لا جديد — الوارد نظيف" : "الأرشيف فارغ"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
