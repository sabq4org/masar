import clsx from "clsx";

/** شعار «مسار» — كلمة بكشيدة ممدودة يواصل سطرها طريقه إلى نقطة زعفرانية */
export function MasarLogo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className={clsx("inline-flex flex-col", lg ? "gap-1" : "gap-0.5")}>
      <span className="flex items-end gap-2">
        <span
          className={clsx("font-display font-extrabold leading-none text-ink", lg ? "text-4xl" : "text-2xl")}
        >
          مســـار
        </span>
      </span>
      <span className="flex items-center" aria-hidden="true">
        <span className={clsx("h-[2px] rounded-chip bg-ink", lg ? "w-24" : "w-14")} />
        <span className={clsx("h-[2px] flex-1 rounded-chip bg-line", lg ? "min-w-8" : "min-w-5")} />
        <span
          className={clsx("rounded-chip bg-saffron", lg ? "h-2.5 w-2.5" : "h-2 w-2")}
        />
      </span>
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
