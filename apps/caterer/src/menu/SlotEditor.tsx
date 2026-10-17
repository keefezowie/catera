import { useState } from "react";
import { TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useMobile } from "@catera/mobile-core";
import { selectLibraryDish, type ComponentGroup, type Dish, type LibraryDish } from "@catera/domain";
import {
  Button,
  FONT,
  fontFor,
  PressableRow,
  PressableScale,
  Text,
  useColors,
  useListMotion,
  type RowMotion,
} from "@catera/mobile-ui";
import { dayComplete, suggestDishes } from "./logic";

/**
 * One day's menu: a line per category with exactly the package's dish count.
 * Typing suggests dishes already used; a new name becomes a dish quietly.
 */
export function SlotEditor({
  composition,
  items,
  library,
  usage,
  onChange,
  onCreate,
  onSave,
  saving,
  canEdit,
}: {
  composition: ComponentGroup[];
  items: Dish[];
  library: LibraryDish[];
  usage: Map<string, number>;
  onChange: (items: Dish[]) => void;
  onCreate: (name: string, categoryId: string | undefined) => Promise<LibraryDish>;
  onSave: () => void;
  saving: boolean;
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
    <View style={{ gap: 18 }}>
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
        <Text variant="caption" style={{ textAlign: "center" }}>
          {t(
            `Paket ini berisi ${composition.map((g) => `${g.slots} ${g.name.toLowerCase()}`).join(", ")}. Lengkapi ${missing} lagi.`,
            `This package holds ${composition.map((g) => `${g.slots} ${g.name.toLowerCase()}`).join(", ")}. ${missing} more to go.`,
          )}
        </Text>
      ) : null}
      {canEdit ? (
        <Button label={t("Simpan menu", "Save menu")} busy={saving} disabled={!complete} onPress={onSave} />
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
  const c = useColors();
  const [query, setQuery] = useState("");
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

  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" style={{ color: c.charcoal }}>
        {`${group.name} · ${filled.length} dari ${group.slots}`}
      </Text>
      {filled.map((i) => (
        <Animated.View key={i.id} testID="menu-slot-row" {...rowMotion(i.id)}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              minHeight: 48,
              paddingLeft: 14,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: 10,
              backgroundColor: c.surface,
            }}
          >
            <Text style={{ flex: 1 }}>{i.name}</Text>
            {canEdit ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Hapus ${i.name}`}
                onPress={() => onChange(items.filter((x) => x.id !== i.id))}
                style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: c.muted, fontSize: 18 }}>×</Text>
              </PressableScale>
            ) : null}
          </View>
        </Animated.View>
      ))}
      {open && canEdit ? (
        <View style={{ gap: 6 }}>
          <TextInput
            accessibilityLabel={`${group.name} berikutnya`}
            value={query}
            onChangeText={setQuery}
            placeholder={`Ketik nama ${group.name.toLowerCase()}…`}
            placeholderTextColor={c.muted}
            style={{
              minHeight: 48,
              borderWidth: 1,
              borderColor: c.fieldBorder,
              borderRadius: 10,
              paddingHorizontal: 14,
              fontFamily: FONT,
              fontSize: 15,
              // The platform default ink is near black, which vanishes on the dark surface.
              color: c.charcoal,
              backgroundColor: c.surface,
            }}
          />
          {query.trim() ? (
            <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: c.surface }}>
              {suggestions.map((d) => (
                <PressableRow
                  key={d.id}
                  accessibilityRole="button"
                  onPress={() => add(d)}
                  style={{ minHeight: 48, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}
                >
                  <Text style={{ flex: 1 }}>{d.name}</Text>
                  <Text variant="caption">{`dipakai ${usage.get(d.id) ?? 0}×`}</Text>
                </PressableRow>
              ))}
              <PressableRow
                accessibilityRole="button"
                onPress={() => void onCreate(query.trim(), group.categoryId).then(add)}
                style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: "center", borderTopWidth: 1, borderTopColor: c.line }}
              >
                <Text style={{ fontFamily: fontFor("700") }}>{`+ Buat hidangan baru “${query.trim()}”`}</Text>
              </PressableRow>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
