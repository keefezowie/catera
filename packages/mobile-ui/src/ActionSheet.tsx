import { Fragment, use, useEffect, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationContext, NavigationRouteContext } from "expo-router/react-navigation";
import { useHaptic } from "./motion";
import { SheetHeader } from "./SheetHeader";
import { actionWaiting, answerAction, type ActionItem, type ActionSheetInput } from "./sheets";
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
}: ActionSheetInput & { onChoose: (key: string) => void; closeLabel?: string; os?: string }) {
  const palette = useColors();
  const insets = useSafeAreaInsets();
  const haptic = useHaptic();
  const ios = os === "ios";
  const inset = ios ? 20 : 24;
  const ordered = orderActions(items);
  const firstDanger = ordered.findIndex((i) => i.tone === "danger");

  return (
    <View testID="action-sheet" style={{ paddingBottom: insets.bottom + 8 }}>
      <SheetHeader title={title} closeLabel={closeLabel} os={os} />
      {context ? (
        <View testID="action-context" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: inset, paddingBottom: 12 }}>
          {context.image ? (
            <Image
              testID="action-context-image"
              source={{ uri: context.image }}
              contentFit="cover"
              accessible={false}
              style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: palette.sage }}
            />
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
    </View>
  );
}

/**
 * The `/aksi` route: shows the actions `useActionSheet` parked under `?id=` and answers once with the chosen key, or
 * null when the sheet closes without a choice (Close, the hardware back, a swipe down). A route with nothing waiting
 * closes itself.
 */
export function ActionRoute() {
  const navigation = use(NavigationContext);
  const route = use(NavigationRouteContext);
  const id = (route?.params as { id?: string } | undefined)?.id;
  // Read once: the entry is dropped when answered, while the sheet still shows as it slides away.
  const [input] = useState(() => actionWaiting(id));
  const stray = !input;
  const closing = useRef(false);

  useEffect(() => {
    if (!navigation) return;
    if (stray) {
      navigation.goBack();
      return;
    }
    return navigation.addListener("beforeRemove", () => answerAction(id, null));
  }, [navigation, id, stray]);

  if (!input) return null;
  return (
    <ActionSheet
      {...input}
      onChoose={(key) => {
        if (closing.current) return;
        closing.current = true;
        answerAction(id, key);
        navigation?.goBack();
      }}
    />
  );
}
