import { createMobileRuntime } from "@catera/mobile-core";

/** One runtime for Catera Dapur; its SecureStore keys never collide with the customer app's. */
export const runtime = createMobileRuntime({
  apiUrl: process.env.EXPO_PUBLIC_API_URL || "",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  storagePrefix: "dapur",
});
