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
  const api = { request: vi.fn() };
  const auth = { updateUser: vi.fn(), verifyOtp: vi.fn(), signInWithPassword: vi.fn() };
  const supabase = { auth } as any;
  await expect(sendPhoneChangeCode(api, true, "+62 812-3456-7890")).resolves.toEqual({ simulated: true });
  await expect(verifyPhoneChangeCode(api, true, "+6281234567890", "123456")).resolves.toEqual({ simulated: true });
  await expect(requestEmailChange(supabase, true, "baru@example.test")).resolves.toEqual({ simulated: true });
  await expect(changePassword(supabase, true, { email: "a@example.test", current: "lama-lama", next: "baru-baru-1" })).resolves.toEqual({ simulated: true });
  expect(api.request).not.toHaveBeenCalled();
  expect(auth.updateUser).not.toHaveBeenCalled();
  expect(auth.verifyOtp).not.toHaveBeenCalled();
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});

it("outside the demo the callers use the web routes and Supabase, and check input first", async () => {
  const api = { request: vi.fn().mockResolvedValue({ sent: true }) };
  await expect(sendPhoneChangeCode(api, false, "081234567890")).resolves.toEqual({ simulated: false });
  expect(api.request).toHaveBeenLastCalledWith("auth/phone-send", { phone: "081234567890" });
  await verifyPhoneChangeCode(api, false, "081234567890", "123456");
  expect(api.request).toHaveBeenLastCalledWith("auth/phone-verify", { phone: "081234567890", token: "123456" });
  await expect(verifyPhoneChangeCode(api, false, "081234567890", "12")).rejects.toThrow("INVALID_INPUT");
  await expect(sendPhoneChangeCode(api, false, "abc")).rejects.toThrow("INVALID_INPUT");

  const auth = {
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
  };
  const supabase = { auth } as any;
  await requestEmailChange(supabase, false, " baru@example.test ");
  expect(auth.updateUser).toHaveBeenLastCalledWith({ email: "baru@example.test" });
  await changePassword(supabase, false, { email: "a@example.test", current: "lama-lama", next: "baru-baru-1" });
  expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@example.test", password: "lama-lama" });
  expect(auth.updateUser).toHaveBeenLastCalledWith({ password: "baru-baru-1" });
  auth.updateUser.mockClear();
  auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { status: 400 } });
  await expect(changePassword(supabase, false, { email: "a@example.test", current: "salah-salah", next: "baru-baru-1" })).rejects.toThrow("INVALID_CREDENTIALS");
  expect(auth.updateUser).not.toHaveBeenCalled();
  await expect(changePassword(supabase, false, { email: "a@example.test", current: "x", next: "pendek" })).rejects.toThrow("INVALID_INPUT");
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
