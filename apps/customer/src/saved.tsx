import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { View, Pressable, AccessibilityInfo } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  errorLabel,
  type SavedPackages,
  type SavedPackageResult,
} from "@catera/domain";
import { useNative, nativeApi } from "./context";
import { nativeReturnPath } from "./auth";
import {
  Screen,
  Txt,
  Btn,
  Gate,
  Empty,
  OfferCard,
  Photo,
  C,
  styles,
} from "./ui";

type Intent = { packageId: string; nonce: string; createdAt: number };
const intentKey = "catera.save-intent";
const blank: SavedPackages = { packageIds: [], items: [], nextCursor: null };
type Value = SavedPackages & {
  ready: boolean;
  busy: string[];
  error: string;
  paging: boolean;
  intentError: Intent | null;
  refresh: () => Promise<void>;
  more: () => Promise<void>;
  resume: (nonce: string, retry?: boolean) => Promise<void>;
  cancelIntent: () => Promise<void>;
  set: (
    packageId: string,
    saved: boolean,
    returnPath: string,
  ) => Promise<boolean>;
};
const Context = createContext<Value>({
  ...blank,
  ready: false,
  busy: [],
  error: "",
  paging: false,
  intentError: null,
  refresh: async () => {},
  more: async () => {},
  resume: async () => {},
  cancelIntent: async () => {},
  set: async () => {
    throw new Error("NOT_CONFIGURED");
  },
});
export const useNativeSaved = () => useContext(Context);
export function NativeSavedProvider({ children }: { children: ReactNode }) {
  const { actor, revision } = useNative();
  const [state, setState] = useState({
    ...blank,
    owner: "",
    ready: false,
    error: "",
  });
  const [busyState, setBusy] = useState({ owner: "", ids: [] as string[] });
  const [paging, setPaging] = useState(false),
    [intentError, setIntentError] = useState<Intent | null>(null);
  const owner = useRef(actor?.id);
  owner.current = actor?.id;
  const generation = useRef(0),
    requests = useRef(new Map<string, string>()),
    locks = useRef(new Set<string>());
  const attempts = useRef(new Set<string>());
  const current =
    state.owner === actor?.id ? state : { ...blank, ready: false, error: "" };
  const refresh = useCallback(async () => {
    if (!actor) return;
    const identity = actor.id,
      version = ++generation.current;
    try {
      const result = await nativeApi.savedPackages();
      if (owner.current === identity && generation.current === version)
        setState({ ...result, owner: identity, ready: true, error: "" });
    } catch (error) {
      if (owner.current === identity && generation.current === version)
        setState((previous) => ({
          ...(previous.owner === identity
            ? previous
            : { ...blank, ready: false }),
          owner: identity,
          error: error instanceof Error ? error.message : "REQUEST_FAILED",
        }));
    }
  }, [actor?.id]);
  useEffect(() => {
    generation.current++;
    requests.current.clear();
    locks.current.clear();
    setIntentError(null);
    setBusy({ owner: actor?.id || "", ids: [] });
    if (!actor) setState({ ...blank, owner: "", ready: false, error: "" });
  }, [actor?.id]);
  useEffect(() => {
    void refresh();
  }, [actor?.id, revision, refresh]);
  const write = useCallback(
    async (packageId: string, saved: boolean, nonce?: string) => {
      if (!actor) throw new Error("UNAUTHORIZED");
      const identity = actor.id,
        hash = identity + ":" + packageId + ":" + saved;
      if (locks.current.has(hash)) return;
      locks.current.add(hash);
      const key = requests.current.get(hash) || nonce || Crypto.randomUUID();
      requests.current.set(hash, key);
      setBusy((previous) => ({
        owner: identity,
        ids: [...(previous.owner === identity ? previous.ids : []), packageId],
      }));
      try {
        const result = await nativeApi.command<SavedPackageResult>(
          "savedPackage.set",
          { packageId, saved },
          key,
        );
        if (owner.current !== identity) return;
        generation.current++;
        requests.current.delete(hash);
        setState((previous) =>
          previous.owner !== identity
            ? previous
            : {
                ...previous,
                error: "",
                packageIds: result.saved
                  ? [...new Set([...previous.packageIds, packageId])]
                  : previous.packageIds.filter((id) => id !== packageId),
                items: result.saved
                  ? previous.items
                  : previous.items.filter(
                      (item) => item.packageId !== packageId,
                    ),
              },
        );
        void refresh();
        return result;
      } finally {
        locks.current.delete(hash);
        if (owner.current === identity)
          setBusy((previous) => ({
            owner: identity,
            ids: previous.ids.filter((id) => id !== packageId),
          }));
      }
    },
    [actor?.id, refresh],
  );
  async function set(packageId: string, saved: boolean, returnPath: string) {
    if (!actor) {
      const intent: Intent = {
        packageId,
        nonce: Crypto.randomUUID(),
        createdAt: Date.now(),
      };
      await SecureStore.setItemAsync(intentKey, JSON.stringify(intent));
      const url = new URL(
        nativeReturnPath(returnPath),
        "https://catera.invalid",
      );
      url.searchParams.set("saveIntent", intent.nonce);
      router.push({
        pathname: "/login",
        params: { next: url.pathname + url.search },
      });
      return false;
    }
    return Boolean(await write(packageId, saved));
  }
  async function resume(nonce: string, retry = false) {
    if (
      !actor ||
      !current.ready ||
      (!retry && attempts.current.has(actor.id + nonce))
    )
      return;
    attempts.current.add(actor.id + nonce);
    let intent: Intent | null = null;
    try {
      intent = JSON.parse(
        (await SecureStore.getItemAsync(intentKey)) || "null",
      );
      if (
        !intent ||
        intent.nonce !== nonce ||
        Date.now() - intent.createdAt >= 86400000
      )
        return;
      if (!(await write(intent.packageId, true, intent.nonce))) return;
      await SecureStore.deleteItemAsync(intentKey);
      setIntentError(null);
    } catch {
      if (owner.current === actor.id && intent) setIntentError(intent);
    }
  }
  async function more() {
    if (!actor || !current.nextCursor || paging) return;
    const identity = actor.id,
      version = generation.current;
    setPaging(true);
    try {
      const result = await nativeApi.savedPackages(current.nextCursor);
      if (owner.current === identity && generation.current === version)
        setState((previous) => ({
          ...previous,
          ...result,
          error: "",
          items: [
            ...previous.items,
            ...result.items.filter(
              (item) =>
                !previous.items.some((old) => old.packageId === item.packageId),
            ),
          ],
        }));
    } catch (error) {
      if (owner.current === identity)
        setState((previous) => ({
          ...previous,
          error: error instanceof Error ? error.message : "REQUEST_FAILED",
        }));
    } finally {
      setPaging(false);
    }
  }
  return (
    <Context.Provider
      value={{
        ...current,
        refresh,
        more,
        set,
        resume,
        paging,
        intentError,
        cancelIntent: async () => {
          await SecureStore.deleteItemAsync(intentKey);
          setIntentError(null);
        },
        busy: busyState.owner === actor?.id ? busyState.ids : [],
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function NativeSaveButton({
  packageId,
  name,
  returnPath,
  compact = false,
}: {
  packageId: string;
  name: string;
  returnPath?: string;
  compact?: boolean;
}) {
  const { actor, t, locale } = useNative();
  const saved = useNativeSaved(),
    [error, setError] = useState("");
  const selected = saved.packageIds.includes(packageId),
    busy = saved.busy.includes(packageId);
  return (
    <View style={compact ? { flex: 1 } : { gap: 5 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          (selected
            ? t("Hapus dari tersimpan: ", "Remove from Saved: ")
            : t("Simpan paket: ", "Save package: ")) + name
        }
        accessibilityState={{
          selected,
          disabled: busy || (!!actor && !saved.ready && !saved.error),
        }}
        disabled={busy || (!!actor && !saved.ready && !saved.error)}
        style={[
          styles.button,
          styles.secondary,
          { paddingHorizontal: compact ? 5 : 17 },
          selected && { backgroundColor: C.soft },
        ]}
        onPress={async () => {
          setError("");
          try {
            if (actor && !saved.ready && saved.error) {
              await saved.refresh();
              return;
            }
            const confirmed = await saved.set(
              packageId,
              !selected,
              returnPath || "/package/" + packageId,
            );
            if (actor && confirmed)
              AccessibilityInfo.announceForAccessibility(
                selected
                  ? t("Paket dihapus.", "Package removed.")
                  : t("Paket disimpan.", "Package saved."),
              );
          } catch (error) {
            setError(
              errorLabel(
                error instanceof Error ? error.message : "REQUEST_FAILED",
                locale,
              ) ||
                t(
                  "Paket belum berhasil diperbarui. Coba lagi.",
                  "Saved could not be updated. Try again.",
                ),
            );
          }
        }}
      >
        <Txt
          style={{
            fontSize: 13,
            textAlign: "center",
            color: C.forest,
            fontWeight: "700",
          }}
        >
          {busy
            ? t("Menyimpan…", "Saving…")
            : actor && !saved.ready && saved.error
              ? t("Coba lagi", "Retry")
              : selected
                ? t("Tersimpan", "Saved")
                : t("Simpan", "Save")}
        </Txt>
      </Pressable>
      {error && (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Txt style={styles.error}>{error}</Txt>
        </View>
      )}
    </View>
  );
}
export function NativeSavedIntent() {
  const { saveIntent } = useLocalSearchParams<{ saveIntent?: string }>();
  const { actor, t } = useNative(),
    saved = useNativeSaved();
  useEffect(() => {
    if (saveIntent && saved.ready && actor) void saved.resume(saveIntent);
  }, [actor?.id, saved.ready, saveIntent]);
  if (!saved.intentError) return null;
  return (
    <View style={styles.stack} accessible accessibilityRole="alert">
      <Txt>
        {t("Paket belum berhasil disimpan.", "The package could not be saved.")}
      </Txt>
      <Btn
        label={t("Coba simpan lagi", "Retry saving")}
        disabled={saved.busy.length > 0}
        onPress={() => void saved.resume(saved.intentError!.nonce, true)}
      />
      <Btn
        secondary
        label={t("Batal", "Cancel")}
        onPress={() => void saved.cancelIntent()}
      />
    </View>
  );
}
export function SavedScreen() {
  const { t, locale } = useNative(),
    saved = useNativeSaved();
  useFocusEffect(
    useCallback(() => {
      void saved.refresh();
    }, [saved.refresh]),
  );
  return (
    <Gate next="/saved">
      <Screen
        title={t("Paket tersimpan", "Saved packages")}
        refresh={saved.refresh}
      >
        <Txt>
          {t(
            "Harga dan ketersediaan diperiksa saat checkout.",
            "Prices and availability are checked at checkout.",
          )}
        </Txt>
        {!saved.ready && !saved.error && <Txt>{t("Memuat…", "Loading…")}</Txt>}
        {saved.error && (
          <View accessible accessibilityRole="alert">
            <Txt style={styles.error}>
              {errorLabel(saved.error, locale) ||
                t(
                  "Paket tersimpan belum berhasil dimuat.",
                  "Saved packages could not be loaded.",
                )}
            </Txt>
            <Btn
              label={t("Coba lagi", "Retry")}
              onPress={() => void saved.refresh()}
            />
          </View>
        )}
        {saved.ready && !saved.items.length && (
          <Empty
            title={t("Belum ada paket tersimpan", "No saved packages yet")}
            body={t(
              "Simpan paket yang ingin Anda coba.",
              "Save a package you would like to try.",
            )}
          />
        )}
        {saved.items.map((item) =>
          item.offer ? (
            <OfferCard
              key={item.packageId}
              offer={item.offer}
              returnPath="/saved"
            />
          ) : (
            <View style={styles.offer} key={item.packageId}>
              <Photo src={item.summary.image} />
              <View style={styles.offerBody}>
                <Txt>{item.summary.caterer}</Txt>
                <Txt kind="heading">{item.summary.name}</Txt>
                <Txt>
                  {t(
                    "Tidak tersedia · Paket tidak menerima pesanan baru.",
                    "Unavailable · This package is not accepting new orders.",
                  )}
                </Txt>
                <NativeSaveButton
                  packageId={item.packageId}
                  name={item.summary.name}
                  returnPath="/saved"
                />
              </View>
            </View>
          ),
        )}
        {saved.nextCursor && (
          <Btn
            secondary
            label={
              saved.paging
                ? t("Memuat…", "Loading…")
                : t("Muat lainnya", "Load more")
            }
            disabled={saved.paging}
            onPress={() => void saved.more()}
          />
        )}
        <Btn
          secondary
          label={t("Jelajah paket", "Browse packages")}
          onPress={() => router.push("/discover")}
        />
      </Screen>
    </Gate>
  );
}
