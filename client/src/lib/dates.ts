export type DateLocale = "ar" | "en";

const MS_DAY = 86400_000;

let locale: DateLocale = "ar";

export function setDatesLocale(l: DateLocale) {
  locale = l;
}

function dateLocale() {
  return locale === "en" ? "en-US" : "ar-SA-u-ca-gregory";
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

/** نص الاستحقاق: اليوم / غدًا / Today / Tomorrow… */
export function dueLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diff = Math.round((target.getTime() - today.getTime()) / MS_DAY);
  if (diff === 0) return locale === "en" ? "Today" : "اليوم";
  if (diff === 1) return locale === "en" ? "Tomorrow" : "غدًا";
  if (diff === -1) return locale === "en" ? "Yesterday" : "أمس";
  if (diff > 1 && diff < 7)
    return d.toLocaleDateString(dateLocale(), { weekday: "long" });
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString(dateLocale(), {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
}

export function dueTone(iso: string | null, isCompleted: boolean): string {
  if (!iso || isCompleted) return "text-ink-3";
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(iso));
  const diff = Math.round((target.getTime() - today.getTime()) / MS_DAY);
  if (diff < 0) return "text-danger";
  if (diff <= 1) return "text-success";
  return "text-ink-3";
}

export function relTime(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return locale === "en" ? "Just now" : "الآن";
  const m = Math.round(s / 60);
  if (m < 60) return locale === "en" ? `${m}m ago` : `قبل ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return locale === "en" ? `${h}h ago` : `قبل ${h} س`;
  const d = Math.round(h / 24);
  if (d < 7) return locale === "en" ? `${d}d ago` : `قبل ${d} ي`;
  return new Date(iso).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" });
}

export function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLine(): string {
  return new Date().toLocaleDateString(dateLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function greeting(name: string, loc: DateLocale = locale): string {
  const h = new Date().getHours();
  const first = name.split(" ")[0];
  if (loc === "en") {
    if (h < 12) return `Good morning, ${first}`;
    if (h < 17) return `Good afternoon, ${first}`;
    return `Good evening, ${first}`;
  }
  if (h < 12) return `صباح الخير، ${first}`;
  if (h < 17) return `مساء الخير، ${first}`;
  return `مساء الخير، ${first}`;
}
