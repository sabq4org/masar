import { useEffect } from "react";
import { queryClient } from "./api";

const LIVE_PREFIXES = [
  "/api/tasks",
  "/api/projects",
  "/api/reports",
  "/api/notifications",
  "/api/my-tasks",
];

/** اشتراك SSE: أي تغيير على المهام لدى أي مستخدم يبطل الكاش فتتحدث الشاشة لحظيًا */
export function useLive() {
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      es = new EventSource("/api/events");
      es.onmessage = () => {
        queryClient.invalidateQueries({
          predicate: (q) => {
            const key = String(q.queryKey[0]);
            return LIVE_PREFIXES.some((p) => key.startsWith(p));
          },
        });
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
    };
  }, []);
}
