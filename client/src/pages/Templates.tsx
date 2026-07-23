import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2, FolderPlus, Sparkles } from "lucide-react";
import { api, queryClient } from "../lib/api";
import type { DepartmentRow, TemplateRow } from "../lib/types";
import { useI18n } from "../lib/i18n";

export default function Templates() {
  const { t, locale } = useI18n();
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
      <h1 className="mb-1 text-2xl font-extrabold">{t("templates.title")}</h1>
      <p className="mb-6 text-sm text-ink-3">{t("templates.subtitle")}</p>

      {error && (
        <div className="mb-4 rounded-field border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {templates.map((tpl) => {
          const sections = (tpl.structure?.sections ?? []) as {
            title: string;
            tasks: { title: string }[];
          }[];
          const taskCount = sections.reduce((n, s) => n + s.tasks.length, 0);
          return (
            <div key={tpl.id} className="rounded-card border border-line bg-surface p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-chip" style={{ background: tpl.color }} />
                <h2 className="flex-1 truncate font-bold">{tpl.name}</h2>
                <button
                  onClick={() => confirm(t("templates.deleteConfirm", { name: tpl.name })) && remove.mutate(tpl.id)}
                  className="text-ink-3 hover:text-danger"
                  title={t("templates.deleteTitle")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mb-3 text-xs text-ink-3">
                {t("templates.sectionsTasks", { sections: sections.length, tasks: taskCount })}
              </div>
              <div className="mb-3 space-y-1">
                {sections.slice(0, 3).map((s, i) => (
                  <div key={i} className="truncate text-xs text-ink-2">
                    <b>{s.title}</b>: {s.tasks.map((x) => x.title).join(locale === "en" ? ", " : "، ").slice(0, 80)}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const name = prompt(t("templates.newProjectName"), tpl.name.replace(/^قالب\s*[—-]\s*/, ""));
                  if (name?.trim()) instantiate.mutate({ id: tpl.id, name: name.trim() });
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-field bg-accent py-2 text-sm font-bold text-paper hover:opacity-90"
              >
                <FolderPlus size={15} /> {t("templates.use")}
              </button>
            </div>
          );
        })}
        {templates.length === 0 && (
          <div className="col-span-full rounded-card border border-dashed border-line py-12 text-center text-ink-3">
            <Sparkles className="mx-auto mb-2 text-ink-3" size={24} />
            {t("templates.emptyHint")}
          </div>
        )}
      </div>
      {departments.length === 0 && null}
    </div>
  );
}
