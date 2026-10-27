import { redirectFor } from "@catera/mobile-core";

export {
  authClient,
  authError,
  clearPending,
  isOffline,
  pendingKey,
  RATE_WAIT_S,
  readPending,
  redirectFor,
  savePending,
  validEmail,
  type Pending,
} from "@catera/mobile-core";

/**
 * Where the customer app's email links land. A function, not a constant, so a test that mocks @catera/mobile-core
 * without `redirectFor` can still import this module.
 */
export const redirectTo = () => redirectFor("catera");
