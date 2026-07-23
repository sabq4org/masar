import { useState } from "react";
import { api, queryClient } from "../lib/api";
import { MasarLogo, SariLine } from "../components/identity";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/api/auth/login", { email, password });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper p-4">
      {/* نسيج ورقي خفيف */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, var(--masar-line-soft) 0 1px, transparent 1px), radial-gradient(circle at 80% 60%, var(--masar-line) 0 1px, transparent 1px)",
          backgroundSize: "28px 28px, 42px 42px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-saffron/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-review/10"
      />

      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-sheet border border-line bg-surface p-8 shadow-card"
      >
        <div className="mb-4 flex justify-center">
          <MasarLogo size={56} />
        </div>
        <p className="mb-2 text-center font-display text-sm font-semibold text-ink-2">
          من الفكرة إلى النشر… على سطرٍ واحد.
        </p>
        <div className="mx-auto mb-7 w-40">
          <SariLine progress={38} />
        </div>

        <label className="mb-1 block text-sm font-bold">البريد الإلكتروني</label>
        <input
          type="email"
          dir="ltr"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-field border border-line bg-surface px-3 py-2 text-left focus:border-saffron focus:outline-none"
        />
        <label className="mb-1 block text-sm font-bold">كلمة المرور</label>
        <input
          type="password"
          dir="ltr"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-field border border-line bg-surface px-3 py-2 text-left focus:border-saffron focus:outline-none"
        />
        {error && (
          <div className="mb-4 rounded-field border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
            {error}
          </div>
        )}
        <button
          disabled={busy}
          className="w-full rounded-field bg-ink py-2.5 font-bold text-paper hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "جارٍ الدخول…" : "دخول"}
        </button>
      </form>
    </div>
  );
}
