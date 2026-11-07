import type {
  Offer,
  AddressUse,
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
  UsageName,
} from "@catera/domain";
export class ApiError extends Error {
  constructor(
    public code: string,
    public requestId?: string,
    /** The HTTP status, when a response arrived. */
    public status?: number,
  ) {
    super(code);
  }
}
/**
 * `base` left out means same origin (the web). An empty one is a native build with no API URL: it fails as
 * NOT_CONFIGURED, since a relative fetch on a phone would throw the TypeError that reads as being offline.
 */
export function createApi(
  base?: string,
  token?: () => Promise<string | null>,
  {
    timeoutMs = 30_000,
    credentials = "include",
  }: {
    timeoutMs?: number;
    /**
     * Whether requests carry and keep cookies. The web session lives in cookies ("include"). A native client signs in
     * with a bearer token only and passes "omit": the phone's fetch (expo/fetch, which defaults to "include")
     * otherwise stores the API's cookies, such as the demo `catera_v1_demo`, in the phone's cookie store and keeps
     * sending them after the token is gone.
     */
    credentials?: RequestCredentials;
  } = {},
) {
  async function request<T>(path: string, body?: unknown): Promise<T> {
    if (base === "") throw new ApiError("NOT_CONFIGURED");
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
          const response = await fetch((base ?? "") + "/api/v1/" + path, {
            method: body ? "POST" : "GET",
            credentials,
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
            throw new ApiError("INVALID_API_RESPONSE", undefined, response.status);
          }
          if (!response.ok)
            throw new ApiError(
              result?.error?.code || "REQUEST_FAILED",
              result?.error?.requestId,
              response.status,
            );
          if (!result || typeof result !== "object" || !("data" in result))
            throw new ApiError("INVALID_API_RESPONSE", undefined, response.status);
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
    addressUse: (id: string) => request<AddressUse>("address-use/" + encodeURIComponent(id)),
    customerActions: (limit = 20) =>
      request<CustomerActionFeed>(
        "customer-actions?" + new URLSearchParams({ limit: String(limit) }),
      ),
    deliveryAvailability: (id: string, from: string, to: string) =>
      request<DeliveryAvailability[]>(
        "availability/" + encodeURIComponent(id) + "?" + new URLSearchParams({ from, to }),
      ),
    seller: (id: string, date: string) =>
      request<SellerState>("seller/" + encodeURIComponent(id) + "?date=" + encodeURIComponent(date)),
    sellerOperations: (id: string, date?: string) =>
      request<SellerOperationsState>(
        "seller/" + encodeURIComponent(id) + (date ? "?date=" + encodeURIComponent(date) : ""),
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
          encodeURIComponent(id) +
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
        "seller-calendar/" + encodeURIComponent(id) + "?" + new URLSearchParams(params),
      ),
    sellerImportOptions: (id: string) =>
      request<SellerImportOptions>("seller-import-options/" + encodeURIComponent(id)),
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
          encodeURIComponent(id) +
          "?" +
          new URLSearchParams({
            cycles: String(cycles),
            ...(packageId ? { packageId } : {}),
          }),
      ),
    sellerCustomers: (id: string, query = "") =>
      request<SellerCustomersState>("seller-customers/" + encodeURIComponent(id) + query),
    pilot: (id: string, from: string, to: string) =>
      request<PilotState>(
        "pilot/" + encodeURIComponent(id) + "?" + new URLSearchParams({ from, to }),
      ),
    settlement: (id: string) =>
      request<SettlementResponse>("seller-settlement/" + encodeURIComponent(id)),
    settlementReport: (id: string, days: 7 | 30) =>
      request<SettlementReport | SettlementReportingUnavailable>(
        "seller-settlement-report/" + encodeURIComponent(id) + "?days=" + days,
      ),
    settlementHistory: (
      id: string,
      kind: SettlementHistoryKind,
      cursor?: SettlementCursor,
    ) =>
      request<SettlementPage | SettlementReportingUnavailable>(
        "seller-settlement-history/" +
          encodeURIComponent(id) +
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
          encodeURIComponent(id) +
          "?" +
          new URLSearchParams({
            payoutId,
            ...(cursor ? { cursor: JSON.stringify(cursor) } : {}),
          }),
      ),
    checkout: (id: string) => request<Checkout>("checkouts/" + encodeURIComponent(id)),
    command: <T = Record<string, unknown>>(
      action: string,
      payload: unknown,
      requestId: string = globalThis.crypto.randomUUID(),
    ) => request<T>("commands", { action, payload, requestId }),
    /** One anonymous daily count. The server keeps no user, caterer or device with it. */
    usage: async (name: UsageName, app: "customer" | "dapur"): Promise<void> => {
      await request("usage", { name, app });
    },
  };
}
