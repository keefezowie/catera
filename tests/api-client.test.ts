import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createApi } from "../packages/api-client/src/index";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("bounds session restoration and never submits a write after it times out", async () => {
  let restore!: (token: string) => void;
  const session = new Promise<string>((resolve) => {
    restore = resolve;
  });
  const api = createApi("https://catera.example", () => session, {
    timeoutMs: 100,
  });
  const result = api.command("checkout.create", {}, "same-attempt");
  const rejection = expect(result).rejects.toMatchObject({
    code: "REQUEST_TIMEOUT",
  });
  await vi.advanceTimersByTimeAsync(100);
  await rejection;
  restore("restored-session");
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("aborts a stalled request without retrying a command, and permits explicit recovery", async () => {
  fetchMock.mockImplementationOnce(() => new Promise(() => {}));
  const api = createApi("https://catera.example", undefined, {
    timeoutMs: 100,
  });
  const result = api.command("checkout.create", {}, "same-attempt");
  const rejection = expect(result).rejects.toMatchObject({
    code: "REQUEST_TIMEOUT",
  });
  await vi.advanceTimersByTimeAsync(100);
  await rejection;
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  fetchMock.mockResolvedValueOnce(
    Response.json({ data: { id: "existing-checkout" } }),
  );
  await expect(
    api.command("checkout.create", {}, "same-attempt"),
  ).resolves.toEqual({ id: "existing-checkout" });
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).requestId).toBe(
    "same-attempt",
  );
  expect(vi.getTimerCount()).toBe(0);
});

it("includes response body parsing in the deadline", async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: () => new Promise(() => {}),
  } as Response);
  const api = createApi("https://catera.example", undefined, {
    timeoutMs: 100,
  });
  const rejection = expect(api.me()).rejects.toMatchObject({
    code: "REQUEST_TIMEOUT",
  });
  await vi.advanceTimersByTimeAsync(100);
  await rejection;
});

it.each([
  () => new Response("<html>Temporary tunnel offline</html>", { status: 502 }),
  () => Response.json({ message: "another application" }),
  () => Response.json(null),
])(
  "rejects a tunnel page or an incompatible API response",
  async (response) => {
    fetchMock.mockResolvedValueOnce(response());
    await expect(
      createApi("https://catera.example").me(),
    ).rejects.toMatchObject({ code: "INVALID_API_RESPONSE" });
    expect(vi.getTimerCount()).toBe(0);
  },
);

it("preserves server error codes and request references", async () => {
  fetchMock.mockResolvedValueOnce(
    Response.json(
      { error: { code: "CAPACITY", requestId: "request-123" } },
      { status: 409 },
    ),
  );
  await expect(
    createApi("https://catera.example").quote({}),
  ).rejects.toMatchObject({ code: "CAPACITY", requestId: "request-123" });
  expect(vi.getTimerCount()).toBe(0);
});

it("reads a claim preview by its escaped token without a session", async () => {
  const preview = {
    catererName: "Dapur Senja",
    packageName: "Rantang Nusantara",
    remainingDays: 3,
    nextDate: "2026-10-12",
    nextWindow: "11.00-13.00",
    addressLabel: "Rumah",
    maskedPhone: "0812-•••-0001",
  };
  fetchMock.mockResolvedValueOnce(Response.json({ data: preview }));
  await expect(createApi("https://catera.example").claimPreview("a/b c")).resolves.toEqual(preview);
  expect(String(fetchMock.mock.calls[0][0])).toBe("https://catera.example/api/v1/claim-preview/a%2Fb%20c");
});

it("sends cookies for the web session by default, and none for a client that asks to omit them", async () => {
  const ok = () => new Response(JSON.stringify({ data: { actor: null, demo: false } }));
  fetchMock.mockImplementation(async () => ok());
  await createApi("https://catera.example").me();
  await createApi("https://catera.example", async () => "t", { credentials: "omit" }).me();
  expect(fetchMock.mock.calls[0][1]?.credentials).toBe("include");
  expect(fetchMock.mock.calls[1][1]?.credentials).toBe("omit");
  expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBe("Bearer t");
});

it("escapes every id and date in the path, so a deep link cannot leave its route", async () => {
  fetchMock.mockImplementation(async () => Response.json({ data: {} }));
  const api = createApi("https://catera.example");
  const id = "../me";
  const e = "..%2Fme";
  const calls: [() => Promise<unknown>, string][] = [
    [() => api.deliveryAvailability(id, "a", "b"), `availability/${e}?from=a&to=b`],
    [() => api.seller(id, "d/1"), `seller/${e}?date=d%2F1`],
    [() => api.sellerOperations(id, "d/1"), `seller/${e}?date=d%2F1`],
    [() => api.sellerOperations(id), `seller/${e}`],
    [() => api.sellerAttention(id), `seller-attention/${e}?scope=all&limit=20`],
    [() => api.sellerCalendar(id, {}), `seller-calendar/${e}?`],
    [() => api.sellerImportOptions(id), `seller-import-options/${e}`],
    [() => api.renewalContext(id), `renewal-context/${e}?cycles=1`],
    [() => api.sellerCustomers(id, "?offset=2"), `seller-customers/${e}?offset=2`],
    [() => api.pilot(id, "a", "b"), `pilot/${e}?from=a&to=b`],
    [() => api.settlement(id), `seller-settlement/${e}`],
    [() => api.settlementReport(id, 7), `seller-settlement-report/${e}?days=7`],
    [() => api.settlementHistory(id, "orders" as never), `seller-settlement-history/${e}?kind=orders`],
    [() => api.settlementPayout(id, "p"), `seller-settlement-payout/${e}?payoutId=p`],
    [() => api.checkout(id), `checkouts/${e}`],
  ];
  for (const [call, path] of calls) {
    await call();
    expect(String(fetchMock.mock.lastCall?.[0])).toBe("https://catera.example/api/v1/" + path);
  }
});

it("reports the HTTP status of a server error and of a non-JSON gateway page", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "CAPACITY" } }, { status: 409 }));
  await expect(createApi("https://catera.example").me()).rejects.toMatchObject({ code: "CAPACITY", status: 409 });
  fetchMock.mockResolvedValueOnce(new Response("<html>Bad gateway</html>", { status: 502 }));
  await expect(createApi("https://catera.example").me()).rejects.toMatchObject({ code: "INVALID_API_RESPONSE", status: 502 });
});

it("lets a network failure through as the TypeError that OFFLINE detection reads", async () => {
  fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
  await expect(createApi("https://catera.example").me()).rejects.toBeInstanceOf(TypeError);
});

it("fails an empty API URL as NOT_CONFIGURED, and keeps a left-out one on the same origin", async () => {
  await expect(createApi("").me()).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  fetchMock.mockResolvedValueOnce(Response.json({ data: { actor: null, demo: false } }));
  await createApi().me();
  expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/me");
});
