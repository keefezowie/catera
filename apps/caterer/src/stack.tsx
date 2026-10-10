import { useMemo } from "react";
import type { Stack } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { AppHeader, useColors } from "@catera/mobile-ui";

type StackOptions = NonNullable<React.ComponentProps<typeof Stack>["screenOptions"]>;

/**
 * One header for every pushed screen, in the root stack and in each tab's stack: round back (or close, for a modal)
 * button and a heading.
 */
export function useStackScreenOptions(): StackOptions {
  const { t } = useMobile();
  const palette = useColors();
  return useMemo<StackOptions>(
    () => ({
      header: ({ options, navigation, back }) => (
        <AppHeader
          title={String(options.title ?? "")}
          onBack={back && options.headerBackVisible !== false ? navigation.goBack : undefined}
          modal={options.presentation === "modal"}
          backLabel={options.presentation === "modal" ? t("Tutup", "Close") : t("Kembali", "Back")}
        />
      ),
      contentStyle: { backgroundColor: palette.canvas },
    }),
    [t, palette.canvas],
  );
}
