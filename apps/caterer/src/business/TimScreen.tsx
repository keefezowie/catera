import { useState } from "react";
import { Share, View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { useData, useMobile } from "@catera/mobile-core";
import { useFormRun } from "../useFormRun";
import {
  Button,
  Card,
  FormError,
  ListCard,
  SheetFitBody,
  SheetHeader,
  sheetSidePadding,
  Text,
  TwoLineRow,
  useToast,
} from "@catera/mobile-ui";

/**
 * Whether the share sheet's answer proves the invite went out. iOS answers `sharedAction` only for a real share and
 * `dismissedAction` for a dismissal; Android answers `sharedAction` for every share, including one backed out of
 * (react-native `Share.js`), so there it proves nothing and the sheet makes no claim.
 */
export const inviteShared = (action: string, os = process.env.EXPO_OS) => os === "ios" && action === Share.sharedAction;

/**
 * Tim, a sheet over Usaha sized to its content: shows current kitchen team members and invites kitchen staff who see
 * Hari ini (including today's delivery contact) and Menu, never money or customer history.
 */
export function TimScreen() {
  const { runtime, actor, t, locale, command } = useMobile();
  const toast = useToast();
  const catererId = actor?.catererId ?? "";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  const staff = ops.data?.staff ?? [];
  const [code, setCode] = useState("");
  const { busy, failure, run } = useFormRun(
    locale,
    t("Undangan belum bisa dibuat. Coba lagi.", "Couldn't create the invite. Try again."),
  );
  // The sheet's own side padding, the same in both apps.
  const inset = sheetSidePadding();

  const invite = () =>
    run(async () => {
      const r = await command<{ code: string }>("staff.invite", { catererId: actor?.catererId });
      setCode(r.code);
      const shared = await Share.share({
        message: t(
          `Halo! Pasang aplikasi Catera Dapur, daftar lewat 'Gabung ke dapur', lalu masukkan kode undangan ini: ${r.code}`,
          `Hi! Install the Catera Dapur app, sign up through 'Join a kitchen', then enter this invite code: ${r.code}`,
        ),
      });
      if (inviteShared(shared.action))
        toast.show({ message: t("Undangan dibagikan", "Invite shared"), tone: "success" });
    });

  return (
    // At a larger font on a small phone the paragraph, the code and the button scroll under the fixed title row, so
    // Bagikan undangan is never cut off.
    <SheetFitBody
      testID="tim-sheet"
      header={<SheetHeader title={t("Undang staf dapur", "Invite kitchen staff")} closeLabel={t("Tutup", "Close")} />}
    >
      <View testID="tim-content" style={{ paddingHorizontal: inset, gap: 16 }}>
        <Text>
          {t(
            "Staf dapur bisa melihat daftar masak, rute antar hari ini dan menu. Uang dan daftar pelanggan tetap hanya untuk kamu.",
            "Kitchen staff see the cooking list, today's delivery route and menu. Money and customer lists stay with you.",
          )}
        </Text>
        {staff.length ? (
          <View testID="tim-members" style={{ gap: nativeLayout.space.sm }}>
            <Text variant="heading" accessibilityRole="header">
              {t(`Anggota tim (${staff.length})`, `Team members (${staff.length})`)}
            </Text>
            <ListCard inset={0}>
              {staff.map((m) => (
                <TwoLineRow
                  key={m.user_id}
                  title={m.name}
                  meta={m.role === "owner" ? t("Pemilik", "Owner") : t("Staf dapur", "Kitchen staff")}
                />
              ))}
            </ListCard>
          </View>
        ) : null}
        {code ? (
          <Card testID="tim-code" tone="sage" style={{ gap: 4 }}>
            <Text variant="meta">{t("Kode undangan", "Invite code")}</Text>
            <Text selectable variant="section" style={{ fontVariant: ["tabular-nums"] }}>
              {code}
            </Text>
            <Text variant="meta">{t("Satu kode untuk satu orang.", "One code per person.")}</Text>
          </Card>
        ) : null}
        {failure ? <FormError message={failure.message} failureKey={failure.key} /> : null}
        <Button label={t("Bagikan undangan", "Share invite")} busy={busy} onPress={() => void invite()} />
      </View>
    </SheetFitBody>
  );
}
