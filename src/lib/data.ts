import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { demoEnabled, demoRpc } from "./demo-db";
import { supabase, userId } from "./auth";
import type { Snapshot, Workspace } from "./types";
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const uid = await userId();
  if (!uid) throw new Error("UNAUTHORIZED");
  if (demoEnabled()) return demoRpc<T>(uid, name, Object.values(args));
  const { data, error } = await (await supabase()).rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export const getWorkspaces = cache(async () => {
  if (!(await userId())) redirect("/login");
  return rpc<Workspace[]>("list_workspaces");
});
export const getSnapshot = cache(async (slug: string) => {
  if (!(await userId())) redirect("/login");
  return rpc<Snapshot>("workspace_snapshot", { business_slug: slug });
});
