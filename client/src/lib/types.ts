export interface Me {
  id: number;
  email: string;
  name: string;
  role: string;
  departmentId: number | null;
  avatarColor: string;
  avatarUrl?: string | null;
  permissions: string[];
}

export interface UserLite {
  id: number;
  name: string;
  role: string;
  roleLabel?: string;
  avatarColor: string;
  avatarUrl?: string | null;
  departmentId: number | null;
}

export interface DepartmentRow {
  id: number;
  nameAr: string;
  color: string;
}

export interface SectionRow {
  id: number;
  title: string;
  orderIndex: number;
}

export interface MyTaskSection {
  id: number;
  userId: number;
  title: string;
  orderIndex: number;
  isDefault: boolean;
}

export interface MemberRow {
  id: number;
  userId: number;
  name: string;
  avatarColor: string;
  avatarUrl?: string | null;
}

export type ProjectStatusType = "on_track" | "at_risk" | "off_track" | "on_hold" | "complete";

export interface StatusUpdateRow {
  id: number;
  projectId: number;
  statusType: ProjectStatusType;
  title: string | null;
  body: string | null;
  createdAt: string;
  createdBy?: { id: number; name: string; avatarColor: string; avatarUrl?: string | null } | null;
}

export interface ProjectRow {
  id: number;
  name: string;
  description: string | null;
  type: string;
  color: string;
  status: string;
  currentStatus: ProjectStatusType | null;
  defaultView: string;
  departmentId: number | null;
  ownerId: number | null;
  taskCount?: number;
  doneCount?: number;
  memberCount?: number;
  isStarred?: boolean;
  sections?: SectionRow[];
  members?: MemberRow[];
  lastStatusUpdate?: StatusUpdateRow | null;
}

export type TaskType = "task" | "milestone" | "approval";
export type ApprovalStatus = "pending" | "approved" | "changes_requested" | "rejected";
export type Priority = "low" | "normal" | "high" | "urgent";

export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  taskType: TaskType;
  approvalStatus: ApprovalStatus | null;
  priority: Priority | null;
  tags: string[];
  assigneeId: number | null;
  projectId: number | null;
  sectionId: number | null;
  parentTaskId: number | null;
  orderIndex: number;
  myTasksSectionId: number | null;
  myTasksOrderIndex: number;
  dueAt: string | null;
  startAt: string | null;
  linkUrl: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  assignee?: { id: number; name: string; avatarColor: string; avatarUrl?: string | null } | null;
  project?: { id: number; name: string; color: string } | null;
  section?: { id: number; title: string } | null;
  subtasks?: { id: number; isCompleted: boolean }[];
  watchers?: {
    userId: number;
    user: { id: number; name: string; avatarColor: string; avatarUrl?: string | null };
  }[];
}

export interface SubtaskRow extends TaskRow {
  assignee?: { id: number; name: string; avatarColor: string; avatarUrl?: string | null } | null;
}

export interface CommentRow {
  id: number;
  content: string;
  createdAt: string;
  user: { id: number; name: string; avatarColor: string; avatarUrl?: string | null };
  likes: { userId: number }[];
}

export interface AttachmentRow {
  id: number;
  taskId: number;
  fileName: string;
  originalName: string;
  mime: string | null;
  size: number;
  createdAt: string;
}

export interface ActivityRow {
  id: number;
  action: string;
  detail: any;
  createdAt: string;
  user: { id: number; name: string } | null;
}

export interface TaskDetail extends TaskRow {
  parent?: { id: number; title: string } | null;
  createdBy?: { id: number; name: string } | null;
  completedBy?: { id: number; name: string } | null;
  subtasks: SubtaskRow[];
  comments: CommentRow[];
  watchers: {
    userId: number;
    user: { id: number; name: string; avatarColor: string; avatarUrl?: string | null };
  }[];
  likes: { userId: number; user: { id: number; name: string } }[];
  likedByMe: boolean;
  attachments: AttachmentRow[];
  activity: ActivityRow[];
  dependencies: {
    id: number;
    blockedByTaskId: number;
    task: { id: number; title: string; isCompleted: boolean } | null;
  }[];
}

export interface NotificationRow {
  id: number;
  type: string;
  title: string;
  body: string | null;
  taskId: number | null;
  isRead: boolean;
  createdAt: string;
  actor?: { id: number; name: string; avatarColor: string; avatarUrl?: string | null } | null;
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

/** أولويات بأسلوب حقول أسانا الملونة */
export const PRIORITIES: Record<string, { label: string; bg: string; fg: string }> = {
  urgent: { label: "عاجلة", bg: "#B0413E22", fg: "#B0413E" },
  high: { label: "عالية", bg: "#C2701E22", fg: "#C2701E" },
  normal: { label: "متوسطة", bg: "#A87A0E22", fg: "#8a6a10" },
  low: { label: "منخفضة", bg: "#33658A1f", fg: "#33658A" },
};

export const PROJECT_STATUS_META: Record<string, { label: string; color: string }> = {
  on_track: { label: "على المسار", color: "#2E7D5B" },
  at_risk: { label: "في خطر", color: "#A87A0E" },
  off_track: { label: "متعثر", color: "#B0413E" },
  on_hold: { label: "معلّق", color: "#46536B" },
  complete: { label: "مكتمل", color: "#33658A" },
};

export const PROJECT_COLORS = [
  "#C2701E", "#33658A", "#2E7D5B", "#B0413E", "#A87A0E",
  "#46536B", "#5D8FB5", "#8C5A2E", "#274E6D", "#77705F",
];
