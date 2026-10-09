import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  localBootstrap,
  refreshDemoCatalogSQL,
  retireDemoFixturePackagesSQL,
  seedSQL,
} from "./seed";
import { contentsFixturesSQL } from "./contents-fixtures";
import { applyDemoStates } from "./demo-states";
const globalDb = globalThis as unknown as { cateraV1?: Promise<PGlite> };
export const demoEnabled = () =>
  process.env.CATERA_V1_DEMO === "true" && !process.env.VERCEL;
export function projectRoot() {
  return (
    process.env.CATERA_PROJECT_ROOT ||
    (/apps[\\/]web$/.test(process.cwd())
      ? path.resolve(process.cwd(), "../..")
      : process.cwd())
  );
}
export async function createDemoDatabase(inMemory = false) {
  const folder =
    process.env.CATERA_DEMO_DATA_DIR || path.join(projectRoot(), ".data", "v1");
  if (!inMemory) await mkdir(folder, { recursive: true });
  const db = new PGlite(inMemory ? undefined : folder);
  await db.waitReady;
  const r = await db.query<{ exists: boolean }>(
    "select exists(select 1 from pg_namespace where nspname='v1')",
  );
  if (!r.rows[0].exists) {
    await db.exec(localBootstrap);
    for (const file of [
      "202609090001_marketplace.sql",
      "202609090002_services.sql",
    ])
      await db.exec(
        await readFile(
          path.join(projectRoot(), "supabase/migrations", file),
          "utf8",
        ),
      );
    await db.exec(
      await readFile(
        path.join(
          projectRoot(),
          "supabase/migrations/202609090003_hardening.sql",
        ),
        "utf8",
      ),
    );
    await db.exec(seedSQL());
  } else if (
    !(
      await db.query<{ exists: boolean }>(
        "select to_regclass('v1.content_revisions') is not null as exists",
      )
    ).rows[0].exists
  ) {
    await db.exec(
      await readFile(
        path.join(
          projectRoot(),
          "supabase/migrations/202609090003_hardening.sql",
        ),
        "utf8",
      ),
    );
  }
  await db.exec(
    await readFile(
      path.join(projectRoot(), "supabase/migrations/202609090005_realtime.sql"),
      "utf8",
    ),
  );
  if (!inMemory)
    await db.exec(
      await readFile(
        path.join(projectRoot(), "packages/backend/src/fixture.sql"),
        "utf8",
      ),
    );
  if (
    !(
      await db.query<{ exists: boolean }>(
        "select to_regclass('v1.content_revisions') is not null as exists",
      )
    ).rows[0].exists
  ) {
    const file = (
      await readdir(path.join(projectRoot(), "supabase/migrations"))
    ).find((f) => f.endsWith("_package_contents.sql"));
    if (!file) throw new Error("CONTENTS_MIGRATION_MISSING");
    await db.exec(
      "begin;" +
        (await readFile(
          path.join(projectRoot(), "supabase/migrations", file),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (
    !(
      await db.query<{ exists: boolean }>(
        "select to_regclass('v1.dishes') is not null as exists",
      )
    ).rows[0].exists
  ) {
    const file = (
      await readdir(path.join(projectRoot(), "supabase/migrations"))
    ).find((f) => f.endsWith("_reusable_dishes.sql"));
    if (!file) throw new Error("DISHES_MIGRATION_MISSING");
    await db.exec(
      "begin;" +
        (await readFile(
          path.join(projectRoot(), "supabase/migrations", file),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (!inMemory) {
    if (process.env.CATERA_V1_FIXTURES === "true")
      await db.exec(contentsFixturesSQL());
    else await db.exec(retireDemoFixturePackagesSQL());
    await db.exec(refreshDemoCatalogSQL());
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regprocedure('public.catera_v1_read_operations_base(text,jsonb)') is not null or position('calendarMeta' in pg_get_functiondef('public.catera_v1_read(text,jsonb)'::regprocedure)) > 0 as installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      await readFile(
        path.join(
          projectRoot(),
          "supabase/migrations/20260910160000_calendar_metadata.sql",
        ),
        "utf8",
      ),
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regclass('v1.dish_categories') is not null as installed",
      )
    ).rows[0].installed
  ) {
    const file = (
      await readdir(path.join(projectRoot(), "supabase/migrations"))
    ).find((f) => f.endsWith("_slot_menu_calendar.sql"));
    if (!file) throw new Error("SLOT_MENU_MIGRATION_MISSING");
    await db.exec(
      "begin;" +
        (await readFile(
          path.join(projectRoot(), "supabase/migrations", file),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regprocedure('public.catera_v1_command_legacy(text,jsonb,uuid)') is not null as installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      "begin;" +
        (await readFile(
          path.join(
            projectRoot(),
            "supabase/migrations/20260911150000_shared_recurring_capacity.sql",
          ),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regprocedure('public.catera_v1_read_operations_base(text,jsonb)') is not null as installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      "begin;" +
        (await readFile(
          path.join(
            projectRoot(),
            "supabase/migrations/20260911150142_seller_operations.sql",
          ),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regprocedure('v1.valid_nutrition(jsonb)') is not null as installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      "begin;" +
        (await readFile(
          path.join(
            projectRoot(),
            "supabase/migrations/20260911163659_package_nutrition_ranges.sql",
          ),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  // This constructor owns synthetic PGlite storage; hosted RPC never enters it.
  await db.transaction(async (tx) => {
    await tx.query("select set_config('catera.demo','true',true)");
    await tx.exec(
      await readFile(
        path.join(projectRoot(), "packages/backend/src/demo-slot-upgrade.sql"),
        "utf8",
      ),
    );
  });
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regprocedure('v1.package_obligations(uuid)') is not null as installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      "begin;" +
        (await readFile(
          path.join(
            projectRoot(),
            "supabase/migrations/20260911163608_package_lifecycle.sql",
          ),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  const usability = await db.query<{ installed: string | null }>(
    "select to_regprocedure('public.catera_v1_read_usability_base(text,jsonb)') as installed",
  );
  if (!usability.rows[0]?.installed) {
    await db.exec(
      "begin;\n" +
        (await readFile(
          path.join(
            projectRoot(),
            "supabase/migrations/20260912100853_usability_read_options.sql",
          ),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  await db.exec(
    await readFile(
      path.join(
        projectRoot(),
        "supabase/migrations/20260913052558_menu_customer_cutoff.sql",
      ),
      "utf8",
    ),
  );
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regclass('v1.customer_menus') is not null as installed",
      )
    ).rows[0].installed
  ) {
    const file = (
      await readdir(path.join(projectRoot(), "supabase/migrations"))
    ).find((f) => f.endsWith("_customer_choice_menus.sql"));
    if (!file) throw new Error("CHOICE_MIGRATION_MISSING");
    await db.exec(
      "begin;\n" +
        (await readFile(
          path.join(projectRoot(), "supabase/migrations", file),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  for (const [capability, suffix] of [
    ["v1.customer_records", "_paid_seller_pilot.sql"],
    ["v1.package_duration_revisions", "_multi_cycle.sql"],
    ["v1.settlement_entries", "_earned_settlement.sql"],
  ]) {
    if (
      !(
        await db.query<{ installed: boolean }>(
          "select to_regclass($1) is not null as installed",
          [capability],
        )
      ).rows[0].installed
    ) {
      const file = (
        await readdir(path.join(projectRoot(), "supabase/migrations"))
      ).find((f) => f.endsWith(suffix));
      if (!file) throw new Error("MIGRATION_MISSING: " + suffix);
      await db.exec(
        "begin;\n" +
          (await readFile(
            path.join(projectRoot(), "supabase/migrations", file),
            "utf8",
          )) +
          "\ncommit;",
      );
    }
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regprocedure('v1.settlement_reporting_version()') is not null as installed",
      )
    ).rows[0].installed
  ) {
    const file = (
      await readdir(path.join(projectRoot(), "supabase/migrations"))
    ).find((f) => f.endsWith("_settlement_reporting.sql"));
    if (!file) throw new Error("REPORTING_MIGRATION_MISSING");
    await db.exec(
      "begin;\n" +
        (await readFile(
          path.join(projectRoot(), "supabase/migrations", file),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regclass('v1.payout_destinations') is not null as installed",
      )
    ).rows[0].installed
  ) {
    const file = (
      await readdir(path.join(projectRoot(), "supabase/migrations"))
    ).find((f) => f.endsWith("_seller_experience.sql"));
    if (!file) throw new Error("EXPERIENCE_MIGRATION_MISSING");
    await db.exec(
      "begin;\n" +
        (await readFile(
          path.join(projectRoot(), "supabase/migrations", file),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regclass('v1.delivery_issues') is not null installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      "begin;\n" +
        (await readFile(
          path.join(projectRoot(), "packages/backend/src/beta-operations.sql"),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regclass('v1.provider_operations') is not null installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      "begin;\n" +
        (await readFile(
          path.join(projectRoot(), "packages/backend/src/doku-sandbox.sql"),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select exists(select 1 from information_schema.columns where table_schema='v1' and table_name='checkouts' and column_name='terms_accepted_at') installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      "begin;\n" +
        (await readFile(
          path.join(
            projectRoot(),
            "supabase/migrations/20260920152746_checkout_sales_safeguards.sql",
          ),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  // Idempotent repairs for the same hosted worker paths used by local verification.
  for (const file of [
    "20260919145757_settlement_pending_status_qualification.sql",
    "20260919145914_settlement_pending_claim_alias.sql",
    "20260919150043_outbox_claim_top_level_cte.sql",
  ]) {
    await db.exec(
      await readFile(
        path.join(projectRoot(), "supabase/migrations", file),
        "utf8",
      ),
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select exists(select 1 from information_schema.columns where table_schema='v1' and table_name='checkouts' and column_name='payment_mode') installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      "begin;\n" +
        (await readFile(
          path.join(
            projectRoot(),
            "supabase/migrations/20260920154045_direct_payments.sql",
          ),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regprocedure('public.catera_v1_read_journeys_base(text,jsonb)') is not null installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      "begin;\n" +
        (await readFile(
          path.join(
            projectRoot(),
            "supabase/migrations/20260924150757_caterer_journey_reads.sql",
          ),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regprocedure('v1.customer_actions(uuid,integer)') is not null installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      "begin;\n" +
        (await readFile(
          path.join(
            projectRoot(),
            "supabase/migrations/20260926112150_uiux_action_reads.sql",
          ),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (
    !(
      await db.query<{ installed: boolean }>(
        "select to_regprocedure('v1.partial_package_drafts_version()') is not null as installed",
      )
    ).rows[0].installed
  ) {
    await db.exec(
      "begin;\n" +
        (await readFile(
          path.join(
            projectRoot(),
            "supabase/migrations/20260927105917_partial_package_drafts.sql",
          ),
          "utf8",
        )) +
        "\ncommit;",
    );
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regclass('v1.saved_packages') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261001180039_saved_packages.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regprocedure('v1.auto_deliver(date)') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261007100000_auto_delivered.sql"), "utf8") + "\ncommit;");
  }
  if ((await db.query<{ pending: boolean }>(
    "select position('COVERAGE' in prosrc)>0 pending from pg_proc where oid='v1.pilot_import_row(uuid,jsonb,boolean)'::regprocedure",
  )).rows[0].pending) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261007110000_import_before_approval.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regclass('v1.auto_deliver_policy') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008090000_auto_deliver_guards.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regclass('v1.delivery_reactions') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008100000_customer_arrival.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select position('departed_at' in prosrc)>0 installed from pg_proc where oid='v1.beta_production_signature(jsonb)'::regprocedure",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008100500_production_signature_arrival.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regprocedure('public.catera_v1_command_confirm_base(text,jsonb,uuid)') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008101000_delivery_confirm.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regprocedure('public.catera_v1_command_depart_base(text,jsonb,uuid)') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008102000_delivery_depart.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select position('INVALID_DATE' in prosrc)>0 installed from pg_proc where oid='public.catera_v1_command(text,jsonb,uuid)'::regprocedure",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008102500_depart_today_one_push.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regclass('v1.import_assistant_usage') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008110000_import_assistant_quota.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regprocedure('v1.remind_due(timestamptz)') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008103000_push_timing.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regprocedure('public.catera_v1_command_issue_reminder_base(text,jsonb,uuid)') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008111000_push_report_renewal_dedupe.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regprocedure('public.catera_v1_read_claim_preview_base(text,jsonb)') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008112000_claim_preview.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regprocedure('v1.caterer_whatsapp(uuid)') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008113000_caterer_whatsapp.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select position('insufficient_privilege' in prosrc)>0 installed from pg_proc where oid='v1.caterer_whatsapp(uuid)'::regprocedure",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008114000_caterer_whatsapp_denied.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select not exists(select 1 from pg_proc where position($$dedupe='renew-'||item.id) then perform$$ in prosrc)>0) installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008114500_maintenance_renewal_conflict.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regprocedure('public.catera_v1_read_issue_customer_base(text,jsonb)') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008120000_delivery_issue_customer.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regprocedure('public.catera_v1_command_issue_date_base(text,jsonb,uuid)') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008121000_delivery_issue_not_future.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select position('payAgain' in prosrc)>0 installed from pg_proc where oid='v1.customer_actions(uuid,int)'::regprocedure",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008122000_customer_payment_history.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select position('paymentFailed' in prosrc)>0 installed from pg_proc where oid='v1.customer_actions(uuid,int)'::regprocedure",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261008123000_customer_payment_failed.sql"), "utf8") + "\ncommit;");
  }
  if (!(await db.query<{ installed: boolean }>(
    "select to_regprocedure('public.catera_v1_command_cook_base(text,jsonb,uuid)') is not null installed",
  )).rows[0].installed) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261009090000_kitchen_cooking.sql"), "utf8") + "\ncommit;");
  }
  if ((await db.query<{ missing: boolean }>(
    "select to_regclass('v1.usage_daily') is null missing",
  )).rows[0].missing) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261009091000_usage_counts.sql"), "utf8") + "\ncommit;");
  }
  if ((await db.query<{ missing: boolean }>(
    "select to_regprocedure('v1.pilot_command_in_jakarta(text,jsonb,uuid)') is null missing",
  )).rows[0].missing) {
    await db.exec("begin;\n" + await readFile(path.join(projectRoot(),
      "supabase/migrations/20261010090000_pilot_jakarta_day.sql"), "utf8") + "\ncommit;");
  }
  // Synthetic renewal, payment and kitchen-loop states for the demo customer, after everything else, only on a demo
  // database seeded just now (`r`: no v1 schema before). Demo storage only: never run against hosted data.
  await applyDemoStates(db, { seeded: !r.rows[0].exists, root: projectRoot(), folder: inMemory ? null : folder });
  return db;
}
export async function getDemoDatabase() {
  if (!demoEnabled()) throw new Error("DEMO_DISABLED");
  return (globalDb.cateraV1 ??= createDemoDatabase());
}
export async function localRpc<T>(
  db: PGlite,
  actor: string | null,
  name: string,
  args: unknown[],
  system = false,
): Promise<T> {
  if (
    ![
      "catera_v1_read",
      "catera_v1_command",
      "catera_v1_system",
      "catera_v1_manifest",
      "catera_v1_reconcile",
      "catera_v1_usage",
    ].includes(name)
  )
    throw new Error("INVALID_RPC");
  return db.transaction(async (tx) => {
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('catera.demo','true',true),set_config('request.jwt.claims',$2,true)",
      [
        actor || "",
        JSON.stringify({
          role: system ? "service_role" : actor ? "authenticated" : "anon",
        }),
      ],
    );
    const r = await tx.query<{ value: T }>(
      "select public." +
        name +
        "(" +
        args.map((_, i) => "$" + (i + 1)).join(",") +
        ") value",
      args,
    );
    return r.rows[0].value;
  });
}
export async function rpc<T>(
  actor: string | null,
  accessToken: string | null,
  name: string,
  args: Record<string, unknown>,
  system = false,
): Promise<T> {
  if (demoEnabled())
    return localRpc<T>(
      await getDemoDatabase(),
      actor,
      name,
      Object.values(args),
      system,
    );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = system
    ? process.env.SUPABASE_SECRET_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NOT_CONFIGURED");
  if (url.includes("otmanljypltxkwjcebni"))
    throw new Error("PILOT_DATABASE_PROTECTED");
  const client = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      headers: accessToken ? { Authorization: "Bearer " + accessToken } : {},
    },
  });
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
