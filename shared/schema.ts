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

// ─── المستخدمون والفرق ─────────────────────────────────────────────

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull().unique(),
  color: varchar("color", { length: 7 }).notNull().default("#33658A"),
  icon: varchar("icon", { length: 40 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// الأدوار ثابتة في الكود (server/permissions.ts)
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

// ─── أقسام «مهامي» الشخصية (نموذج أسانا) ───────────────────────────
// لكل مستخدم أقسامه الخاصة في صفحة مهامي؛ قسم واحد افتراضي isDefault
// («المسندة حديثًا») تهبط فيه المهام الجديدة ولا يُحذف.

export const userTaskSections = pgTable(
  "user_task_sections",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [index("uts_user_idx").on(t.userId)],
);

// ─── المشاريع والأقسام ─────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    type: varchar("type", { length: 20 }).notNull().default("ops"), // coverage|file|campaign|dev|ops
    departmentId: integer("department_id").references(() => departments.id),
    ownerId: integer("owner_id").references(() => users.id),
    color: varchar("color", { length: 7 }).notNull().default("#33658A"),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active|archived
    // آخر حالة معلنة (تنعكس من project_status_updates): on_track|at_risk|off_track|on_hold|complete
    currentStatus: varchar("current_status", { length: 20 }),
    defaultView: varchar("default_view", { length: 20 }).notNull().default("list"), // list|board|timeline|calendar|overview
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

export const projectMembers = pgTable(
  "project_members",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pm_project_user_idx").on(t.projectId, t.userId)],
);

export const projectStars = pgTable(
  "project_stars",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("stars_project_user_idx").on(t.projectId, t.userId)],
);

// تحديثات حالة المشروع (نموذج أسانا: على المسار / في خطر / متعثر / معلّق / مكتمل)
export const projectStatusUpdates = pgTable(
  "project_status_updates",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdById: integer("created_by_id").references(() => users.id),
    statusType: varchar("status_type", { length: 20 }).notNull(), // on_track|at_risk|off_track|on_hold|complete
    title: text("title"),
    body: text("body"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("psu_project_idx").on(t.projectId)],
);

// ─── المهام (نموذج أسانا: مكتملة/غير مكتملة + أقسام حرة) ───────────

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at"),
    completedById: integer("completed_by_id").references(() => users.id),
    // task عادية | milestone معلم | approval اعتماد (نموذج أسانا)
    taskType: varchar("task_type", { length: 20 }).notNull().default("task"),
    approvalStatus: varchar("approval_status", { length: 20 }), // pending|approved|changes_requested|rejected
    priority: varchar("priority", { length: 10 }), // low|normal|high|urgent — null = بلا أولوية
    tags: text("tags").array().notNull().default([]),
    assigneeId: integer("assignee_id").references(() => users.id),
    createdById: integer("created_by_id").references(() => users.id),
    departmentId: integer("department_id").references(() => departments.id),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    sectionId: integer("section_id").references(() => projectSections.id, { onDelete: "set null" }),
    parentTaskId: integer("parent_task_id"), // المهام الفرعية مهام كاملة (نموذج أسانا)
    orderIndex: integer("order_index").notNull().default(0),
    // موضع المهمة في «مهامي» عند المسؤول عنها؛ null = قسم «المسندة حديثًا»
    myTasksSectionId: integer("my_tasks_section_id").references(() => userTaskSections.id, {
      onDelete: "set null",
    }),
    myTasksOrderIndex: integer("my_tasks_order_index").notNull().default(0),
    startAt: timestamp("start_at"),
    dueAt: timestamp("due_at"),
    linkUrl: text("link_url"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("tasks_assignee_completed_idx").on(t.assigneeId, t.isCompleted),
    index("tasks_project_section_idx").on(t.projectId, t.sectionId, t.orderIndex),
    index("tasks_due_idx").on(t.dueAt),
    index("tasks_parent_idx").on(t.parentTaskId),
  ],
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

// المتعاونون (Collaborators في أسانا)
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

export const taskLikes = pgTable(
  "task_likes",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("task_likes_task_user_idx").on(t.taskId, t.userId)],
);

export const commentLikes = pgTable(
  "comment_likes",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id")
      .notNull()
      .references(() => taskComments.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("comment_likes_comment_user_idx").on(t.commentId, t.userId)],
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

// ─── المرفقات ──────────────────────────────────────────────────────

export const attachments = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(), // الاسم المخزن على القرص
    originalName: text("original_name").notNull(),
    mime: varchar("mime", { length: 120 }),
    size: integer("size").notNull().default(0),
    uploadedById: integer("uploaded_by_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("attachments_task_idx").on(t.taskId)],
);

// ─── قوالب المشاريع ────────────────────────────────────────────────

export const projectTemplates = pgTable("project_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).notNull().default("ops"),
  color: varchar("color", { length: 7 }).notNull().default("#33658A"),
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
    type: varchar("type", { length: 40 }).notNull(), // assigned|mention|completed|due_soon|overdue|comment|like|approval…
    title: text("title").notNull(),
    body: text("body"),
    taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    actorId: integer("actor_id").references(() => users.id),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.isRead)],
);

// ─── العلاقات ──────────────────────────────────────────────────────

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  createdBy: one(users, { fields: [tasks.createdById], references: [users.id] }),
  completedBy: one(users, { fields: [tasks.completedById], references: [users.id] }),
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  section: one(projectSections, { fields: [tasks.sectionId], references: [projectSections.id] }),
  department: one(departments, { fields: [tasks.departmentId], references: [departments.id] }),
  parent: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: "subtasks",
  }),
  subtasks: many(tasks, { relationName: "subtasks" }),
  comments: many(taskComments),
  watchers: many(taskWatchers),
  likes: many(taskLikes),
  activity: many(taskActivity),
  attachments: many(attachments),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  department: one(departments, { fields: [projects.departmentId], references: [departments.id] }),
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  sections: many(projectSections),
  tasks: many(tasks),
  members: many(projectMembers),
  stars: many(projectStars),
  statusUpdates: many(projectStatusUpdates),
}));

export const projectSectionsRelations = relations(projectSections, ({ one, many }) => ({
  project: one(projects, { fields: [projectSections.projectId], references: [projects.id] }),
  tasks: many(tasks),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const projectStarsRelations = relations(projectStars, ({ one }) => ({
  project: one(projects, { fields: [projectStars.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectStars.userId], references: [users.id] }),
}));

export const projectStatusUpdatesRelations = relations(projectStatusUpdates, ({ one }) => ({
  project: one(projects, { fields: [projectStatusUpdates.projectId], references: [projects.id] }),
  createdBy: one(users, { fields: [projectStatusUpdates.createdById], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, { fields: [users.departmentId], references: [departments.id] }),
  myTaskSections: many(userTaskSections),
}));

export const userTaskSectionsRelations = relations(userTaskSections, ({ one, many }) => ({
  user: one(users, { fields: [userTaskSections.userId], references: [users.id] }),
  tasks: many(tasks),
}));

export const taskCommentsRelations = relations(taskComments, ({ one, many }) => ({
  task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskComments.userId], references: [users.id] }),
  likes: many(commentLikes),
}));

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
  comment: one(taskComments, { fields: [commentLikes.commentId], references: [taskComments.id] }),
  user: one(users, { fields: [commentLikes.userId], references: [users.id] }),
}));

export const taskLikesRelations = relations(taskLikes, ({ one }) => ({
  task: one(tasks, { fields: [taskLikes.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskLikes.userId], references: [users.id] }),
}));

export const taskWatchersRelations = relations(taskWatchers, ({ one }) => ({
  task: one(tasks, { fields: [taskWatchers.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskWatchers.userId], references: [users.id] }),
}));

export const taskActivityRelations = relations(taskActivity, ({ one }) => ({
  task: one(tasks, { fields: [taskActivity.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskActivity.userId], references: [users.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  task: one(tasks, { fields: [attachments.taskId], references: [tasks.id] }),
  uploadedBy: one(users, { fields: [attachments.uploadedById], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  actor: one(users, { fields: [notifications.actorId], references: [users.id] }),
  task: one(tasks, { fields: [notifications.taskId], references: [tasks.id] }),
}));

// ─── أنواع مشتركة ──────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectSection = typeof projectSections.$inferSelect;
export type ProjectStatusUpdate = typeof projectStatusUpdates.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type UserTaskSection = typeof userTaskSections.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;

export interface TemplateStructure {
  sections: Array<{
    title: string;
    tasks: Array<{ title: string; priority?: string; description?: string }>;
  }>;
}

export const PROJECT_STATUS_TYPES = {
  on_track: { label: "على المسار", color: "#2E7D5B" },
  at_risk: { label: "في خطر", color: "#A87A0E" },
  off_track: { label: "متعثر", color: "#B0413E" },
  on_hold: { label: "معلّق", color: "#46536B" },
  complete: { label: "مكتمل", color: "#33658A" },
} as const;
