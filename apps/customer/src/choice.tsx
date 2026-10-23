import { useCallback } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import {
  Button,
  ChoiceList,
  parkQuestion,
  SheetFitBody,
  SheetHeader,
  useQuestionRoute,
  type QuestionRegistry,
} from "@catera/mobile-ui";

/**
 * Choice sheets opened over a screen whose state they change (Beli's delivery address and start date). They are routes
 * (`/pembelian/alamat-pilih`, `/pembelian/mulai`, `sheetOptions({ detents: "fit" })`), and a route cannot take the
 * screen's state as a param, so the question waits under the id the route reads from `?id=`, through the same
 * `parkQuestion` and `useQuestionRoute` as `useConfirm`. Each question is answered once: a choice, a swipe down, the
 * hardware back or Close wins, and the answer comes once the sheet has gone.
 */

export type ChoiceItem = { id: string; label: string; detail?: string };

/**
 * A text button under the list ("Tambah alamat", "Kelola alamat"); choosing it answers `key`. With `href`, the sheet
 * itself opens that screen in its own place (one stack change), so the next screen is never presented while the sheet
 * is still sliding away; the asker then opens nothing.
 */
export type ChoiceExtra = { key: string; label: string; href?: string };

export type ChoiceInput = {
  title: string;
  items: ChoiceItem[];
  selected?: string | null;
  /** The buttons under the list, side by side and wrapping when they do not fit. */
  extras?: ChoiceExtra[];
  /** One button under the list; the same as a one-item `extras`, drawn before them. */
  extra?: ChoiceExtra;
};

const waiting: QuestionRegistry<ChoiceInput, string | null> = new Map();

/** Asks a choice sheet at `pathname` and resolves the chosen item's id (or an extra's `key`), or null when it closes. */
export function useChoice(): (pathname: string, input: ChoiceInput) => Promise<string | null> {
  return useCallback((pathname: string, input: ChoiceInput) => parkQuestion(waiting, pathname, input, null), []);
}

/**
 * The route of a choice sheet: the question `useChoice` parked under `?id=`, as the sheet title over a radio list.
 * A choice closes the sheet at once and answers once it has gone. A route with nothing waiting (a stray or cold link:
 * there is no purchase to choose for) closes itself, to Beranda when nothing is under it. `os` defaults to the running
 * platform.
 */
export function ChoiceRoute({ os }: { os?: string } = {}) {
  const { t } = useMobile();
  const { input, close } = useQuestionRoute(waiting, null, os);
  if (!input) return null;
  const choose = (result: string, href?: string) => close(result, href ? () => router.replace(href as never) : undefined);
  const extras = [...(input.extra ? [input.extra] : []), ...(input.extras ?? [])];
  return (
    // A long list (a full address book, a larger font) scrolls under the fixed title row.
    <SheetFitBody header={<SheetHeader title={input.title} closeLabel={t("Tutup", "Close")} />}>
      <ChoiceList
        label={input.title}
        options={input.items.map((item) => ({ value: item.id, label: item.label, detail: item.detail }))}
        value={input.selected ?? null}
        onChange={choose}
      />
      {extras.length ? (
        <View
          style={{
            paddingHorizontal: process.env.EXPO_OS === "ios" ? 20 : 24,
            paddingTop: 8,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {extras.map((x) => (
            // Two fit beside each other on a phone; at a larger font each takes the full width.
            <Button key={x.key} variant="secondary" label={x.label} onPress={() => choose(x.key, x.href)} style={{ flexGrow: 1, flexBasis: 140 }} />
          ))}
        </View>
      ) : null}
    </SheetFitBody>
  );
}
