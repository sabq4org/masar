import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api, queryClient } from "../lib/api";
import type { StatusRow } from "../lib/types";

interface Transition {
  id: number;
  fromStatusId: number;
  toStatusId: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  planning: "تخطيط",
  active: "تنفيذ",
  blocked: "معاقة",
  review: "مراجعة",
  done: "منجزة",
  closed: "مغلقة",
};

export default function Settings() {
  const [error, setError] = useState<string | null>(null);
  const { data: statusesData } = useQuery<StatusRow[] | null>({ queryKey: ["/api/statuses"] });
  const { data: transData } = useQuery<Transition[] | null>({
    queryKey: ["/api/statuses/transitions"],
  });
  const statuses = Array.isArray(statusesData) ? statusesData : [];
  const transitions = Array.isArray(transData) ? transData : [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/api/statuses"] });
    queryClient.invalidateQueries({ queryKey: ["/api/statuses/transitions"] });
  }

  const patchStatus = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, string> }) =>
      api("PATCH", `/api/statuses/${id}`, patch),
    onSuccess: invalidate,
    onError: (e: Error) => showError(e.message),
  });

  const toggleTransition = useMutation({
    mutationFn: ({ from, to, exists }: { from: number; to: number; exists: boolean }) =>
      exists
        ? api("DELETE", `/api/statuses/transitions?fromStatusId=${from}&toStatusId=${to}`)
        : api("POST", "/api/statuses/transitions", { fromStatusId: from, toStatusId: to }),
    onSuccess: invalidate,
    onError: (e: Error) => showError(e.message),
  });

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  const has = (from: number, to: number) =>
    transitions.some((t) => t.fromStatusId === from && t.toStatusId === to);

  const nonClosed = statuses.filter((s) => s.category !== "closed");

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-2xl font-extrabold">إعدادات سير العمل</h1>
      {error && (
        <div className="mb-4 rounded-field border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      {/* الحالات */}
      <section className="mb-8 rounded-card border border-line bg-surface p-4">
        <h2 className="mb-1 text-sm font-bold text-ink-2">الحالات</h2>
        <p className="mb-3 text-xs text-ink-3">عدّل الاسم واللون مباشرة — التغيير ينعكس على كل العروض</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {statuses.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-field border border-line-soft px-3 py-2">
              <input
                type="color"
                value={s.color}
                onChange={(e) => patchStatus.mutate({ id: s.id, patch: { color: e.target.value } })}
                className="h-7 w-7 flex-none cursor-pointer rounded border-0 bg-transparent p-0"
                title="اللون"
              />
              <input
                defaultValue={s.nameAr}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== s.nameAr) patchStatus.mutate({ id: s.id, patch: { nameAr: v } });
                }}
                className="min-w-0 flex-1 rounded px-1 py-0.5 text-sm font-semibold focus:bg-line-soft focus:outline-none"
              />
              <span className="flex-none rounded-chip bg-line-soft px-2 py-0.5 text-[11px] text-ink-3">
                {CATEGORY_LABELS[s.category] ?? s.category}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* مصفوفة الانتقالات */}
      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="mb-1 text-sm font-bold text-ink-2">الانتقالات المسموحة</h2>
        <p className="mb-3 text-xs text-ink-3">
          الصف = من حالة، والعمود = إلى حالة. «مؤجلة» و«ملغاة» مسموحتان دائمًا من أي حالة فلا تظهران هنا.
        </p>
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky right-0 bg-surface p-1.5 text-right font-bold text-ink-2">من ↓ / إلى ←</th>
                {nonClosed.map((s) => (
                  <th key={s.id} className="p-1.5 font-bold" style={{ color: s.color }}>
                    <div className="max-w-16 truncate" title={s.nameAr}>{s.nameAr}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nonClosed.map((from) => (
                <tr key={from.id} className="border-t border-line-soft">
                  <td
                    className="sticky right-0 whitespace-nowrap bg-surface p-1.5 font-bold"
                    style={{ color: from.color }}
                  >
                    {from.nameAr}
                  </td>
                  {nonClosed.map((to) => {
                    if (from.id === to.id)
                      return <td key={to.id} className="p-1.5 text-center text-ink-3">—</td>;
                    const exists = has(from.id, to.id);
                    return (
                      <td key={to.id} className="p-1.5 text-center">
                        <button
                          onClick={() =>
                            toggleTransition.mutate({ from: from.id, to: to.id, exists })
                          }
                          className={clsx(
                            "h-5 w-5 rounded border text-[11px] font-bold leading-none",
                            exists
                              ? "border-success bg-success text-paper"
                              : "border-line bg-line-soft/50 text-transparent hover:border-ink-3",
                          )}
                          title={`${from.nameAr} ← ${to.nameAr}`}
                        >
                          ✓
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
