import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, KeyRound } from "lucide-react";
import clsx from "clsx";
import { api, queryClient } from "../lib/api";
import type { DepartmentRow } from "../lib/types";
import type { MsgKey } from "../locales/en";
import { Avatar } from "../components/bits";
import { useI18n, useRoleLabel } from "../lib/i18n";

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
  departmentId: number | null;
  avatarColor: string;
  avatarUrl?: string | null;
  isActive: boolean;
}

interface RoleOpt {
  value: string;
  label: string;
}

interface RolesPayload {
  roles: RoleOpt[];
  groups: { label: string; roles: RoleOpt[] }[];
}

/** Arabic group labels from API → i18n keys */
const ROLE_GROUP_LABEL_KEYS: Record<string, MsgKey> = {
  "تنفيذي": "roleGroup.executive",
  "تشغيلي": "roleGroup.ops",
  "تخطيط وتطوير": "roleGroup.planning",
  "عام": "roleGroup.general",
};

export default function UsersAdmin() {
  const { t } = useI18n();
  const roleLabel = useRoleLabel();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member", departmentId: "" });
  const [error, setError] = useState<string | null>(null);

  const { data: usersData } = useQuery<AdminUser[] | null>({ queryKey: ["/api/admin/users"] });
  const { data: rolesData } = useQuery<RolesPayload | RoleOpt[] | null>({ queryKey: ["/api/roles"] });
  const { data: depsData } = useQuery<DepartmentRow[] | null>({ queryKey: ["/api/departments"] });
  const users = Array.isArray(usersData) ? usersData : [];
  const roleGroups =
    rolesData && !Array.isArray(rolesData) && Array.isArray(rolesData.groups)
      ? rolesData.groups
      : null;
  const rolesFlat = Array.isArray(rolesData)
    ? rolesData
    : rolesData && Array.isArray(rolesData.roles)
      ? rolesData.roles
      : [];
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
      setForm({ name: "", email: "", password: "", role: "member", departmentId: "" });
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
    const pwd = prompt(t("users.resetPrompt", { name: u.name }));
    if (pwd && pwd.length >= 8) update.mutate({ id: u.id, patch: { password: pwd } });
    else if (pwd) alert(t("users.passwordShort"));
  }

  function groupLabel(apiLabel: string) {
    const key = ROLE_GROUP_LABEL_KEYS[apiLabel];
    return key ? t(key) : apiLabel;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t("users.title")}</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-field bg-accent px-4 py-2 text-sm font-bold text-paper hover:opacity-90"
        >
          <Plus size={16} /> {t("users.new")}
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
          <Input label={t("users.name")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label={t("users.email")} type="email" dir="ltr" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Input label={t("users.password")} type="password" dir="ltr" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-2">{t("users.role")}</label>
            <RoleSelect
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              groups={roleGroups}
              flat={rolesFlat}
              roleLabel={roleLabel}
              groupLabel={groupLabel}
              className="w-full rounded-field border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-2">{t("users.team")}</label>
            <select
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              className="w-full rounded-field border border-line px-3 py-2 text-sm"
            >
              <option value="">{t("users.noTeam")}</option>
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
              {t("users.create")}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line bg-line-soft/60 text-start text-xs text-ink-2">
              <th className="px-4 py-2.5 font-bold">{t("users.user")}</th>
              <th className="px-4 py-2.5 font-bold">{t("users.role")}</th>
              <th className="px-4 py-2.5 font-bold">{t("users.team")}</th>
              <th className="px-4 py-2.5 font-bold">{t("users.status")}</th>
              <th className="px-4 py-2.5 font-bold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {users.map((u) => (
              <tr key={u.id} className={clsx(!u.isActive && "opacity-50")}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={u.name} color={u.avatarColor} src={u.avatarUrl} />
                    <div>
                      <div className="font-bold">{u.name}</div>
                      <div dir="ltr" className="text-xs text-ink-3">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <RoleSelect
                    value={u.role}
                    onChange={(v) => update.mutate({ id: u.id, patch: { role: v } })}
                    groups={roleGroups}
                    flat={rolesFlat}
                    roleLabel={roleLabel}
                    groupLabel={groupLabel}
                    className="rounded-field border border-line px-2 py-1 text-xs"
                  />
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
                    <option value="">{t("users.noTeam")}</option>
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
                    {u.isActive ? t("users.active") : t("users.inactive")}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => resetPassword(u)}
                    title={t("users.resetPassword")}
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

function RoleSelect({
  value,
  onChange,
  groups,
  flat,
  roleLabel,
  groupLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: { label: string; roles: RoleOpt[] }[] | null;
  flat: RoleOpt[];
  roleLabel: (role: string) => string;
  groupLabel: (apiLabel: string) => string;
  className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {groups
        ? groups.map((g) => (
            <optgroup key={g.label} label={groupLabel(g.label)}>
              {g.roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {roleLabel(r.value)}
                </option>
              ))}
            </optgroup>
          ))
        : flat.map((r) => (
            <option key={r.value} value={r.value}>
              {roleLabel(r.value)}
            </option>
          ))}
    </select>
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
