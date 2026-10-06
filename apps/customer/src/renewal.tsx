import { useState } from "react";
import { router } from "expo-router";
import { currency, type Subscription } from "@catera/domain";
import { nativeApi, useData, useNative } from "./context";
import { Btn, Facts, Panel, ResourceNotice, Select, Txt } from "./ui";
export function Renewal({ subscription: s }: { subscription: Subscription }) {
  const { t, locale } = useNative();
  const [packageId, setPackageId] = useState("");
  const state = useData("renewal:" + s.id + ":" + packageId, () =>
    nativeApi.renewalContext(s.id, packageId || undefined),
  );
  const r = state.data;
  const offer = r?.offers.find((o) => o.id === r.packageId);
  return (
    <Panel>
      <Txt kind="heading">{t("Perpanjang paket", "Renew package")}</Txt>
      <ResourceNotice resource={state} />
      <Txt kind="small">
        {t(
          "Pembelian baru dengan harga dan aturan terkini. Jadwal dimulai setelah pengantaran terakhir. Tidak diperpanjang otomatis.",
          "A new purchase at current prices and terms. Starts after your last delivery. No automatic renewal.",
        )}
      </Txt>
      {r?.pendingCheckoutId ? (
        <Btn
          label={t(
            "Lanjutkan pembayaran perpanjangan",
            "Continue renewal payment",
          )}
          onPress={() =>
            router.push(("/payment/" + r.pendingCheckoutId) as never)
          }
        />
      ) : (
        r && (
          <>
            {r.replacementRequired && (
              <Txt>
                {t(
                  "Paket sebelumnya tidak tersedia. Pilih penggantinya.",
                  "Your previous package is unavailable. Choose a replacement.",
                )}
              </Txt>
            )}
            <Select
              label={t("Paket berikutnya", "Next package")}
              value={r.packageId}
              onChange={setPackageId}
              options={r.offers.map((o) => ({ value: o.id, label: o.name }))}
            />
            {offer && (
              <Facts
                rows={[
                  [
                    t(
                      "Harga dahulu / porsi / hari",
                      "Previous price / portion / day",
                    ),
                    currency(s.snapshot.offer.price, locale),
                  ],
                  [
                    t(
                      "Harga sekarang / porsi / hari",
                      "Current price / portion / day",
                    ),
                    currency(offer.price, locale),
                  ],
                  [t("Mulai paling awal", "Earliest start"), r.startDate],
                  [t("Alamat", "Address"), r.address.line],
                  [t("Porsi tetap", "Fixed portions"), r.portions],
                ]}
              />
            )}
            {!r.available && (
              <Txt>
                {t(
                  "Paket belum tersedia untuk jadwal berikutnya. Pilih paket lain atau coba lagi nanti.",
                  "This package is unavailable for the next schedule. Choose another package or try later.",
                )}
              </Txt>
            )}
            <Btn
              label={t("Tinjau perpanjangan", "Review renewal")}
              disabled={!state.canWrite || !r.available}
              onPress={() =>
                router.push({
                  pathname: "/checkout/[id]",
                  params: {
                    id: r.packageId,
                    portions: r.portions,
                    startDate: r.startDate,
                    addressId: r.addressId || "",
                    renewedFrom: s.id,
                  },
                })
              }
            />
          </>
        )
      )}
    </Panel>
  );
}
