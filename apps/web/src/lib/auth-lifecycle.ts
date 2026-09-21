import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emailSchema,
  newPasswordSchema,
  registerEmail,
  confirmationUrl,
  authError,
} from "./registration";
import {
  recoveryCookie,
  recoverySecret,
  verifyRecoveryGrant,
} from "./recovery-grant";

export function authOrigin(request: Request) {
  const configured = process.env.CATERA_PUBLIC_URL;
  if (!configured && process.env.NODE_ENV === "production")
    throw new Error("NOT_CONFIGURED");
  return new URL(configured || request.url).origin;
}

export async function authLifecycle(
  action: string,
  input: Record<string, unknown>,
  client: SupabaseClient,
  request: Request,
) {
  const origin = authOrigin(request);
  if (action === "register") return registerEmail(client, input, origin);
  if (action === "resend") {
    const { error } = await client.auth.resend({
      type: "signup",
      email: emailSchema.parse(input.email),
      options: { emailRedirectTo: confirmationUrl(origin, input.next) },
    });
    // Confirmation state and account existence are deliberately not disclosed.
    if (
      error?.code !== "user_not_found" &&
      error?.code !== "email_not_confirmed" &&
      error?.code !== "email_exists"
    )
      authError(error);
    return { sent: true };
  }
  if (action === "recover") {
    recoverySecret(); // Fail before sending unusable recovery links.
    const { error } = await client.auth.resetPasswordForEmail(
      emailSchema.parse(input.email),
      { redirectTo: confirmationUrl(origin, null, true) },
    );
    if (error?.code !== "user_not_found") authError(error);
    return { sent: true };
  }
  if (action === "reset-password") {
    const password = newPasswordSchema.parse(input.password);
    const jar = await cookies();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    const {
      data: { session },
    } = await client.auth.getSession();
    if (
      error ||
      !user ||
      !session ||
      !verifyRecoveryGrant(
        jar.get(recoveryCookie)?.value,
        user.id,
        session.access_token,
        recoverySecret(),
      )
    ) {
      throw new Error("RECOVERY_EXPIRED");
    }
    const updated = await client.auth.updateUser({ password });
    authError(updated.error);
    jar.delete(recoveryCookie);
    await client.auth.signOut();
    return { updated: true };
  }
  throw new Error("NOT_FOUND");
}
