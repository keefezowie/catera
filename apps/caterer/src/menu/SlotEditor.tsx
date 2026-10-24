import { useState, type ReactNode } from "react";
import { TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { errorLabel, selectLibraryDish, type ComponentGroup, type Dish, type LibraryDish } from "@catera/domain";
import {
  DecorativeIcon,
  FONT,
  FormError,
  ListCard,
  PressableRow,
  PressableScale,
  SectionHeader,
  Text,
  useBusy,
  useColors,
  useListMotion,
  type RowMotion,
} from "@catera/mobile-ui";
import { dayComplete, suggestDishes } from "./logic";

/** One chosen dish, one input and one suggestion: every row of the editor is 48 tall. */
const ROW = 48;

/**
 * One day's menu: a section per category (its name, "n dari m", then a list card of 48 rows) with exactly the package's
 * dish count. Typing suggests dishes already used; a new name becomes a dish quietly. The save button is the screen's
 * pinned footer (`MenuDayScreen`), so the editor holds only the day's content.
 */
export function SlotEditor({
  composition,
  items,
  library,
  usage,
  onChange,
  onCreate,
  canEdit,
}: {
  composition: ComponentGroup[];
  items: Dish[];
  library: LibraryDish[];
  usage: Map<string, number>;
  onChange: (items: Dish[]) => void;
  onCreate: (name: string, categoryId: string | undefined) => Promise<LibraryDish>;
  canEdit: boolean;
}) {
  const { t } = useMobile();
  // A dish the caterer adds enters and one removed leaves, the rest moving; the day's first draw does not animate.
  const rowMotion = useListMotion(items.map((i) => i.id));
  const complete = dayComplete(composition, items);
  const missing = composition.reduce(
    (n, g) => n + Math.max(0, g.slots - items.filter((i) => i.groupId === g.id).length),
    0,
  );
  return (
    <View style={{ gap: nativeLayout.dense.sectionGap }}>
      {composition.map((group) => (
        <GroupLine
          key={group.id}
          group={group}
          items={items}
          library={library}
          usage={usage}
          canEdit={canEdit}
          onChange={onChange}
          onCreate={onCreate}
          rowMotion={rowMotion}
        />
      ))}
      {!complete && missing > 0 ? (
        <Text variant="meta" style={{ textAlign: "center" }}>
          {t(
            `Paket ini berisi ${composition.map((g) => `${g.slots} ${g.name.toLowerCase()}`).join(", ")}. Tambah ${missing} lagi.`,
            `This package holds ${composition.map((g) => `${g.slots} ${g.name.toLowerCase()}`).join(", ")}. ${missing} more to go.`,
          )}
        </Text>
      ) : null}
    </View>
  );
}

function GroupLine({
  group,
  items,
  library,
  usage,
  canEdit,
  onChange,
  onCreate,
  rowMotion,
}: {
  group: ComponentGroup;
  items: Dish[];
  library: LibraryDish[];
  usage: Map<string, number>;
  canEdit: boolean;
  onChange: (items: Dish[]) => void;
  onCreate: (name: string, categoryId: string | undefined) => Promise<LibraryDish>;
  rowMotion: (key: string) => RowMotion;
}) {
  const { t, locale } = useMobile();
  const c = useColors();
  const [query, setQuery] = useState("");
  const [createError, setCreateError] = useState<{ message: string; key: number } | null>(null);
  const filled = items.filter((i) => i.groupId === group.id);
  const open = filled.length < group.slots;
  const suggestions = query.trim() ? suggestDishes(library, group.categoryId, query, usage).slice(0, 4) : [];

  function add(dish: LibraryDish) {
    // The first free position: removing a dish frees its id for the next one.
    const taken = new Set(items.map((i) => i.id));
    let position = 1;
    while (taken.has(`${group.id}-${position}`)) position += 1;
    const slot: Dish = {
      id: `${group.id}-${position}`,
      name: "",
      description: "",
      image: "",
      serving: "",
      groupId: group.id,
      categoryId: group.categoryId,
    };
    onChange([...items, selectLibraryDish(slot, dish)]);
    setQuery("");
  }

  const [creating, create] = useBusy(async (name: string) => {
    setCreateError(null);
    try {
      add(await onCreate(name, group.categoryId));
    } catch (e) {
      setCreateError((f) => ({
        message:
          errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
          t("Hidangan belum tersimpan. Coba lagi.", "The dish was not saved. Try again."),
        key: (f?.key ?? 0) + 1,
      }));
    }
  });

  // The group's rows in one list card: the chosen dishes, then (while a slot is open) the input and its suggestions.
  const rows: ReactNode[] = filled.map((i) => (
    <Animated.View key={i.id} testID="menu-slot-row" {...rowMotion(i.id)}>
      <View testID="menu-slot-row-body" style={{ flexDirection: "row", alignItems: "center", minHeight: ROW }}>
        <Text variant="bodyL" style={{ flex: 1 }}>
          {i.name}
        </Text>
        {canEdit ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t(`Hapus ${i.name}`, `Remove ${i.name}`)}
            onPress={() => onChange(items.filter((x) => x.id !== i.id))}
            // The glyph is 18 in a 48 target that stays inside the row; it is held against the end (3 in) so it sits near the card's edge.
            style={{ width: ROW, height: ROW, paddingRight: 3, alignItems: "flex-end", justifyContent: "center" }}
          >
            <DecorativeIcon name="close" size={18} color={c.muted} />
          </PressableScale>
        ) : null}
      </View>
    </Animated.View>
  ));
  if (open && canEdit) {
    rows.push(
      <View key="input" style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: ROW }}>
        <DecorativeIcon name="search-outline" size={20} color={c.muted} />
        <TextInput
          accessibilityLabel={t(`Tambah ${group.name.toLowerCase()}`, `Add ${group.name.toLowerCase()}`)}
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setCreateError(null);
          }}
          placeholder={t(`Ketik nama ${group.name.toLowerCase()}…`, `Type a ${group.name.toLowerCase()} name…`)}
          placeholderTextColor={c.muted}
          style={{
            flex: 1,
            minHeight: ROW,
            padding: 0,
            fontFamily: FONT,
            fontSize: 15,
            lineHeight: 22,
            // The platform default ink is near black, which vanishes on the dark surface.
            color: c.charcoal,
          }}
        />
      </View>,
    );
    if (query.trim()) {
      for (const d of suggestions)
        rows.push(
          <PressableRow
            key={`suggest-${d.id}`}
            accessibilityRole="button"
            onPress={() => add(d)}
            style={{ minHeight: ROW, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <Text variant="bodyL" style={{ flex: 1 }}>
              {d.name}
            </Text>
            <Text variant="meta">{t(`dipakai ${usage.get(d.id) ?? 0} kali`, `used ${usage.get(d.id) ?? 0} ${usage.get(d.id) === 1 ? "time" : "times"}`)}</Text>
          </PressableRow>,
        );
      rows.push(
        <PressableRow
          key="create"
          accessibilityRole="button"
          disabled={creating}
          accessibilityState={{ busy: creating, disabled: creating }}
          onPress={() => void create(query.trim())}
          style={{ minHeight: ROW, justifyContent: "center", opacity: creating ? 0.5 : 1 }}
        >
          <Text variant="bodyStrong">{t(`+ Buat hidangan baru “${query.trim()}”`, `+ Create new dish “${query.trim()}”`)}</Text>
        </PressableRow>,
      );
    }
  }

  return (
    <View>
      <SectionHeader title={group.name} count={t(`${filled.length} dari ${group.slots}`, `${filled.length} of ${group.slots}`)} />
      {rows.length ? <ListCard inset={0}>{rows}</ListCard> : null}
      {createError ? <FormError message={createError.message} failureKey={createError.key} /> : null}
    </View>
  );
}
