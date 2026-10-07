import type {
  Offer,
  CustomerState,
  SellerState,
  AdminState,
  Actor,
  Quote,
  Checkout,
  Conversation,
  MenuMonth,
  SellerOperationsState,
  SellerCalendar,
  SellerImportOptions,
  PackageDish,
  CustomerMenuMonth,
  RenewalContext,
  SellerCustomersState,
  PilotState,
  SettlementResponse,
  SettlementReport,
  SettlementPage,
  SettlementPayout,
  SettlementCursor,
  SettlementHistoryKind,
  SettlementReportingUnavailable,
  DeliveryAvailability,
  CustomerActionFeed,
  SellerAttentionPage,
  SavedPackages,
  ClaimPreview,
} from "@catera/domain";
export class ApiError extends Error {
  constructor(
    public code: string,
    public requestId?: string,
  ) {
    super(code);
  }
}
export function createApi(
  base = "",
  token?: () => Promise<string | null>,
  { timeoutMs = 30_000 }: { timeoutMs?: number } = {},
) {
  async function request<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new ApiError("REQUEST_TIMEOUT"));
        controller.abort();
      }, timeoutMs);
    });
    try {
      return await Promise.race([
        timeout,
        (async () => {
          // Session restoration can itself need the network. Bound it too,
          // and never send a late write after the caller has already timed out.
          const access = await token?.();
          if (controller.signal.aborted) throw new ApiError("REQUEST_TIMEOUT");
          const response = await fetch(base + "/api/v1/" + path, {
            method: body ? "POST" : "GET",
            credentials: "include",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              ...(access ? { Authorization: "Bearer " + access } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          let result;
          try {
            result = await response.json();
          } catch {
            throw new ApiError("INVALID_API_RESPONSE");
          }
          if (!response.ok)
            throw new ApiError(
              result?.error?.code || "REQUEST_FAILED",
              result?.error?.requestId,
            );
          if (!result || typeof result !== "object" || !("data" in result))
            throw new ApiError("INVALID_API_RESPONSE");
          return result.data as T;
        })(),
      ]);
    } finally {
      clearTimeout(timer!);
    }
  }
  return {
    request,
    catalog: (query = "") =>
      request<{ items: Offer[]; nextCursor: string | null }>("catalog" + query),
    me: () => request<{ actor: Actor | null; demo: boolean }>("me"),
    offer: (id: string) => request<{ offer: Offer | null }>("offer/" + encodeURIComponent(id)),
    claimPreview: (token: string) =>
      request<ClaimPreview>("claim-preview/" + encodeURIComponent(token)),
    savedPackages: (cursor?: string, limit = 50) =>
      request<SavedPackages>("saved-packages?" + new URLSearchParams({
        limit: String(limit), ...(cursor ? { cursor } : {}),
      })),
    customer: (query = "") => request<CustomerState>("customer" + query),
    customerActions: (limit = 20) =>
      request<CustomerActionFeed>(
        "customer-actions?" + new URLSearchParams({ limit: String(limit) }),
      ),
    deliveryAvailability: (id: string, from: string, to: string) =>
      request<DeliveryAvailability[]>(
        "availability/" + id + "?" + new URLSearchParams({ from, to }),
      ),
    seller: (id: string, date: string) =>
      request<SellerState>("seller/" + id + "?date=" + date),
    sellerOperations: (id: string, date?: string) =>
      request<SellerOperationsState>(
        "seller/" + id + (date ? "?date=" + date : ""),
      ),
    sellerAttention: (
      id: string,
      params: {
        scope?: "selected" | "future" | "all";
        date?: string;
        meal?: "lunch" | "dinner";
        cursor?: string;
        limit?: number;
      } = {},
    ) =>
      request<SellerAttentionPage>(
        "seller-attention/" +
          id +
          "?" +
          new URLSearchParams({
            scope: params.scope ?? "all",
            limit: String(params.limit ?? 20),
            ...(params.date ? { date: params.date } : {}),
            ...(params.meal ? { meal: params.meal } : {}),
            ...(params.cursor ? { cursor: params.cursor } : {}),
          }),
      ),
    sellerCalendar: (id: string, params: Record<string, string>) =>
      request<SellerCalendar>(
        "seller-calendar/" + id + "?" + new URLSearchParams(params),
      ),
    sellerImportOptions: (id: string) =>
      request<SellerImportOptions>("seller-import-options/" + id),
    menuMonth: (
      packageId: string,
      revision: number,
      month: string,
      meal: string,
    ) =>
      request<MenuMonth>(
        "menu-month?" +
          new URLSearchParams({
            packageId,
            revision: String(revision),
            month,
            meal,
          }),
      ),
    packageOptions: (packageId: string) =>
      request<PackageDish[]>(
        "package-options?" + new URLSearchParams({ packageId }),
      ),
    customerMenuMonth: (subscriptionId: string, month: string, meal: string) =>
      request<CustomerMenuMonth>(
        "customer-menu-month?" +
          new URLSearchParams({ subscriptionId, month, meal }),
      ),
    admin: () => request<AdminState>("admin"),
    conversations: () => request<Conversation[]>("conversations"),
    quote: (payload: unknown) => request<Quote>("quote", payload),
    renewalContext: (id: string, packageId?: string, cycles = 1) =>
      request<RenewalContext>(
        "renewal-context/" +
          id +
          "?" +
          new URLSearchParams({
            cycles: String(cycles),
            ...(packageId ? { packageId } : {}),
          }),
      ),
    sellerCustomers: (id: string, query = "") =>
      request<SellerCustomersState>("seller-customers/" + id + query),
    pilot: (id: string, from: string, to: string) =>
      request<PilotState>(
        "pilot/" + id + "?" + new URLSearchParams({ from, to }),
      ),
    settlement: (id: string) =>
      request<SettlementResponse>("seller-settlement/" + id),
    settlementReport: (id: string, days: 7 | 30) =>
      request<SettlementReport | SettlementReportingUnavailable>(
        "seller-settlement-report/" + id + "?days=" + days,
      ),
    settlementHistory: (
      id: string,
      kind: SettlementHistoryKind,
      cursor?: SettlementCursor,
    ) =>
      request<SettlementPage | SettlementReportingUnavailable>(
        "seller-settlement-history/" +
          id +
          "?" +
          new URLSearchParams({
            kind,
            ...(cursor ? { cursor: JSON.stringify(cursor) } : {}),
          }),
      ),
    settlementPayout: (
      id: string,
      payoutId: string,
      cursor?: SettlementCursor,
    ) =>
      request<SettlementPayout | SettlementReportingUnavailable>(
        "seller-settlement-payout/" +
          id +
          "?" +
          new URLSearchParams({
            payoutId,
            ...(cursor ? { cursor: JSON.stringify(cursor) } : {}),
          }),
      ),
    checkout: (id: string) => request<Checkout>("checkouts/" + id),
    command: <T = Record<string, unknown>>(
      action: string,
      payload: unknown,
      requestId: string = globalThis.crypto.randomUUID(),
    ) => request<T>("commands", { action, payload, requestId }),
  };
}
