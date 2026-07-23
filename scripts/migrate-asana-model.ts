import "dotenv/config";
import { pool } from "../server/db";

/**
 * هجرة البيانات من نموذج «١٣ حالة» إلى نموذج أسانا (مكتملة/غير مكتملة).
 * آمنة للتشغيل المتكرر. شغّلها قبل `npm run db:push`:
 *
 *   npm run migrate:asana   ← تنقل البيانات القديمة إلى الأعمدة الجديدة
 *   npm run db:push         ← يوائم المخطط (سيسقط الجداول القديمة بعد نقل بياناتها)
 *   npm run seed            ← يضمن أقسام «مهامي» الافتراضية
 *
 * ما تفعله:
 * 1. تضيف الأعمدة الجديدة إلى tasks إن غابت
 * 2. is_completed = true لكل مهمة كانت حالتها من فئة done/closed
 * 3. تحوّل صفوف subtasks القديمة إلى مهام كاملة بأم (parent_task_id)
 * 4. تنشئ أقسام «مهامي» الافتراضية لكل مستخدم
 * 5. تنشئ عضويات المشاريع من مالكي المشاريع ومسؤولي المهام
 */
async function main() {
  const client = await pool.connect();
  try {
    const tableExists = async (name: string) => {
      const r = await client.query(
        `select 1 from information_schema.tables where table_name = $1 limit 1`,
        [name],
      );
      return (r.rowCount ?? 0) > 0;
    };
    const columnExists = async (table: string, column: string) => {
      const r = await client.query(
        `select 1 from information_schema.columns where table_name = $1 and column_name = $2 limit 1`,
        [table, column],
      );
      return (r.rowCount ?? 0) > 0;
    };

    console.log("١) إضافة الأعمدة الجديدة…");
    await client.query(`
      alter table tasks add column if not exists is_completed boolean not null default false;
      alter table tasks add column if not exists completed_by_id integer references users(id);
      alter table tasks add column if not exists task_type varchar(20) not null default 'task';
      alter table tasks add column if not exists approval_status varchar(20);
      alter table tasks add column if not exists my_tasks_section_id integer;
      alter table tasks add column if not exists my_tasks_order_index integer not null default 0;
      alter table projects add column if not exists current_status varchar(20);
      alter table projects add column if not exists default_view varchar(20) not null default 'list';
      alter table notifications add column if not exists actor_id integer references users(id);
    `);

    if (await columnExists("tasks", "status_id")) {
      console.log("٢) تحويل الحالات القديمة إلى مكتملة/غير مكتملة…");
      await client.query(`
        update tasks set is_completed = true
        where status_id in (select id from statuses where category in ('done','closed'))
          and is_completed = false;
      `);
      // من كانت حالتها «بانتظار الاعتماد» تصبح مهمة اعتماد معلقة
      await client.query(`
        update tasks set task_type = 'approval', approval_status = 'pending'
        where status_id in (select id from statuses where key = 'awaiting_approval')
          and task_type = 'task';
      `);
    }

    if (await tableExists("subtasks")) {
      console.log("٣) تحويل المهام الفرعية القديمة إلى مهام كاملة…");
      await client.query(`
        insert into tasks (title, is_completed, parent_task_id, project_id, department_id, created_by_id, order_index, created_at, updated_at)
        select s.title, s.is_done, s.task_id, t.project_id, t.department_id, t.created_by_id, s.order_index, now(), now()
        from subtasks s
        join tasks t on t.id = s.task_id
        where not exists (
          select 1 from tasks c
          where c.parent_task_id = s.task_id and c.title = s.title
        );
      `);
    }

    console.log("٤) أقسام «مهامي» الافتراضية لكل مستخدم…");
    await client.query(`
      create table if not exists user_task_sections (
        id serial primary key,
        user_id integer not null references users(id) on delete cascade,
        title text not null,
        order_index integer not null default 0,
        is_default boolean not null default false
      );
    `);
    await client.query(`
      insert into user_task_sections (user_id, title, order_index, is_default)
      select u.id, v.title, v.ord, v.is_default
      from users u
      cross join (values ('المسندة حديثًا', 0, true), ('اليوم', 1, false), ('قادمة', 2, false), ('لاحقًا', 3, false))
        as v(title, ord, is_default)
      where not exists (select 1 from user_task_sections s where s.user_id = u.id);
    `);

    console.log("٥) عضويات المشاريع من المالكين والمسؤولين…");
    await client.query(`
      create table if not exists project_members (
        id serial primary key,
        project_id integer not null references projects(id) on delete cascade,
        user_id integer not null references users(id) on delete cascade,
        created_at timestamp not null default now(),
        constraint pm_project_user_unique unique (project_id, user_id)
      );
    `);
    await client.query(`
      insert into project_members (project_id, user_id)
      select p.id, p.owner_id from projects p where p.owner_id is not null
      on conflict do nothing;
    `);
    await client.query(`
      insert into project_members (project_id, user_id)
      select distinct t.project_id, t.assignee_id
      from tasks t
      where t.project_id is not null and t.assignee_id is not null
      on conflict do nothing;
    `);

    console.log(`
اكتملت هجرة البيانات ✔
الخطوة التالية: npm run db:push — وافق على إسقاط الجداول القديمة
(statuses, status_transitions, subtasks, task_approvals) فبياناتها نُقلت.
ثم: npm run seed`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
