import { cookies } from "next/headers";
import { supabase } from "../../../lib/auth";
import { authOrigin } from "../../../lib/auth-lifecycle";
import { rpc, demoEnabled } from "@catera/backend";
import type { Actor } from "@catera/domain";
import { safeReturnPath, signedInPath } from "../../../lib/navigation";
import { defaultWorkspace, workspaceCookieName } from "../../../lib/workspace";
import {
  createRecoveryGrant,
  recoveryCookie,
  recoveryMaxAge,
  recoverySecret,
} from "../../../lib/recovery-grant";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const recovery = type === "recovery";
  const next = safeReturnPath(url.searchParams.get("next"));
  let origin: string;
  try {
    origin = authOrigin(request);
  } catch {
    return new Response("Authentication is not configured.", { status: 503 });
  }
  const redirect = (path: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: new URL(path, origin).toString(),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  try {
    if (demoEnabled()) throw new Error("FORBIDDEN");
    const token = url.searchParams.get("token_hash");
    if (
      !token ||
      token.length > 2048 ||
      (type !== "signup" && type !== "recovery")
    )
      throw new Error("INVALID_INPUT");
    const secret = recovery ? recoverySecret() : null;
    const client = await supabase();
    const { data, error } = await client.auth.verifyOtp({
      token_hash: token,
      type,
    });
    if (error || !data.user || !data.session) throw new Error("UNAUTHORIZED");
    const jar = await cookies();
    jar.delete(recoveryCookie);
    if (recovery && secret) {
      jar.set(
        recoveryCookie,
        createRecoveryGrant(data.user.id, data.session.access_token, secret),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: recoveryMaxAge,
        },
      );
      return redirect("/reset-password");
    }
    const name =
      typeof data.user.user_metadata?.name === "string"
        ? data.user.user_metadata.name.trim().slice(0, 100)
        : "Pelanggan";
    await rpc(data.user.id, data.session.access_token, "catera_v1_command", {
      action: "profile.ensure",
      payload: { name: name || "Pelanggan" },
      request_id: crypto.randomUUID(),
    });
    const actor = await rpc<Actor>(
      data.user.id,
      data.session.access_token,
      "catera_v1_read",
      { resource: "actor", params: {} },
    );
    jar.set(workspaceCookieName, defaultWorkspace(actor), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return redirect(signedInPath(actor, next));
  } catch {
    return redirect(
      (recovery ? "/forgot-password" : "/register") +
        "?error=link" +
        (next ? "&next=" + encodeURIComponent(next) : ""),
    );
  }
}
