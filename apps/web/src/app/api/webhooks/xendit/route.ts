import { rpc, verifyCallback, payoutEvent } from "@catera/backend";
export async function POST(request: Request) {
  if (!verifyCallback(request.headers.get("x-callback-token")))
    return new Response("Unauthorized", { status: 401 });
  try {
    const body = await request.json();
    const data = body.data || body;
    const system = <T = unknown>(action: string, payload: unknown) =>
      rpc<T>(null, null, "catera_v1_system", { action, payload }, true);
    if (String(body.event || "").startsWith("v3_payout.")) {
      if (
        !process.env.XENDIT_BUSINESS_ID ||
        body.business_id !== process.env.XENDIT_BUSINESS_ID
      )
        return new Response("Mismatched merchant", { status: 400 });
      const p = await system<{
        id: string;
        recipient_request: Record<string, unknown> | null;
      }>("payout.lookup", { id: data.reference_id });
      if (!p?.recipient_request)
        return new Response("Unknown payout", { status: 400 });
      const expected = p.recipient_request.recipient as {
        account_details?: Record<string, unknown>;
      };
      if (expected?.account_details) {
        for (const key of ["account_number", "account_country", "currency"]) {
          if (
            expected.account_details[key] !== undefined &&
            data.recipient?.account_details?.[key] !==
              expected.account_details[key]
          )
            return new Response("Mismatched recipient", { status: 400 });
        }
      }
      await system(
        "payout.event",
        payoutEvent(
          data,
          body.id ||
            [data.payout_id, data.status, data.updated || body.created].join(
              ":",
            ),
        ),
      );
    } else if (data.payment_session_id) {
      if (!data.reference_id)
        return new Response("Invalid event", { status: 400 });
      const status =
        data.status === "COMPLETED"
          ? "paid"
          : data.status === "EXPIRED"
            ? "expired"
            : null;
      if (!status) return Response.json({ received: true });
      await system("payment.event", {
        checkoutId: data.reference_id,
        providerId: data.payment_session_id,
        paymentRequestId: data.payment_request_id,
        eventId: body.id || data.payment_session_id + ":" + data.status,
        status,
        amount: data.amount,
        currency: data.currency,
      });
    } else if (
      String(body.event || "").startsWith("refund.") &&
      data.reference_id
    ) {
      const r = await system<{
        id: string;
        amount: number;
        provider_id: string;
        payment: { provider_id: string };
      }>("refund.lookup", { id: data.reference_id });
      if (
        !r ||
        r.amount !== data.amount ||
        data.currency !== "IDR" ||
        (r.provider_id && r.provider_id !== (data.id || data.refund_id)) ||
        r.payment.provider_id !== data.payment_request_id
      )
        return new Response("Mismatched refund", { status: 400 });
      const status =
        data.status === "SUCCEEDED"
          ? "succeeded"
          : data.status === "FAILED"
            ? "failed"
            : null;
      if (status)
        await system("refund.update", {
          id: r.id,
          providerId: data.id || data.refund_id,
          state: status,
        });
    } else return Response.json({ received: true, ignored: true });
    return Response.json({ received: true });
  } catch {
    return new Response("Event could not be processed", { status: 503 });
  }
}
