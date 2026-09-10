import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { demoEnabled, rpc, DEMO_ACTORS } from "@catera/backend";
import type { Actor } from "@catera/domain";
const localGlobal = globalThis as unknown as { demoSecret?: string };
const secret = () =>
  process.env.CATERA_SESSION_SECRET ||
  (localGlobal.demoSecret ??= randomBytes(48).toString("hex"));
export async function supabase() {
  const jar = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NOT_CONFIGURED");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        for (const v of values)
          try {
            jar.set(v.name, v.value, v.options);
          } catch {
            /* Refresh in a route handler. */
          }
      },
    },
  });
}
export function demoToken(role: keyof typeof DEMO_ACTORS) {
  if (!demoEnabled() || !DEMO_ACTORS[role]) throw new Error("FORBIDDEN");
  const data = Buffer.from(
    JSON.stringify({ id: DEMO_ACTORS[role], exp: Date.now() + 86400000 }),
  ).toString("base64url");
  return (
    "demo." +
    data +
    "." +
    createHmac("sha256", secret()).update(data).digest("base64url")
  );
}
function verifyDemo(token: string) {
  const [, data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(
      createHmac("sha256", secret()).update(data).digest("base64url"),
    ),
    actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  try {
    const value = JSON.parse(Buffer.from(data, "base64url").toString());
    return value.exp > Date.now() &&
      Object.values(DEMO_ACTORS).includes(value.id)
      ? (value.id as string)
      : null;
  } catch {
    return null;
  }
}
export async function session(
  request?: Request,
): Promise<{ actor: Actor | null; token: string | null; id: string | null }> {
  const bearer = request?.headers.get("authorization")?.replace(/^Bearer /, "");
  if (demoEnabled()) {
    const token = bearer || (await cookies()).get("catera_v1_demo")?.value;
    const id = token ? verifyDemo(token) : null;
    return {
      id,
      token: null,
      actor: id
        ? await rpc<Actor>(id, null, "catera_v1_read", {
            resource: "actor",
            params: {},
          })
        : null,
    };
  }
  try {
    const client = bearer
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: "Bearer " + bearer } },
            auth: { persistSession: false },
          },
        )
      : await supabase();
    const { data, error } = await client.auth.getUser(bearer);
    if (error || !data.user) return { id: null, actor: null, token: null };
    const token =
      bearer ||
      (await client.auth.getSession()).data.session?.access_token ||
      null;
    return {
      id: data.user.id,
      token,
      actor: await rpc<Actor>(data.user.id, token, "catera_v1_read", {
        resource: "actor",
        params: {},
      }),
    };
  } catch {
    return { id: null, actor: null, token: null };
  }
}
