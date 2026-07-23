import { createContext, useContext, useState } from "react";

/** حالة لوحة تفاصيل المهمة — عامة على مستوى التطبيق حتى تفتح من أي صفحة (بحث، وارد…) */
const TaskPaneContext = createContext<{
  taskId: number | null;
  open: (id: number) => void;
  close: () => void;
}>({ taskId: null, open: () => {}, close: () => {} });

export function TaskPaneProvider({ children }: { children: React.ReactNode }) {
  const [taskId, setTaskId] = useState<number | null>(null);
  return (
    <TaskPaneContext.Provider
      value={{ taskId, open: (id) => setTaskId(id), close: () => setTaskId(null) }}
    >
      {children}
    </TaskPaneContext.Provider>
  );
}

export function useTaskPane() {
  return useContext(TaskPaneContext);
}
