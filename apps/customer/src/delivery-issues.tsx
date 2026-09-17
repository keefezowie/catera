import { useState } from "react";
import { router } from "expo-router";
import {
  mealLabel,
  type CustomerState,
  type DeliveryIssue,
} from "@catera/domain";
import { nativeApi, useNative, useData } from "./context";
import { Panel, Txt, Field, Run, Select, Btn, Status } from "./ui";

export function NativeDeliveryIssueReport({ id }: { id: string }) {
  const { t, locale, command } = useNative();
  const data = useData<CustomerState>("issue-delivery:" + id, () =>
    nativeApi.customer("?deliveryId=" + id),
  );
  const [meal, setMeal] = useState(""),
    [subject, setSubject] = useState("Makanan belum diterima"),
    [body, setBody] = useState(""),
    [sent, setSent] = useState(false);
  const d = data.data?.deliveries.find((d) => d.id === id);
  if (data.error)
    return (
      <Panel>
        <Txt>{data.error}</Txt>
        <Btn label={t("Coba lagi", "Retry")} onPress={data.reload} />
      </Panel>
    );
  if (!d) return <Txt>{data.data ? t("Pengantaran tidak ditemukan.", "Delivery not found.") : t("Memuat pengantaran…", "Loading delivery…")}</Txt>;
  if (sent)
    return (
      <Txt>
        {t(
          "Laporan tersimpan. Tinjau tanggapan di bawah.",
          "Report saved. Review responses below.",
        )}
      </Txt>
    );
  const meals = d.meals.map((m) => ({
    value: m.meal,
    label: mealLabel(m.meal, locale),
  }));
  return (
    <Panel>
      <Txt kind="heading">{t("Kendala pengantaran", "Delivery issue")}</Txt>
      <Txt>
        {d.offer.name} · {d.service_date}
      </Txt>
      <Txt>
        {t(
          "Laporan tidak membatalkan jadwal atau memproses refund.",
          "Reporting does not cancel deliveries or process a refund.",
        )}
      </Txt>
      <Select
        label={t("Waktu makan", "Meal")}
        options={meals}
        value={meal || meals[0]?.value || ""}
        onChange={setMeal}
      />
      <Select
        label={t("Jenis kendala", "Issue type")}
        value={subject}
        onChange={setSubject}
        options={[
          ["Makanan belum diterima", "Meal not received"],
          ["Pengantaran terlambat", "Delivery is late"],
          ["Menu tidak sesuai", "Menu is incorrect"],
          ["Kemasan rusak", "Packaging is damaged"],
          ["Kualitas makanan", "Food quality"],
          ["Lainnya", "Other"],
        ].map(([id, en]) => ({ value: id, label: t(id, en) }))}
      />
      <Field
        label={t("Ceritakan kendalanya", "Tell us what happened")}
        multiline
        value={body}
        onChangeText={setBody}
        maxLength={2000}
      />
      <Run
        label={t("Kirim laporan", "Send report")}
        action={async () => {
          await command("deliveryIssue.create", {
            deliveryId: id,
            meal: meal || meals[0]?.value,
            subject,
            body,
          });
          setSent(true);
        }}
      />
    </Panel>
  );
}

export function NativeDeliveryIssues({ issue }: { issue?: string }) {
  const { t, locale, command } = useNative();
  const state = useData<DeliveryIssue[]>("delivery-issues:" + issue, () =>
    nativeApi.request(
      "delivery-issues" + (issue ? "?issue=" + encodeURIComponent(issue) : ""),
    ),
  );
  const [selected, setSelected] = useState(""),
    [body, setBody] = useState("");
  if (state.error)
    return (
      <Panel>
        <Txt>{state.error}</Txt>
        <Btn label={t("Coba lagi", "Retry")} onPress={state.reload} />
      </Panel>
    );
  return (
    <>
      {state.data?.map((i) => (
        <Panel key={i.id}>
          <Txt kind="heading">{i.subject}</Txt>
          <Status status={i.status} />
          <Txt>
            {i.package_name} · {i.service_date} · {mealLabel(i.meal, locale)}
          </Txt>
          {i.events.map((e) => (
            <Txt key={e.id}>{e.body}</Txt>
          ))}
          {i.case_id ? (
            <Btn
              label={t("Lihat kasus", "View case")}
              onPress={() =>
                router.push({
                  pathname: "/support",
                  params: { case: i.case_id! },
                })
              }
            />
          ) : (
            <>
              <Btn
                secondary
                label={t("Minta Catera meninjau", "Ask Catera to review")}
                onPress={() => {
                  setSelected(i.id);
                  setBody("");
                }}
              />
              {selected === i.id && (
                <>
                  <Field
                    label={t("Alasan eskalasi", "Escalation reason")}
                    multiline
                    value={body}
                    onChangeText={setBody}
                    maxLength={2000}
                  />
                  <Txt>
                    {t(
                      "Peninjauan mengikuti aturan bantuan dan penahanan dana. Tidak ada refund otomatis.",
                      "Review follows support and funds-hold rules. No automatic refund.",
                    )}
                  </Txt>
                  <Run
                    label={t("Eskalasi ke Catera", "Escalate to Catera")}
                    action={async () => {
                      await command("deliveryIssue.escalate", {
                        id: i.id,
                        version: i.version,
                        body,
                      });
                      setSelected("");
                    }}
                  />
                </>
              )}
            </>
          )}
        </Panel>
      ))}
    </>
  );
}
