export interface Me {
  id: number;
  email: string;
  name: string;
  role: string;
  departmentId: number | null;
  avatarColor: string;
  permissions: string[];
}

export interface StatusRow {
  id: number;
  key: string;
  nameAr: string;
  color: string;
  category: string;
  orderIndex: number;
  isDefault: boolean;
}

export interface UserLite {
  id: number;
  name: string;
  role: string;
  roleLabel?: string;
  avatarColor: string;
  departmentId: number | null;
}

export interface DepartmentRow {
  id: number;
  nameAr: string;
  color: string;
}

export interface ProjectRow {
  id: number;
  name: string;
  description: string | null;
  type: string;
  color: string;
  status: string;
  departmentId: number | null;
  ownerId: number | null;
  taskCount?: number;
  doneCount?: number;
  sections?: { id: number; title: string; orderIndex: number }[];
}

export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  statusId: number;
  priority: "low" | "normal" | "high" | "urgent";
  progress: number;
  tags: string[];
  assigneeId: number | null;
  projectId: number | null;
  sectionId: number | null;
  dueAt: string | null;
  startAt: string | null;
  completedAt: string | null;
  linkUrl: string | null;
  isArchived: boolean;
  createdAt: string;
  status?: StatusRow;
  assignee?: { id: number; name: string; avatarColor: string } | null;
  project?: { id: number; name: string; color: string } | null;
}

export interface ApprovalRow {
  id: number;
  taskId: number;
  requestedById: number;
  approverId: number;
  state: "pending" | "approved" | "changes_requested" | "rejected";
  note: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  task?: TaskRow;
}

export interface TemplateRow {
  id: number;
  name: string;
  description: string | null;
  type: string;
  color: string;
  structure: { sections: { title: string; tasks: { title: string }[] }[] };
  createdAt: string;
}

export interface TaskDetail extends TaskRow {
  dependencies: { id: number; blockedByTaskId: number; title: string; statusId: number }[];
  approvals: ApprovalRow[];
  createdBy?: { id: number; name: string } | null;
  subtasks: { id: number; title: string; isDone: boolean }[];
  comments: {
    id: number;
    content: string;
    createdAt: string;
    user: { id: number; name: string; avatarColor: string };
  }[];
  watchers: { userId: number; user: { id: number; name: string } }[];
  activity: {
    id: number;
    action: string;
    detail: any;
    createdAt: string;
    user: { id: number; name: string } | null;
  }[];
  nextStatuses: StatusRow[];
}

export const PRIORITY_LABELS: Record<string, { label: string; cls: string }> = {
  low: { label: "منخفضة", cls: "bg-line-soft text-ink-2" },
  normal: { label: "عادية", cls: "bg-blue-100 text-blue-800" },
  high: { label: "عالية", cls: "bg-amber-100 text-amber-800" },
  urgent: { label: "عاجلة", cls: "bg-red-100 text-red-700" },
};
