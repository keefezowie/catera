import { getSnapshot } from "@/lib/data";
import { userId } from "@/lib/auth";
import { csvText, escapeHtml as esc } from "@/lib/exports";
import { getTranslations, getLocale } from "next-intl/server";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await userId())) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url),
    slug = url.searchParams.get("business");
  if (!slug) return new Response("Missing business", { status: 400 });
  try {
    const s = await getSnapshot(slug),
      { id } = await params;
    if (s.role === "subscriber")
      return new Response("Forbidden", { status: 403 });
    const version = s.production.find((v) => v.id === id);
    if (!version) return new Response("Not found", { status: 404 });
    const t = await getTranslations(),
      locale = await getLocale(),
      slot = s.slots.find((x) => x.id === version.slot_id);
    const columns = [t("customer"), t("meal"), t("address"), t("instructions")];
    const rows = version.entries.map((e) => [
      e.customer,
      e.menu || t("menuMissing"),
      e.address.line + ", " + e.address.city,
      e.address.instructions || "",
    ]);
    const title =
      s.business.name +
      " · " +
      version.service_date +
      " · " +
      slot?.name +
      " · " +
      t("revision") +
      " " +
      version.revision;
    const headers = {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (url.searchParams.get("format") === "csv")
      return new Response(
        csvText([[title], [version.created_at], columns, ...rows]),
        {
          headers: {
            ...headers,
            "Content-Type": "text/csv;charset=utf-8",
            "Content-Disposition":
              'attachment; filename="catera-' +
              version.service_date +
              "-v" +
              version.revision +
              '.csv"',
          },
        },
      );
    const html =
      '<!doctype html><html lang="' +
      locale +
      '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      esc(title) +
      "</title><style>body{font:14px Arial,sans-serif;color:#163d2e;padding:30px;line-height:1.5}h1{font-size:22px}table{border-collapse:collapse;width:100%;color:#222}th,td{border-bottom:1px solid #ccc;text-align:left;padding:12px;vertical-align:top}th{background:#f1f4ec}button{padding:10px 20px;margin:20px 0;background:#163d2e;color:white;border:0;border-radius:5px;cursor:pointer}@media print{button{display:none}body{padding:0}tr{break-inside:avoid}}</style></head><body><h1>" +
      esc(title) +
      "</h1><p>" +
      esc(version.created_at) +
      '</p><button onclick="window.print()">' +
      esc(t("print")) +
      "</button><table><thead><tr>" +
      columns.map((c) => "<th>" + esc(c) + "</th>").join("") +
      "</tr></thead><tbody>" +
      rows
        .map(
          (r) =>
            "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>",
        )
        .join("") +
      "</tbody></table></body></html>";
    return new Response(html, {
      headers: {
        ...headers,
        "Content-Type": "text/html;charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  } catch {
    return new Response("Access unavailable", { status: 403 });
  }
}
