import { createClient } from "@supabase/supabase-js";
import pg from "pg";
const [slug, name, email] = process.argv.slice(2);
if (
  !slug ||
  !name ||
  !email ||
  !process.env.DATABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SECRET_KEY
) {
  console.error(
    'Usage: npm run provision -- <business-slug> "<business-name>" <owner-email>. Requires DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in a private environment file.',
  );
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug) || !email.includes("@"))
  throw Error("Invalid slug or email");
const auth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  let userId = (
    await db.query("select id from auth.users where lower(email)=$1", [
      email.toLowerCase(),
    ])
  ).rows[0]?.id;
  if (!userId) {
    const { data, error } = await auth.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  }
  await db.query("begin");
  let business = (
    await db.query("select id from public.businesses where slug=$1", [slug])
  ).rows[0];
  if (!business) {
    business = (
      await db.query(
        "insert into public.businesses(slug,name) values($1,$2) returning id",
        [slug, name],
      )
    ).rows[0];
    await db.query(
      "insert into public.delivery_slots(business_id,name,start_time) values($1,'Makan siang','11:30'),($1,'Makan malam','17:30')",
      [business.id],
    );
  }
  await db.query(
    "insert into public.memberships(business_id,user_id,role) values($1,$2,'owner') on conflict do nothing",
    [business.id, userId],
  );
  await db.query(
    "insert into public.audit_events(business_id,actor_id,action,details) values($1,$2,'platform_provision',jsonb_build_object('source','provision-cli'))",
    [business.id, userId],
  );
  await db.query("commit");
  console.log(
    "Business provisioned. Owner can request an email code at /login. No message was sent by this command.",
  );
} catch (e) {
  await db.query("rollback");
  console.error(e instanceof Error ? e.message : "Provisioning failed");
  process.exitCode = 1;
} finally {
  await db.end();
}
