import { router, useLocalSearchParams } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { RecoverForm } from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { REDIRECT_TO } from "./emailAuth";
import { canRetry } from "./failure";
import { emailCheck, useAuthRun, useFormPose } from "./useAuthRun";

/** Lupa kata sandi: a recovery link by email, opened on this phone to choose a new password. */
export function Recover() {
  const { t, locale } = useMobile();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = nativeReturnPath(typeof params.next === "string" ? params.next : undefined);
  const run = useAuthRun();
  const form = useFormPose(run.code, run.failures);
  return (
    <RecoverForm
      next={next}
      redirectTo={REDIRECT_TO}
      action={{ ...run, retryable: canRetry(run.code, locale) }}
      form={form}
      emailCheck={emailCheck(t)}
      onBack={() => router.replace({ pathname: "/login", params: { next } } as never)}
    />
  );
}
