import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { CATERER_IDS as K, DEMO_ACTORS as U } from "../packages/backend/src/seed";
import {
  changePassword,
  listAccountRequests,
  requestAccountDeletion,
  requestEmailChange,
  requestHelp,
  sendPhoneChangeCode,
  updateProfileName,
  verifyPhoneChangeCode,
} from "../packages/mobile-core/src/account";

let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const cmd = (action: string, payload: unknown, user: string | null = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const nameOf = async (id: string) =>
  (await db.query<{ name: string }>("select name from v1.profiles where id=$1", [id])).rows[0].name;

beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => {
  await db.close();
});

it("profile.update changes only the caller's row", async () => {
  const ownerBefore = await nameOf(U.owner);
  await expect(cmd("profile.update", { name: "  Sari Dewi  " })).resolves.toEqual({ name: "Sari Dewi" });
  expect(await nameOf(U.customer)).toBe("Sari Dewi");
  expect(await nameOf(U.owner)).toBe(ownerBefore);
  await expect(cmd("profile.update", { name: "Sari Dewi" })).resolves.toEqual({ name: "Sari Dewi" });
  await expect(cmd("profile.update", { name: "Nama Lain", id: U.owner })).rejects.toThrow("INVALID_INPUT");
  expect(await nameOf(U.owner)).toBe(ownerBefore);
});

it("profile.update rejects an empty name and a name over 80", async () => {
  const before = await nameOf(U.customer);
  for (const name of ["", "   ", " a ", "n".repeat(81), 7, null])
    await expect(cmd("profile.update", { name }), String(name)).rejects.toThrow("INVALID_INPUT");
  await expect(cmd("profile.update", {})).rejects.toThrow("INVALID_INPUT");
  await expect(cmd("profile.update", { name: "n".repeat(80) })).resolves.toEqual({ name: "n".repeat(80) });
  expect(await nameOf(U.customer)).not.toBe(before);
});

it("profile.update is UNAUTHORIZED when signed out", async () => {
  await expect(cmd("profile.update", { name: "Tanpa Masuk" }, null)).rejects.toThrow("UNAUTHORIZED");
});

it("the deletion request is created once per open request", async () => {
  const first = await cmd("accountRequest.create", { kind: "deletion", body: "Tolong hapus akun saya." });
  expect(first.status).toBe("open");
  expect(first.existing).toBeUndefined();
  const second = await cmd("accountRequest.create", { kind: "deletion", body: "Hapus akun saya, ya." });
  expect(second).toEqual({ id: first.id, status: "open", existing: true });
  const count = async () =>
    (await db.query<{ n: number }>("select count(*)::int n from v1.account_requests where user_id=$1 and kind='deletion'", [U.customer])).rows[0].n;
  expect(await count()).toBe(1);
  const help = await cmd("accountRequest.create", { kind: "help", body: "Ubah nomor WhatsApp dapur." });
  expect(help.status).toBe("open");
  expect(help.id).not.toBe(first.id);
  await db.query("update v1.account_requests set status='resolved',resolution='selesai' where id=$1", [first.id]);
  const third = await cmd("accountRequest.create", { kind: "deletion", body: "Hapus akun saya lagi." });
  expect(third.id).not.toBe(first.id);
  expect(await count()).toBe(2);
  await expect(cmd("accountRequest.create", { kind: "deletion", body: "Masuk dulu" }, null)).rejects.toThrow("UNAUTHORIZED");
  await expect(cmd("accountRequest.create", { kind: "deletion", body: "x" })).rejects.toThrow("INVALID_INPUT");
});

it("the demo simulates phone and email change without calling Supabase", async () => {
  const auth = { updateUser: vi.fn(), verifyOtp: vi.fn(), signInWithPassword: vi.fn(), getUser: vi.fn() };
  const supabase = { auth } as any;
  await expect(sendPhoneChangeCode(supabase, true, "0812-3456-7890")).resolves.toEqual({ simulated: true });
  await expect(verifyPhoneChangeCode(supabase, true, "+6281234567890", "123456")).resolves.toEqual({ simulated: true });
  await expect(requestEmailChange(supabase, true, "baru@example.test")).resolves.toEqual({ simulated: true });
  await expect(changePassword(supabase, true, { current: "lama-lama", next: "baru-baru-1" })).resolves.toEqual({ simulated: true });
  await expect(sendPhoneChangeCode(supabase, true, "+1 555 0100")).rejects.toThrow("INVALID_PHONE");
  for (const fn of Object.values(auth)) expect(fn).not.toHaveBeenCalled();
});

it("outside the demo the phone change runs on the mobile Supabase session, not the cookie-only web routes", async () => {
  const auth = {
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };
  const supabase = { auth } as any;
  await expect(sendPhoneChangeCode(supabase, false, "0812-3456-7890")).resolves.toEqual({ simulated: false });
  expect(auth.updateUser).toHaveBeenLastCalledWith({ phone: "+6281234567890" });
  await verifyPhoneChangeCode(supabase, false, "6281234567890", "123456");
  expect(auth.verifyOtp).toHaveBeenLastCalledWith({ phone: "+6281234567890", token: "123456", type: "phone_change" });
  await expect(verifyPhoneChangeCode(supabase, false, "081234567890", "12")).rejects.toThrow("INVALID_INPUT");
  await expect(sendPhoneChangeCode(supabase, false, "abc")).rejects.toThrow("INVALID_PHONE");
  await expect(sendPhoneChangeCode(null, false, "081234567890")).rejects.toThrow("NOT_CONFIGURED");
  expect(auth.updateUser).toHaveBeenCalledTimes(1);
});

it("Supabase failures become typed codes the screens can name", async () => {
  const fail = (error: object) => vi.fn().mockResolvedValue({ data: {}, error });
  const client = (updateUser: any, verifyOtp?: any) => ({ auth: { updateUser, verifyOtp } }) as any;
  const phone = "081234567890";
  await expect(sendPhoneChangeCode(client(fail({ status: 422, code: "phone_exists" })), false, phone)).rejects.toThrow("PHONE_IN_USE");
  await expect(sendPhoneChangeCode(client(fail({ status: 429, code: "over_sms_send_rate_limit" })), false, phone)).rejects.toThrow("AUTH_RATE_LIMITED");
  await expect(sendPhoneChangeCode(client(fail({ status: 500, code: "sms_send_failed" })), false, phone)).rejects.toThrow("PHONE_CHANGE_FAILED");
  await expect(verifyPhoneChangeCode(client(vi.fn(), fail({ status: 403, code: "otp_expired" })), false, phone, "123456")).rejects.toThrow("CODE_INVALID");
  await expect(verifyPhoneChangeCode(client(vi.fn(), fail({ status: 400 })), false, phone, "123456")).rejects.toThrow("CODE_INVALID");
  await expect(verifyPhoneChangeCode(client(vi.fn(), fail({ status: 422, code: "phone_exists" })), false, phone, "123456")).rejects.toThrow("PHONE_IN_USE");
  await expect(requestEmailChange(client(fail({ status: 422, code: "email_exists" })), false, "a@example.test")).rejects.toThrow("EMAIL_IN_USE");
  await expect(requestEmailChange(client(fail({ status: 400, code: "email_address_invalid" })), false, "a@example.test")).rejects.toThrow("INVALID_INPUT");
  await expect(requestEmailChange(client(fail({ status: 500 })), false, "a@example.test")).rejects.toThrow("EMAIL_CHANGE_FAILED");
});

it("changePassword re-checks the signed-in account's own email and never switches accounts", async () => {
  const me = { id: "user-1", email: "a@example.test" };
  const input = { current: "lama-lama", next: "baru-baru-1" };
  const make = (signedInAs: object | null, user: object | null = me) => ({
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { status: 401 } }),
    signInWithPassword: vi.fn().mockResolvedValue(
      signedInAs
        ? { data: { session: {}, user: signedInAs }, error: null }
        : { data: { session: null, user: null }, error: { status: 400, code: "invalid_credentials" } },
    ),
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
  });
  let auth = make(me);
  await expect(changePassword({ auth } as any, false, input)).resolves.toEqual({ simulated: false });
  expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@example.test", password: "lama-lama" });
  expect(auth.updateUser).toHaveBeenLastCalledWith({ password: "baru-baru-1" });

  auth = make({ id: "user-2", email: "a@example.test" });
  await expect(changePassword({ auth } as any, false, input)).rejects.toThrow("ACCOUNT_MISMATCH");
  expect(auth.updateUser).not.toHaveBeenCalled();

  auth = make(null);
  await expect(changePassword({ auth } as any, false, { ...input, current: "salah-salah" })).rejects.toThrow("INVALID_CREDENTIALS");
  expect(auth.updateUser).not.toHaveBeenCalled();

  auth = make(me, null);
  await expect(changePassword({ auth } as any, false, input)).rejects.toThrow("UNAUTHORIZED");
  auth = make(me, { id: "user-1", email: "" });
  await expect(changePassword({ auth } as any, false, input)).rejects.toThrow("NO_EMAIL");
  expect(auth.signInWithPassword).not.toHaveBeenCalled();

  auth = make(me);
  auth.updateUser.mockResolvedValue({ data: {}, error: { status: 422, code: "same_password" } });
  await expect(changePassword({ auth } as any, false, { current: "lama-lama", next: "lama-lama" })).rejects.toThrow("PASSWORD_REJECTED");
  await expect(changePassword({ auth } as any, false, { current: "x", next: "pendek" })).rejects.toThrow("INVALID_INPUT");
});

it("a retried deletion request returns its stored receipt, and help for another caterer is FORBIDDEN", async () => {
  const requestId = crypto.randomUUID();
  const payload = { kind: "deletion", body: "Tolong hapus akun staf saya." };
  const ask = () => localRpc<any>(db, U.staff, "catera_v1_command", ["accountRequest.create", payload, requestId]);
  const first = await ask();
  expect(first.existing).toBeUndefined();
  await expect(ask()).resolves.toEqual({ id: first.id, status: "open" });
  await expect(
    cmd("accountRequest.create", { kind: "help", body: "Ubah nama dapur Hijau Kitchen.", catererId: K[1] }, U.owner),
  ).rejects.toThrow("FORBIDDEN");
});

it("names are trimmed and counted the same way by the database and the mobile check", async () => {
  const rice = "\u{1F35A}";
  const [nbsp, wide] = [String.fromCharCode(0xa0), String.fromCharCode(0x3000)];
  await expect(cmd("profile.update", { name: nbsp + "\tSari" + wide })).resolves.toEqual({ name: "Sari" });
  await expect(cmd("profile.update", { name: nbsp + "a" + nbsp })).rejects.toThrow("INVALID_INPUT");
  await expect(updateProfileName((async () => ({ name: "x" })) as any, nbsp + "a" + wide)).rejects.toThrow("INVALID_INPUT");
  await expect(cmd("profile.update", { name: rice.repeat(80) })).resolves.toEqual({ name: rice.repeat(80) });
  await expect(cmd("profile.update", { name: rice.repeat(81) })).rejects.toThrow("INVALID_INPUT");
  const run = <T,>(action: string, payload: unknown) => cmd(action, payload) as Promise<T>;
  await expect(updateProfileName(run, rice.repeat(80))).resolves.toEqual({ name: rice.repeat(80) });
  await expect(updateProfileName(run, rice.repeat(81))).rejects.toThrow("INVALID_INPUT");
});

it("the typed account callers send the commands the database accepts", async () => {
  const run = <T,>(action: string, payload: unknown) => cmd(action, payload, U.owner) as Promise<T>;
  await expect(updateProfileName(run, "  Bu Wulan ")).resolves.toEqual({ name: "Bu Wulan" });
  await expect(updateProfileName(run, " a ")).rejects.toThrow("INVALID_INPUT");
  const asked = await requestAccountDeletion(run, "Tolong hapus akun dapur saya.");
  expect(asked.status).toBe("open");
  expect((await requestAccountDeletion(run, "Hapus akun dapur saya lagi.")).existing).toBe(true);
  const help = await requestHelp(run, "Ubah nama dapur menjadi Dapur Bu Wulan.", K[0]);
  expect(help.status).toBe("open");
  await expect(requestHelp(run, "abc")).rejects.toThrow("INVALID_INPUT");
  const rows = await listAccountRequests({
    request: async () => (await db.query("select * from v1.account_requests where user_id=$1 order by created_at desc", [U.owner])).rows as any,
  });
  expect(rows.some((r) => r.id === asked.id && r.status === "open")).toBe(true);
});
