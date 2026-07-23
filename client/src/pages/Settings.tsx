import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { api, queryClient } from "../lib/api";
import type { Me } from "../lib/types";
import { PROJECT_COLORS } from "../lib/types";
import { Avatar } from "../components/bits";

/** الإعدادات — الملف الشخصي والمظهر */
export default function Settings({ me }: { me: Me }) {
  const [name, setName] = useState(me.name);
  const [color, setColor] = useState(me.avatarColor);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("PATCH", "/api/auth/me", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setMsg({ text: "حُفظت التغييرات ✓", ok: true });
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (e: Error) => {
      setMsg({ text: e.message, ok: false });
      setTimeout(() => setMsg(null), 4000);
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 font-display text-xl font-bold">الإعدادات</h1>

      {msg && (
        <div
          className={clsx(
            "mb-4 rounded-field border px-4 py-2 text-sm font-semibold",
            msg.ok ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger",
          )}
        >
          {msg.text}
        </div>
      )}

      <section className="mb-4 rounded-card border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-bold">الملف الشخصي</h2>
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={name || me.name} color={color} size={12} />
          <div className="text-xs text-ink-3">
            <div className="font-semibold text-ink">{me.email}</div>
            لون الصورة الرمزية يظهر لزملائك في المهام والتعليقات
          </div>
        </div>
        <label className="mb-1 block text-xs font-bold text-ink-2">الاسم</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-3 w-full rounded-field border border-line bg-paper px-3 py-2 text-sm focus:border-saffron focus:outline-none"
        />
        <label className="mb-1 block text-xs font-bold text-ink-2">لون الصورة الرمزية</label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={clsx("h-7 w-7 rounded-chip border-2", color === c ? "border-ink" : "border-transparent")}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
        <button
          onClick={() => save.mutate({ name: name.trim(), avatarColor: color })}
          disabled={!name.trim() || save.isPending}
          className="rounded-field bg-accent px-4 py-1.5 text-xs font-bold text-paper hover:opacity-90 disabled:opacity-40"
        >
          حفظ الملف الشخصي
        </button>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-bold">تغيير كلمة المرور</h2>
        <label className="mb-1 block text-xs font-bold text-ink-2">كلمة المرور الحالية</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="mb-3 w-full rounded-field border border-line bg-paper px-3 py-2 text-sm focus:border-saffron focus:outline-none"
        />
        <label className="mb-1 block text-xs font-bold text-ink-2">كلمة المرور الجديدة (٨ أحرف فأكثر)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-field border border-line bg-paper px-3 py-2 text-sm focus:border-saffron focus:outline-none"
        />
        <button
          onClick={() => {
            save.mutate({ password, currentPassword });
            setPassword("");
            setCurrentPassword("");
          }}
          disabled={password.length < 8 || !currentPassword || save.isPending}
          className="rounded-field bg-accent px-4 py-1.5 text-xs font-bold text-paper hover:opacity-90 disabled:opacity-40"
        >
          تغيير كلمة المرور
        </button>
      </section>
    </div>
  );
}
