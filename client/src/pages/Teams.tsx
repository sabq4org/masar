import { useQuery } from "@tanstack/react-query";
import type { DepartmentRow, UserLite } from "../lib/types";
import { Avatar } from "../components/bits";

interface DeptStats {
  id: number;
  nameAr: string;
  color: string;
  open: number;
  overdue: number;
  done: number;
}

export default function Teams() {
  const { data: depsData } = useQuery<DepartmentRow[] | null>({ queryKey: ["/api/departments"] });
  const { data: usersData } = useQuery<UserLite[] | null>({ queryKey: ["/api/users"] });
  const { data: overview } = useQuery<{ byDepartment: DeptStats[] } | null>({
    queryKey: ["/api/reports/overview"],
  });

  const departments = Array.isArray(depsData) ? depsData : [];
  const users = Array.isArray(usersData) ? usersData : [];
  const stats = overview?.byDepartment ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-2xl font-extrabold">الفرق</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {departments.map((d) => {
          const members = users.filter((u) => u.departmentId === d.id);
          const s = stats.find((x) => x.id === d.id);
          return (
            <div key={d.id} className="rounded-xl border border-line bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: d.color }} />
                <h2 className="flex-1 font-bold">{d.nameAr}</h2>
                <span className="text-xs text-ink-3">{members.length} عضو</span>
              </div>
              <div className="mb-3 flex gap-4 text-xs">
                <span className="text-ink-2">
                  مفتوحة <b className="tabular-nums">{s?.open ?? 0}</b>
                </span>
                <span className={s?.overdue ? "font-bold text-red-600" : "text-ink-2"}>
                  متأخرة <b className="tabular-nums">{s?.overdue ?? 0}</b>
                </span>
                <span className="text-emerald-700">
                  منجزة <b className="tabular-nums">{s?.done ?? 0}</b>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <span
                    key={m.id}
                    className="flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs"
                  >
                    <Avatar name={m.name} color={m.avatarColor} size={6} />
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
      </div>
    </div>
  );
}
