import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { selectLibraryDish, type ComponentGroup, type Dish, type LibraryDish } from "@catera/domain";
import { Button, colors, FONT, Text } from "@catera/mobile-ui";
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
        />
      ))}
      {!complete && missing > 0 ? (
        <Text variant="caption" style={{ textAlign: "center" }}>
          {`Paket ini berisi ${composition.map((g) => `${g.slots} ${g.name.toLowerCase()}`).join(", ")}. Lengkapi ${missing} lagi.`}
        </Text>
      ) : null}
      {canEdit ? (
        <Button label="Simpan menu" disabled={!complete || saving} onPress={onSave} />
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
}: {
  group: ComponentGroup;
  items: Dish[];
  library: LibraryDish[];
  usage: Map<string, number>;
  canEdit: boolean;
  onChange: (items: Dish[]) => void;
  onCreate: (name: string, categoryId: string | undefined) => Promise<LibraryDish>;
}) {
  const [query, setQuery] = useState("");
  const filled = items.filter((i) => i.groupId === group.id);
  const open = filled.length < group.slots;
  const suggestions = query.trim() ? suggestDishes(library, group.categoryId, query, usage).slice(0, 4) : [];

  function add(dish: LibraryDish) {
    const position = filled.length + 1;
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
      <Text variant="label" style={{ color: open ? colors.sunriseInk : colors.forest }}>
        {`${group.name} · ${filled.length} dari ${group.slots}`}
      </Text>
      {filled.map((i) => (
        <View
          key={i.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: 48,
            paddingLeft: 14,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 10,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ flex: 1 }}>{i.name}</Text>
          {canEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Hapus ${i.name}`}
              onPress={() => onChange(items.filter((x) => x.id !== i.id))}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: colors.muted, fontSize: 18 }}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {open && canEdit ? (
        <View style={{ gap: 6 }}>
          <TextInput
            accessibilityLabel={`${group.name} berikutnya`}
            value={query}
            onChangeText={setQuery}
            placeholder={`Ketik nama ${group.name.toLowerCase()}…`}
            placeholderTextColor={colors.muted}
            style={{
              minHeight: 48,
              borderWidth: 1,
              borderColor: "#CFD3C6",
              borderRadius: 10,
              paddingHorizontal: 14,
              fontFamily: FONT,
              fontSize: 15,
              backgroundColor: colors.surface,
            }}
          />
          {query.trim() ? (
            <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface }}>
              {suggestions.map((d) => (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  onPress={() => add(d)}
                  style={{ minHeight: 44, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}
                >
                  <Text style={{ flex: 1 }}>{d.name}</Text>
                  <Text variant="caption">{`dipakai ${usage.get(d.id) ?? 0}×`}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => void onCreate(query.trim(), group.categoryId).then(add)}
                style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderTopWidth: 1, borderTopColor: colors.line }}
              >
                <Text style={{ fontWeight: "700" }}>{`+ Buat hidangan baru “${query.trim()}”`}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
