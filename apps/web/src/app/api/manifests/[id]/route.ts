import { session } from "@/lib/auth";
import { rpc } from "@catera/backend";
import { menuSummary } from "@catera/domain";
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
    const rows = [
      [
        "Tanggal",
        "Revisi",
        "Paket",
        "Waktu makan",
        "Menu",
        "Porsi",
        "Trial",
        "Jendela pengantaran",
        "Alamat",
        "Area",
        "Petunjuk",
        "Status",
      ],
      ...v.entries.flatMap((d) =>
        d.meals.map((meal) => [
          v.service_date,
          v.revision,
          d.offer.name,
          meal.meal === "lunch" ? "Makan siang" : "Makan malam",
          d.offer.menus
            .filter((menu) => menu.meal === meal.meal)
            .map(menuSummary)
            .join("; "),
          d.portions,
          d.trial ? "Ya" : "Tidak",
          d.offer.windows[meal.meal as "lunch" | "dinner"],
          d.address.line,
          d.address.area,
          d.address.instructions,
          meal.status,
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
