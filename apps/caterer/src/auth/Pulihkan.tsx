import { router } from "expo-router";
import { redirectFor, useMobile } from "@catera/mobile-core";
import { RecoverForm } from "@catera/mobile-ui";
import { emailCheck } from "./checks";
import { formPose, useAuthRun } from "./useAuthRun";

/** Lupa kata sandi: a recovery link by email, opened on this phone to choose a new password. */
export function Pulihkan() {
  const { t } = useMobile();
  const action = useAuthRun();
  return (
    <RecoverForm
      brand="Catera Dapur"
      art={null}
      next="/"
      redirectTo={redirectFor("catera-dapur")}
      action={action}
      form={formPose}
      emailCheck={emailCheck(t)}
      onBack={() => router.replace("/masuk" as never)}
    />
  );
}
