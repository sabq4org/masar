// الأدوار والصلاحيات — خريطة ثابتة في الكود (MVP)، تنتقل لجداول عند الحاجة لأدوار مخصصة
export const ROLES = [
  "admin", // مدير النظام
  "editor_chief", // رئيس التحرير ونوابه
  "managing_editor", // مدير التحرير
  "dept_head", // رئيس قسم
  "editor", // محرر
  "reporter", // مراسل
  "proofreader", // مدقق
  "media", // مصور/مصمم/فيديو/سوشيال
  "operations", // إداري
  "guest", // ضيف/متعاون خارجي
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS_AR: Record<Role, string> = {
  admin: "مدير النظام",
  editor_chief: "رئيس التحرير",
  managing_editor: "مدير التحرير",
  dept_head: "رئيس قسم",
  editor: "محرر",
  reporter: "مراسل",
  proofreader: "مدقق",
  media: "وسائط",
  operations: "إداري",
  guest: "ضيف",
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
  editor_chief: ["*"],
  managing_editor: [
    P.VIEW_ALL, P.VIEW_OWN, P.CREATE, P.EDIT_ANY, P.EDIT_OWN,
    P.ASSIGN, P.DELETE, P.APPROVE, P.PROJECTS_MANAGE, P.REPORTS_VIEW,
  ],
  dept_head: [
    P.VIEW_ALL, P.VIEW_OWN, P.CREATE, P.EDIT_ANY, P.EDIT_OWN,
    P.ASSIGN, P.APPROVE, P.PROJECTS_MANAGE, P.REPORTS_VIEW,
  ],
  editor: [P.VIEW_ALL, P.VIEW_OWN, P.CREATE, P.EDIT_OWN],
  reporter: [P.VIEW_OWN, P.CREATE, P.EDIT_OWN],
  proofreader: [P.VIEW_ALL, P.VIEW_OWN, P.EDIT_OWN],
  media: [P.VIEW_OWN, P.CREATE, P.EDIT_OWN],
  operations: [P.VIEW_ALL, P.VIEW_OWN, P.CREATE, P.EDIT_OWN],
  guest: [P.VIEW_OWN],
};

export function permissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role as Role] ?? [P.VIEW_OWN];
}

export function roleHas(role: string, permission: string): boolean {
  const perms = permissionsForRole(role);
  return perms.includes("*") || perms.includes(permission);
}
