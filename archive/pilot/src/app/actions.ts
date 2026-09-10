"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { setDemoSession, supabase } from "@/lib/auth";
import { demoEnabled } from "@/lib/demo-db";
import { hostedDemoEnabled, parseDemoRole } from "@/lib/hosted-demo-config";
import { startHostedDemoSession } from "@/lib/hosted-demo";
import { rpc } from "@/lib/data";
import { commandSchemas, errorCode } from "@/lib/validation";
import type { CommandResult } from "@/lib/types";
export async function command(
  slug: string,
  action: string,
  payload: unknown,
  requestId: string,
): Promise<CommandResult> {
  const parsed = commandSchemas[action]?.safeParse(payload);
  if (!parsed?.success || !z.uuid().safeParse(requestId).success)
    return { ok: false, code: "INVALID_INPUT" };
  try {
    const result = await rpc<{ id?: string; applied?: number }>(
      "execute_command",
      {
        business_slug: slug,
        action,
        payload: parsed.data,
        request_id: requestId,
      },
    );
    revalidatePath("/w/" + slug, "layout");
    return { ok: true, result };
  } catch (error) {
    const code = errorCode(error instanceof Error ? error.message : "");
    console.warn(
      JSON.stringify({
        event: "catera.command_rejected",
        action,
        code,
        requestId,
      }),
    );
    return { ok: false, code };
  }
}
export async function demoLogin(form: FormData) {
  const role = parseDemoRole(form.get("role"));
  if (!role) return;
  if (hostedDemoEnabled()) {
    let failed = false;
    try {
      await startHostedDemoSession(role);
    } catch {
      failed = true;
      console.warn(JSON.stringify({ event: "catera.hosted_demo_login_failed" }));
    }
    // redirect throws; keep it outside the login error handler.
    if (failed) redirect("/login?demoError=1");
  } else {
    // The existing local-only guard remains intact.
    await setDemoSession(role);
  }
  redirect("/workspaces");
}
export async function sendCode(_state: { error: string }, form: FormData) {
  // A hosted demo must never activate real addresses or send login email.
  if (process.env.CATERA_HOSTED_DEMO_MODE === "true")
    return { error: "AUTH_NOT_CONFIGURED" };
  const email = String(form.get("email") || "")
    .trim()
    .toLowerCase();
  if (!z.email().safeParse(email).success) return { error: "INVALID_EMAIL" };
  try {
    // Only pre-provisioned accounts or explicitly invited addresses can activate.
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (secret) {
      const service = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        secret,
        { auth: { persistSession: false } },
      );
      const { data } = await service
        .from("invitations")
        .select("id")
        .eq("email", email)
        .is("accepted_at", null)
        .limit(1);
      if (data?.length)
        await service.auth.admin.createUser({ email, email_confirm: true });
    }
    const { error } = await (
      await supabase()
    ).auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) return { error: "EMAIL_SEND_FAILED" };
  } catch {
    return { error: "AUTH_NOT_CONFIGURED" };
  }
  (await cookies()).set("catera_pending_email", email, {
    httpOnly: true,
    sameSite: "lax",
    secure: !demoEnabled(),
    maxAge: 600,
    path: "/",
  });
  redirect("/verify");
}
export async function verifyCode(_state: { error: string }, form: FormData) {
  if (process.env.CATERA_HOSTED_DEMO_MODE === "true")
    return { error: "AUTH_NOT_CONFIGURED" };
  const email = (await cookies()).get("catera_pending_email")?.value;
  if (!email) return { error: "EMAIL_REQUIRED" };
  const { error } = await (
    await supabase()
  ).auth.verifyOtp({
    email,
    token: String(form.get("code") || ""),
    type: "email",
  });
  if (error) return { error: "INVALID_CODE" };
  (await cookies()).delete("catera_pending_email");
  redirect("/workspaces");
}
export async function logout() {
  if (demoEnabled()) (await cookies()).delete("catera_demo");
  else await (await supabase()).auth.signOut({
    // Logging out one visitor must not end every shared demo session.
    scope: hostedDemoEnabled() ? "local" : "global",
  });
  redirect("/login");
}
export async function setLocale(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "id";
  (await cookies()).set("catera_locale", locale, {
    sameSite: "lax",
    path: "/",
    maxAge: 31536000,
  });
  revalidatePath("/", "layout");
}
