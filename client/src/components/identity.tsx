import { useI18n } from "../lib/i18n";

/**
 * شعار «مسار» — مطابق لبناء دليل الهوية:
 * الكلمة بخط Alexandria وكشيدة ممدودة، وسطر الكتابة يواصل طريقه
 * خارج الكلمة على مستوى الكشيدة نفسه لينتهي بنقطة زعفرانية.
 * النِّسَب مأخوذة من الوثيقة (بالنسبة لحجم الخط): السطر يبدأ بعد فجوة
 * 8٪ من نهاية الكلمة، طوله 57٪، سماكته 5٪، والنقطة قطرها 17٪.
 * بالإنجليزية: كلمة Masar بنفس الزخرفة (السطر + النقطة).
 */
export function MasarLogo({ size = 26 }: { size?: number }) {
  const { locale, t } = useI18n();
  const u = size / 120;
  const word = locale === "en" ? "Masar" : "مســــار";
  const isEn = locale === "en";
  return (
    <span
      className="relative inline-block select-none"
      style={{ paddingInlineEnd: isEn ? 72 * u : 110 * u, lineHeight: 1 }}
      aria-label={t("appName")}
    >
      <span
        style={{
          fontFamily: isEn
            ? "Alexandria, 'IBM Plex Sans', system-ui, sans-serif"
            : "Alexandria, 'IBM Plex Sans Arabic', sans-serif",
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1,
          color: "var(--masar-ink)",
        }}
      >
        {word}
      </span>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 14 * u,
          ...(isEn
            ? { left: "auto" as const, right: -60 * u, width: 52 * u }
            : { left: 32 * u, width: 68 * u }),
          height: Math.max(6 * u, 2),
          background: "var(--masar-ink)",
          borderRadius: 3 * u,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 7 * u,
          ...(isEn
            ? { left: "auto" as const, right: -78 * u }
            : { left: 6 * u }),
          width: Math.max(20 * u, 5),
          height: Math.max(20 * u, 5),
          background: "var(--masar-saffron)",
          borderRadius: "50%",
        }}
      />
    </span>
  );
}

/** «السطر الساري» — شريط تقدم: ممتلئ بالحبر خلفك، باهت أمامك، والنقطة الزعفرانية أنت هنا */
export function SariLine({ progress, color }: { progress: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div className="relative h-[3px] w-full" dir="rtl">
      <div className="absolute inset-0 rounded-chip bg-line" />
      <div
        className="absolute inset-y-0 right-0 rounded-chip"
        style={{ width: `${pct}%`, background: color ?? "var(--masar-ink)" }}
      />
      <span
        className="absolute top-1/2 h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-chip bg-saffron"
        style={{ right: `${pct}%` }}
      />
    </div>
  );
}
