import type { Actor, Workspace, WorkspaceMode } from "@catera/domain";

export const workspaceCookieName = "catera_workspace";

export function defaultWorkspaceForRole(role: Actor["role"]): Workspace {
  if (role === "platform_admin") return "admin";
  if (role === "owner" || role === "staff") return "caterer";
  return "customer";
}

export function defaultWorkspace(actor: Actor | null): Workspace {
  return actor ? defaultWorkspaceForRole(actor.role) : "customer";
}

export function canSwitchWorkspace(actor: Actor | null): boolean {
  return actor?.role === "owner" || actor?.role === "staff";
}

/**
 * Workspace is a presentation and routing preference only. The actor is
 * always resolved independently from the database for authorization.
 */
export function resolveWorkspace(
  actor: Actor | null,
  value: unknown,
): Workspace {
  const fallback = defaultWorkspace(actor);
  if (!actor) return "customer";
  if (actor.role === "platform_admin") return "admin";
  if (canSwitchWorkspace(actor))
    return isWorkspaceMode(value) ? value : fallback;
  return fallback;
}

export function isWorkspaceMode(value: unknown): value is WorkspaceMode {
  return value === "customer" || value === "caterer";
}
