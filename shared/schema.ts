import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  json,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// جدول جلسات connect-pg-simple — معرّف هنا حتى لا يعتبره drizzle جدولًا غريبًا
export const session = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (t) => [index("IDX_session_expire").on(t.expire)],
);

// ─── المستخدمون والأقسام ───────────────────────────────────────────

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull().unique(),
  color: varchar("color", { length: 7 }).notNull().default("#2563B6"),
  icon: varchar("icon", { length: 40 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// الأدوار ثابتة في الكود (server/permissions.ts) — لا جداول RBAC في MVP
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: varchar("role", { length: 40 }).notNull().default("editor"),
    departmentId: integer("department_id").references(() => departments.id),
    avatarColor: varchar("avatar_color", { length: 7 }).notNull().default("#475569"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("users_department_idx").on(t.departmentId)],
);

// ─── محرك الحالات ──────────────────────────────────────────────────

// الفئة السلوكية تستخدمها الفلاتر والتقارير حتى مع حالات مخصصة جديدة
export const statuses = pgTable("statuses", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 40 }).notNull().unique(),
  nameAr: text("name_ar").notNull(),
  color: varchar("color", { length: 7 }).notNull(),
  category: varchar("category", { length: 20 }).notNull(), // planning|active|blocked|review|done|closed
  orderIndex: integer("order_index").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
});

export const statusTransitions = pgTable(
  "status_transitions",
  {
    id: serial("id").primaryKey(),
    fromStatusId: integer("from_status_id")
      .notNull()
      .references(() => statuses.id, { onDelete: "cascade" }),
    toStatusId: integer("to_status_id")
      .notNull()
      .references(() => statuses.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("transitions_from_to_idx").on(t.fromStatusId, t.toStatusId)],
);

// ─── المشاريع والأقسام الداخلية ────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    type: varchar("type", { length: 20 }).notNull().default("ops"), // coverage|file|campaign|dev|ops
    departmentId: integer("department_id").references(() => departments.id),
    ownerId: integer("owner_id").references(() => users.id),
    color: varchar("color", { length: 7 }).notNull().default("#2563B6"),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active|archived
    startAt: timestamp("start_at"),
    endAt: timestamp("end_at"),
    createdById: integer("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("projects_department_idx").on(t.departmentId)],
);

export const projectSections = pgTable(
  "project_sections",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [index("sections_project_idx").on(t.projectId)],
);

// ─── المهام ────────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    statusId: integer("status_id")
      .notNull()
      .references(() => statuses.id),
    priority: varchar("priority", { length: 10 }).notNull().default("normal"), // low|normal|high|urgent
    progress: integer("progress").notNull().default(0),
    color: varchar("color", { length: 7 }),
    tags: text("tags").array().notNull().default([]),
    assigneeId: integer("assignee_id").references(() => users.id),
    createdById: integer("created_by_id").references(() => users.id),
    departmentId: integer("department_id").references(() => departments.id),
    // قرار MVP: مشروع واحد لكل مهمة بأعمدة مباشرة؛ الإسكان المتعدد لاحقًا
    // عبر جدول placements (هجرة INSERT..SELECT بسيطة موثقة في README)
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    sectionId: integer("section_id").references(() => projectSections.id, { onDelete: "set null" }),
    parentTaskId: integer("parent_task_id"),
    orderIndex: integer("order_index").notNull().default(0),
    startAt: timestamp("start_at"),
    dueAt: timestamp("due_at"),
    completedAt: timestamp("completed_at"),
    sourceType: varchar("source_type", { length: 20 }), // meeting|message|alert|manual
    sourceRef: text("source_ref"),
    linkUrl: text("link_url"), // رابط المادة الصحفية أو أي مرجع خارجي
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("tasks_assignee_status_idx").on(t.assigneeId, t.statusId),
    index("tasks_project_section_idx").on(t.projectId, t.sectionId, t.orderIndex),
    index("tasks_due_idx").on(t.dueAt),
    index("tasks_status_idx").on(t.statusId),
    index("tasks_parent_idx").on(t.parentTaskId),
  ],
);

export const subtasks = pgTable(
  "subtasks",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [index("subtasks_task_idx").on(t.taskId)],
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    mentions: integer("mentions").array().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("comments_task_idx").on(t.taskId)],
);

export const taskWatchers = pgTable(
  "task_watchers",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [uniqueIndex("watchers_task_user_idx").on(t.taskId, t.userId)],
);

export const taskActivity = pgTable(
  "task_activity",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id),
    action: varchar("action", { length: 40 }).notNull(),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("activity_task_idx").on(t.taskId)],
);

// ─── الاعتماديات: المهمة محجوبة بمهمة أخرى ─────────────────────────

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    blockedByTaskId: integer("blocked_by_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("deps_task_blocker_idx").on(t.taskId, t.blockedByTaskId)],
);

// ─── الاعتمادات: طلب التعديل لا يغلق المهمة ────────────────────────

export const taskApprovals = pgTable(
  "task_approvals",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    requestedById: integer("requested_by_id")
      .notNull()
      .references(() => users.id),
    approverId: integer("approver_id")
      .notNull()
      .references(() => users.id),
    state: varchar("state", { length: 20 }).notNull().default("pending"), // pending|approved|changes_requested|rejected
    note: text("note"),
    decisionNote: text("decision_note"),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("approvals_approver_state_idx").on(t.approverId, t.state)],
);

// ─── قوالب المشاريع ────────────────────────────────────────────────

export const projectTemplates = pgTable("project_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).notNull().default("ops"),
  color: varchar("color", { length: 7 }).notNull().default("#2563B6"),
  // { sections: [{ title, tasks: [{ title, priority }] }] }
  structure: jsonb("structure").notNull(),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── الإشعارات ─────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(), // assigned|mention|status_change|due_soon|overdue|comment
    title: text("title").notNull(),
    body: text("body"),
    taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.isRead)],
);

// ─── العلاقات ──────────────────────────────────────────────────────

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  status: one(statuses, { fields: [tasks.statusId], references: [statuses.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  createdBy: one(users, { fields: [tasks.createdById], references: [users.id] }),
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  section: one(projectSections, { fields: [tasks.sectionId], references: [projectSections.id] }),
  department: one(departments, { fields: [tasks.departmentId], references: [departments.id] }),
  subtasks: many(subtasks),
  comments: many(taskComments),
  watchers: many(taskWatchers),
  activity: many(taskActivity),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  department: one(departments, { fields: [projects.departmentId], references: [departments.id] }),
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  sections: many(projectSections),
  tasks: many(tasks),
}));

export const projectSectionsRelations = relations(projectSections, ({ one, many }) => ({
  project: one(projects, { fields: [projectSections.projectId], references: [projects.id] }),
  tasks: many(tasks),
}));

export const usersRelations = relations(users, ({ one }) => ({
  department: one(departments, { fields: [users.departmentId], references: [departments.id] }),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, { fields: [subtasks.taskId], references: [tasks.id] }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskComments.userId], references: [users.id] }),
}));

export const taskWatchersRelations = relations(taskWatchers, ({ one }) => ({
  task: one(tasks, { fields: [taskWatchers.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskWatchers.userId], references: [users.id] }),
}));

export const taskActivityRelations = relations(taskActivity, ({ one }) => ({
  task: one(tasks, { fields: [taskActivity.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskActivity.userId], references: [users.id] }),
}));

// ─── أنواع مشتركة ──────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Status = typeof statuses.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectSection = typeof projectSections.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Subtask = typeof subtasks.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type TaskApproval = typeof taskApprovals.$inferSelect;
export type ProjectTemplate = typeof projectTemplates.$inferSelect;

export interface TemplateStructure {
  sections: Array<{
    title: string;
    tasks: Array<{ title: string; priority?: string; description?: string }>;
  }>;
}
