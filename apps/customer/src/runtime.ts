import { createMobileRuntime } from "@catera/mobile-core";

/** One runtime for the Catera customer app; the "catera" prefix keeps the existing
 * catera.demo.token and catera.locale keys, so sessions survive the update. */
export const runtime = createMobileRuntime({
  apiUrl: process.env.EXPO_PUBLIC_API_URL || "",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  storagePrefix: "catera",
  app: "customer",
});
