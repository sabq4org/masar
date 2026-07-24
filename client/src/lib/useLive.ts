import { useEffect } from "react";
import { queryClient } from "./api";

const LIVE_PREFIXES = [
  "/api/tasks",
  "/api/projects",
  "/api/reports",
  "/api/notifications",
  "/api/my-tasks",
  "/api/activity",
];

/** اشتراك SSE: تجميع الإبطال لتجنّب عاصفة إعادة جلب عند كل بث */
export function useLive() {
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let pendingTypes = new Set<string>();

    function flush() {
      debounce = null;
      const types = pendingTypes;
      pendingTypes = new Set();
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = String(q.queryKey[0] ?? "");
          if (!LIVE_PREFIXES.some((p) => key.startsWith(p))) return false;
          // إن وصلت أنواع محددة — لا تُبطل التقارير إلا عند tasks/projects
          if (types.size === 0) return true;
          if (key.startsWith("/api/notifications")) return types.has("notifications") || types.has("tasks");
          if (key.startsWith("/api/reports")) return types.has("tasks") || types.has("projects");
          if (key.startsWith("/api/projects")) return types.has("projects") || types.has("tasks");
          if (key.startsWith("/api/my-tasks")) return types.has("tasks");
          if (key.startsWith("/api/activity"))
            return types.has("tasks") || types.has("projects") || types.has("notifications");
          if (key.startsWith("/api/tasks")) return types.has("tasks");
          return true;
        },
      });
    }

    function connect() {
      es = new EventSource("/api/events");
      es.onmessage = (ev) => {
        try {
          const batch = JSON.parse(ev.data) as Array<{ type?: string }>;
          if (Array.isArray(batch)) {
            for (const e of batch) if (e?.type) pendingTypes.add(e.type);
          }
        } catch {
          pendingTypes.add("tasks");
        }
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(flush, 700);
      };
      es.onerror = () => {
        es?.close();
        retry = setTimeout(connect, 5000);
      };
    }
    connect();

    return () => {
      es?.close();
      if (retry) clearTimeout(retry);
      if (debounce) clearTimeout(debounce);
    };
  }, []);
}
