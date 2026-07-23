import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, ListTodo, Sparkles, X } from "lucide-react";
import type { ApprovalRow, Me, ProjectRow, TaskRow } from "../lib/types";
import { Avatar, DueBadge, StatusChip } from "../components/bits";
import TaskSheet from "../components/TaskSheet";
import { SariLine } from "../components/identity";

interface Overview {
  totals: { open: number; overdue: number; dueToday: number; done7d: number; total: number };
  byStatus: { id: number; nameAr: string; color: string; count: number; category: string }[];
}

export default function OverviewPage({ me }: { me: Me }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const { data: overview } = useQuery<Overview | null>({ queryKey: ["/api/reports/overview"] });
  const { data: attention } = useQuery<{ overdue: TaskRow[]; awaitingApproval: TaskRow[] } | null>({
    queryKey: ["/api/reports/attention"],
  });
  const { data: projectsData } = useQuery<ProjectRow[] | null>({ queryKey: ["/api/projects"] });
  const { data: pendingData } = useQuery<ApprovalRow[] | null>({
    queryKey: ["/api/approvals/pending"],
  });
  const projects = (Array.isArray(projectsData) ? projectsData : []).slice(0, 6);
  const myApprovals = Array.isArray(pendingData) ? pendingData : [];
  const t = overview?.totals;

  const [brief, setBrief] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const canReports = me.permissions.includes("*") || me.permissions.includes("reports.view");
  const dailyBrief = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/daily-brief", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "تعذر توليد الملخص");
      return data as { brief: string };
    },
    onSuccess: (d) => setBrief(d.brief),
    onError: (e: Error) => setBriefError(e.message),
  });

  const CARDS = [
    { label: "مهام مفتوحة", value: t?.open, icon: ListTodo, cls: "text-saffron bg-accent-soft" },
    { label: "متأخرة", value: t?.overdue, icon: AlertTriangle, cls: "text-danger bg-danger/10" },
    { label: "تستحق اليوم", value: t?.dueToday, icon: Clock, cls: "text-wait bg-wait/10" },
    { label: "أُنجز آخر ٧ أيام", value: t?.done7d, icon: CheckCircle2, cls: "text-success bg-success/10" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">أهلًا، {me.name.split(" ")[0]}</h1>
        {canReports && (
          <button
            onClick={() => { setBriefError(null); dailyBrief.mutate(); }}
            disabled={dailyBrief.isPending}
            className="flex items-center gap-1.5 rounded-field border border-review/30 bg-review/10 px-3 py-1.5 text-sm font-bold text-review hover:bg-review/20 disabled:opacity-50"
          >
            <Sparkles size={15} /> {dailyBrief.isPending ? "يُولّد…" : "الملخص اليومي"}
          </button>
        )}
      </div>
      <p className="mb-6 text-sm text-ink-3">هذه نظرة عامة على غرفة الأخبار الآن</p>

      {briefError && (
        <div className="mb-4 rounded-field border border-wait/30 bg-wait/10 px-4 py-2 text-sm font-semibold text-wait">
          {briefError}
        </div>
      )}
      {brief && (
        <div className="mb-6 rounded-card border border-review/30 bg-review/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-bold text-review">
              <Sparkles size={15} /> ملخص الصباح — بالذكاء الاصطناعي
            </span>
            <button onClick={() => setBrief(null)} className="text-ink-3 hover:text-ink"><X size={15} /></button>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{brief}</div>
        </div>
      )}

      {/* بانتظار اعتمادي */}
      {myApprovals.length > 0 && (
        <div className="mb-6 rounded-card border border-wait/40 bg-wait/10">
          <h2 className="border-b border-wait/30 px-4 py-2.5 text-sm font-bold text-wait">
            بانتظار اعتمادك ({myApprovals.length})
          </h2>
          <div className="divide-y divide-wait/20">
            {myApprovals.map((a) => (
              <button
                key={a.id}
                onClick={() => a.task && setOpenId(a.task.id)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-right hover:bg-wait/10"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {a.task?.title}
                </span>
                <span className="text-xs text-ink-3 tabular-nums">
                  {new Date(a.createdAt).toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CARDS.map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="rounded-card border border-line bg-surface p-4">
            <div className={`mb-2 inline-flex rounded-field p-2 ${cls}`}>
              <Icon size={18} />
            </div>
            <div className="text-2xl font-extrabold tabular-nums">{value ?? "…"}</div>
            <div className="text-sm text-ink-2">{label}</div>
          </div>
        ))}
      </div>

      {/* توزيع الحالات */}
      {overview && overview.totals.total > 0 && (
        <div className="mb-6 rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold text-ink-2">توزيع المهام على الحالات</h2>
          <div className="flex h-4 overflow-hidden rounded-chip">
            {overview.byStatus
              .filter((s) => s.count > 0)
              .map((s) => (
                <div
                  key={s.id}
                  title={`${s.nameAr}: ${s.count}`}
                  style={{
                    background: s.color,
                    width: `${(s.count / overview.totals.total) * 100}%`,
                  }}
                />
              ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {overview.byStatus
              .filter((s) => s.count > 0)
              .map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 text-xs text-ink-2">
                  <span className="h-2 w-2 rounded-chip" style={{ background: s.color }} />
                  {s.nameAr} <b className="tabular-nums">{s.count}</b>
                </span>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AttentionList
          title="متأخرة — تحتاج تدخلًا"
          empty="لا مهام متأخرة"
          tasks={attention?.overdue ?? []}
          onOpen={setOpenId}
        />
        <AttentionList
          title="بانتظار الاعتماد"
          empty="لا شيء ينتظر الاعتماد"
          tasks={attention?.awaitingApproval ?? []}
          onOpen={setOpenId}
        />
      </div>

      {/* المشاريع النشطة */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-2">المشاريع النشطة</h2>
          <Link href="/projects" className="text-xs font-semibold text-saffron hover:underline">
            كل المشاريع ←
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const pct = p.taskCount ? Math.round(((p.doneCount ?? 0) / p.taskCount) * 100) : 0;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="rounded-card border border-line bg-surface p-3 hover:shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-chip" style={{ background: p.color }} />
                  <span className="flex-1 truncate text-sm font-bold">{p.name}</span>
                  <span className="text-xs tabular-nums text-ink-3">{pct}٪</span>
                </div>
                <div className="py-0.5"><SariLine progress={pct} color={p.color} /></div>
              </Link>
            );
          })}
          {projects.length === 0 && (
            <div className="col-span-full rounded-card border border-dashed border-line py-8 text-center text-sm text-ink-3">
              لا مشاريع نشطة
            </div>
          )}
        </div>
      </div>

      {openId && <TaskSheet taskId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function AttentionList({
  title,
  empty,
  tasks,
  onOpen,
}: {
  title: string;
  empty: string;
  tasks: TaskRow[];
  onOpen: (id: number) => void;
}) {
  return (
    <div className="rounded-card border border-line bg-surface">
      <h2 className="border-b border-line-soft px-4 py-2.5 text-sm font-bold text-ink-2">
        {title} <span className="tabular-nums text-ink-3">({tasks.length})</span>
      </h2>
      <div className="divide-y divide-line-soft">
        {tasks.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-ink-3">{empty}</div>
        )}
        {tasks.slice(0, 7).map((t) => (
          <button
            key={t.id}
            onClick={() => onOpen(t.id)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-right hover:bg-line-soft/50"
          >
            {t.project && (
              <span
                className="h-2 w-2 flex-none rounded-chip"
                style={{ background: t.project.color }}
              />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.title}</span>
            <StatusChip status={t.status} />
            <DueBadge task={t} />
            {t.assignee && <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size={6} />}
          </button>
        ))}
      </div>
    </div>
  );
}
