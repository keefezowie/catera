export type CommandAttempt<T> = {
  data: T;
  fingerprint: string;
  requestId: string;
  unknown: boolean;
};

export function commandOutcomeUnknown(code: string, previouslyUnknown = false) {
  return (
    code === "SAVE_FAILED" ||
    (previouslyUnknown &&
      ["UNAUTHORIZED", "FORBIDDEN", "IDEMPOTENCY_CONFLICT"].includes(code))
  );
}

/** An unresolved write can only replay its original input and receipt key. */
export function prepareCommandAttempt<T>(
  previous: CommandAttempt<T> | null,
  data: T,
  createId = () => crypto.randomUUID(),
): { blocked: boolean; attempt: CommandAttempt<T> } {
  const fingerprint = JSON.stringify(data);
  if (previous?.unknown && previous.fingerprint !== fingerprint)
    return { blocked: true, attempt: previous };
  if (previous?.fingerprint === fingerprint)
    return { blocked: false, attempt: previous };
  return {
    blocked: false,
    attempt: { data, fingerprint, requestId: createId(), unknown: false },
  };
}
