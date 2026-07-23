// الأدوار والصلاحيات — خريطة ثابتة في الكود (MVP)
// مجموعات تنظيمية: تنفيذي · تشغيلي · تخطيط وتطوير · عام

export const ROLES = [
  "admin", // مدير النظام
  "executive", // تنفيذي / قيادة
  "ops_manager", // مدير تشغيلي
  "ops", // تشغيلي
  "planning", // تخطيط وتطوير
  "project_lead", // قائد مشروع
  "specialist", // أخصائي
  "member", // عضو
  "support", // مساندة
  "guest", // ضيف / متعاون
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS_AR: Record<Role, string> = {
  admin: "مدير النظام",
  executive: "تنفيذي",
  ops_manager: "مدير تشغيلي",
  ops: "تشغيلي",
  planning: "تخطيط وتطوير",
  project_lead: "قائد مشروع",
  specialist: "أخصائي",
  member: "عضو",
  support: "مساندة",
  guest: "ضيف",
};

/** تجميع الأدوار في قائمة المستخدمين */
export const ROLE_GROUPS: { label: string; roles: Role[] }[] = [
  { label: "تنفيذي", roles: ["admin", "executive"] },
  { label: "تشغيلي", roles: ["ops_manager", "ops", "specialist"] },
  { label: "تخطيط وتطوير", roles: ["planning", "project_lead"] },
  { label: "عام", roles: ["member", "support", "guest"] },
];

/** أدوار النموذج الإعلامي القديم → الأدوار الجديدة (ترحيل آمن) */
export const LEGACY_ROLE_MAP: Record<string, Role> = {
  editor_chief: "executive",
  managing_editor: "executive",
  dept_head: "ops_manager",
  editor: "member",
  reporter: "member",
  proofreader: "specialist",
  media: "specialist",
  operations: "support",
};

const P = {
  VIEW_ALL: "tasks.view_all",
  VIEW_OWN: "tasks.view_own",
  CREATE: "tasks.create",
  EDIT_ANY: "tasks.edit_any",
  EDIT_OWN: "tasks.edit_own",
  ASSIGN: "tasks.assign",
  DELETE: "tasks.delete",
  APPROVE: "tasks.approve",
  PROJECTS_MANAGE: "projects.manage",
  WORKFLOW_MANAGE: "workflow.manage",
  REPORTS_VIEW: "reports.view",
  USERS_MANAGE: "users.manage",
} as const;

export const PERMISSIONS = P;

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: ["*"],
  executive: ["*"],
  ops_manager: [
    P.VIEW_ALL, P.VIEW_OWN, P.CREATE, P.EDIT_ANY, P.EDIT_OWN,
    P.ASSIGN, P.DELETE, P.APPROVE, P.PROJECTS_MANAGE, P.REPORTS_VIEW,
  ],
  ops: [P.VIEW_ALL, P.VIEW_OWN, P.CREATE, P.EDIT_OWN, P.ASSIGN],
  planning: [
    P.VIEW_ALL, P.VIEW_OWN, P.CREATE, P.EDIT_ANY, P.EDIT_OWN,
    P.ASSIGN, P.PROJECTS_MANAGE, P.REPORTS_VIEW,
  ],
  project_lead: [
    P.VIEW_ALL, P.VIEW_OWN, P.CREATE, P.EDIT_ANY, P.EDIT_OWN,
    P.ASSIGN, P.APPROVE, P.PROJECTS_MANAGE, P.REPORTS_VIEW,
  ],
  specialist: [P.VIEW_ALL, P.VIEW_OWN, P.CREATE, P.EDIT_OWN],
  member: [P.VIEW_ALL, P.VIEW_OWN, P.CREATE, P.EDIT_OWN],
  support: [P.VIEW_ALL, P.VIEW_OWN, P.CREATE, P.EDIT_OWN],
  guest: [P.VIEW_OWN],
};

function normalizeRole(role: string): Role | null {
  if ((ROLES as readonly string[]).includes(role)) return role as Role;
  return LEGACY_ROLE_MAP[role] ?? null;
}

export function permissionsForRole(role: string): string[] {
  const normalized = normalizeRole(role);
  return normalized ? ROLE_PERMISSIONS[normalized] : [P.VIEW_OWN];
}

export function roleHas(role: string, permission: string): boolean {
  const perms = permissionsForRole(role);
  return perms.includes("*") || perms.includes(permission);
}

export function roleLabelAr(role: string): string {
  const normalized = normalizeRole(role);
  if (normalized) return ROLE_LABELS_AR[normalized];
  return role;
}
