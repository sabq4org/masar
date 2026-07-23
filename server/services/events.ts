import { EventEmitter } from "events";

// ناقل أحداث داخل العملية — يكفي لنسخة Railway الواحدة؛
// عند التوسع لعدة نسخ يُستبدل بـ Redis pub/sub بنفس الواجهة
export const eventsBus = new EventEmitter();
eventsBus.setMaxListeners(500);

export type LiveEvent = {
  type: "tasks" | "projects" | "notifications" | "workflow";
  taskId?: number;
  projectId?: number;
};

let pending: LiveEvent[] = [];
let timer: NodeJS.Timeout | null = null;

/** بث مُجمّع: أحداث خلال 500م.ث تُرسل دفعة واحدة لتقليل الضجيج */
export function broadcast(event: LiveEvent) {
  pending.push(event);
  if (timer) return;
  timer = setTimeout(() => {
    const batch = pending;
    pending = [];
    timer = null;
    eventsBus.emit("batch", batch);
  }, 500);
}
