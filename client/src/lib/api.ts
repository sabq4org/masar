import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await fetch(queryKey[0] as string, { credentials: "include" });
        if (res.status === 401) return null;
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "خطأ");
        return res.json();
      },
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export async function api(
  method: "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
): Promise<any> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "حدث خطأ غير متوقع");
  return data;
}
