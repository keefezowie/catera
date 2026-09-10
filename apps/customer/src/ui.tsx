import { useState, type ReactNode } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  errors,
  statusLabel,
  type Offer,
  currency,
  mealLabel,
} from "@catera/domain";
import { useNative, apiBase } from "./context";
import { colors } from "@catera/design-tokens";
export const C = {
  forest: colors.forest,
  cream: colors.cream,
  ink: colors.charcoal,
  muted: colors.muted,
  line: colors.line,
  soft: colors.sage,
  orange: colors.sunrise,
};
export function Txt({
  children,
  kind = "body",
  style,
}: {
  children: ReactNode;
  kind?: "title" | "heading" | "body" | "small" | "label";
  style?: object;
}) {
  return <Text style={[styles.text, styles[kind], style]}>{children}</Text>;
}
export function Screen({
  children,
  title,
  refresh,
}: {
  children: ReactNode;
  title?: string;
  refresh?: () => void;
}) {
  const { demo } = useNative();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.page}
          refreshControl={
            refresh ? (
              <RefreshControl
                refreshing={false}
                onRefresh={refresh}
                tintColor={C.forest}
              />
            ) : undefined
          }
        >
          {demo && (
            <Txt kind="small" style={styles.demo}>
              Demo sintetis · Tidak ada transaksi uang
            </Txt>
          )}
          {title && <Txt kind="title">{title}</Txt>}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Btn({
  label,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.45 },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={19}
          color={secondary ? C.forest : C.cream}
        />
      )}
      <Txt
        style={{
          color: secondary ? C.forest : C.cream,
          fontWeight: "700",
          textAlign: "center",
          fontSize: 13,
        }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
export function Run({
  label,
  action,
  secondary = false,
}: {
  label: string;
  action: () => Promise<unknown>;
  secondary?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  return (
    <View style={styles.stack}>
      {error ? <Txt style={styles.error}>{error}</Txt> : null}
      {success ? <Txt kind="small">Perubahan tersimpan.</Txt> : null}
      <Btn
        label={busy ? "Memproses…" : label}
        disabled={busy}
        secondary={secondary}
        onPress={async () => {
          setBusy(true);
          setError("");
          setSuccess(false);
          try {
            await action();
            setSuccess(true);
          } catch (e) {
            setError(errors[(e as Error).message] || (e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}
export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.stack}>
      <Txt kind="label">{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#757B6E"
        style={[
          styles.input,
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
        {...props}
      />
    </View>
  );
}
export function Select({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.stack}>
      <Txt kind="label">{label}</Txt>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {options.map((o) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: value === o.value }}
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.chip, value === o.value && styles.selectedChip]}
          >
            <Txt
              kind="small"
              style={{ color: value === o.value ? C.cream : C.forest }}
            >
              {o.label}
            </Txt>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
export function DayPicker({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.stack}>
      <Txt kind="label">{label}</Txt>
      <Btn
        secondary
        icon="calendar-outline"
        label={new Date(value + "T12:00:00").toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        onPress={() => setOpen(true)}
      />
      {open && (
        <DateTimePicker
          value={new Date(value + "T12:00:00")}
          minimumDate={min ? new Date(min + "T00:00:00") : undefined}
          mode="date"
          onChange={(event, date) => {
            setOpen(Platform.OS === "ios");
            if (event.type !== "dismissed" && date)
              onChange(
                date.getFullYear() +
                  "-" +
                  String(date.getMonth() + 1).padStart(2, "0") +
                  "-" +
                  String(date.getDate()).padStart(2, "0"),
              );
          }}
        />
      )}
      {open && Platform.OS === "ios" && (
        <Btn secondary label="Selesai" onPress={() => setOpen(false)} />
      )}
    </View>
  );
}
export function Qty({
  value,
  onChange,
  max = 100,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <View style={[styles.row, { justifyContent: "space-between" }]}>
      <Txt kind="label">Porsi setiap hari</Txt>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kurangi porsi"
          onPress={() => onChange(Math.max(1, value - 1))}
          style={styles.qty}
        >
          <Ionicons name="remove" size={19} color={C.forest} />
        </Pressable>
        <Txt kind="heading">{value}</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tambah porsi"
          onPress={() => onChange(Math.min(max, value + 1))}
          style={styles.qty}
        >
          <Ionicons name="add" size={19} color={C.forest} />
        </Pressable>
      </View>
    </View>
  );
}
export const Photo = ({
  src,
  height = 200,
}: {
  src: string;
  height?: number;
}) => (
  <Image
    accessibilityIgnoresInvertColors
    source={{ uri: src.startsWith("/") ? apiBase + src : src }}
    style={{ height, width: "100%", borderRadius: 12 }}
    resizeMode="cover"
  />
);
export function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <View>
      {rows.map(([label, value]) => (
        <View style={styles.fact} key={label}>
          <Txt kind="small" style={{ flex: 1, color: C.muted }}>
            {label}
          </Txt>
          <Txt
            kind="small"
            style={{ flex: 1, textAlign: "right", fontWeight: "700" }}
          >
            {value}
          </Txt>
        </View>
      ))}
    </View>
  );
}
export function Status({ status }: { status: string }) {
  return (
    <Txt kind="small" style={styles.status}>
      {statusLabel(status)}
    </Txt>
  );
}
export function Empty({
  title = "Belum ada makanan di sini.",
  body = "Temukan paket untuk keseharianmu.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <View style={styles.empty}>
      <Image
        source={require("../../../packages/brand/assets/empty-calendar.png")}
        style={{ width: 145, height: 145 }}
        resizeMode="contain"
      />
      <Txt kind="heading">{title}</Txt>
      <Txt style={{ textAlign: "center" }}>{body}</Txt>
    </View>
  );
}
export function Gate({ children }: { children: ReactNode }) {
  const { actor, ready, error, refresh } = useNative();
  if (!ready)
    return <ActivityIndicator style={{ margin: 80 }} color={C.forest} />;
  if (error)
    return (
      <Screen title="Belum dapat terhubung">
        <Txt>{error}</Txt>
        <Run label="Coba lagi" action={refresh} />
      </Screen>
    );
  if (!actor)
    return (
      <Screen title="Makanan favorit, dalam satu tempat.">
        <Empty
          title="Masuk untuk melihat makananmu."
          body="Jadwal, pesan, dan semua katerermu terhubung dalam satu akun."
        />
        <Btn label="Masuk / Daftar" onPress={() => router.push("/login")} />
        <Btn
          secondary
          label="Jelajah dulu"
          onPress={() => router.push("/discover")}
        />
      </Screen>
    );
  return children;
}
export function OfferCard({ offer: o }: { offer: Offer }) {
  const { compare, toggleCompare, area, locale } = useNative();
  return (
    <View style={styles.offer}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={o.name}
        onPress={() => router.push(("/package/" + o.id) as never)}
      >
        <Photo src={o.image} />
      </Pressable>
      <View style={styles.offerBody}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Txt kind="small" style={{ color: C.muted }}>
            {o.caterer}
          </Txt>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: compare.includes(o.id) }}
            accessibilityLabel={"Bandingkan " + o.name}
            onPress={() => toggleCompare(o.id)}
            style={styles.qty}
          >
            <Ionicons
              name={compare.includes(o.id) ? "checkmark" : "add"}
              size={20}
              color={C.forest}
            />
          </Pressable>
        </View>
        <Txt kind="heading">{o.name}</Txt>
        <Txt kind="small">
          {mealLabel(o.meal, locale)} · {o.days} hari ·{" "}
          {o.flexible ? "Fleksibel" : "Tetap"}
        </Txt>
        <Txt kind="small">
          {o.trialPrice ? "Bisa coba 1 hari · " : ""}
          {o.tags.join(" · ")}
        </Txt>
        <View
          style={[
            styles.row,
            { justifyContent: "space-between", marginTop: 10 },
          ]}
        >
          <View>
            <Txt kind="heading">{currency(o.price)}</Txt>
            <Txt kind="small">
              / porsi / hari{o.meal === "both" ? " · 2 kali makan" : ""}
            </Txt>
          </View>
          <Btn
            label="Lihat paket"
            secondary
            onPress={() => router.push(("/package/" + o.id) as never)}
          />
        </View>
        <Txt
          kind="small"
          style={{
            color: area && !o.areas.includes(area) ? "#915022" : C.muted,
            marginTop: 9,
          }}
        >
          {area && !o.areas.includes(area)
            ? "Di luar area pengantaran"
            : "Pengantaran termasuk"}
        </Txt>
      </View>
    </View>
  );
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FDFAF3" },
  page: {
    padding: 22,
    paddingBottom: 45,
    gap: 22,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  text: { fontFamily: "Jakarta", color: C.ink, lineHeight: 23 },
  title: {
    fontSize: 30,
    lineHeight: 39,
    fontWeight: "700",
    color: C.forest,
    letterSpacing: -0.8,
  },
  heading: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "700",
    color: C.forest,
    letterSpacing: -0.4,
  },
  body: { fontSize: 14 },
  small: { fontSize: 11, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "700", color: C.forest },
  button: {
    minHeight: 48,
    paddingHorizontal: 17,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#C9D2BE",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  stack: { gap: 9 },
  panel: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    backgroundColor: "#FFFEF9",
    padding: 21,
    gap: 18,
  },
  input: {
    fontFamily: "Jakarta",
    fontSize: 14,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#C9D2BE",
    borderRadius: 9,
    padding: 13,
    color: C.ink,
    backgroundColor: "#FFFEF9",
  },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingVertical: 13,
    paddingHorizontal: 15,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  selectedChip: { backgroundColor: C.forest, borderColor: C.forest },
  qty: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.soft,
    borderRadius: 8,
  },
  fact: {
    flexDirection: "row",
    gap: 24,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  status: {
    alignSelf: "flex-start",
    backgroundColor: C.soft,
    color: C.forest,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
  },
  empty: { alignItems: "center", padding: 18, gap: 14 },
  error: {
    backgroundColor: "#FDECE3",
    color: "#8A3928",
    padding: 15,
    borderRadius: 8,
    fontSize: 12,
  },
  demo: {
    backgroundColor: C.soft,
    color: "#506445",
    padding: 7,
    textAlign: "center",
    fontSize: 9,
    borderRadius: 5,
  },
  offer: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#FFFEF9",
  },
  offerBody: { padding: 19, gap: 7 },
});
