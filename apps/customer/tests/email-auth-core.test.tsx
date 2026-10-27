import * as SecureStore from "expo-secure-store";
import { errorLabel } from "@catera/domain";
import { authError, createMobileRuntime, isOffline, readPending, savePending } from "@catera/mobile-core";

jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
const mockAuth = { signInWithPassword: jest.fn(), signInWithOtp: jest.fn(), verifyOtp: jest.fn(), signOut: jest.fn(async () => ({ error: null })) };
jest.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: mockAuth }) }));

const runtime = () =>
  createMobileRuntime({ apiUrl: "http://x.test", supabaseUrl: "http://s.test", supabaseKey: "k", storagePrefix: "catera", app: "customer" });
const caught = async (p: Promise<unknown>) => p.then(() => null, (e: Error) => e.message);
const thrown = (f: () => void) => { try { f(); } catch (e) { return (e as Error).message; } return null; };

describe("email-auth core", () => {
  it("maps rate limits and network failures to codes", () => {
    expect(thrown(() => authError({ status: 429 }))).toBe("AUTH_RATE_LIMITED");
    expect(thrown(() => authError({ name: "AuthRetryableFetchError", status: 0 }))).toBe("OFFLINE");
    expect(thrown(() => authError({ code: "email_not_confirmed" }))).toBe("EMAIL_NOT_CONFIRMED");
    expect(thrown(() => authError({ code: "weak_password" }))).toBe("PASSWORD_REJECTED");
    expect(thrown(() => authError({ status: 500 }))).toBe("AUTH_UNAVAILABLE");
    expect(thrown(() => authError({ name: "AuthRetryableFetchError", status: 503 }))).toBe("AUTH_UNAVAILABLE");
    expect(thrown(() => authError({ name: "AuthRetryableFetchError" }))).toBe("OFFLINE");
    expect(isOffline(new TypeError("Network request failed"))).toBe(true);
    expect(isOffline({ status: 400 })).toBe(false);
    expect(isOffline({ name: "AuthRetryableFetchError", status: 503 })).toBe(false);
    expect(isOffline({ name: "AuthRetryableFetchError", status: 0 })).toBe(true);
  });

  it("signInPassword, sendPhoneOtp and verifyPhoneOtp report OFFLINE on a network failure", async () => {
    const r = runtime();
    mockAuth.signInWithPassword.mockRejectedValueOnce(new TypeError("Network request failed"));
    expect(await caught(r.signInPassword("a@b.co", "secret123", "req"))).toBe("OFFLINE");
    mockAuth.signInWithOtp.mockRejectedValueOnce(new TypeError("Network request failed"));
    expect(await caught(r.sendPhoneOtp("+62811"))).toBe("OFFLINE");
    mockAuth.verifyOtp.mockResolvedValueOnce({ data: null, error: { name: "AuthRetryableFetchError", status: 0 } });
    expect(await caught(r.verifyPhoneOtp("+62811", "123456", "N", "req"))).toBe("OFFLINE");
  });

  it("verifyPhoneOtp calls only a refused code wrong: a 429 is the rate limit, a 5xx the server", async () => {
    const r = runtime();
    mockAuth.verifyOtp.mockResolvedValueOnce({ data: null, error: { name: "AuthApiError", status: 429 } });
    expect(await caught(r.verifyPhoneOtp("+62811", "123456", "N", "req"))).toBe("AUTH_RATE_LIMITED");
    mockAuth.verifyOtp.mockResolvedValueOnce({ data: null, error: { name: "AuthRetryableFetchError", status: 503 } });
    expect(await caught(r.verifyPhoneOtp("+62811", "123456", "N", "req"))).toBe("AUTH_UNAVAILABLE");
    mockAuth.verifyOtp.mockResolvedValueOnce({ data: null, error: { name: "AuthApiError", status: 500 } });
    expect(await caught(r.verifyPhoneOtp("+62811", "123456", "N", "req"))).toBe("AUTH_UNAVAILABLE");
    mockAuth.verifyOtp.mockRejectedValueOnce(new TypeError("Network request failed"));
    expect(await caught(r.verifyPhoneOtp("+62811", "123456", "N", "req"))).toBe("OFFLINE");
    mockAuth.verifyOtp.mockResolvedValueOnce({ data: null, error: { name: "AuthApiError", status: 403, code: "otp_expired" } });
    expect(await caught(r.verifyPhoneOtp("+62811", "123456", "N", "req"))).toBe("INVALID_OTP");
  });

  it("a 400 from the server is still INVALID_CREDENTIALS", async () => {
    mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { session: null, user: null }, error: { name: "AuthApiError", status: 400, code: "invalid_credentials" } });
    expect(await caught(runtime().signInPassword("a@b.co", "secret123", "req"))).toBe("INVALID_CREDENTIALS");
  });

  it("remembers the email with the pending link", async () => {
    const r = runtime();
    await savePending(r, "recovery", "/akun", "a@b.co");
    expect(await readPending(r)).toMatchObject({ purpose: "recovery", next: "/akun", email: "a@b.co" });
  });

  it("demo sign-out clears the server cookie once, and only when a demo token was held", async () => {
    const r = runtime();
    const request = jest.spyOn(r.api, "request").mockResolvedValue({} as never);
    await r.signOut();
    expect(request).not.toHaveBeenCalled();
    await SecureStore.setItemAsync(r.storageKey("demo.token"), "t");
    await r.signOut();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("auth/logout", expect.anything());
    expect(await SecureStore.getItemAsync(r.storageKey("demo.token"))).toBeNull();
  });

  it("sign-out clears the demo token even when the logout request rejects or hangs", async () => {
    const r = runtime();
    await SecureStore.setItemAsync(r.storageKey("demo.token"), "t");
    const request = jest.spyOn(r.api, "request").mockRejectedValue(new Error("down"));
    await r.signOut();
    expect(await SecureStore.getItemAsync(r.storageKey("demo.token"))).toBeNull();
    await SecureStore.setItemAsync(r.storageKey("demo.token"), "t");
    request.mockReturnValue(new Promise(() => undefined));
    await r.signOut();
    expect(await SecureStore.getItemAsync(r.storageKey("demo.token"))).toBeNull();
  });

  it("has the offline and unverified sentences", () => {
    expect(errorLabel("OFFLINE", "id")).toBe("Belum ada koneksi. Cek internetmu, lalu coba lagi.");
    expect(errorLabel("OFFLINE", "en")).toBe("No connection. Check your internet and try again.");
    expect(errorLabel("EMAIL_NOT_CONFIRMED", "id")).toBe("Emailmu belum diverifikasi.");
    expect(errorLabel("EMAIL_NOT_CONFIRMED", "en")).toBe("Your email isn't verified yet.");
  });
});
