import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  addDays,
  localDay,
  mealLabel,
  availabilityReasonLabel,
  type Delivery,
  type Address,
} from "@catera/domain";
import { nativeApi, useData, useNative } from "./context";
import { PackageContents } from "./package-contents";
import {
  Btn,
  Empty,
  Facts,
  Gate,
  Panel,
  Photo,
  ResourceNotice,
  Run,
  Screen,
  Select,
  Status,
  Txt,
} from "./ui";

export function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actor } = useNative();
  return <DeliveryDetail key={`${actor?.id}:${id}`} id={id} />;
}
function DeliveryDetail({ id }: { id: string }) {
  const { actor, command, t, locale } = useNative();
  const state = useData("delivery:" + id, () =>
    actor ? nativeApi.customer("?deliveryId=" + id) : Promise.resolve(null),
  );
  const delivery = state.data?.deliveries.find((d) => d.id === id);
  const [source, setSource] = useState<Delivery | null>(null);
  const [action, setAction] = useState<"date" | "address" | "">("");
  const [intent, setIntent] = useState("reschedule");
  const [from, setFrom] = useState(localDay());
  const [target, setTarget] = useState("");
  const [addressId, setAddressId] = useState("");
  const [review, setReview] = useState(false);
  const [reviewAddress, setReviewAddress] = useState<Address | null>(null);
  const [now, setNow] = useState(Date.now());
  const availability = useData(
    "delivery-availability:" + id + ":" + action + ":" + from,
    () =>
      actor && action === "date"
        ? nativeApi.deliveryAvailability(id, from, addDays(from, 30))
        : Promise.resolve([]),
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const changed = !!source && source.version !== delivery?.version;
  const beforeCutoff =
    !!delivery && new Date(delivery.cutoff_at).getTime() > now;
  const dateAvailable = availability.data?.some(
    (d) => d.date === target && d.available,
  );
  const selectedAddress = state.data?.addresses.find((a) => a.id === addressId);
  const addressChanged =
    !!reviewAddress &&
    JSON.stringify(reviewAddress) !== JSON.stringify(selectedAddress);
  const safe =
    state.canWrite &&
    beforeCutoff &&
    !changed &&
    (action === "address"
      ? !!selectedAddress && !addressChanged
      : availability.canWrite && dateAvailable);
  function begin(kind: "date" | "address") {
    if (!delivery) return;
    setSource({ ...delivery });
    setAction(kind);
    setReview(false);
    setReviewAddress(null);
    setAddressId(delivery.address.id);
  }
  const d = delivery;
  return (
    <Gate next={"/delivery/" + id}>
      <Screen
        title={t("Pengantaran", "Delivery")}
        refresh={async () => {
          await Promise.all([state.reload(), availability.reload()]);
        }}
      >
        <ResourceNotice resource={state} />
        {state.data && !d && (
          <Empty
            title={t("Pengantaran tidak ditemukan", "Delivery not found")}
          />
        )}
        {d && (
          <>
            <Photo src={d.offer.image} height={180} />
            <Txt kind="heading">{d.offer.name}</Txt>
            <Txt>{d.offer.caterer}</Txt>
            {d.meals.map((m) => (
              <Panel key={m.meal}>
                <Txt kind="label">
                  {mealLabel(m.meal, locale)} ·{" "}
                  {d.offer.windows[m.meal as "lunch" | "dinner"]}
                </Txt>
                <Status status={m.status} />
              </Panel>
            ))}
            <Facts
              rows={[
                [t("Tanggal", "Date"), d.service_date],
                [t("Porsi tetap", "Fixed portions"), d.portions],
                [
                  t("Alamat", "Address"),
                  d.address.line + ", " + d.address.area,
                ],
                [t("Catatan", "Note"), d.address.instructions || "—"],
                [
                  t("Batas perubahan", "Change cutoff"),
                  new Date(d.cutoff_at).toLocaleString(
                    locale === "id" ? "id-ID" : "en-GB",
                    { timeZone: d.offer.timezone },
                  ) +
                    " · " +
                    d.offer.timezone,
                ],
              ]}
            />
            <PackageContents offer={d.offer} />
            {d.offer.menuSelectionMode === "customer" && (
              <Btn
                label={t("Lihat / pilih menu", "View / choose menu")}
                onPress={() =>
                  router.push(
                    `/subscriptions/${d.subscription_id}/menu?date=${d.service_date}&meal=${d.meals[0]?.meal || "lunch"}` as never,
                  )
                }
              />
            )}
            {!action && (
              <>
                {d.canChange && beforeCutoff && (
                  <Btn
                    label={t("Ganti tanggal", "Change date")}
                    disabled={!state.canWrite}
                    onPress={() => begin("date")}
                  />
                )}
                {d.status === "scheduled" && beforeCutoff && (
                  <Btn
                    secondary
                    label={t("Ubah alamat", "Change address")}
                    disabled={!state.canWrite}
                    onPress={() => begin("address")}
                  />
                )}
              </>
            )}
            {action && source && (
              <Panel>
                <Txt kind="heading">
                  {action === "date"
                    ? t("Tanggal pengganti", "Replacement date")
                    : t("Alamat pengganti", "Replacement address")}
                </Txt>
                {d.offer.meal === "both" && (
                  <Txt>
                    {t(
                      "Siang dan malam berpindah bersama, dengan alamat yang sama.",
                      "Lunch and dinner move together using the same address.",
                    )}
                  </Txt>
                )}
                {(changed || addressChanged) && (
                  <>
                    <Txt>
                      {t(
                        "Data berubah sejak dibuka. Pilihan Anda tetap ada. Muat versi terbaru sebelum meninjau ulang.",
                        "The details changed since opening. Your selection is retained. Load the latest version before reviewing again.",
                      )}
                    </Txt>
                    <Run
                      secondary
                      label={t("Gunakan versi terbaru", "Use latest version")}
                      successMessage=""
                      action={async () => {
                        setSource({ ...d });
                        setReview(false);
                        setReviewAddress(null);
                        await availability.reload();
                      }}
                    />
                  </>
                )}
                {!beforeCutoff && (
                  <Txt>
                    {t(
                      "Batas perubahan sudah lewat. Hubungi katerer untuk bantuan.",
                      "The change cutoff has passed. Contact the caterer for help.",
                    )}
                  </Txt>
                )}
                {!review &&
                  (action === "address" ? (
                    <>
                      <Select
                        label={t("Alamat tersimpan", "Saved address")}
                        value={addressId}
                        onChange={setAddressId}
                        options={(state.data?.addresses || [])
                          .filter((a) => d.offer.areas.includes(a.area))
                          .map((a) => ({
                            value: a.id,
                            label: a.label + " · " + a.area,
                          }))}
                      />
                      <Btn
                        secondary
                        label={t("Kelola alamat", "Manage addresses")}
                        onPress={() => router.push("/addresses")}
                      />
                    </>
                  ) : (
                    <>
                      <Select
                        label={t("Alasan perubahan", "Change reason")}
                        value={intent}
                        onChange={setIntent}
                        options={[
                          {
                            value: "reschedule",
                            label: t("Ganti tanggal", "Change date"),
                          },
                          {
                            value: "skip",
                            label: t(
                              "Lewati & pilih pengganti",
                              "Skip & choose a replacement",
                            ),
                          },
                        ]}
                      />
                      <ResourceNotice resource={availability} />
                      <Select
                        label={t("Tanggal tersedia", "Available dates")}
                        value={target}
                        onChange={setTarget}
                        options={(availability.data || [])
                          .filter((d) => d.available)
                          .map((d) => ({ value: d.date, label: d.date }))}
                      />
                      {availability.data &&
                        !availability.data.some((d) => d.available) && (
                          <Txt>
                            {t(
                              "Belum ada kapasitas pada rentang ini. Coba tanggal berikutnya.",
                              "No capacity in this period. Try later dates.",
                            )}
                          </Txt>
                        )}
                      {!!availability.data?.some((d) => !d.available) && (
                        <Txt kind="small">
                          {availability.data
                            .filter((d) => !d.available)
                            .map(
                              (d) =>
                                `${d.date}: ${availabilityReasonLabel(d.reason, locale)}`,
                            )
                            .join("\n")}
                        </Txt>
                      )}
                      <Btn
                        secondary
                        label={t(
                          "Lihat 31 hari berikutnya",
                          "See next 31 days",
                        )}
                        onPress={() => {
                          setFrom(addDays(from, 31));
                          setTarget("");
                        }}
                      />
                      {from > localDay() && (
                        <Btn
                          secondary
                          label={t(
                            "Kembali ke tanggal terdekat",
                            "Back to earliest dates",
                          )}
                          onPress={() => {
                            setFrom(localDay());
                            setTarget("");
                          }}
                        />
                      )}
                    </>
                  ))}
                {review && (
                  <Facts
                    rows={[
                      [
                        t("Tanggal semula", "Original date"),
                        source.service_date,
                      ],
                      [
                        t("Tanggal pengganti", "Replacement date"),
                        action === "date" ? target : source.service_date,
                      ],
                      [
                        t("Makanan", "Meal"),
                        mealLabel(source.offer.meal, locale),
                      ],
                      [t("Porsi tetap", "Fixed portions"), source.portions],
                      [
                        t("Alamat semula", "Original address"),
                        source.address.line + ", " + source.address.area,
                      ],
                      [
                        t("Alamat pengganti", "Replacement address"),
                        action === "address"
                          ? reviewAddress!.line + ", " + reviewAddress!.area
                          : source.address.line + ", " + source.address.area,
                      ],
                    ]}
                  />
                )}
                <Txt kind="small">
                  {t(
                    "Tanggal lama tetap aman sampai perubahan berhasil. Pengajuan pembatalan tidak menghapus jadwal.",
                    "Your original booking stays safe until the change succeeds. A cancellation request does not remove your schedule.",
                  )}
                </Txt>
                <Run
                  label={
                    review
                      ? t("Konfirmasi perubahan", "Confirm change")
                      : t("Tinjau perubahan", "Review change")
                  }
                  disabled={!safe}
                  successMessage=""
                  action={async () => {
                    if (!review) {
                      if (action === "address")
                        setReviewAddress({ ...selectedAddress! });
                      setReview(true);
                      return;
                    }
                    if (new Date(source.cutoff_at).getTime() <= Date.now())
                      throw new Error("CUTOFF");
                    try {
                      await command(
                        action === "address"
                          ? "delivery.address"
                          : "delivery.reschedule",
                        action === "address"
                          ? { id, version: source.version, addressId }
                          : {
                              id,
                              version: source.version,
                              date: target,
                              kind: intent,
                            },
                      );
                      setAction("");
                      setSource(null);
                    } finally {
                      await Promise.all([
                        state.reload(),
                        availability.reload(),
                      ]);
                    }
                  }}
                />
                {review && (
                  <Btn
                    secondary
                    label={t("Ubah pilihan", "Edit selection")}
                    onPress={() => {
                      setReview(false);
                      setReviewAddress(null);
                    }}
                  />
                )}
                <Btn
                  secondary
                  label={t("Batal", "Cancel")}
                  onPress={() => {
                    setAction("");
                    setSource(null);
                  }}
                />
              </Panel>
            )}
            {!d.canChange && (
              <Txt kind="small">
                {d.offer.flexible
                  ? t(
                      "Batas perubahan telah lewat atau pengantaran sedang diproses.",
                      "The change cutoff has passed or delivery is in progress.",
                    )
                  : t(
                      "Paket ini memakai tanggal tetap.",
                      "This package has fixed dates.",
                    )}
              </Txt>
            )}
            <Btn
              secondary
              label={t("Hubungi katerer", "Contact caterer")}
              onPress={() =>
                router.push({
                  pathname: "/messages",
                  params: { caterer: d.offer.catererId },
                })
              }
            />
            <Btn
              secondary
              label={t(
                "Laporkan masalah / ajukan pembatalan",
                "Report an issue / request cancellation",
              )}
              onPress={() =>
                router.push({
                  pathname: "/support",
                  params: { delivery: id, subscription: d.subscription_id },
                })
              }
            />
          </>
        )}
      </Screen>
    </Gate>
  );
}
