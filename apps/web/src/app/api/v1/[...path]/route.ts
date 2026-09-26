import { enrichPayoutSetup } from "@/lib/payout-setup";
import type { PayoutSetup } from "@catera/domain";
import {
  readSettlementResource,
  readSettlementReporting,
} from "@/lib/settlement-read";
import { assertSameOrigin } from "@/lib/request-origin";
import {
  decodeAttentionCursor,
  encodeAttentionCursor,
  type AttentionCursor,
} from "@/lib/attention-cursor";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  enrichDirectCheckout,
  filterPaymentAvailability,
  directMethodReady,
  submitDirectPayment,
  reconcileDirectPayment,
  processDokuInbox,
  demoEnabled,
  rpc,
  createPaymentSession,
  attachPayment,
  assertEarnedCollection,
  DEMO_ACTORS,
} from "@catera/backend";
import {
  addressSchema,
  packageOptionSchema,
  customerMenuSaveSchema,
  customerMenuResetSchema,
  menuBatchSaveSchema,
  categorySaveSchema,
  checkoutSchema,
  durationPricingSchema,
  normalizeCustomerPhone,
  commandSchema,
  deliveryBatchSchema,
  offerSchema,
  menuSaveSchema,
  dishSaveSchema,
  dishArchiveSchema,
  type Checkout,
  type PaymentAvailability,
  type Quote,
} from "@catera/domain";
import { session, supabase, demoToken } from "@/lib/auth";
import { authLifecycle } from "@/lib/auth-lifecycle";
import { recoveryCookie } from "@/lib/recovery-grant";
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
  "PAYMENT_UNAVAILABLE",
  "PAYMENT_METHOD_LOCKED",
  "EMAIL_NOT_CONFIRMED",
  "PASSWORD_REJECTED",
  "AUTH_UNAVAILABLE",
  "RECOVERY_EXPIRED",
  "TERMS_REQUIRED",
  "DURATION_UNAVAILABLE",
  "BOOKING_HORIZON",
  "PROMOTIONS_DISABLED",
  "AMOUNT_TOO_LARGE",
  "SETTLEMENT_SCHEDULED",
  "SETTLEMENT_NOT_CONFIGURED",
  "PHONE_VERIFICATION_REQUIRED",
  "CLAIM_UNAVAILABLE",
  "IMPORT_LIMIT",
  "DUPLICATE_IMPORT",
  "SETTLEMENT_PROVIDER_RECONCILIATION",
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
  "CUSTOMER_NOT_LINKED",
  "OVERLAP",
  "TRIAL_USED",
  "FIXED_PACKAGE",
  "DUPLICATE_DATE",
  "INVALID_DATE",
  "INVALID_INPUT",
  "NOT_FOUND",
  "NOT_CONFIGURED",
  "NOT_AVAILABLE",
  "PACKAGE_IMMUTABLE",
  "SUSPEND_FIRST",
  "PACKAGE_HAS_DELIVERIES",
  "INSUFFICIENT_OPTIONS",
  "OPTION_CHANGED",
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
        "renewal-context",
        "seller-customers",
        "seller-attention",
        "delivery-issues",
        "seller-identity",
        "message-customers",
        "payout-setup",
        "payout-destination-queue",
        "payout-destination-detail",
        "account-requests",
        "pilot",
        "seller-settlement",
        "seller-settlement-report",
        "seller-settlement-history",
        "seller-settlement-payout",
        "settlement-controls",
        "reviews",
        "availability",
        "customer",
        "customer-actions",
        "seller",
        "seller-calendar",
        "seller-import-options",
        "menu-month",
        "package-options",
        "customer-menu-month",
        "admin",
        "conversations",
        "checkout",
        "payment-methods",
      ].includes(resource)
    )
      throw new Error("NOT_FOUND");
    if (path[1]) params.id = path[1];
    if (resource === "customer-actions") {
      params.limit = z.coerce
        .number()
        .int()
        .min(1)
        .max(20)
        .parse(params.limit ?? 20)
        .toString();
    }
    if (resource === "seller-attention") {
      z.string().uuid().parse(params.id);
      params.scope = z
        .enum(["selected", "future", "all"])
        .parse(params.scope ?? "all");
      params.limit = z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .parse(params.limit ?? 20)
        .toString();
      if (params.date) {
        z.string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .refine((value) => {
            const parsed = new Date(value + "T00:00:00Z");
            return (
              !Number.isNaN(parsed.valueOf()) &&
              parsed.toISOString().slice(0, 10) === value
            );
          })
          .parse(params.date);
      }
      if (params.scope === "selected" && !params.date)
        throw new Error("INVALID_INPUT");
      if (params.meal) z.enum(["lunch", "dinner"]).parse(params.meal);
      if (params.cursor) {
        const cursor = decodeAttentionCursor(params.cursor);
        params.cursorPriority = String(cursor.priority);
        params.cursorAt = cursor.at;
        params.cursorId = cursor.id;
        delete params.cursor;
      }
    }
    if (resource === "payout-setup") {
      const state = await rpc<PayoutSetup>(s.id, s.token, "catera_v1_read", {
        resource,
        params,
      });
      return ok(enrichPayoutSetup(state, params.id));
    }
    const read = () =>
      rpc(s.id, s.token, "catera_v1_read", { resource, params });
    if (
      [
        "seller-settlement-report",
        "seller-settlement-history",
        "seller-settlement-payout",
      ].includes(resource)
    ) {
      z.string().uuid().parse(params.id);
      if (resource === "seller-settlement-report")
        z.enum(["7", "30"]).parse(params.days ?? "30");
      if (resource === "seller-settlement-history")
        z.enum(["payouts", "entries", "holds"]).parse(params.kind);
      if (resource === "seller-settlement-payout")
        z.string().uuid().parse(params.payoutId);
      if (params.cursor) {
        if (params.cursor.length > 300) throw new Error("INVALID_INPUT");
        let cursor: unknown;
        try {
          cursor = JSON.parse(params.cursor);
        } catch {
          throw new Error("INVALID_INPUT");
        }
        z.object({
          at: z.string().datetime({ offset: true }),
          id: z.string().uuid(),
        })
          .strict()
          .parse(cursor);
      }
      return ok(
        await readSettlementReporting(
          s.actor,
          params.id,
          () =>
            rpc(s.id, s.token, "catera_v1_read", {
              resource: "seller-settlement",
              params: { id: params.id },
            }),
          read,
        ),
      );
    }
    if (resource === "checkout")
      return ok(enrichDirectCheckout((await read()) as Checkout));
    if (resource === "payment-methods")
      return ok(
        filterPaymentAvailability((await read()) as PaymentAvailability),
      );
    if (resource === "seller-attention") {
      const page = (await read()) as {
        timezone: string;
        total: number;
        items: unknown[];
        nextCursor: AttentionCursor | null;
      };
      return ok({
        ...page,
        nextCursor: page.nextCursor
          ? encodeAttentionCursor(page.nextCursor)
          : null,
      });
    }
    return ok(
      resource === "seller-settlement" || resource === "settlement-controls"
        ? await readSettlementResource(s.actor, resource, params.id, read)
        : await read(),
    );
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
      if (["phone-send", "phone-verify"].includes(path[1])) {
        const s = await session(request);
        if (!s.id || demoEnabled())
          throw new Error("PHONE_VERIFICATION_REQUIRED");
        const client = await supabase();
        const current = await client.auth.getUser();
        if (current.error || current.data.user?.id !== s.id)
          throw new Error("FORBIDDEN");
        const phone = normalizeCustomerPhone(z.string().parse(a.phone));
        const result =
          path[1] === "phone-send"
            ? await client.auth.updateUser({ phone })
            : await client.auth.verifyOtp({
                phone,
                token: z
                  .string()
                  .regex(/^\d{6}$/)
                  .parse(a.token),
                type: "phone_change",
              });
        if (result.error) throw new Error("PHONE_VERIFICATION_REQUIRED");
        return ok({ sent: true });
      }
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
        (await cookies()).delete(recoveryCookie);
        (await cookies()).delete("catera_v1_demo");
        (await cookies()).delete(workspaceCookieName);
        if (!demoEnabled())
          await (await supabase()).auth.signOut({ scope: "local" });
        return ok({});
      }
      if (demoEnabled()) throw new Error("FORBIDDEN");
      const client = await supabase();
      if (
        ["register", "resend", "recover", "reset-password"].includes(path[1])
      ) {
        return ok(await authLifecycle(path[1], a, client, request));
      }
      if (path[1] === "password") {
        (await cookies()).delete(recoveryCookie);
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
          options: {
            captchaToken: a.captchaToken,
            shouldCreateUser: a.intent !== "login",
          },
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
      // New accountless prepaid customers are created atomically by import.commit.
      // Keep standalone manual acquisition retired.
      if (command.action === "customer.save" && !command.payload.id)
        throw new Error("NOT_AVAILABLE");
      if (command.action === "customer.claim") {
        if (demoEnabled()) throw new Error("PHONE_VERIFICATION_REQUIRED");
        const client = await supabase();
        const verified = await client.auth.getUser(s.token || undefined);
        const user = verified.data.user;
        if (
          verified.error ||
          user?.id !== s.id ||
          !user.phone ||
          !user.phone_confirmed_at
        )
          throw new Error("PHONE_VERIFICATION_REQUIRED");
        return ok(
          await rpc(
            null,
            null,
            "catera_v1_system",
            {
              action: "pilot.claim",
              payload: {
                userId: s.id,
                verifiedPhone: normalizeCustomerPhone(user.phone),
                token: z.string().min(20).max(200).parse(command.payload.token),
                requestId: command.requestId,
              },
            },
            true,
          ),
        );
      }
      if (command.action === "package.durationPricing.save")
        command.payload = durationPricingSchema.parse(command.payload);
      if (command.action === "packageOption.save")
        command.payload = packageOptionSchema.parse(command.payload);
      if (command.action === "customerMenu.saveBatch")
        command.payload = customerMenuSaveSchema.parse(command.payload);
      if (command.action === "customerMenu.resetBatch")
        command.payload = customerMenuResetSchema.parse(command.payload);
      if (command.action === "delivery.statusBatch")
        command.payload = deliveryBatchSchema.parse(command.payload);
      if (
        command.action === "checkout.create" &&
        command.payload.acceptedTerms !== true
      )
        throw new Error("TERMS_REQUIRED");
      if (command.action === "checkout.create")
        command.payload = checkoutSchema.parse(command.payload);
      if (command.action === "checkout.create" && !demoEnabled()) {
        const availability = filterPaymentAvailability(
          await rpc<PaymentAvailability>(s.id, s.token, "catera_v1_read", {
            resource: "payment-methods",
            params: {},
          }),
        );
        if (
          availability.mode === "direct" &&
          !availability.availableMethods.length
        )
          throw new Error("PAYMENT_UNAVAILABLE");
        const q = await rpc<Quote>(s.id, s.token, "catera_v1_read", {
          resource: "quote",
          params: command.payload,
        });
        assertEarnedCollection(q.offer.catererId);
      }
      if (command.action === "address.save")
        command.payload = addressSchema.parse(command.payload);
      if (command.action === "menu.save")
        command.payload = menuSaveSchema.parse(command.payload);
      if (command.action === "menu.saveBatch")
        command.payload = menuBatchSaveSchema.parse(command.payload);
      if (command.action === "category.save")
        command.payload = categorySaveSchema.parse(command.payload);
      if (command.action === "dish.save")
        command.payload = dishSaveSchema.parse(command.payload);
      if (command.action === "dish.archive")
        command.payload = dishArchiveSchema.parse(command.payload);
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
      if (
        command.action === "checkout.payment.start" ||
        command.action === "checkout.payment.refresh"
      ) {
        const payload = z
          .object({
            id: z.string().uuid(),
            method: z.enum(["VIRTUAL_ACCOUNT_BRI", "QRIS"]).optional(),
          })
          .strict()
          .parse(command.payload);
        const readCheckout = () =>
          rpc<Checkout>(s.id, s.token, "catera_v1_read", {
            resource: "checkout",
            params: { id: payload.id },
          });
        const checkout = await readCheckout();
        if (
          command.action === "checkout.payment.start" &&
          (!payload.method ||
            (!checkout.payment?.selectedMethod &&
              !directMethodReady(payload.method)))
        )
          throw new Error("PAYMENT_UNAVAILABLE");
        await rpc(s.id, s.token, "catera_v1_command", {
          action: command.action,
          payload,
          request_id: command.requestId,
        });
        const system = <T = unknown>(action: string, payload: unknown = {}) =>
          rpc<T>(null, null, "catera_v1_system", { action, payload }, true);
        if (command.action === "checkout.payment.start")
          await submitDirectPayment(checkout, system);
        else {
          const operation = await system<
            import("@catera/backend").ProviderOperation | null
          >("provider.direct.refresh", { id: checkout.id });
          if (operation) {
            try {
              await reconcileDirectPayment(operation, system);
              await processDokuInbox(system);
            } catch {
              await system("provider.error", {
                kind: "payment",
                id: checkout.id,
                code: "DOKU_DIRECT_RECONCILIATION_REQUIRED",
              });
            }
          }
        }
        return ok(enrichDirectCheckout(await readCheckout()));
      }
      let result = await rpc<unknown>(s.id, s.token, "catera_v1_command", {
        action: command.action,
        payload: command.payload,
        request_id: command.requestId,
      });
      if (
        command.action === "checkout.create" &&
        !demoEnabled() &&
        (result as Checkout).payment_mode !== "direct"
      ) {
        const checkout = result as Checkout;
        try {
          const payment = await createPaymentSession(checkout);
          await attachPayment(checkout, payment);
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
