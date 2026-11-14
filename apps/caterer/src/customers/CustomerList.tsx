import { useEffect, useRef, useState, type ReactNode } from "react";
import { Linking, RefreshControl, ScrollView, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { nativeLayout } from "@catera/design-tokens";
import { addDays, errorLabel, jakartaDay, whatsappUrl, type CustomerSubscription, type Locale, type SellerCustomer } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  cardEdge,
  Chip,
  DecorativeIcon,
  FadeSwap,
  fontFor,
  ListCard,
  MoodHeader,
  PressableScale,
  RowSwap,
  Screen,
  Text,
  TwoLineRow,
  useBusy,
  useColors,
  useListMotion,
  useRowMotion,
  useScreenMargin,
  useToast,
  useTouchTarget,
} from "@catera/mobile-ui";
import { activeSubscriptions, currentSubscription, customerStatus, endLabel, initials, matchesQuery, type CustomerStatus } from "./rules";
import { sendRenewalLink } from "./renewal";
import { usePayments } from "./usePayments";
import { loadAllCustomers } from "./load";
import { useImportCommits } from "../import/commits";
import { customerHref } from "../hrefs";
import { ReadError } from "../ReadError";
import { ListSkeleton } from "../skeletons";
import { pushScreen } from "../nav";

/** The chat button's 48 target pulls 8 into the card's side padding, so its glyph ends where the other rows' text does. */
const CHAT_PULL = -8;
/**
 * The chips' frame sits 4 closer to the header than the screen body's 16 would put it: the board draws the visible
 * chip 12 below the title row, and the frame's own 7 above the chip makes up the rest.
 */
const CHIPS_LIFT = -4;

/**
 * What the row says about a package's days: "sisa 9 hari", or the date wording when the package ends today or tomorrow
 * (or has nothing left to deliver), the same words the card used.
 */
function daysLeft(
  s: Pick<CustomerSubscription, "ends_on" | "remaining">,
  today: string,
  t: (id: string, en: string) => string,
  locale: Locale,
) {
  if (s.remaining <= 0 || s.ends_on === today || s.ends_on === addDays(today, 1)) return endLabel(s.ends_on, today, t, locale);
  return t(`sisa ${s.remaining} hari`, s.remaining === 1 ? "1 day left" : `${s.remaining} days left`);
}

/** The initials circle ahead of a name. */
const AVATAR = 40;

/**
 * How soon the renewals fall, in words: all today, all within the week, or just soon (a package is "ending" at three
 * delivery days left, which a slow schedule can stretch past a week).
 */
function endingWhen(ends: string[], today: string, t: (id: string, en: string) => string) {
  if (ends.every((e) => e <= today)) return t("hari ini", "today");
  if (ends.every((e) => e <= addDays(today, 6))) return t("minggu ini", "this week");
  return t("segera", "soon");
}

/** The Screen body's column, for a list that is the scroll root and so draws its own. */
const FRAME = { maxWidth: 760, width: "100%", alignSelf: "center" } as const;

/**
 * One customer's place in the list. The rows are the list's items, so the card they used to share is drawn in
 * pieces: the first row takes the top corners and edge, the last the bottom ones, and a line divides the rest.
 */
function CardRow({ first, last, children }: { first: boolean; last: boolean; children: ReactNode }) {
  const palette = useColors();
  const edge = cardEdge(palette).borderWidth ?? 0;
  const radius = nativeLayout.radius.card;
  return (
    <View
      testID="customer-card-row"
      style={{
        backgroundColor: palette.surface,
        paddingHorizontal: nativeLayout.cardPadding - edge,
        borderCurve: "continuous",
        overflow: "hidden",
        borderLeftWidth: edge,
        borderRightWidth: edge,
        borderTopWidth: first ? edge : 0,
        borderBottomWidth: last ? edge : 0,
        borderColor: palette.cardBorder || undefined,
        borderTopLeftRadius: first ? radius : 0,
        borderTopRightRadius: first ? radius : 0,
        borderBottomLeftRadius: last ? radius : 0,
        borderBottomRightRadius: last ? radius : 0,
      }}
    >
      {first ? null : <View testID="list-card-separator" style={{ height: 1, backgroundColor: palette.line }} />}
      {children}
    </View>
  );
}

/** Every subscriber, marketplace and own, filtered by where their package stands. */
export function CustomerList() {
  const { runtime, actor, t, locale, command } = useMobile();
  // Named palette because `c` is a customer in the callbacks below.
  const palette = useColors();
  const target = useTouchTarget();
  const margin = useScreenMargin();
  const toast = useToast();
  const id = actor?.catererId ?? "";
  const list = useData(`customers:${id}`, () => loadAllCustomers(runtime, id));
  const [picked, setPicked] = useState<CustomerStatus | null>(null);
  const [query, setQuery] = useState("");
  const today = jakartaDay(new Date());
  const customers = list.data?.customers ?? [];
  // The chips do not overlap: whoever is about to end leaves Aktif and waits under Perlu diperpanjang.
  const inFilter = (c: SellerCustomer, s: CustomerStatus) => customerStatus(c) === s;
  const count = (s: CustomerStatus) => customers.filter((c) => inFilter(c, s)).length;
  // The list opens on the renewals when there are any; a chip the caterer picked stays.
  const filter: CustomerStatus = picked ?? (count("ending") ? "ending" : "active");
  const shown = customers.filter((c) => inFilter(c, filter) && matchesQuery(c, query));
  const labels: Record<CustomerStatus, string> = {
    active: t("Aktif", "Active"),
    ending: t("Perlu diperpanjang", "To renew"),
    ended: t("Selesai", "Ended"),
  };
  const endingList = customers.filter((c) => inFilter(c, "ending"));
  // The renewal link, as the customer's page sends it. A tick lasts for this visit only: the app keeps no record of a send.
  const payments = usePayments().data;
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [which, setWhich] = useState("");
  const [sending, send] = useBusy(async (c: SellerCustomer) => {
    const s = currentSubscription(c);
    // Null is a read still running or one that failed: neither says payments are off.
    if (!s || payments === null) return;
    if (payments === false) {
      pushScreen("/aktifkan");
      return;
    }
    setWhich(c.id);
    try {
      await sendRenewalLink({ command, runtime, t }, id, c, s);
      setSent((m) => ({ ...m, [c.id]: true }));
    } catch (e) {
      toast.show({
        message:
          errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
          t("Tautan perpanjang belum terkirim. Coba lagi.", "Couldn't send the renewal link. Try again."),
        tone: "error",
      });
    }
  });
  // Pull to refresh reads the list again while the rows stay; only the spinner says so.
  const [pulling, setPulling] = useState(false);
  // Only the caterer's own import on this phone inserts rows: the answer that follows it lets the new customers enter.
  // Any other new answer (the first load, a pull to refresh, a push, a change made on the web) is a refresh, and a
  // refresh or a filter change swaps the rows as one block, with no entrance, no exit and no move (Decision A).
  const imports = useImportCommits();
  const seen = useRef({ data: list.data, imports, swaps: 0 });
  const answered = list.data !== seen.current.data;
  const byImport = answered && !!seen.current.data && imports !== seen.current.imports;
  const swaps = seen.current.swaps + (answered && !byImport ? 1 : 0);
  useEffect(() => {
    if (answered) seen.current = { data: list.data, imports, swaps };
  });
  const motion = useRowMotion();
  const rowMotion = useListMotion(list.data ? customers.map((c) => c.id) : null, !byImport);
  const pulled = useRef(false);
  async function pull() {
    pulled.current = true;
    setPulling(true);
    try {
      await list.reload();
    } finally {
      setPulling(false);
    }
  }
  // A pull that ended with the old customers still on screen says so; a background reload that fails stays quiet.
  useEffect(() => {
    if (pulling || !pulled.current) return;
    pulled.current = false;
    if (list.stale) toast.show({ message: t("Belum bisa memperbarui. Tarik lagi untuk mencoba.", "Couldn't refresh. Pull again to try."), tone: "error" });
  }, [pulling, list.stale, toast, t]);
  const addLabel = t("+ Impor pelanggan", "+ Import customers");
  return (
    <Screen
      plainHeader
      header={
        // No mood band: the title and the one action share the 48 row on the canvas (spec 3.2); no empty row above.
        <MoodHeader
          plain
          testID="pelanggan-header"
          title={null}
          meta={
            <Text variant="heroTitle" accessibilityRole="header">
              {t("Pelanggan", "Customers")}
            </Text>
          }
          trailing={
            // A 48 target in the 48 row, and its label ends on the margin (no padding on that side).
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={addLabel}
              haptic="tap"
              onPress={() => pushScreen("/impor")}
              style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 8, paddingRight: 0 }}
            >
              <Ionicons name="add" size={20} color={palette.forest} />
              {/* forest: action */}
              <Text variant="bodyStrong" style={{ color: palette.forest }}>
                {addLabel.replace(/^\+\s*/, "")}
              </Text>
            </PressableScale>
          }
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={() => void pull()}
          tintColor={palette.forest}
          colors={[palette.forest]}
          progressBackgroundColor={palette.surface}
        />
      }
      list={({ scrollProps, header: screenHeader }) => (
        <Animated.FlatList
          {...scrollProps}
          // Cells are not the rows' parents, so the slide when customers are inserted belongs to the list.
          itemLayoutAnimation={motion.layout as never}
          data={list.data ? shown : []}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={
            <>
              {screenHeader}
              {/* paddingBottom: the 8 the chips and the card were apart when they shared a column. */}
              <View testID="pelanggan-list-head" style={{ ...FRAME, paddingHorizontal: margin, paddingTop: 16 + CHIPS_LIFT, paddingBottom: 8 }}>
                {!list.data && list.error ? <ReadError art message={list.error} onRetry={() => void list.reload()} /> : null}
                {/* The chips enter from their skeleton as one block, never one by one. */}
                {list.data || !list.error ? (
                  <FadeSwap swapKey={list.data ? "list" : "loading"}>
                    {list.data ? (
                      <View style={{ gap: 8 }}>
                        {/* One row of chips that scrolls sideways. The frame is a real 48 tall and never shrinks (a hit slop cannot
                            reach past its parent), and runs to the right screen edge while the chips start at the margin. */}
                        <View
                          testID="pelanggan-search"
                          style={{
                            minHeight: target,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            paddingHorizontal: 12,
                            borderRadius: nativeLayout.radius.control,
                            borderCurve: "continuous",
                            backgroundColor: palette.fill,
                          }}
                        >
                          <DecorativeIcon name="search-outline" size={20} color={palette.muted} />
                          <TextInput
                            accessibilityLabel={t("Cari nama atau area", "Search name or area")}
                            value={query}
                            onChangeText={setQuery}
                            placeholder={t("Cari nama atau area", "Search name or area")}
                            placeholderTextColor={palette.muted}
                            returnKeyType="search"
                            autoCorrect={false}
                            clearButtonMode="while-editing"
                            style={{ flex: 1, minHeight: target, fontFamily: fontFor("400"), fontSize: 15, color: palette.charcoal, padding: 0 }}
                          />
                        </View>
                        <View testID="pelanggan-chips-frame" style={{ height: target, flexShrink: 0, marginRight: -margin }}>
                          <ScrollView
                            testID="pelanggan-chips"
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            style={{ flexGrow: 0, flexShrink: 0, height: target }}
                            contentContainerStyle={{ gap: 8, alignItems: "center", paddingRight: margin }}
                          >
                            {(["ending", "active", "ended"] as const).map((s) => (
                              <Chip key={s} label={`${labels[s]} · ${count(s)}`} selected={filter === s} onPress={() => setPicked(s)} />
                            ))}
                          </ScrollView>
                        </View>
                        {filter === "ending" && endingList.length ? (
                          <View testID="pelanggan-renewal-note" style={{ gap: 2 }}>
                            <Text variant="bodyStrong">
                              {t(
                                `${endingList.length} paket berakhir ${endingWhen(endingList.map((c) => currentSubscription(c)?.ends_on ?? today), today, t)}`,
                                `${endingList.length} ${endingList.length === 1 ? "package ends" : "packages end"} ${endingWhen(endingList.map((c) => currentSubscription(c)?.ends_on ?? today), today, t)}`,
                              )}
                            </Text>
                            <Text variant="meta">{t("Kirim tautan perpanjang lewat WhatsApp.", "Send the renewal link on WhatsApp.")}</Text>
                          </View>
                        ) : null}
                        {!shown.length ? (
                          <Text variant="caption">
                            {query.trim() ? t("Tidak ada pelanggan yang cocok.", "No customers match.") : t("Belum ada pelanggan di sini.", "No customers here yet.")}
                          </Text>
                        ) : null}
                      </View>
                    ) : (
                      <ListSkeleton shape="customer" rows={8} chips={3} label={t("Memuat pelanggan", "Loading customers")} />
                    )}
                  </FadeSwap>
                ) : null}
              </View>
            </>
          }
          renderItem={({ item: c, index }) => {
            const s = currentSubscription(c);
            const others = Math.max(activeSubscriptions(c).length - 1, 0);
            const meta = [
              s?.package_name,
              s && s.status === "active" ? daysLeft(s, today, t, locale) : null,
              others ? `+${others} ${t("paket lain", "more packages")}` : null,
              c.address.area,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <View style={{ ...FRAME, paddingHorizontal: margin }}>
                {/* A filter change or a refresh swaps the rows as one block; only the caterer's own import animates them in. */}
                <RowSwap swapKey={`${filter}:${swaps}`}>
                  <CardRow first={index === 0} last={index === shown.length - 1}>
                    <Animated.View testID="customer-row" {...rowMotion(c.id)} layout={undefined}>
                      {/* The row and its chat button are two controls side by side, so a screen reader finds both. */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <TwoLineRow
                            leading={
                              <View
                                accessible={false}
                                importantForAccessibility="no-hide-descendants"
                                style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: palette.sage, alignItems: "center", justifyContent: "center" }}
                              >
                                <Text variant="bodyStrong" style={{ color: palette.forest }}>
                                  {initials(c.name)}
                                </Text>
                              </View>
                            }
                            title={c.name}
                            meta={meta}
                            onPress={() => pushScreen(customerHref(c.id, c.name))}
                          />
                        </View>
                        {filter === "ending" && c.phone && currentSubscription(c)?.status === "active" ? (
                          <PressableScale
                            accessibilityRole="button"
                            accessibilityLabel={`${sent[c.id] ? t("Kirim ulang tautan", "Resend link") : t("Kirim tautan", "Send link")} ${c.name}`}
                            accessibilityState={{ disabled: payments === null || sending, busy: sending && which === c.id }}
                            disabled={payments === null || sending}
                            haptic="tap"
                            onPress={() => void send(c)}
                            style={{ minHeight: 48, minWidth: 48, flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "center", opacity: payments === null ? 0.45 : 1 }}
                          >
                            {sent[c.id] ? <Ionicons name="checkmark" size={18} color={palette.forest} /> : null}
                            {/* forest: action */}
                            <Text variant="bodyStrong" style={{ color: palette.forest }}>
                              {sent[c.id] ? t("Terkirim", "Sent") : t("Kirim tautan", "Send link")}
                            </Text>
                          </PressableScale>
                        ) : null}
                        {c.phone ? (
                          <PressableScale
                            accessibilityRole="link"
                            accessibilityLabel={`${t("Chat", "Chat")} ${c.name}`}
                            onPress={() => void Linking.openURL(whatsappUrl("", c.phone!))}
                            style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", marginRight: CHAT_PULL }}
                          >
                            <Ionicons name="chatbubble-ellipses-outline" size={22} color={palette.forest} />
                          </PressableScale>
                        ) : null}
                      </View>
                    </Animated.View>
                  </CardRow>
                </RowSwap>
              </View>
            );
          }}
        />
      )}
    >
      {null}
    </Screen>
  );
}
