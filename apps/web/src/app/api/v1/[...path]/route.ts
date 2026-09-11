import { assertSameOrigin } from "@/lib/request-origin";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  demoEnabled,
  rpc,
  createPaymentSession,
  DEMO_ACTORS,
} from "@catera/backend";
import {
  addressSchema,
  menuBatchSaveSchema,
  categorySaveSchema,
  checkoutSchema,
  commandSchema,
  deliveryBatchSchema,
  offerSchema,
  menuSaveSchema,
  dishSaveSchema,
  dishArchiveSchema,
  type Checkout,
} from "@catera/domain";
import { session, supabase, demoToken } from "@/lib/auth";
import { passwordSignIn } from "@/lib/password-auth";
import type { Actor } from "@catera/domain";
import {
  canSwitchWorkspace,
  defaultWorkspace,
  defaultWorkspaceForRole,
  workspaceCookieName,
} from "@/lib/workspace";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function setWorkspaceCookie(value: ReturnType<typeof defaultWorkspace>) {
  (await cookies()).set(workspaceCookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
const ok = (data: unknown) =>
  Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
const codes = [
  "CLASSIFY_PACKAGE",
  "COMPOSITION_CHANGED",
  "INVALID_CREDENTIALS",
  "AUTH_RATE_LIMITED",
  "PRICE_CHANGED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "CAPACITY",
  "CUTOFF",
  "COVERAGE",
  "CONFLICT",
  "OVERLAP",
  "TRIAL_USED",
  "FIXED_PACKAGE",
  "DUPLICATE_DATE",
  "INVALID_DATE",
  "INVALID_INPUT",
  "NOT_FOUND",
  "NOT_CONFIGURED",
  "NOT_AVAILABLE",
  "AMOUNT_INVALID",
  "INVALID_STATE",
  "PILOT_DATABASE_PROTECTED",
  "PAYMENT_HOLD_TOO_SHORT",
];
function failure(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  const code =
    e instanceof z.ZodError
      ? "INVALID_INPUT"
      : codes.find((c) => msg.includes(c)) || "REQUEST_FAILED";
  const requestId = crypto.randomUUID();
  console.warn(
    JSON.stringify({ event: "catera.v1.rejected", code, requestId }),
  );
  return Response.json(
    { error: { code, requestId } },
    {
      status:
        code === "UNAUTHORIZED" || code === "INVALID_CREDENTIALS"
          ? 401
          : code === "AUTH_RATE_LIMITED"
            ? 429
            : code === "FORBIDDEN"
              ? 403
              : code === "NOT_FOUND"
                ? 404
                : code === "NOT_CONFIGURED"
                  ? 503
                  : 400,
    },
  );
}
export async function GET(request: Request, context: Context) {
  try {
    const { path } = await context.params;
    const s = await session(request);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    if (path[0] === "me") return ok({ actor: s.actor, demo: demoEnabled() });
    const resource = path[0] === "checkouts" ? "checkout" : path[0];
    if (
      ![
        "catalog",
        "reviews",
        "availability",
        "customer",
        "seller",
        "seller-calendar",
        "menu-month",
        "admin",
        "conversations",
        "checkout",
      ].includes(resource)
    )
      throw new Error("NOT_FOUND");
    if (path[1]) params.id = path[1];
    return ok(await rpc(s.id, s.token, "catera_v1_read", { resource, params }));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new Error("INVALID_INPUT");
    const raw = await request.text();
    if (raw.length > 150000) throw new Error("INVALID_INPUT");
    const a = JSON.parse(raw);
    const { path } = await context.params;
    if (path[0] === "auth") {
      if (path[1] === "demo") {
        const role = z
          .enum(["customer", "owner", "staff", "platform_admin"])
          .parse(a.role);
        const token = demoToken(role);
        (await cookies()).set("catera_v1_demo", token, {
          httpOnly: true,
          sameSite: "lax",
          secure: false,
          path: "/",
          maxAge: 86400,
        });
        await setWorkspaceCookie(defaultWorkspaceForRole(role));
        return ok({ token, id: DEMO_ACTORS[role] });
      }
      if (path[1] === "workspace") {
        const workspace = z.enum(["customer", "caterer"]).parse(a.workspace);
        const current = await session(request);
        if (!current.actor) throw new Error("UNAUTHORIZED");
        if (!canSwitchWorkspace(current.actor) && workspace !== "customer")
          throw new Error("FORBIDDEN");
        if (
          current.actor.role === "platform_admin" ||
          (current.actor.role !== "customer" &&
            current.actor.role !== "owner" &&
            current.actor.role !== "staff")
        )
          throw new Error("FORBIDDEN");
        await setWorkspaceCookie(workspace);
        return ok({ workspace });
      }
      if (path[1] === "logout") {
        (await cookies()).delete("catera_v1_demo");
        (await cookies()).delete(workspaceCookieName);
        if (!demoEnabled())
          await (await supabase()).auth.signOut({ scope: "local" });
        return ok({});
      }
      if (demoEnabled()) throw new Error("FORBIDDEN");
      const client = await supabase();
      if (path[1] === "password") {
        const result = await passwordSignIn(
          client,
          a,
          async (id, token, name) => {
            await rpc(id, token, "catera_v1_command", {
              action: "profile.ensure",
              payload: { name },
              request_id: crypto.randomUUID(),
            });
            return rpc<Actor>(id, token, "catera_v1_read", {
              resource: "actor",
              params: {},
            });
          },
        );
        await setWorkspaceCookie(defaultWorkspace(result.actor));
        return ok(result);
      }
      const phone = z
        .string()
        .regex(/^\+62\d{8,13}$/)
        .parse(a.phone);
      if (path[1] === "send") {
        const { error } = await client.auth.signInWithOtp({
          phone,
          options: { captchaToken: a.captchaToken },
        });
        if (error) throw new Error("NOT_CONFIGURED");
        return ok({});
      }
      if (path[1] === "verify") {
        const { data, error } = await client.auth.verifyOtp({
          phone,
          token: z
            .string()
            .regex(/^\d{6}$/)
            .parse(a.token),
          type: "sms",
        });
        if (error || !data.user) throw new Error("UNAUTHORIZED");
        await rpc(
          data.user.id,
          data.session?.access_token || null,
          "catera_v1_command",
          {
            action: "profile.ensure",
            payload: { name: a.name || "Pelanggan" },
            request_id: crypto.randomUUID(),
          },
        );
        const actor = await rpc<Actor>(
          data.user.id,
          data.session?.access_token || null,
          "catera_v1_read",
          { resource: "actor", params: {} },
        );
        await setWorkspaceCookie(defaultWorkspace(actor));
        return ok({
          session: data.session
            ? {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
              }
            : null,
        });
      }
    }
    const s = await session(request);
    if (!s.id) throw new Error("UNAUTHORIZED");
    if (path[0] === "quote") {
      const payload = checkoutSchema.parse(a);
      return ok(
        await rpc(s.id, s.token, "catera_v1_read", {
          resource: "quote",
          params: payload,
        }),
      );
    }
    if (path[0] === "commands") {
      const command = commandSchema.parse(a);
      if (command.action === "delivery.statusBatch") command.payload = deliveryBatchSchema.parse(command.payload);
      if (command.action === "checkout.create")
        command.payload = checkoutSchema.parse(command.payload);
      if (command.action === "address.save")
        command.payload = addressSchema.parse(command.payload);
      if (command.action === "menu.save")
        command.payload = menuSaveSchema.parse(command.payload);
      if (command.action === "menu.saveBatch") command.payload = menuBatchSaveSchema.parse(command.payload);
      if (command.action === "category.save") command.payload = categorySaveSchema.parse(command.payload);
      if (command.action === "dish.save") command.payload = dishSaveSchema.parse(command.payload);
      if (command.action === "dish.archive") command.payload = dishArchiveSchema.parse(command.payload);
      if (command.action === "package.save")
        command.payload = {
          ...command.payload,
          offer: offerSchema.parse(command.payload.offer),
        };
      if (command.action.startsWith("reconcile."))
        return ok(
          await rpc(s.id, s.token, "catera_v1_reconcile", {
            kind: command.action.split(".")[1],
            identifier: command.payload.id,
            details: command.payload,
            request_id: command.requestId,
          }),
        );
      let result = await rpc<unknown>(s.id, s.token, "catera_v1_command", {
        action: command.action,
        payload: command.payload,
        request_id: command.requestId,
      });
      if (command.action === "checkout.create" && !demoEnabled()) {
        const checkout = result as Checkout;
        try {
          const payment = await createPaymentSession(checkout);
          await rpc(
            null,
            null,
            "catera_v1_system",
            {
              action: "payment.attach",
              payload: { id: checkout.id, ...payment },
            },
            true,
          );
          result = { ...checkout, payment_url: payment.url };
        } catch {
          /* Durable outbox retries the same idempotent session. The reservation stays visible. */
        }
      }
      return ok(result);
    }
    throw new Error("NOT_FOUND");
  } catch (e) {
    return failure(e);
  }
}
