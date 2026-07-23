import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, KeyRound } from "lucide-react";
import clsx from "clsx";
import { api, queryClient } from "../lib/api";
import type { DepartmentRow } from "../lib/types";
import { Avatar } from "../components/bits";

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
  departmentId: number | null;
  avatarColor: string;
  isActive: boolean;
}

export default function UsersAdmin() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "editor", departmentId: "" });
  const [error, setError] = useState<string | null>(null);

  const { data: usersData } = useQuery<AdminUser[] | null>({ queryKey: ["/api/admin/users"] });
  const { data: rolesData } = useQuery<{ value: string; label: string }[] | null>({ queryKey: ["/api/roles"] });
  const { data: depsData } = useQuery<DepartmentRow[] | null>({ queryKey: ["/api/departments"] });
  const users = Array.isArray(usersData) ? usersData : [];
  const roles = Array.isArray(rolesData) ? rolesData : [];
  const departments = Array.isArray(depsData) ? depsData : [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
  }

  const create = useMutation({
    mutationFn: () =>
      api("POST", "/api/admin/users", {
        ...form,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
      }),
    onSuccess: () => {
      setShowForm(false);
      setForm({ name: "", email: "", password: "", role: "editor", departmentId: "" });
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, unknown> }) =>
      api("PATCH", `/api/admin/users/${id}`, patch),
    onSuccess: invalidate,
    onError: (e: Error) => {
      setError(e.message);
      setTimeout(() => setError(null), 4000);
    },
  });

  function resetPassword(u: AdminUser) {
    const pwd = prompt(`كلمة مرور جديدة لـ ${u.name} (8 أحرف على الأقل):`);
    if (pwd && pwd.length >= 8) update.mutate({ id: u.id, patch: { password: pwd } });
    else if (pwd) alert("كلمة المرور قصيرة");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">المستخدمون</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-field bg-accent px-4 py-2 text-sm font-bold text-paper hover:opacity-90"
        >
          <Plus size={16} /> مستخدم جديد
        </button>
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
            create.mutate();
          }}
          className="mb-6 grid grid-cols-1 gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Input label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label="البريد" type="email" dir="ltr" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Input label="كلمة المرور (٨+ أحرف)" type="password" dir="ltr" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-2">الدور</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-field border border-line px-3 py-2 text-sm"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-2">الفريق</label>
            <select
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              className="w-full rounded-field border border-line px-3 py-2 text-sm"
            >
              <option value="">بلا فريق</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.nameAr}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              disabled={create.isPending}
              className="w-full rounded-field bg-accent py-2 font-bold text-paper disabled:opacity-50"
            >
              إنشاء
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line bg-line-soft/60 text-right text-xs text-ink-2">
              <th className="px-4 py-2.5 font-bold">المستخدم</th>
              <th className="px-4 py-2.5 font-bold">الدور</th>
              <th className="px-4 py-2.5 font-bold">الفريق</th>
              <th className="px-4 py-2.5 font-bold">الحالة</th>
              <th className="px-4 py-2.5 font-bold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {users.map((u) => (
              <tr key={u.id} className={clsx(!u.isActive && "opacity-50")}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={u.name} color={u.avatarColor} />
                    <div>
                      <div className="font-bold">{u.name}</div>
                      <div dir="ltr" className="text-xs text-ink-3">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={u.role}
                    onChange={(e) => update.mutate({ id: u.id, patch: { role: e.target.value } })}
                    className="rounded-field border border-line px-2 py-1 text-xs"
                  >
                    {roles.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={u.departmentId ?? ""}
                    onChange={(e) =>
                      update.mutate({
                        id: u.id,
                        patch: { departmentId: e.target.value ? Number(e.target.value) : null },
                      })
                    }
                    className="rounded-field border border-line px-2 py-1 text-xs"
                  >
                    <option value="">بلا فريق</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.nameAr}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => update.mutate({ id: u.id, patch: { isActive: !u.isActive } })}
                    className={clsx(
                      "rounded-chip px-2.5 py-0.5 text-xs font-bold",
                      u.isActive ? "bg-success/15 text-success" : "bg-line-soft text-ink-3",
                    )}
                  >
                    {u.isActive ? "نشط" : "معطّل"}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => resetPassword(u)}
                    title="إعادة تعيين كلمة المرور"
                    className="text-ink-3 hover:text-saffron"
                  >
                    <KeyRound size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  dir?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-ink-2">{label}</label>
      <input
        type={type}
        dir={dir}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          "w-full rounded-field border border-line px-3 py-2 text-sm focus:border-saffron focus:outline-none",
          dir === "ltr" && "text-left",
        )}
      />
    </div>
  );
}
