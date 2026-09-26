export type ResourcePhase =
  | "initial_loading"
  | "empty"
  | "filtered_empty"
  | "ready"
  | "refreshing"
  | "stale_error"
  | "action_pending"
  | "recoverable_error"
  | "conflict"
  | "terminal";

export function resourcePhase({
  hasData,
  loading = false,
  error = false,
  empty = false,
  filtered = false,
  actionPending = false,
  conflict = false,
  terminal = false,
}: {
  hasData: boolean;
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  filtered?: boolean;
  actionPending?: boolean;
  conflict?: boolean;
  terminal?: boolean;
}): ResourcePhase {
  if (terminal) return "terminal";
  if (actionPending) return "action_pending";
  if (conflict) return "conflict";
  if (loading) return hasData ? "refreshing" : "initial_loading";
  if (error) return hasData ? "stale_error" : "recoverable_error";
  if (empty) return filtered ? "filtered_empty" : "empty";
  return "ready";
}
