import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refresh cookie sessions; database RPCs independently authorize every request. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    (process.env.CATERA_V1_DEMO === "true" && !process.env.VERCEL) ||
    !url ||
    !key ||
    url.includes("otmanljypltxkwjcebni") ||
    request.headers.has("authorization")
  )
    return response;
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values)
          response.cookies.set(name, value, options);
      },
    },
  });
  await client.auth.getClaims();
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|assets/|favicon.ico|manifest.webmanifest|api/jobs|api/webhooks).*)",
  ],
};
