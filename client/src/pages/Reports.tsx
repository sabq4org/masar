import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { Avatar, Spinner } from "../components/bits";
import { useTaskPane } from "../lib/taskPane";
import type { TaskRow } from "../lib/types";

interface Overview {
  totals: { open: number; overdue: number; dueToday: number; done7d: number; total: number };
  byDepartment: { id: number; nameAr: string; color: string; open: number; overdue: number; done: number }[];
  byUser: { id: number; name: string; avatarColor: string; open: number; overdue: number }[];
  byProject: { id: number; name: string; color: string; open: number; done: number; overdue: number }[];
}

export default function Reports() {
  const pane = useTaskPane();
  const { data, isLoading } = useQuery<Overview | null>({ queryKey: ["/api/reports/overview"] });
  const { data: attention } = useQuery<{ overdue: TaskRow[]; awaitingApproval: TaskRow[] } | null>({
    queryKey: ["/api/reports/attention"],
  });
  const { data: aiStatus } = useQuery<{ enabled: boolean } | null>({ queryKey: ["/api/ai/status"] });
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  if (isLoading || !data) return <Spinner />;

  const cards = [
    { label: "مهام مفتوحة", value: data.totals.open, tone: "text-ink" },
    { label: "متأخرة", value: data.totals.overdue, tone: "text-danger" },
    { label: "تستحق اليوم", value: data.totals.dueToday, tone: "text-wait" },
    { label: "أُنجزت خلال ٧ أيام", value: data.totals.done7d, tone: "text-success" },
  ];

  async function loadBrief() {
    setBriefLoading(true);
    try {
      const res = await fetch("/api/ai/daily-brief", { credentials: "include" });
      const json = await res.json();
      setBrief(res.ok ? json.brief : json.error);
    } catch {
      setBrief("تعذر توليد الملخص");
    }
    setBriefLoading(false);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-display text-xl font-bold">التقارير</h1>
        <div className="flex-1" />
        {aiStatus?.enabled && (
          <button
            onClick={loadBrief}
            disabled={briefLoading}
            className="flex items-center gap-1.5 rounded-field border border-line px-3 py-1.5 text-xs font-bold text-ink-2 hover:border-saffron hover:text-saffron disabled:opacity-50"
          >
            <Sparkles size={13} /> {briefLoading ? "يولّد…" : "الملخص الذكي"}
          </button>
        )}
        <a
          href="/api/tasks/export.csv"
          className="flex items-center gap-1.5 rounded-field border border-line px-3 py-1.5 text-xs font-bold text-ink-2 hover:border-saffron hover:text-saffron"
        >
          <Download size={13} /> تصدير CSV
        </a>
      </div>

      {brief && (
        <div className="mb-4 whitespace-pre-wrap rounded-card border border-review/30 bg-review/5 px-4 py-3 text-sm leading-relaxed">
          {brief}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-card border border-line bg-surface px-4 py-3 shadow-card">
            <div className={`font-latin text-2xl font-bold tabular-nums ${c.tone}`}>{c.value}</div>
            <div className="text-xs font-semibold text-ink-3">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* حسب المشروع */}
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold">حسب المشروع</h2>
          <div className="space-y-2.5">
            {data.byProject.map((p) => {
              const total = p.open + p.done;
              const pct = total ? Math.round((p.done / total) * 100) : 0;
              return (
                <div key={p.id}>
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />
                    <span className="flex-1 truncate font-semibold">{p.name}</span>
                    {p.overdue > 0 && <span className="font-bold text-danger tabular-nums">{p.overdue} متأخرة</span>}
                    <span className="text-ink-3 tabular-nums">{p.done}/{total}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-chip bg-line-soft">
                    <div className="h-full rounded-chip" style={{ width: `${pct}%`, background: p.color }} />
                  </div>
                </div>
              );
            })}
            {!data.byProject.length && <div className="text-xs text-ink-3">لا بيانات</div>}
          </div>
        </section>

        {/* حسب العضو */}
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold">عبء الأعضاء (المهام المفتوحة)</h2>
          <div className="space-y-2">
            {data.byUser.slice(0, 10).map((u) => {
              const max = Math.max(...data.byUser.map((x) => x.open), 1);
              return (
                <div key={u.id} className="flex items-center gap-2">
                  <Avatar name={u.name} color={u.avatarColor} size={6} />
                  <span className="w-24 flex-none truncate text-xs font-semibold">{u.name}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-md bg-line-soft">
                    <div
                      className="flex h-full items-center rounded-md bg-review px-1.5 text-[10px] font-bold text-paper tabular-nums"
                      style={{ width: `${Math.max((u.open / max) * 100, 8)}%` }}
                    >
                      {u.open}
                    </div>
                  </div>
                  {u.overdue > 0 && (
                    <span className="w-14 flex-none text-left text-[10px] font-bold text-danger tabular-nums">
                      {u.overdue} متأخرة
                    </span>
                  )}
                </div>
              );
            })}
            {!data.byUser.length && <div className="text-xs text-ink-3">لا مهام مسندة</div>}
          </div>
        </section>

        {/* يحتاج انتباهًا */}
        <section className="rounded-card border border-line bg-surface p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-bold">يحتاج انتباهك</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-bold text-danger">متأخرة</div>
              <div className="space-y-1">
                {(attention?.overdue ?? []).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => pane.open(t.id)}
                    className="flex w-full items-center gap-2 rounded-field border border-line-soft px-2.5 py-1.5 text-right text-xs font-semibold hover:bg-line-soft/50"
                  >
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    {t.assignee && <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size={5} />}
                  </button>
                ))}
                {!(attention?.overdue ?? []).length && (
                  <div className="text-xs text-ink-3">لا متأخرات — ممتاز</div>
                )}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-bold text-review">اعتمادات معلقة</div>
              <div className="space-y-1">
                {(attention?.awaitingApproval ?? []).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => pane.open(t.id)}
                    className="flex w-full items-center gap-2 rounded-field border border-line-soft px-2.5 py-1.5 text-right text-xs font-semibold hover:bg-line-soft/50"
                  >
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    {t.assignee && <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size={5} />}
                  </button>
                ))}
                {!(attention?.awaitingApproval ?? []).length && (
                  <div className="text-xs text-ink-3">لا اعتمادات معلقة</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
