import type {
  Offer,
  CustomerState,
  SellerState,
  AdminState,
  Actor,
  Quote,
  Checkout,
  Conversation,
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
    admin: () => request<AdminState>("admin"),
    conversations: () => request<Conversation[]>("conversations"),
    quote: (payload: unknown) => request<Quote>("quote", payload),
    checkout: (id: string) => request<Checkout>("checkouts/" + id),
    command: <T = Record<string, unknown>>(
      action: string,
      payload: unknown,
      requestId: string = globalThis.crypto.randomUUID(),
    ) => request<T>("commands", { action, payload, requestId }),
  };
}
