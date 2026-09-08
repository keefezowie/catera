"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { sendCode, verifyCode } from "@/app/actions";
export function AuthForm({ verify = false }: { verify?: boolean }) {
  const t = useTranslations(),
    [state, action, pending] = useActionState(verify ? verifyCode : sendCode, {
      error: "",
    });
  return (
    <form action={action} className="stack">
      <label>
        {t(verify ? "code" : "email")}
        <input
          name={verify ? "code" : "email"}
          type={verify ? "text" : "email"}
          inputMode={verify ? "numeric" : "email"}
          autoComplete={verify ? "one-time-code" : "email"}
          required
          autoFocus
          maxLength={verify ? 6 : 254}
          pattern={verify ? "[0-9]{6}" : undefined}
          placeholder={verify ? "000000" : "nama@email.com"}
        />
      </label>
      {state.error && (
        <p className="error" role="alert">
          {t("error." + state.error)}
        </p>
      )}
      <button className="button primary full" disabled={pending}>
        {pending ? t("saving") : t(verify ? "verify" : "sendCode")}
      </button>
    </form>
  );
}
