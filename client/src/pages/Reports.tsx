import { useQuery } from "@tanstack/react-query";
import { Avatar } from "../components/bits";

interface Overview {
  totals: { open: number; overdue: number; dueToday: number; done7d: number; total: number };
  byStatus: { id: number; nameAr: string; color: string; count: number }[];
  byDepartment: { id: number; nameAr: string; color: string; open: number; overdue: number; done: number }[];
  byUser: { id: number; name: string; avatarColor: string; open: number; overdue: number }[];
}

export default function Reports() {
  const { data } = useQuery<Overview | null>({ queryKey: ["/api/reports/overview"] });
  if (!data) return <div className="text-ink-3">جارٍ التحميل…</div>;

  const maxDept = Math.max(1, ...data.byDepartment.map((d) => d.open + d.done));
  const maxUser = Math.max(1, ...data.byUser.map((u) => u.open));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">التقارير</h1>
        <a
          href="/api/tasks/export.csv"
          download
          className="rounded-field border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-line-soft"
        >
          تصدير CSV
        </a>
      </div>
      <p className="mb-6 text-sm text-ink-3">
        الأرقام مؤشرات سياقية وليست تقييمًا للأفراد — تُقرأ مع نوع المهام وتعقيدها
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["إجمالي المهام", data.totals.total, "text-ink"],
          ["مفتوحة", data.totals.open, "text-accent"],
          ["متأخرة", data.totals.overdue, "text-danger"],
          ["تستحق اليوم", data.totals.dueToday, "text-wait"],
          ["أُنجز آخر ٧ أيام", data.totals.done7d, "text-success"],
        ].map(([label, value, cls]) => (
          <div key={label as string} className="rounded-card border border-line bg-surface p-4 text-center">
            <div className={`text-2xl font-extrabold tabular-nums ${cls}`}>{value as number}</div>
            <div className="text-xs text-ink-2">{label as string}</div>
          </div>
        ))}
      </div>

      {/* أين يقف العمل — الحالات */}
      <section className="mb-6 rounded-card border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-ink-2">أين يقف العمل الآن (حسب الحالة)</h2>
        <div className="space-y-2">
          {data.byStatus
            .filter((s) => s.count > 0)
            .map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-32 flex-none text-xs font-semibold">{s.nameAr}</span>
                <div className="h-3.5 flex-1 overflow-hidden rounded-chip bg-line-soft">
                  <div
                    className="h-full rounded-chip"
                    style={{
                      background: s.color,
                      width: `${(s.count / Math.max(1, data.totals.total)) * 100}%`,
                    }}
                  />
                </div>
                <span className="w-8 flex-none text-left text-xs font-bold tabular-nums">{s.count}</span>
              </div>
            ))}
          {data.totals.total === 0 && (
            <div className="py-4 text-center text-sm text-ink-3">لا بيانات بعد</div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* إنجاز الفرق */}
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold text-ink-2">الفرق — مفتوحة ومنجزة</h2>
          <div className="space-y-3">
            {data.byDepartment.map((d) => (
              <div key={d.id}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span className="h-2 w-2 rounded-chip" style={{ background: d.color }} />
                    {d.nameAr}
                    {d.overdue > 0 && (
                      <span className="font-bold text-danger">· {d.overdue} متأخرة</span>
                    )}
                  </span>
                  <span className="tabular-nums text-ink-3">
                    {d.done} منجزة / {d.open} مفتوحة
                  </span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-chip bg-line-soft">
                  <div
                    className="h-full"
                    style={{ background: d.color, width: `${(d.done / maxDept) * 100}%` }}
                  />
                  <div
                    className="h-full opacity-40"
                    style={{ background: d.color, width: `${(d.open / maxDept) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {data.byDepartment.length === 0 && (
              <div className="py-4 text-center text-sm text-ink-3">
                لا مهام مسندة لفرق بعد — حدد فريق المهمة عند إنشائها
              </div>
            )}
          </div>
        </section>

        {/* أحمال العمل */}
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold text-ink-2">أحمال العمل — المهام المفتوحة لكل شخص</h2>
          <div className="space-y-2.5">
            {data.byUser.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5">
                <Avatar name={u.name} color={u.avatarColor} size={6} />
                <span className="w-28 flex-none truncate text-xs font-semibold">{u.name}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-chip bg-line-soft">
                  <div
                    className={u.overdue > 0 ? "h-full rounded-chip bg-danger" : "h-full rounded-chip bg-accent"}
                    style={{ width: `${(u.open / maxUser) * 100}%` }}
                  />
                </div>
                <span className="w-10 flex-none text-left text-xs tabular-nums">
                  {u.open}
                  {u.overdue > 0 && <span className="text-danger"> ({u.overdue})</span>}
                </span>
              </div>
            ))}
            {data.byUser.length === 0 && (
              <div className="py-4 text-center text-sm text-ink-3">لا مهام مسندة بعد</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
