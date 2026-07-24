import type { MyTaskSection, TaskRow } from "./types";
import { startOfDay } from "./dates";

const MS_DAY = 86400_000;
/** نافذة «قادمة»: غدًا حتى أسبوع */
const UPCOMING_DAYS = 7;

type BuiltinKind = "recent" | "today" | "upcoming" | "later";

const TITLE_KIND: Record<string, BuiltinKind> = {
  "المسندة حديثًا": "recent",
  "Recently assigned": "recent",
  اليوم: "today",
  Today: "today",
  قادمة: "upcoming",
  Upcoming: "upcoming",
  "لاحقًا": "later",
  لاحقا: "later",
  Later: "later",
};

function kindOfSection(s: MyTaskSection): BuiltinKind | "custom" {
  if (s.isDefault) return "recent";
  return TITLE_KIND[s.title] ?? "custom";
}

function daysUntilDue(dueAt: string | null): number | null {
  if (!dueAt) return null;
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueAt));
  return Math.round((due.getTime() - today.getTime()) / MS_DAY);
}

/**
 * توزيع مهامي بأسلوب أسانا حسب الاستحقاق:
 * - بلا تاريخ (وما زالت في الوارد) → المسندة حديثًا
 * - اليوم أو متأخرة → اليوم
 * - خلال ٧ أيام → قادمة
 * - أبعد من أسبوع → لاحقًا
 * القسم اليدوي (غير الوارد) يُحترم إن ثبّته المستخدم بالسحب.
 */
export function myTasksGroupId(
  task: TaskRow,
  sections: MyTaskSection[],
): number | null {
  if (!sections.length) return task.myTasksSectionId ?? null;

  const byKind = new Map<BuiltinKind, MyTaskSection>();
  for (const s of sections) {
    const k = kindOfSection(s);
    if (k !== "custom" && !byKind.has(k)) byKind.set(k, s);
  }
  const recent = byKind.get("recent") ?? sections.find((s) => s.isDefault) ?? sections[0];
  const today = byKind.get("today");
  const upcoming = byKind.get("upcoming");
  const later = byKind.get("later");

  const placed = task.myTasksSectionId
    ? sections.find((s) => s.id === task.myTasksSectionId)
    : null;

  // سحب يدوي إلى قسم مخصص أو إلى اليوم/قادمة/لاحقًا — يُحترم
  if (placed && kindOfSection(placed) !== "recent") {
    return placed.id;
  }

  const diff = daysUntilDue(task.dueAt);
  if (diff === null) return recent?.id ?? null;
  if (diff <= 0) return today?.id ?? recent?.id ?? null;
  if (diff <= UPCOMING_DAYS) return upcoming?.id ?? later?.id ?? recent?.id ?? null;
  return later?.id ?? upcoming?.id ?? recent?.id ?? null;
}
