import { Fragment } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { nativeMotion } from "@catera/design-tokens";
import { useHaptic, useReduced } from "./motion";
import { SheetFitBody, SheetHeader } from "./SheetHeader";
import { useActionRoute, type ActionItem, type ActionSheetInput } from "./sheets";
import { useColors } from "./theme";
import { fonts } from "./type";

/** Destructive items go last, after every other item, each group in the caller's order. */
export function orderActions(items: ActionItem[]): ActionItem[] {
  return [...items.filter((i) => i.tone !== "danger"), ...items.filter((i) => i.tone === "danger")];
}

/**
 * The action sheet (canvas `ActionSheet`): several secondary actions on one item, as icon rows under the sheet title and
 * the item they act on (photo, name, lines). Destructive items come last, below a divider, in the danger ink. A disabled
 * item is shown dimmed and cannot be chosen. Rows are 52pt on iOS (the system row) and 56dp on Android (Material's
 * one-line list item, with its ripple). `os` defaults to the running platform.
 */
export function ActionSheet({
  title,
  context,
  items,
  onChoose,
  closeLabel,
  os = process.env.EXPO_OS,
}: ActionSheetInput & { onChoose: (key: string) => void; os?: string }) {
  const palette = useColors();
  const reduced = useReduced();
  const haptic = useHaptic();
  const ios = os === "ios";
  const inset = ios ? 20 : 24;
  const ordered = orderActions(items);
  const firstDanger = ordered.findIndex((i) => i.tone === "danger");

  return (
    // A long list (many items, a larger font on a small phone) scrolls under the fixed title row.
    <SheetFitBody testID="action-sheet" foot={8} header={<SheetHeader title={title} closeLabel={closeLabel} os={os} />}>
      {context ? (
        <View testID="action-context" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: inset, paddingBottom: 12 }}>
          {context.image ? (
            <View testID="action-context-frame" style={{ width: 56, height: 56, borderRadius: 12, borderCurve: "continuous", overflow: "hidden", backgroundColor: palette.sage }}>
              <Image
                testID="action-context-image"
                source={{ uri: context.image }}
                contentFit="cover"
                accessible={false}
                transition={reduced ? 0 : nativeMotion.selection}
                style={{ width: 56, height: 56 }}
              />
            </View>
          ) : null}
          <View style={{ flex: 1, gap: 2 }}>
            <RNText selectable style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: palette.charcoal }}>
              {context.title}
            </RNText>
            {context.lines.map((line, i) => (
              <RNText key={i} selectable style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: palette.muted, fontVariant: ["tabular-nums"] }}>
                {line}
              </RNText>
            ))}
          </View>
        </View>
      ) : null}
      {ordered.map((item, i) => {
        const danger = item.tone === "danger";
        const ink = danger ? palette.danger : palette.charcoal;
        return (
          <Fragment key={item.key}>
            {i === firstDanger && i > 0 ? (
              <View
                testID="action-divider"
                style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.line, marginHorizontal: inset, marginVertical: 4 }}
              />
            ) : null}
            <Pressable
              testID={`action-row-${item.key}`}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ disabled: !!item.disabled }}
              disabled={item.disabled}
              android_ripple={{ color: palette.line }}
              onPress={() => {
                if (item.disabled) return;
                haptic.select();
                onChoose(item.key);
              }}
              style={({ pressed }) => [
                {
                  minHeight: ios ? 52 : 56,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  paddingHorizontal: inset,
                  paddingVertical: 8,
                  opacity: item.disabled ? 0.45 : 1,
                },
                ios && pressed ? { backgroundColor: palette.sage } : null,
              ]}
            >
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={ios ? 22 : 24}
                color={danger ? palette.danger : ios ? palette.forest : palette.charcoal}
              />
              <RNText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: ios ? 17 : 16, lineHeight: 22, color: ink }}>
                {item.label}
              </RNText>
            </Pressable>
          </Fragment>
        );
      })}
    </SheetFitBody>
  );
}

/**
 * The `/aksi` route: shows the actions `useActionSheet` parked under `?id=` and answers once with the chosen key, or
 * null when the sheet closes without a choice (Close, the hardware back, a swipe down, an unmount). The answer comes
 * once the sheet has gone (`useQuestionRoute`), so the asker can open Pindah tanggal or Laporkan masalah straight away.
 * A route with nothing waiting closes itself, to Beranda when nothing is under it (a cold OS link). `os` defaults to
 * the running platform.
 */
export function ActionRoute({ os }: { os?: string } = {}) {
  const { input, close } = useActionRoute(os);
  if (!input) return null;
  return <ActionSheet {...input} closeLabel={input.closeLabel} onChoose={(key) => close(key)} />;
}
