import { useState } from "react";
import { api, queryClient } from "../lib/api";
import { MasarLogo } from "../components/identity";

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
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-sheet border border-line bg-surface p-8 shadow-card"
      >
        <div className="mb-2 flex justify-center">
          <MasarLogo size="lg" />
        </div>
        <p className="mb-1 text-center text-sm text-ink-2">
          من الفكرة إلى النشر… على سطرٍ واحد.
        </p>
        <p className="mb-7 text-center text-[11px] font-medium text-ink-3">صحيفة سبق</p>

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
