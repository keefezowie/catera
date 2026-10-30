import { useCallback, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { groupPaymentMethods, paymentMethodInfo, type PaymentMethodInfo } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import {
  fonts,
  parkQuestion,
  SectionHeader,
  SheetFitBody,
  SheetHeader,
  Text,
  useColors,
  useQuestionRoute,
  type QuestionRegistry,
} from "@catera/mobile-ui";
import { MethodMark } from "./MethodMark";

/**
 * "Bayar dengan": every method the server offers for this purchase, grouped (QRIS, e-wallet, bank, card, store,
 * paylater). A route (`/pembelian/bayar-pakai`) asked through `parkQuestion` like `src/choice.tsx`; the answer is the
 * chosen DOKU code, or null when the sheet closes.
 */
export type PayMethodInput = { codes: string[]; selected: string | null };

const waiting: QuestionRegistry<PayMethodInput, string | null> = new Map();

export function usePayMethodPicker(): (input: PayMethodInput) => Promise<string | null> {
  return useCallback((input: PayMethodInput) => parkQuestion(waiting, "/pembelian/bayar-pakai", input, null), []);
}

/** Section titles show only once the list is longer than this. */
const TITLES_AFTER = 5;

type Row = {
  label: string;
  detail: string;
  checked?: boolean;
  /** Set on the folded bank row only: it is a button that opens in place, not a radio. */
  expanded?: boolean;
  mark: ReactNode;
  onPress: () => void;
};

function PickRow({ row, os }: { row: Row; os: string | undefined }) {
  const c = useColors();
  const ios = os === "ios";
  const button = row.expanded !== undefined;
  return (
    <Pressable
      accessibilityRole={button ? "button" : "radio"}
      accessibilityLabel={`${row.label}, ${row.detail}`}
      accessibilityState={button ? { expanded: row.expanded } : { checked: !!row.checked }}
      onPress={row.onPress}
      android_ripple={{ color: c.line }}
      style={({ pressed }) => [
        {
          minHeight: 64,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          paddingHorizontal: ios ? 20 : 24,
          paddingVertical: 8,
        },
        ios && pressed ? { backgroundColor: c.sage } : null,
      ]}
    >
      {row.mark}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ fontFamily: row.checked ? fonts.semibold : fonts.regular, fontSize: ios ? 17 : 16, lineHeight: 22, color: c.charcoal }}>
          {row.label}
        </Text>
        <Text variant="meta">{row.detail}</Text>
      </View>
      {button ? (
        <Ionicons name={row.expanded ? "chevron-up" : "chevron-down"} size={20} color={c.muted} />
      ) : ios ? (
        row.checked ? <Ionicons name="checkmark" size={20} color={c.forest} /> : null
      ) : (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: row.checked ? c.forest : c.controlRing,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {row.checked ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.forest }} /> : null}
        </View>
      )}
    </Pressable>
  );
}

export function PayMethodRoute({ os = process.env.EXPO_OS }: { os?: string } = {}) {
  const { t, locale } = useMobile();
  const { input, close } = useQuestionRoute(waiting, null, os);
  // The banks start open when the chosen method is one of them.
  const [open, setOpen] = useState(() => !!input && paymentMethodInfo(input.selected ?? "")?.group === "va");
  if (!input) return null;
  const groups = groupPaymentMethods(input.codes);
  const total = groups.reduce((n, g) => n + g.methods.length, 0);
  const text = (p: { id: string; en: string }) => (locale === "en" ? p.en : p.id);
  const plain = (m: PaymentMethodInfo): Row => ({
    label: text(m.name),
    detail: text(m.detail),
    checked: m.code === input.selected,
    mark: <MethodMark info={m} />,
    onPress: () => close(m.code),
  });
  return (
    // A long list scrolls under the fixed title row.
    <SheetFitBody header={<SheetHeader title={t("Bayar dengan", "Pay with")} closeLabel={t("Tutup", "Close")} os={os} />}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("Bayar dengan", "Pay with")}>
        {groups.map(({ group, title, methods }) => {
          const fold = group === "va" && methods.length > 1;
          const names = methods.map((m) => m.short);
          const picked = methods.find((m) => m.code === input.selected);
          const first = names.slice(0, 4).join(", ");
          return (
            <View key={group}>
              {title && total > TITLES_AFTER ? <SectionHeader title={text(title)} /> : null}
              {fold ? (
                <>
                  <PickRow
                    os={os}
                    row={{
                      label: t("Transfer bank (Virtual Account)", "Bank transfer (Virtual Account)"),
                      detail: picked
                        ? text(picked.name)
                        : names.length > 4
                          ? t(`${first} dan ${names.length - 4} lainnya`, `${first} and ${names.length - 4} more`)
                          : names.join(", "),
                      expanded: open,
                      mark: <MethodMark group="va" />,
                      onPress: () => setOpen((o) => !o),
                    }}
                  />
                  {open ? methods.map((m) => <PickRow key={m.code} os={os} row={plain(m)} />) : null}
                </>
              ) : (
                methods.map((m) => <PickRow key={m.code} os={os} row={plain(m)} />)
              )}
            </View>
          );
        })}
      </View>
    </SheetFitBody>
  );
}
