import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/auth", () => ({
  session: async () => ({ id: null, token: null, actor: null }),
}));
vi.mock("@catera/backend", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  demoEnabled: () => false,
  rpc: state.rpc,
}));
import { GET } from "../apps/web/src/app/api/v1/[...path]/route";

const db = (message: string, code?: string, details?: string) =>
  Object.assign(new Error(message), { code, details });
const answer = async (error: Error) => {
  state.rpc.mockRejectedValueOnce(error);
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const response = await GET(new Request("https://catera.test/api/v1/catalog"), {
    params: Promise.resolve({ path: ["catalog"] }),
  } as never);
  return { status: response.status, code: (await response.json()).error.code, log: JSON.stringify(log.mock.calls) };
};
afterEach(() => vi.restoreAllMocks());

it("keeps refusals raised in SQL exactly as they were", async () => {
  expect(await answer(db("CAPACITY", "P0001"))).toMatchObject({ status: 400, code: "CAPACITY" });
  // Not in the route's list, as many raised codes are: still the caller's, and now named in the log.
  const refused = await answer(db("MENU_IN_USE", "P0001"));
  expect(refused).toMatchObject({ status: 400, code: "REQUEST_FAILED" });
  expect(refused.log).toContain("MENU_IN_USE");
  expect(await answer(db("NOT_FOUND"))).toMatchObject({ status: 404, code: "NOT_FOUND" });
});

it("answers a malformed value from the client with 400", async () => {
  expect((await answer(db('invalid input syntax for type uuid: "x"', "22P02"))).status).toBe(400);
});

it("answers a value a constraint refused with 400 and logs the cause without row values", async () => {
  const refused = await answer(
    db('duplicate key value violates unique constraint "users_phone_key"', "23505", "Key (phone)=(+6281234567801) already exists."),
  );
  expect(refused).toMatchObject({ status: 400, code: "REQUEST_FAILED" });
  expect(refused.log).toContain("23505");
  expect(refused.log).toContain("users_phone_key");
  expect(refused.log).not.toContain("6281234567801");
});

it("does not count a refused payment choice as a server fault", async () => {
  for (const reason of ["DIRECT_PAYMENT_REQUIRED", "DOKU_CHANNEL_NOT_SUPPORTED", "PAYOUT_CHANNEL_LIMIT"])
    expect(await answer(new Error(reason))).toMatchObject({ status: 400, code: "REQUEST_FAILED" });
});

it("answers anything unexpected with 500", async () => {
  expect(await answer(db("connection terminated", "57P01"))).toMatchObject({ status: 500, code: "REQUEST_FAILED" });
  expect((await answer(new TypeError("fetch failed"))).status).toBe(500);
});
