import { PackagePreview } from "./package-preview";
import {
  menuSummary,
  packageTypeLabel,
  nutritionSummary,
} from "@catera/domain";
import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { MascotLoading } from "./mascot-loading";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  RefreshControl,
  AccessibilityInfo,
  findNodeHandle,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  errorLabel,
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
  scrollRef,
}: {
  children: ReactNode;
  title?: string;
  refresh?: () => void;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const { demo, t } = useNative();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
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
              {t(
                "Demo sintetis · Tidak ada transaksi uang",
                "Synthetic demo · No money transactions",
              )}
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
  successMessage,
}: {
  label: string;
  action: () => Promise<unknown>;
  secondary?: boolean;
  successMessage?: string;
}) {
  const { t, locale } = useNative();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  return (
    <View style={styles.stack}>
      {error ? (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Txt style={styles.error}>{error}</Txt>
        </View>
      ) : null}
      {success && successMessage !== "" ? (
        <Txt kind="small">
          {successMessage ?? t("Perubahan tersimpan.", "Changes saved.")}
        </Txt>
      ) : null}
      <Btn
        label={busy ? t("Memproses…", "Processing…") : label}
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
            const code = (e as Error).message;
            setError(
              code === "INVALID_CREDENTIALS"
                ? t(
                    "Email atau kata sandi tidak cocok. Coba lagi.",
                    "Email or password is incorrect. Try again.",
                  )
                : code === "AUTH_RATE_LIMITED"
                  ? t(
                      "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
                      "Too many attempts. Wait a moment and try again.",
                    )
                  : errorLabel(code, locale) || code,
            );
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
        placeholderTextColor={C.muted}
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
  const [open, setOpen] = useState(false);
  const { t } = useNative();
  const trigger = useRef<View>(null);
  const heading = useRef<View>(null);
  function focus(target: View | null) {
    const handle = target && findNodeHandle(target);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }
  function close() {
    setOpen(false);
    requestAnimationFrame(() => focus(trigger.current));
  }
  const selected =
    options.find((o) => o.value === value)?.label ||
    t("Pilih opsi", "Choose an option");
  return (
    <View style={styles.stack}>
      <Txt kind="label">{label}</Txt>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected }}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={styles.nativeSelectTrigger}
      >
        <Txt style={{ flex: 1 }}>{selected}</Txt>
        <Ionicons name="chevron-down" size={17} color={C.forest} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="none"
        onShow={() => focus(heading.current)}
        onDismiss={() => focus(trigger.current)}
        onRequestClose={close}
      >
        <SafeAreaView style={styles.selectBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessible={false}
            onPress={close}
          />
          <View
            style={styles.selectSheet}
            accessibilityViewIsModal
            onAccessibilityEscape={close}
          >
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <View
                ref={heading}
                accessible
                accessibilityRole="header"
                accessibilityLabel={label}
                style={{ flex: 1 }}
              >
                <Txt kind="heading">{label}</Txt>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Tutup pilihan", "Close options")}
                onPress={close}
                style={styles.qty}
              >
                <Ionicons name="close" size={22} color={C.forest} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8 }}
            >
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: value === o.value }}
                  onPress={() => {
                    onChange(o.value);
                    close();
                  }}
                  style={[
                    styles.nativeOption,
                    value === o.value && styles.nativeOptionSelected,
                  ]}
                >
                  <Txt style={{ flex: 1 }}>{o.label}</Txt>
                  {value === o.value && (
                    <Ionicons name="checkmark" size={19} color={C.forest} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
export function LanguageSelect() {
  const { locale, setLocale, t } = useNative();
  return (
    <Select
      label={t("Bahasa", "Language")}
      value={locale}
      onChange={(value) => setLocale(value as "id" | "en")}
      options={[
        { value: "id", label: "Bahasa Indonesia" },
        { value: "en", label: "English" },
      ]}
    />
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
  const { locale, t } = useNative();
  return (
    <View style={styles.stack}>
      <Txt kind="label">{label}</Txt>
      <Btn
        secondary
        icon="calendar-outline"
        label={new Date(value + "T12:00:00").toLocaleDateString(locale === "id" ? "id-ID" : "en-GB", {
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
        <Btn
          secondary
          label={t("Selesai", "Done")}
          onPress={() => setOpen(false)}
        />
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
  const { t } = useNative();
  return (
    <View style={[styles.row, { justifyContent: "space-between" }]}>
      <Txt kind="label">{t("Porsi setiap hari", "Portions per day")}</Txt>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Kurangi porsi", "Decrease portions")}
          onPress={() => onChange(Math.max(1, value - 1))}
          style={styles.qty}
        >
          <Ionicons name="remove" size={19} color={C.forest} />
        </Pressable>
        <Txt kind="heading">{value}</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Tambah porsi", "Increase portions")}
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
  const { locale } = useNative();
  return (
    <Txt kind="small" style={styles.status}>
      {statusLabel(status, locale)}
    </Txt>
  );
}
export function Empty({
  title,
  body,
}: {
  title?: string;
  body?: string;
}) {
  const { t } = useNative();
  return (
    <View style={styles.empty}>
      <Image
        source={require("../../../packages/brand/assets/empty-calendar.png")}
        style={{ width: 145, height: 145 }}
        resizeMode="contain"
      />
      <Txt kind="heading">
        {title || t("Belum ada makanan di sini.", "No meals here yet.")}
      </Txt>
      <Txt style={{ textAlign: "center" }}>
        {body || t("Temukan paket untuk keseharianmu.", "Find a package for your everyday routine.")}
      </Txt>
    </View>
  );
}
export function Gate({ children }: { children: ReactNode }) {
  const { actor, ready, error, refresh, t } = useNative();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  if (!ready)
    return (
      <MascotLoading
        active={focused}
        label={t(
          "Menyiapkan Catera untuk Anda…",
          "Getting Catera ready for you…",
        )}
      />
    );
  if (error)
    return (
      <Screen title={t("Belum dapat terhubung", "Could not connect")}>
        <Txt>{error}</Txt>
        <Run label={t("Coba lagi", "Try again")} action={refresh} />
      </Screen>
    );
  if (!actor)
    return (
      <Screen title={t("Makanan favorit, dalam satu tempat.", "Favorite meals, all in one place.")}>
        <Empty
          title={t("Masuk untuk melihat makananmu.", "Sign in to see your meals.")}
          body={t(
            "Jadwal, pesan, dan semua katerermu terhubung dalam satu akun.",
            "Your schedule, messages, and caterers in one account.",
          )}
        />
        <Btn
          label={t("Masuk / Daftar", "Sign in / Sign up")}
          onPress={() => router.push("/login")}
        />
        <Btn
          secondary
          label={t("Jelajah dulu", "Browse first")}
          onPress={() => router.push("/discover")}
        />
      </Screen>
    );
  return children;
}
export function OfferCard({ offer: o }: { offer: Offer }) {
  const { compare, toggleCompare, area, locale, t } = useNative();
  const [meal, setMeal] = useState("lunch");
  const compared = compare.includes(o.id);
  const outside = !!area && !o.areas.includes(area);
  const open = () => router.push(("/package/" + o.id) as never);
  return (
    <View style={styles.offer}>
      <View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={o.name}
          onPress={open}
        >
          <Photo src={o.image} />
        </Pressable>
        {!!o.trialPrice && (
          <View
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              backgroundColor: C.cream,
              borderRadius: 7,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Txt style={{ color: C.forest, fontSize: 12 }}>
              {t("Bisa coba dulu", "Trial available")}
            </Txt>
          </View>
        )}
      </View>
      <View style={[styles.offerBody, { gap: 20 }]}>
        <View style={{ gap: 5 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Txt
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: "600",
                color: C.forest,
              }}
            >
              {o.caterer}
            </Txt>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              {!!o.rating && (
                <Ionicons name="star" size={13} color={C.forest} />
              )}
              <Txt style={{ fontSize: 12 }}>
                {o.rating || t("Baru", "New")}
                {o.reviewCount > 0 ? " (" + o.reviewCount + ")" : ""}
              </Txt>
            </View>
          </View>
          <Pressable accessibilityRole="link" onPress={open}>
            <Txt
              style={{
                fontSize: 21,
                lineHeight: 28,
                fontWeight: "700",
                color: C.forest,
              }}
            >
              {o.name}
            </Txt>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
          <View style={{ minWidth: 48 }}>
            <Txt
              style={{
                fontSize: 28,
                lineHeight: 34,
                fontWeight: "700",
                color: C.forest,
              }}
            >
              {o.days}
            </Txt>
            <Txt style={{ fontSize: 13 }}>{t("hari", "days")}</Txt>
          </View>
          <View
            style={{
              flex: 1,
              gap: 5,
              borderLeftWidth: 1,
              borderLeftColor: C.line,
              paddingLeft: 16,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
            >
              <Ionicons
                name={o.meal === "dinner" ? "moon-outline" : "sunny-outline"}
                size={16}
                color={C.forest}
              />
              <Txt style={{ flex: 1, fontSize: 13 }}>
                {mealLabel(o.meal, locale)}
              </Txt>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
            >
              <Ionicons name="calendar-outline" size={16} color={C.forest} />
              <Txt style={{ flex: 1, fontSize: 13 }}>
                {o.flexible
                  ? t("Jadwal fleksibel", "Flexible schedule")
                  : t("Jadwal tetap", "Fixed schedule")}
              </Txt>
            </View>
          </View>
        </View>
        <PackagePreview offer={o} meal={meal} onMealChange={setMeal} />
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: C.line,
            paddingTop: 18,
            gap: 7,
          }}
        >
          <Txt
            style={{
              fontSize: 25,
              lineHeight: 32,
              fontWeight: "700",
              color: C.forest,
            }}
          >
            {currency(o.price, locale)}
          </Txt>
          <Txt style={{ fontSize: 12, color: C.muted }}>
            {t("/ porsi / hari", "/ portion / day")}
            {o.meal === "both" ? t(" · 2 kali makan", " · 2 meals") : ""}
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Ionicons name="car-outline" size={16} color={C.muted} />
            <Txt
              style={{
                flex: 1,
                fontSize: 12,
                color: outside ? "#915022" : C.muted,
              }}
            >
              {outside
                ? t("Di luar area pengantaran", "Outside delivery area")
                : t("Pengantaran termasuk", "Delivery included")}
            </Txt>
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 8,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: compared }}
              onPress={() => toggleCompare(o.id)}
              style={{
                minHeight: 44,
                paddingHorizontal: 12,
                justifyContent: "center",
                backgroundColor: compared ? C.soft : "transparent",
                borderWidth: 1,
                borderColor: compared ? C.forest : C.line,
                borderRadius: 9,
              }}
            >
              <Txt style={{ fontSize: 13 }}>
                {compared
                  ? t("Dibandingkan", "Comparing")
                  : t("Bandingkan", "Compare")}
              </Txt>
            </Pressable>
            <Btn label={t("Lihat paket", "View package")} onPress={open} />
          </View>
        </View>
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
  nativeSelectTrigger: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFEF9",
  },
  selectBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,38,28,0.35)",
    justifyContent: "center",
    padding: 22,
  },
  selectSheet: {
    backgroundColor: C.cream,
    borderRadius: 16,
    padding: 18,
    gap: 8,
    maxHeight: "82%",
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    flexShrink: 1,
  },
  nativeOption: {
    minHeight: 48,
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  nativeOptionSelected: { backgroundColor: C.soft },
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
