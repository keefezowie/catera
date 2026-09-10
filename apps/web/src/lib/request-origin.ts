/** Browsers send the public Host even when Next's internal Request URL uses localhost. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return; // Native clients use bearer authentication, without browser cookies.
  const configured = process.env.CATERA_PUBLIC_URL;
  const expected = configured
    ? new URL(configured).origin
    : `${new URL(request.url).protocol}//${request.headers.get("host") || new URL(request.url).host}`;
  if (origin !== expected) throw new Error("FORBIDDEN");
}
