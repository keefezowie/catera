import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";
import { demoEnabled } from "./demo-db";
import { DEMO_USERS } from "./demo-seed";
export async function supabase() {
  const jar = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          values.forEach((v) => jar.set(v.name, v.value, v.options));
        } catch {
          /* Server components cannot refresh cookies; actions and proxy do. */
        }
      },
    },
  });
}
async function secret() {
  if (process.env.CATERA_SESSION_SECRET)
    return process.env.CATERA_SESSION_SECRET;
  if (!demoEnabled()) throw new Error("SESSION_NOT_CONFIGURED");
  const file = path.join(process.cwd(), ".data", "session-secret");
  await mkdir(path.dirname(file), { recursive: true });
  try {
    return await readFile(file, "utf8");
  } catch {
    const value = randomBytes(48).toString("hex");
    await writeFile(file, value, { flag: "wx" }).catch(() => {});
    return readFile(file, "utf8");
  }
}
export async function setDemoSession(role: keyof typeof DEMO_USERS) {
  if (!demoEnabled() || !DEMO_USERS[role]) throw new Error("DEMO_DISABLED");
  const body = DEMO_USERS[role] + "." + (Date.now() + 86400000);
  const token =
    body +
    "." +
    createHmac("sha256", await secret())
      .update(body)
      .digest("hex");
  (await cookies()).set("catera_demo", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 86400,
  });
}
export async function userId() {
  if (demoEnabled()) {
    const token = (await cookies()).get("catera_demo")?.value;
    if (!token) return null;
    const [id, expires, sig] = token.split(".");
    if (!id || !expires || !sig || Number(expires) < Date.now()) return null;
    const check = createHmac("sha256", await secret())
      .update(id + "." + expires)
      .digest("hex");
    const a = Buffer.from(check),
      b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return Object.values(DEMO_USERS).includes(id) ? id : null;
  }
  try {
    const { data } = await (await supabase()).auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
