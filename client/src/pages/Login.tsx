import { useState } from "react";
import { api, queryClient } from "../lib/api";

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
        className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm"
      >
        <div className="mb-6 text-center">
          <div className="text-3xl font-extrabold text-accent">مسار</div>
          <div className="mt-1 text-sm text-ink-3">إدارة العمل التحريري</div>
        </div>
        <label className="mb-1 block text-sm font-bold">البريد الإلكتروني</label>
        <input
          type="email"
          dir="ltr"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-line px-3 py-2 text-left focus:border-accent focus:outline-none"
        />
        <label className="mb-1 block text-sm font-bold">كلمة المرور</label>
        <input
          type="password"
          dir="ltr"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-line px-3 py-2 text-left focus:border-accent focus:outline-none"
        />
        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-accent py-2.5 font-bold text-white hover:bg-accent-ink disabled:opacity-50"
        >
          {busy ? "جارٍ الدخول…" : "دخول"}
        </button>
      </form>
    </div>
  );
}
