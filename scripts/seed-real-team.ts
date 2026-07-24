/**
 * زرع فرق وأشخاص ومهام واقعية لمسار (آمن للتكرار).
 * الأشخاص: حسين الحازمي، محمد الحازمي، محسن محمد، أحمد بدوي
 * + توسيع «مشروع تطوير مسار»
 *
 * التشغيل: npx tsx scripts/seed-real-team.ts
 * كلمة المرور المؤقتة للجدد: masar12345
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import {
  users,
  departments,
  projects,
  projectSections,
  projectMembers,
  projectStatusUpdates,
  tasks,
  taskComments,
  taskWatchers,
  userTaskSections,
} from "../shared/schema";

const TEMP_PASSWORD = "masar12345";
const PROJECT_NAME = "مشروع تطوير مسار";

const TEAMS: Array<{ nameAr: string; color: string; sortOrder: number }> = [
  { nameAr: "فريق التطوير", color: "#5D8FB5", sortOrder: 1 },
  { nameAr: "المنتج والتخطيط", color: "#C2701E", sortOrder: 2 },
  { nameAr: "التصميم والتجربة", color: "#2E7D5B", sortOrder: 3 },
  { nameAr: "المحتوى والتحرير", color: "#33658A", sortOrder: 4 },
  { nameAr: "العمليات والدعم", color: "#46536B", sortOrder: 5 },
];

const PEOPLE: Array<{
  email: string;
  name: string;
  role: string;
  avatarColor: string;
  team: string;
}> = [
  {
    email: "hussein@masar.local",
    name: "حسين الحازمي",
    role: "executive",
    avatarColor: "#274E6D",
    team: "المنتج والتخطيط",
  },
  {
    email: "mohammed.h@masar.local",
    name: "محمد الحازمي",
    role: "project_lead",
    avatarColor: "#8C5A2E",
    team: "المنتج والتخطيط",
  },
  {
    email: "mohsen@masar.local",
    name: "محسن محمد",
    role: "specialist",
    avatarColor: "#2E7D5B",
    team: "فريق التطوير",
  },
  {
    email: "ahmad.badawi@masar.local",
    name: "أحمد بدوي",
    role: "ops",
    avatarColor: "#B0413E",
    team: "التصميم والتجربة",
  },
];

async function ensureMySections(userId: number) {
  const existing = await db.select().from(userTaskSections).where(eq(userTaskSections.userId, userId));
  if (existing.length) return;
  await db.insert(userTaskSections).values([
    { userId, title: "المسندة حديثًا", orderIndex: 0, isDefault: true },
    { userId, title: "اليوم", orderIndex: 1 },
    { userId, title: "قادمة", orderIndex: 2 },
    { userId, title: "لاحقًا", orderIndex: 3 },
  ]);
}

async function main() {
  console.log("── فرق ──");
  const teamIds = new Map<string, number>();
  for (const t of TEAMS) {
    const [found] = await db.select().from(departments).where(eq(departments.nameAr, t.nameAr)).limit(1);
    if (found) {
      teamIds.set(t.nameAr, found.id);
      if (!found.isActive) {
        await db.update(departments).set({ isActive: true }).where(eq(departments.id, found.id));
      }
      console.log(`  موجود: ${t.nameAr}`);
    } else {
      const [row] = await db.insert(departments).values(t).returning();
      teamIds.set(t.nameAr, row.id);
      console.log(`  ✔ أُنشئ: ${t.nameAr}`);
    }
  }

  // ضع علي وسلطان في فريق التطوير إن لم يكن لهما فريق من الفرق الجديدة
  const devTeamId = teamIds.get("فريق التطوير")!;
  for (const name of ["علي الحازمي", "سلطان المالكي"]) {
    const [u] = await db.select().from(users).where(eq(users.name, name)).limit(1);
    if (u && u.departmentId !== devTeamId) {
      await db.update(users).set({ departmentId: devTeamId }).where(eq(users.id, u.id));
      console.log(`  ربط ${name} ← فريق التطوير`);
    }
  }

  console.log("── أشخاص ──");
  const hash = await bcrypt.hash(TEMP_PASSWORD, 10);
  const personIds = new Map<string, number>();

  for (const p of PEOPLE) {
    const byEmail = await db.select().from(users).where(eq(users.email, p.email)).limit(1);
    const byName = await db.select().from(users).where(eq(users.name, p.name)).limit(1);
    const existing = byEmail[0] ?? byName[0];
    const deptId = teamIds.get(p.team)!;
    if (existing) {
      await db
        .update(users)
        .set({
          name: p.name,
          role: p.role,
          departmentId: deptId,
          avatarColor: p.avatarColor,
          isActive: true,
        })
        .where(eq(users.id, existing.id));
      await ensureMySections(existing.id);
      personIds.set(p.name, existing.id);
      console.log(`  محدَّث: ${p.name} (${p.team})`);
    } else {
      const [row] = await db
        .insert(users)
        .values({
          email: p.email,
          passwordHash: hash,
          name: p.name,
          role: p.role,
          departmentId: deptId,
          avatarColor: p.avatarColor,
        })
        .returning();
      await ensureMySections(row.id);
      personIds.set(p.name, row.id);
      console.log(`  ✔ أُنشئ: ${p.name} <${p.email}> → ${p.team}`);
    }
  }

  const allUsers = await db.select().from(users);
  const idOf = (name: string) =>
    personIds.get(name) ?? allUsers.find((u) => u.name === name)?.id;

  const adminId = allUsers.find((u) => u.role === "admin")?.id;
  if (!adminId) throw new Error("لا يوجد مدير");

  const [project] = await db.select().from(projects).where(eq(projects.name, PROJECT_NAME)).limit(1);
  if (!project) throw new Error(`المشروع «${PROJECT_NAME}» غير موجود`);

  console.log(`── مشروع #${project.id}: ${PROJECT_NAME} ──`);

  // أعضاء المشروع: الجميع
  const memberIds = [
    adminId,
    ...allUsers.filter((u) => u.isActive).map((u) => u.id),
  ];
  for (const uid of new Set(memberIds)) {
    await db.insert(projectMembers).values({ projectId: project.id, userId: uid }).onConflictDoNothing();
  }
  console.log(`  أعضاء المشروع: ${new Set(memberIds).size}`);

  // أقسام أوضح إن كانت الافتراضية فقط
  let sections = await db
    .select()
    .from(projectSections)
    .where(eq(projectSections.projectId, project.id));

  const wantedSections = ["التخطيط", "التطوير", "التصميم والتجربة", "الاختبار والإطلاق"];
  const hasRich = wantedSections.every((t) => sections.some((s) => s.title === t));
  if (!hasRich) {
    // أعد تسمية/إضافة دون حذف مهام قائمة
    const byTitle = new Map(sections.map((s) => [s.title, s]));
    const mapped: typeof sections = [];
    for (let i = 0; i < wantedSections.length; i++) {
      const title = wantedSections[i];
      const old =
        byTitle.get(title) ??
        sections[i] ??
        null;
      if (old && !byTitle.has(title)) {
        const [updated] = await db
          .update(projectSections)
          .set({ title, orderIndex: i })
          .where(eq(projectSections.id, old.id))
          .returning();
        mapped.push(updated);
        byTitle.set(title, updated);
      } else if (old && old.title === title) {
        await db.update(projectSections).set({ orderIndex: i }).where(eq(projectSections.id, old.id));
        mapped.push(old);
      } else {
        const [created] = await db
          .insert(projectSections)
          .values({ projectId: project.id, title, orderIndex: i })
          .returning();
        mapped.push(created);
      }
    }
    sections = await db
      .select()
      .from(projectSections)
      .where(eq(projectSections.projectId, project.id));
    console.log(
      "  أقسام:",
      sections.map((s) => s.title).join(" · "),
    );
  }

  const sec = (title: string) => {
    const s = sections.find((x) => x.title === title) ?? sections[0];
    return s.id;
  };

  // تحديث حالة المشروع إن لم يوجد
  const updates = await db
    .select()
    .from(projectStatusUpdates)
    .where(eq(projectStatusUpdates.projectId, project.id))
    .limit(1);
  if (!updates.length) {
    await db.insert(projectStatusUpdates).values({
      projectId: project.id,
      createdById: adminId,
      statusType: "on_track",
      title: "الفريق اكتمل — نبدأ موجة المهام التالية",
      body: "انضم حسين ومحمد ومحسن وأحمد. نركّز على الصلاحيات، النسخة الإنجليزية، وتجربة الاستخدام قبل الإطلاق الداخلي.",
    });
    await db.update(projects).set({ currentStatus: "on_track", description: "بناء منصة مسار لإدارة العمل داخل سبق — من الفكرة إلى النشر." }).where(eq(projects.id, project.id));
  }

  // مهام جديدة (تتخطى إن وُجد نفس العنوان في المشروع)
  const existingTasks = await db.select({ title: tasks.title }).from(tasks).where(eq(tasks.projectId, project.id));
  const have = new Set(existingTasks.map((t) => t.title));

  const day = 86400_000;
  const now = Date.now();
  const hussein = idOf("حسين الحازمي")!;
  const mohammed = idOf("محمد الحازمي")!;
  const mohsen = idOf("محسن محمد")!;
  const ahmad = idOf("أحمد بدوي")!;
  const sultan = idOf("سلطان المالكي") ?? adminId;
  const ali = idOf("علي الحازمي") ?? adminId;

  type TaskSeed = {
    title: string;
    section: string;
    assigneeId: number;
    priority?: "urgent" | "high" | "normal" | "low";
    dueOffset?: number;
    done?: boolean;
    taskType?: "task" | "milestone" | "approval";
    description?: string;
    watchers?: number[];
    comment?: { userId: number; content: string };
    subtasks?: Array<{ title: string; assigneeId: number; done?: boolean }>;
  };

  const seeds: TaskSeed[] = [
    {
      title: "اعتماد خارطة طريق مسار للربع القادم",
      section: "التخطيط",
      assigneeId: hussein,
      priority: "urgent",
      dueOffset: 2,
      taskType: "approval",
      description: "مراجعة الأولويات مع الفريق واعتماد ما يدخل الإطلاق الداخلي.",
      watchers: [ali, mohammed],
      comment: {
        userId: mohammed,
        content: "مسودة الخارطة جاهزة في المستند المشترك — نحتاج قرار حسين قبل الأحد.",
      },
    },
    {
      title: "تعريف أدوار الفرق وصلاحيات كل دور",
      section: "التخطيط",
      assigneeId: mohammed,
      priority: "high",
      dueOffset: 3,
      description: "وثيقة قصيرة: من يعدّل المشاريع؟ من يدير المستخدمين؟ ما يظهر للضيف؟",
      watchers: [hussein, ali],
      subtasks: [
        { title: "مسودة الأدوار مع أمثلة", assigneeId: mohammed, done: true },
        { title: "مراجعة مع علي وسلطان", assigneeId: ali },
        { title: "اعتماد نهائي", assigneeId: hussein },
      ],
    },
    {
      title: "تطوير الصلاحيات والأدوار",
      section: "التطوير",
      assigneeId: sultan,
      priority: "high",
      dueOffset: 7,
      // موجودة مسبقًا — لن تُعاد إن وُجدت
    },
    {
      title: "استكمال واختبار المميزات",
      section: "الاختبار والإطلاق",
      assigneeId: mohsen,
      priority: "high",
      dueOffset: 10,
    },
    {
      title: "إصلاح موضع لوحة المهمة في النسخة الإنجليزية",
      section: "التطوير",
      assigneeId: mohsen,
      priority: "normal",
      done: true,
      description: "اللوحة تظهر من اليمين في LTR ومن اليسار في RTL.",
    },
    {
      title: "مراجعة ترجمة الواجهة الإنجليزية وإكمال النواقص",
      section: "التطوير",
      assigneeId: ahmad,
      priority: "high",
      dueOffset: 4,
      watchers: [mohsen, ali],
      subtasks: [
        { title: "جرد النصوص غير المترجمة", assigneeId: ahmad },
        { title: "مراجعة صياغة EN", assigneeId: hussein },
      ],
    },
    {
      title: "تحسين صفحة الفرق: بطاقات الأعضاء والأحمال",
      section: "التصميم والتجربة",
      assigneeId: ahmad,
      priority: "normal",
      dueOffset: 6,
      description: "عرض أوضح لمن في كل فريق وكم مهمة مفتوحة لديه.",
    },
    {
      title: "تجربة مستخدم: إنشاء مشروع ومهمة من الصفر",
      section: "التصميم والتجربة",
      assigneeId: ahmad,
      priority: "high",
      dueOffset: 5,
      watchers: [mohammed],
      comment: {
        userId: ahmad,
        content: "سأصوّر مسار الاستخدام وأرسل ملاحظات الـUX على قناة الفريق.",
      },
    },
    {
      title: "إشعارات الوارد عند إسناد مهمة أو تعليق",
      section: "التطوير",
      assigneeId: mohsen,
      priority: "high",
      dueOffset: 8,
      watchers: [sultan, ali],
    },
    {
      title: "تقرير أسبوعي آلي لمديري الفرق",
      section: "التطوير",
      assigneeId: sultan,
      priority: "normal",
      dueOffset: 12,
      description: "ملخص: مفتوحة / متأخرة / منجزة — حسب الفريق والشخص.",
    },
    {
      title: "جلسة إطلاق داخلي لفريق سبق",
      section: "الاختبار والإطلاق",
      assigneeId: hussein,
      taskType: "milestone",
      priority: "urgent",
      dueOffset: 14,
      watchers: [ali, mohammed, sultan, mohsen, ahmad],
    },
    {
      title: "دليل استخدام مختصر (عربي + إنجليزي)",
      section: "التخطيط",
      assigneeId: mohammed,
      priority: "low",
      dueOffset: 11,
    },
  ];

  let added = 0;
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    if (have.has(s.title)) {
      // حدّث الإسناد/القسم للمهام الموجودة إن أمكن
      const [row] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, project.id), eq(tasks.title, s.title)))
        .limit(1);
      if (row) {
        await db
          .update(tasks)
          .set({
            assigneeId: s.assigneeId,
            sectionId: sec(s.section),
            priority: s.priority ?? row.priority,
            description: s.description ?? row.description,
          })
          .where(eq(tasks.id, row.id));
      }
      continue;
    }

    const [task] = await db
      .insert(tasks)
      .values({
        title: s.title,
        projectId: project.id,
        sectionId: sec(s.section),
        createdById: adminId,
        assigneeId: s.assigneeId,
        priority: s.priority ?? "normal",
        taskType: s.taskType ?? "task",
        approvalStatus: s.taskType === "approval" ? "pending" : null,
        description: s.description ?? null,
        dueAt: s.dueOffset != null ? new Date(now + s.dueOffset * day) : null,
        isCompleted: !!s.done,
        completedAt: s.done ? new Date(now - day) : null,
        completedById: s.done ? s.assigneeId : null,
        orderIndex: i,
        departmentId: teamIds.get("فريق التطوير") ?? null,
      })
      .returning();
    added++;

    if (s.watchers?.length) {
      for (const uid of new Set(s.watchers)) {
        await db.insert(taskWatchers).values({ taskId: task.id, userId: uid }).onConflictDoNothing();
      }
    }
    if (s.comment) {
      await db.insert(taskComments).values({
        taskId: task.id,
        userId: s.comment.userId,
        content: s.comment.content,
      });
    }
    if (s.subtasks?.length) {
      for (let j = 0; j < s.subtasks.length; j++) {
        const st = s.subtasks[j];
        await db.insert(tasks).values({
          title: st.title,
          parentTaskId: task.id,
          projectId: project.id,
          createdById: adminId,
          assigneeId: st.assigneeId,
          isCompleted: !!st.done,
          completedAt: st.done ? new Date() : null,
          orderIndex: j,
        });
      }
    }
  }

  // مهام شخصية خفيفة لأعضاء فرق أخرى (تظهر في مهامي)
  const personal = [
    { title: "مراجعة مقترح ميزات مسار مع الفريق", name: "حسين الحازمي", due: 1 },
    { title: "تنسيق جلسة التخطيط الأسبوعية", name: "محمد الحازمي", due: 2 },
    { title: "إعداد بيئة اختبار محلية لمسار", name: "محسن محمد", due: 0 },
    { title: "جمع ملاحظات UX من أول مستخدمين", name: "أحمد بدوي", due: 3 },
  ];
  for (const p of personal) {
    const uid = idOf(p.name)!;
    const [exists] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.title, p.title), eq(tasks.assigneeId, uid)))
      .limit(1);
    if (exists) continue;
    await db.insert(tasks).values({
      title: p.title,
      createdById: adminId,
      assigneeId: uid,
      dueAt: new Date(now + p.due * day),
      priority: "normal",
      orderIndex: 0,
    });
    added++;
  }

  console.log(`\n✔ أُضيف ${added} مهمة جديدة`);
  console.log(`كلمة المرور المؤقتة للحسابات الجديدة: ${TEMP_PASSWORD}`);
  console.log("الحسابات:");
  for (const p of PEOPLE) {
    console.log(`  ${p.name}  ${p.email}`);
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
