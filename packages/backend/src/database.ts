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
