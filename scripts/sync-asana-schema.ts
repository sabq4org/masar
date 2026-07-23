import "dotenv/config";
import { pool } from "../server/db";

/**
 * مزامنة إضافية آمنة بعد migrate:asana — بدون إسقاط بيانات.
 * تجعل status_id اختياريًا وتنشئ الجداول الناقصة لنموذج أسانا.
 */
async function main() {
  const client = await pool.connect();
  try {
    console.log("١) جعل status_id اختياريًا (الكود الجديد لا يستخدمه)…");
    await client.query(`
      alter table tasks alter column status_id drop not null;
    `).catch((e: Error) => {
      if (!/does not exist|undefined_column/i.test(e.message)) throw e;
    });

    console.log("٢) إنشاء الجداول الناقصة…");
    await client.query(`
      create table if not exists project_stars (
        id serial primary key,
        project_id integer not null references projects(id) on delete cascade,
        user_id integer not null references users(id) on delete cascade
      );
      create unique index if not exists stars_project_user_idx on project_stars (project_id, user_id);

      create table if not exists project_status_updates (
        id serial primary key,
        project_id integer not null references projects(id) on delete cascade,
        created_by_id integer references users(id),
        status_type varchar(20) not null,
        title text,
        body text,
        created_at timestamp not null default now()
      );
      create index if not exists psu_project_idx on project_status_updates (project_id);

      create table if not exists task_likes (
        id serial primary key,
        task_id integer not null references tasks(id) on delete cascade,
        user_id integer not null references users(id) on delete cascade
      );
      create unique index if not exists task_likes_task_user_idx on task_likes (task_id, user_id);

      create table if not exists comment_likes (
        id serial primary key,
        comment_id integer not null references task_comments(id) on delete cascade,
        user_id integer not null references users(id) on delete cascade
      );
      create unique index if not exists comment_likes_comment_user_idx on comment_likes (comment_id, user_id);

      create table if not exists attachments (
        id serial primary key,
        task_id integer not null references tasks(id) on delete cascade,
        file_name text not null,
        original_name text not null,
        mime varchar(120),
        size integer not null default 0,
        uploaded_by_id integer references users(id),
        created_at timestamp not null default now()
      );
      create index if not exists attachments_task_idx on attachments (task_id);
    `);

    console.log("٣) فهارس مفيدة…");
    await client.query(`
      create index if not exists tasks_assignee_completed_idx on tasks (assignee_id, is_completed);
      create index if not exists tasks_project_section_idx on tasks (project_id, section_id, order_index);
      create index if not exists tasks_due_idx on tasks (due_at);
      create index if not exists tasks_parent_idx on tasks (parent_task_id);
    `);

    // تحقق سريع: إدراج مهمة بدون status_id
    console.log("٤) اختبار إدراج…");
    const probe = await client.query(`
      insert into tasks (title, is_completed, created_by_id, order_index, my_tasks_order_index, tags, task_type)
      values ('__masar_probe__', false, (select id from users limit 1), 0, 0, '{}', 'task')
      returning id
    `);
    await client.query(`delete from tasks where id = $1`, [probe.rows[0].id]);
    console.log("اكتملت المزامنة ✔ — الإدراج يعمل بدون status_id");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
