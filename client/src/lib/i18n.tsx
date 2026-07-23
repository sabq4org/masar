import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ar } from "../locales/ar";
import { en, type MsgKey } from "../locales/en";
import { setDatesLocale } from "./dates";

export type Locale = "ar" | "en";

type Vars = Record<string, string | number>;

type I18nCtx = {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (l: Locale) => void;
  t: (key: MsgKey, vars?: Vars) => string;
};

const catalogs = { ar, en } as const;

const I18nContext = createContext<I18nCtx | null>(null);

function readStored(): Locale {
  try {
    const v = localStorage.getItem("masar-lang");
    if (v === "en" || v === "ar") return v;
  } catch {}
  return "ar";
}

function applyDocument(locale: Locale) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = locale;
  document.documentElement.dir = dir;
  document.title = locale === "ar" ? "مسار — من الفكرة إلى النشر" : "Masar — From idea to delivery";
  setDatesLocale(locale);
}

function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = readStored();
    applyDocument(initial);
    return initial;
  });

  useEffect(() => {
    applyDocument(locale);
    try {
      localStorage.setItem("masar-lang", locale);
    } catch {}
  }, [locale]);

  const value = useMemo<I18nCtx>(() => {
    const dict = catalogs[locale];
    return {
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      setLocale: setLocaleState,
      t: (key, vars) => format(dict[key] ?? en[key] ?? key, vars),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LocaleProvider");
  return ctx;
}

/** ترجمة دور من كود الـ API */
export function useRoleLabel() {
  const { t } = useI18n();
  return (role: string) => {
    const key = `role.${role}` as MsgKey;
    const translated = t(key);
    return translated === key ? role : translated;
  };
}
