import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api, queryClient } from "../lib/api";
import type { DepartmentRow, Me, UserLite } from "../lib/types";
import { Avatar } from "../components/bits";

interface DeptStats {
  id: number;
  nameAr: string;
  color: string;
  open: number;
  overdue: number;
  done: number;
}

// ألوان الفرق تُشتق من عائلات الهوية — لا ألوان حرّة
const TEAM_COLORS = [
  "#33658A", "#2E7D5B", "#A87A0E", "#C2701E", "#46536B",
  "#5D8FB5", "#274E6D", "#B0413E", "#77705F", "#8C5A2E",
];

export default function Teams() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TEAM_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const { data: me } = useQuery<Me | null>({ queryKey: ["/api/auth/me"] });
  const { data: depsData } = useQuery<DepartmentRow[] | null>({ queryKey: ["/api/departments"] });
  const { data: usersData } = useQuery<UserLite[] | null>({ queryKey: ["/api/users"] });
  const { data: overview } = useQuery<{ byDepartment: DeptStats[] } | null>({
    queryKey: ["/api/reports/overview"],
  });

  const departments = Array.isArray(depsData) ? depsData : [];
  const users = Array.isArray(usersData) ? usersData : [];
  const stats = overview?.byDepartment ?? [];
  const canManage =
    me && (me.permissions.includes("*") || me.permissions.includes("users.manage"));

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 6000);
  }

  const create = useMutation({
    mutationFn: () => api("POST", "/api/departments", { nameAr: name.trim(), color }),
    onSuccess: () => {
      setName("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    },
    onError: (e: Error) => showError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api("DELETE", `/api/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
    },
    onError: (e: Error) => showError(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">الفرق</h1>
        {canManage && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-field bg-accent px-4 py-2 text-sm font-bold text-paper hover:opacity-90"
          >
            <Plus size={16} /> فريق جديد
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-field border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
          className="mb-6 flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-4"
        >
          <div className="min-w-56 flex-1">
            <label className="mb-1 block text-xs font-bold text-ink-2">اسم الفريق</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: البودكاست"
              className="w-full rounded-field border border-line bg-surface px-3 py-2 focus:border-saffron focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-2">اللون</label>
            <div className="flex gap-1.5">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-field border-2"
                  style={{
                    background: c,
                    borderColor: color === c ? "var(--masar-saffron)" : "transparent",
                  }}
                  title={c}
                />
              ))}
            </div>
          </div>
          <button
            disabled={create.isPending || !name.trim()}
            className="rounded-field bg-accent px-5 py-2 font-bold text-paper hover:opacity-90 disabled:opacity-50"
          >
            إضافة
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {departments.map((d) => {
          const members = users.filter((u) => u.departmentId === d.id);
          const s = stats.find((x) => x.id === d.id);
          return (
            <div key={d.id} className="rounded-card border border-line bg-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-3 w-3 rounded-chip" style={{ background: d.color }} />
                <h2 className="flex-1 font-bold">{d.nameAr}</h2>
                <span className="text-xs text-ink-3">{members.length} عضو</span>
                {canManage && (
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `حذف فريق «${d.nameAr}»؟\nسيُفك ارتباط الأعضاء والمهام والمشاريع بهذا الفريق.`,
                        )
                      )
                        remove.mutate(d.id);
                    }}
                    title="حذف الفريق"
                    className="text-ink-3 hover:text-danger"
                  >
                    <Trash2 size={15} strokeWidth={1.8} />
                  </button>
                )}
              </div>
              <div className="mb-3 flex gap-4 text-xs">
                <span className="text-ink-2">
                  مفتوحة <b className="tabular-nums">{s?.open ?? 0}</b>
                </span>
                <span className={s?.overdue ? "font-bold text-danger" : "text-ink-2"}>
                  متأخرة <b className="tabular-nums">{s?.overdue ?? 0}</b>
                </span>
                <span className="text-success">
                  منجزة <b className="tabular-nums">{s?.done ?? 0}</b>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <span
                    key={m.id}
                    className="flex items-center gap-1.5 rounded-chip border border-line px-2 py-0.5 text-xs"
                  >
                    <Avatar name={m.name} color={m.avatarColor} src={m.avatarUrl} size={6} />
                    {m.name}
                    <span className="text-ink-3">· {m.roleLabel}</span>
                  </span>
                ))}
                {members.length === 0 && (
                  <span className="text-xs text-ink-3">لا أعضاء بعد — أضفهم من «المستخدمون»</span>
                )}
              </div>
            </div>
          );
        })}
        {departments.length === 0 && (
          <div className="col-span-full rounded-card border border-dashed border-line py-12 text-center text-ink-3">
            لا فرق بعد{canManage ? " — أنشئ أول فريق من الزر أعلاه" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
