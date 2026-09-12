import { session } from "@/lib/auth";
import { rpc } from "@catera/backend";
import { menuSummary, statusLabel } from "@catera/domain";
import type { Delivery } from "@catera/domain";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const s = await session(request);
  if (!s.id) return new Response("Unauthorized", { status: 401 });
  try {
    const { id } = await params;
    const v = await rpc<{
      service_date: string;
      revision: number;
      entries: Delivery[];
    }>(s.id, s.token, "catera_v1_manifest", { version_id: id });
    const safe = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@\-]/, "'")
        .replaceAll('"', '""') +
      '"';
    const locale = /(?:^|;\s*)catera_locale=en(?:;|$)/.test(
      request.headers.get("cookie") || "",
    )
      ? "en"
      : "id";
    const tr = (id: string, en: string) => (locale === "id" ? id : en);
    const rows = [
      [
        tr("Tanggal", "Date"),
        tr("Revisi", "Revision"),
        tr("Paket", "Package"),
        tr("Waktu makan", "Meal period"),
        tr("Menu", "Menu"),
        tr("Porsi", "Portions"),
        tr("Trial", "Trial"),
        tr("Jendela pengantaran", "Delivery window"),
        tr("Alamat", "Address"),
        tr("Area", "Area"),
        tr("Petunjuk", "Instructions"),
        tr("Status", "Status"),
      ],
      ...v.entries.flatMap((d) =>
        d.meals.map((meal) => [
          v.service_date,
          v.revision,
          d.offer.name,
          meal.meal === "lunch"
            ? tr("Makan siang", "Lunch")
            : tr("Makan malam", "Dinner"),
          d.offer.menus
            .filter((menu) => menu.meal === meal.meal)
            .map((menu) => menuSummary(menu, locale))
            .join("; "),
          d.portions,
          d.trial ? tr("Ya", "Yes") : tr("Tidak", "No"),
          d.offer.windows[meal.meal as "lunch" | "dinner"],
          d.address.line,
          d.address.area,
          d.address.instructions,
          statusLabel(meal.status, locale),
        ]),
      ),
    ];
    return new Response(
      "\uFEFF" + rows.map((r) => r.map(safe).join(",")).join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv;charset=utf-8",
          "Content-Disposition": `attachment; filename="catera-${v.service_date}-r${v.revision}.csv"`,
          "Cache-Control": "private,no-store",
        },
      },
    );
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
}
