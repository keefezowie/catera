import { describe, it, expect, vi } from "vitest";
import { safeReturnPath, signedInPath } from "../apps/web/src/lib/navigation";
import {
  canSwitchWorkspace,
  defaultWorkspace,
  resolveWorkspace,
} from "../apps/web/src/lib/workspace";
import { passwordSignIn } from "../apps/web/src/lib/password-auth";
import type { Actor } from "@catera/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("sign-in destinations", () => {
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/\tevil.example", "/login?next=/home"])("rejects unsafe or looping destination %s", value => {
    expect(safeReturnPath(value)).toBeNull();
  });
  it("keeps a checkout return and routes roles to their workspaces", () => {
    expect(safeReturnPath("/checkout/abc?trial=1#review")).toBe("/checkout/abc?trial=1#review");
    for (const [role, route] of [["customer","/home"],["owner","/seller"],["staff","/seller"],["platform_admin","/admin"]] as const)
      expect(signedInPath({role} as Actor)).toBe(route);
  });
});

describe("password sign-in", () => {
  it("does not initialize an account after rejected credentials", async () => {
    const client = {auth:{signInWithPassword:vi.fn().mockResolvedValue({data:{user:null,session:null},error:{status:400}})}} as unknown as SupabaseClient;
    const ensure=vi.fn();
    await expect(passwordSignIn(client,{email:"demo@catera.example",password:"incorrect"},ensure)).rejects.toThrow("INVALID_CREDENTIALS");
    expect(ensure).not.toHaveBeenCalled();
  });
  it("takes authority from the DB profile, never editable auth metadata", async () => {
    const client = {auth:{signInWithPassword:vi.fn().mockResolvedValue({data:{user:{id:"user",user_metadata:{name:"Demo",role:"platform_admin"}},session:{access_token:"test-token"}},error:null})}} as unknown as SupabaseClient;
    const ensure=vi.fn().mockResolvedValue({id:"user",name:"Demo",role:"customer"});
    const result=await passwordSignIn(client,{email:"demo@catera.example",password:"test"},ensure);
    expect(ensure).toHaveBeenCalledWith("user","test-token","Demo");
    expect(result).toEqual({actor:{id:"user",name:"Demo",role:"customer"}});
    expect(result).not.toHaveProperty("session");
  });
});

describe("session workspace", () => {
  const owner = {
    id: "owner",
    name: "Owner",
    role: "owner",
    catererId: "caterer",
  } satisfies Actor;
  const customer = {
    id: "customer",
    name: "Customer",
    role: "customer",
  } satisfies Actor;
  const admin = {
    id: "admin",
    name: "Admin",
    role: "platform_admin",
  } satisfies Actor;

  it("defaults seller-capable actors to caterer and allows a customer workspace", () => {
    expect(defaultWorkspace(owner)).toBe("caterer");
    expect(defaultWorkspace({ ...owner, role: "staff" })).toBe("caterer");
    expect(canSwitchWorkspace(owner)).toBe(true);
    expect(resolveWorkspace(owner, "customer")).toBe("customer");
    expect(resolveWorkspace(owner, "caterer")).toBe("caterer");
  });

  it("does not let stale or forged workspace values change authority", () => {
    expect(resolveWorkspace(owner, "unknown")).toBe("caterer");
    expect(resolveWorkspace(owner, "admin")).toBe("caterer");
    expect(resolveWorkspace(customer, "caterer")).toBe("customer");
    expect(canSwitchWorkspace(customer)).toBe(false);
    expect(defaultWorkspace(admin)).toBe("admin");
    expect(resolveWorkspace(admin, "customer")).toBe("admin");
    expect(resolveWorkspace(null, "caterer")).toBe("customer");
  });
});
