import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, queryClient } from "../lib/api";
import type { DepartmentRow, ProjectRow } from "../lib/types";
import { SariLine } from "../components/identity";

const TYPE_LABELS: Record<string, string> = {
  coverage: "تغطية حدث",
  file: "ملف خاص",
  campaign: "حملة",
  dev: "تطويري",
  ops: "تشغيلي",
};

export default function Projects() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("ops");
  const [departmentId, setDepartmentId] = useState<number | "">("");

  const { data: projectsData } = useQuery<ProjectRow[] | null>({ queryKey: ["/api/projects"] });
  const { data: depsData } = useQuery<DepartmentRow[] | null>({ queryKey: ["/api/departments"] });
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const departments = Array.isArray(depsData) ? depsData : [];

  const create = useMutation({
    mutationFn: () => {
      const dep = departments.find((d) => d.id === departmentId);
      return api("POST", "/api/projects", {
        name,
        type,
        departmentId: departmentId === "" ? null : departmentId,
        color: dep?.color ?? "#33658A",
      });
    },
    onSuccess: () => {
      setShowForm(false);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">المشاريع</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-field bg-accent px-4 py-2 text-sm font-bold text-paper hover:opacity-90"
        >
          <Plus size={16} /> مشروع جديد
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
          className="mb-6 flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-4"
        >
          <div className="min-w-56 flex-1">
            <label className="mb-1 block text-xs font-bold text-ink-2">اسم المشروع</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-field border border-line px-3 py-2 focus:border-saffron focus:outline-none"
              placeholder="مثال: تغطية موسم الحج"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-2">النوع</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-field border border-line px-3 py-2"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-2">الفريق</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : "")}
              className="rounded-field border border-line px-3 py-2"
            >
              <option value="">بلا فريق</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.nameAr}</option>
              ))}
            </select>
          </div>
          <button
            disabled={create.isPending}
            className="rounded-field bg-accent px-5 py-2 font-bold text-paper disabled:opacity-50"
          >
            إنشاء
          </button>
          {create.isError && (
            <div className="w-full text-sm text-danger">{(create.error as Error).message}</div>
          )}
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const pct = p.taskCount ? Math.round(((p.doneCount ?? 0) / p.taskCount) * 100) : 0;
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="rounded-card border border-line bg-surface p-4 transition hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-chip" style={{ background: p.color }} />
                <span className="flex-1 truncate font-bold">{p.name}</span>
                <span className="rounded-chip bg-line-soft px-2 py-0.5 text-xs text-ink-2">
                  {TYPE_LABELS[p.type] ?? p.type}
                </span>
              </div>
              <div className="mb-1 flex justify-between text-xs text-ink-3 tabular-nums">
                <span>{p.doneCount ?? 0} / {p.taskCount ?? 0} مهمة</span>
                <span>{pct}٪</span>
              </div>
              <div className="py-1"><SariLine progress={pct} color={p.color} /></div>
            </Link>
          );
        })}
        {projects.length === 0 && (
          <div className="col-span-full rounded-card border border-dashed border-line py-12 text-center text-ink-3">
            لا مشاريع بعد — أنشئ أول مشروع من الزر أعلاه
          </div>
        )}
      </div>
    </div>
  );
}
