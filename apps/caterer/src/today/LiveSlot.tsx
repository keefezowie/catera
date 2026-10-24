import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { mealLabel, shortDate, type DeliveryIssue, type Locale, type SellerAttentionItem } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Card, DecorativeIcon, GlyphCircle, PressableRow, Text, useColors } from "@catera/mobile-ui";
import { replyHref } from "../hrefs";
import { dapurLink } from "../links";
import { openLink } from "../nav";
import { LinkRow } from "./rows";

/** A to-do's text column starts after its 40 glyph circle and the 12 gap: where the hairlines and the link row begin. */
const TEXT_INSET = 52;
/** The live slot's rows are 64 or more, like every two-line row of the Dapur scale. */
const ROW_HEIGHT = 64;

const rowStyle = { minHeight: ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 } as const;

type Item = { key: string; kind: "card" | "row"; node: ReactNode };

/**
 * The one slot for what needs the caterer before the cooking list: the setup card of a new kitchen, the customers'
 * delivery reports still waiting, and the attention items, in that order. It shows the first of them as one card
 * (attention tone for a report or an item, as before); when more wait, a 48 link row "n hal lainnya" opens the rest in
 * place, in the same card. The link stays where it is and reads "expanded" while open (it closes them again), so focus
 * is never left on a control that vanished. Nothing waiting leaves the slot out.
 */
export function LiveSlot({
  setup,
  issues,
  attention,
}: {
  /** The owner of a kitchen with no packages yet: the setup card. */
  setup: boolean;
  /** The reports to show: only today's page passes any, and Besok none. */
  issues: DeliveryIssue[];
  attention: SellerAttentionItem[];
}) {
  const { t, locale } = useMobile();
  const c = useColors();
  const [open, setOpen] = useState(false);
  const items: Item[] = [];
  if (setup) items.push({ key: "setup", kind: "card", node: <MulaiCard /> });
  for (const issue of issues.filter((i) => !i.case_id && (i.status === "open" || i.status === "responded")))
    items.push({ key: `report-${issue.id}`, kind: "row", node: <ReportRow issue={issue} /> });
  for (const item of attention.filter((i) => attentionLabels[i.kind]).slice(0, 3))
    items.push({ key: `attention-${item.id}`, kind: "row", node: <ActionRow item={item} locale={locale} /> });
  if (!items.length) return null;

  const [first, ...rest] = items;
  const more = rest.length;
  const expand = (
    <LinkRow
      testID="live-more"
      label={t(`${more} hal lainnya`, `${more} more`)}
      inset={first.kind === "row" ? TEXT_INSET : 0}
      expanded={open}
      trailing={<DecorativeIcon name={open ? "chevron-up" : "chevron-down"} size={18} color={c.forest} />}
      onPress={() => setOpen((was) => !was)}
    />
  );
  const separator = (key: string) => (
    <View key={key} testID="live-separator" style={{ height: 1, marginLeft: TEXT_INSET, backgroundColor: c.line }} />
  );
  // Rows share one attention card; a setup card on top has its own, so the rows that follow it get theirs.
  const rows = (list: Item[]) => (
    <Card testID="live-card" tone="attention" style={{ gap: 0, paddingVertical: 0 }}>
      {list.map((item, i) => (
        <View key={item.key}>
          {i > 0 ? separator(`${item.key}-separator`) : null}
          {item.node}
        </View>
      ))}
      {more && first.kind === "row" ? (
        <>
          {separator("more-separator")}
          {expand}
        </>
      ) : null}
    </Card>
  );
  return (
    <View testID="live-slot" style={{ gap: 8 }}>
      {first.kind === "card" ? first.node : null}
      {first.kind === "card" && more ? expand : null}
      {first.kind === "row" ? rows(open ? items : [first]) : open && more ? rows(rest) : null}
    </View>
  );
}

/** Reports still waiting on the caterer, each naming who, which day and meal; tap to answer in the reply sheet. */
function ReportRow({ issue }: { issue: DeliveryIssue }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const who = issue.customerName || t("Pelanggan", "A customer");
  return (
    <PressableRow
      accessibilityRole="button"
      accessibilityLabel={`${t("Buka laporan", "Open report")}: ${who}`}
      onPress={() => router.push(replyHref(issue.id, issue.customerName) as never)}
      style={rowStyle}
    >
      <GlyphCircle>
        <DecorativeIcon name="chatbubble-ellipses-outline" size={20} color={c.forest} />
      </GlyphCircle>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="rowTitle">{`${who} ${t("melaporkan masalah", "reported a problem")}`}</Text>
        <Text variant="meta">{`${shortDate(issue.service_date, locale)} · ${mealLabel(issue.meal, locale)}`}</Text>
        <Text variant="meta">{issue.subject}</Text>
        {issue.status === "responded" ? (
          <Text variant="meta" style={{ color: c.charcoal }}>
            {t("Sudah kamu balas. Tandai selesai kalau sudah beres.", "You replied. Mark it done once it's sorted.")}
          </Text>
        ) : null}
      </View>
      {process.env.EXPO_OS === "ios" ? <DecorativeIcon name="chevron-forward" size={18} color={c.muted} /> : null}
    </PressableRow>
  );
}

// Delivery reports have their own rows above (ReportRow).
const attentionLabels: Partial<Record<SellerAttentionItem["kind"], [string, string]>> = {
  support: ["Pertanyaan pelanggan menunggu", "A customer question is waiting"],
  delivery: ["Ada pengantaran bermasalah", "A delivery needs attention"],
  choice_fallback: ["Menu pilihan pelanggan perlu dicek", "Customer menu choices need a check"],
  choice_deadline: ["Batas pilih menu pelanggan sudah dekat", "Customer menu choice deadline is near"],
  payment: ["Ada pembayaran yang perlu dicek", "A payment needs attention"],
};

/**
 * The delivery rows read "2026-10-20 · dinner · Paket" from the server. Build the line from the payload's own
 * `serviceDate`, `meal` and `packageName` when they are there, and from that string when they are not, then show
 * the day and meal the way the rest of Dapur does ("Selasa 20 Okt · Makan malam · Paket").
 */
function attentionContext(item: SellerAttentionItem, locale: Locale) {
  const context = item.context;
  const tail = (name?: string | null) => (name ? ` · ${name}` : "");
  if (item.kind === "delivery" || item.kind === "choice_fallback" || item.kind === "choice_deadline") {
    if (item.serviceDate && item.meal) return `${shortDate(item.serviceDate, locale)} · ${mealLabel(item.meal, locale)}${tail(item.packageName)}`;
    const m = /^([0-9]{4}-[0-9]{2}-[0-9]{2}) · (lunch|dinner)(?=$| · |:)/.exec(context ?? "");
    if (m) return `${shortDate(m[1], locale)} · ${mealLabel(m[2], locale)}${context.slice(m[0].length)}`;
  }
  return context;
}

function ActionRow({ item, locale }: { item: SellerAttentionItem; locale: Locale }) {
  const { t } = useMobile();
  const c = useColors();
  const [id, en] = attentionLabels[item.kind]!;
  const line = attentionContext(item, locale);
  // "/" is dapurLink's answer for "no Dapur screen for this": Hari ini is already where we are.
  const route = dapurLink(item.href);
  const link = route !== "/";
  const body = (
    <>
      <GlyphCircle>
        <DecorativeIcon name="alert-circle-outline" size={20} color={c.forest} />
      </GlyphCircle>
      <View testID={`attention-body-${item.id}`} style={{ flex: 1, minWidth: 0 }}>
        <Text variant="rowTitle">{t(id, en)}</Text>
        {line ? <Text variant="meta">{line}</Text> : null}
      </View>
      {link && process.env.EXPO_OS === "ios" ? <DecorativeIcon name="chevron-forward" size={18} color={c.muted} /> : null}
    </>
  );
  return link ? (
    <PressableRow testID={`attention-${item.id}`} accessibilityRole="link" onPress={() => openLink(route)} style={rowStyle}>
      {body}
    </PressableRow>
  ) : (
    <View testID={`attention-${item.id}`} style={rowStyle}>
      {body}
    </View>
  );
}

/** A new kitchen's way in: three steps as 56 rows, then what this page will show once there are customers. */
function MulaiCard() {
  const { t } = useMobile();
  const c = useColors();
  const steps: [string, string, string][] = [
    [t("Buat paket pertama", "Create your first package"), t("Nama, foto, harga, hari antar", "Name, photo, price, days"), "/paket/baru"],
    [t("Pindahkan pelanggan lama", "Bring in existing customers"), t("Kirim foto buku catatan atau chat WhatsApp", "Send a notebook photo or WhatsApp chat"), "/impor"],
    [t("Aktifkan pembayaran", "Turn on payments"), t("Perlu sebelum perpanjangan pertama", "Needed before the first renewal"), "/aktifkan"],
  ];
  return (
    <>
      {/* Direction K: a plain card. Forest fills only the first step, the one brand control here; the rest sit on well. */}
      <Card>
        <Text variant="section">{t("Siapkan dapurmu", "Set up your kitchen")}</Text>
        {steps.map(([title, sub, href], i) => (
          <PressableRow
            key={href}
            accessibilityRole="button"
            onPress={() => router.push(href as never)}
            style={{
              minHeight: 56,
              padding: 12,
              borderRadius: 12,
              borderCurve: "continuous",
              // `well` steps off the card in both themes; `sage` equals the dark card.
              backgroundColor: i === 0 ? c.forest : c.well,
              gap: 2,
            }}
          >
            <Text variant="rowTitle" style={{ color: i === 0 ? c.cream : c.charcoal }}>
              {title}
            </Text>
            <Text variant="meta" style={{ color: i === 0 ? c.cream : c.muted }}>
              {sub}
            </Text>
          </PressableRow>
        ))}
      </Card>
      <Card>
        <Text variant="section">{t("Setelah ada pelanggan", "Once you have customers")}</Text>
        <Text variant="meta">
          {t(
            "Halaman ini menunjukkan porsi yang perlu dimasak dan rute antar, hari ini dan besok.",
            "This page shows what to cook and where to deliver, today and tomorrow.",
          )}
        </Text>
      </Card>
    </>
  );
}
