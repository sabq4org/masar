import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2, FolderPlus, Sparkles } from "lucide-react";
import { api, queryClient } from "../lib/api";
import type { DepartmentRow, TemplateRow } from "../lib/types";

export default function Templates() {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { data: templatesData } = useQuery<TemplateRow[] | null>({ queryKey: ["/api/templates"] });
  const { data: depsData } = useQuery<DepartmentRow[] | null>({ queryKey: ["/api/departments"] });
  const templates = Array.isArray(templatesData) ? templatesData : [];
  const departments = Array.isArray(depsData) ? depsData : [];

  const instantiate = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api("POST", `/api/templates/${id}/instantiate`, { name }),
    onSuccess: (project: { id: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      navigate(`/projects/${project.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api("DELETE", `/api/templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/templates"] }),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-extrabold">قوالب المشاريع</h1>
      <p className="mb-6 text-sm text-ink-3">
        احفظ أي مشروع كقالب من صفحته (زر «حفظ كقالب»)، ثم أنشئ منه تغطيات جديدة بنقرة
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {templates.map((t) => {
          const sections = (t.structure?.sections ?? []) as {
            title: string;
            tasks: { title: string }[];
          }[];
          const taskCount = sections.reduce((n, s) => n + s.tasks.length, 0);
          return (
            <div key={t.id} className="rounded-xl border border-line bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                <h2 className="flex-1 truncate font-bold">{t.name}</h2>
                <button
                  onClick={() => confirm(`حذف قالب «${t.name}»؟`) && remove.mutate(t.id)}
                  className="text-ink-3 hover:text-red-600"
                  title="حذف القالب"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mb-3 text-xs text-ink-3">
                {sections.length} أقسام · {taskCount} مهمة
              </div>
              <div className="mb-3 space-y-1">
                {sections.slice(0, 3).map((s, i) => (
                  <div key={i} className="truncate text-xs text-ink-2">
                    <b>{s.title}</b>: {s.tasks.map((x) => x.title).join("، ").slice(0, 80)}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const name = prompt("اسم المشروع الجديد:", t.name.replace(/^قالب\s*[—-]\s*/, ""));
                  if (name?.trim()) instantiate.mutate({ id: t.id, name: name.trim() });
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-sm font-bold text-white hover:bg-accent-ink"
              >
                <FolderPlus size={15} /> إنشاء مشروع من القالب
              </button>
            </div>
          );
        })}
        {templates.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-line py-12 text-center text-ink-3">
            <Sparkles className="mx-auto mb-2 text-ink-3" size={24} />
            لا قوالب بعد — افتح أي مشروع واضغط «حفظ كقالب»
          </div>
        )}
      </div>
      {departments.length === 0 && null}
    </div>
  );
}
