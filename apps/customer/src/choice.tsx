import { use, useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { NavigationContext, NavigationRouteContext } from "expo-router/react-navigation";
import { useMobile } from "@catera/mobile-core";
import { Button, ChoiceList, SheetFitBody, SheetHeader } from "@catera/mobile-ui";

/**
 * Choice sheets opened over a screen whose state they change (Beli's delivery address and start date). They are routes
 * (`/pembelian/alamat-pilih`, `/pembelian/mulai`, `sheetOptions({ detents: "fit" })`), and a route cannot take the
 * screen's state as a param, so the question waits here under the id the route reads from `?id=`, the way `useConfirm`
 * parks its question. Each question is answered once: a choice, a swipe down, the hardware back or Close wins.
 */

export type ChoiceItem = { id: string; label: string; detail?: string };

export type ChoiceInput = {
  title: string;
  items: ChoiceItem[];
  selected?: string | null;
  /**
   * A text button under the list ("Kelola alamat"); choosing it answers `extra.key`. With `href`, the sheet itself opens
   * that screen in its own place (one stack change), so the next screen is never presented while the sheet is still
   * sliding away; the asker then opens nothing.
   */
  extra?: { key: string; label: string; href?: string };
};

type Waiting = { input: ChoiceInput; answer: (result: string | null) => void };

const waiting = new Map<string, Waiting>();
let nextId = 0;

/** Asks a choice sheet at `pathname` and resolves the chosen item's id (or `extra.key`), or null when it closes. */
export function useChoice(): (pathname: string, input: ChoiceInput) => Promise<string | null> {
  return useCallback(
    (pathname: string, input: ChoiceInput) =>
      new Promise<string | null>((resolve) => {
        nextId += 1;
        const id = `${nextId}`;
        waiting.set(id, {
          input,
          answer: (result) => {
            waiting.delete(id);
            resolve(result);
          },
        });
        try {
          router.push({ pathname, params: { id } } as never);
        } catch {
          waiting.get(id)?.answer(null);
        }
      }),
    [],
  );
}

const answer = (id: string | undefined, result: string | null) => {
  if (id) waiting.get(id)?.answer(result);
};

/**
 * The route of a choice sheet: the question `useChoice` parked under `?id=`, as the sheet title over a radio list.
 * A choice answers and closes at once. A route with nothing waiting (a stray or cold link: there is no purchase to
 * choose for) closes itself, to Beranda when nothing is under it.
 */
export function ChoiceRoute() {
  const { t } = useMobile();
  const navigation = use(NavigationContext);
  const route = use(NavigationRouteContext);
  const id = (route?.params as { id?: string } | undefined)?.id;
  // Read once: the entry is dropped when answered, while the sheet still shows as it slides away.
  const [input] = useState(() => (id ? waiting.get(id)?.input : undefined));
  const closing = useRef(false);

  useEffect(() => {
    if (!navigation) return;
    if (!input) {
      if (navigation.canGoBack()) navigation.goBack();
      else router.replace("/" as never);
      return;
    }
    return navigation.addListener("beforeRemove", () => answer(id, null));
  }, [navigation, id, input]);
  // Leaving without `beforeRemove` (the navigator unmounts) still answers null; a no-op once answered.
  useEffect(() => () => answer(id, null), [id]);

  if (!input) return null;
  const choose = (result: string, href?: string) => {
    if (closing.current) return;
    closing.current = true;
    answer(id, result);
    if (href) router.replace(href as never);
    else navigation?.goBack();
  };
  return (
    // A long list (a full address book, a larger font) scrolls under the fixed title row.
    <SheetFitBody header={<SheetHeader title={input.title} closeLabel={t("Tutup", "Close")} />}>
      <ChoiceList
        label={input.title}
        options={input.items.map((item) => ({ value: item.id, label: item.label, detail: item.detail }))}
        value={input.selected ?? null}
        onChange={choose}
      />
      {input.extra ? (
        <View style={{ paddingHorizontal: process.env.EXPO_OS === "ios" ? 20 : 24, paddingTop: 8 }}>
          <Button variant="secondary" label={input.extra.label} onPress={() => choose(input.extra!.key, input.extra!.href)} />
        </View>
      ) : null}
    </SheetFitBody>
  );
}
