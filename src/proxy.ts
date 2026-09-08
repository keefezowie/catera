import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (process.env.CATERA_DEMO_MODE === "true" && !process.env.VERCEL)
    return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach((v) => request.cookies.set(v.name, v.value));
        response = NextResponse.next({ request });
        values.forEach((v) => response.cookies.set(v.name, v.value, v.options));
      },
    },
  });
  await client.auth.getUser();
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand).*)"],
};
