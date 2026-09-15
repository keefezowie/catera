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
} from "@catera/domain";
export class ApiError extends Error {
  constructor(
    public code: string,
    public requestId?: string,
  ) {
    super(code);
  }
}
export function createApi(base = "", token?: () => Promise<string | null>) {
  async function request<T>(path: string, body?: unknown): Promise<T> {
    const access = await token?.();
    const response = await fetch(base + "/api/v1/" + path, {
      method: body ? "POST" : "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(access ? { Authorization: "Bearer " + access } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok)
      throw new ApiError(
        result.error?.code || "REQUEST_FAILED",
        result.error?.requestId,
      );
    return result.data as T;
  }
  return {
    request,
    catalog: (query = "") =>
      request<{ items: Offer[]; nextCursor: string | null }>("catalog" + query),
    me: () => request<{ actor: Actor | null; demo: boolean }>("me"),
    customer: (query = "") => request<CustomerState>("customer" + query),
    seller: (id: string, date: string) =>
      request<SellerState>("seller/" + id + "?date=" + date),
    sellerOperations: (id: string, date?: string) =>
      request<SellerOperationsState>(
        "seller/" + id + (date ? "?date=" + date : ""),
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
