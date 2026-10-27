import { View } from "react-native";
import { AuthScreen } from "./AuthLayout";
import { SuccessBeat } from "./SuccessBeat";
import { Button, Text } from "./components";
import { useColors } from "./theme";

type Action = { label: string; onPress(): void };

/**
 * The full-screen confirmation after a verified email, a reset or a registered kitchen (spec 4): a `SuccessBeat`
 * (the title is the screen's one heading) with one line of facts, the primary button pinned in the footer, and
 * optionally one text button under it. `play` is set only on the transition into success; false draws the resting frame.
 * The caller sends back and swipe to where `primary` goes, never back into the form.
 */
export function AuthOutcome({
  title,
  body,
  primary,
  secondary,
  play,
}: {
  title: string;
  body: string;
  primary: Action;
  secondary?: Action;
  play: boolean;
}) {
  const c = useColors();
  return (
    <AuthScreen
      footer={
        <View style={{ gap: 8 }}>
          <Button label={primary.label} onPress={primary.onPress} />
          {secondary ? <Button variant="text" label={secondary.label} onPress={secondary.onPress} /> : null}
        </View>
      }
    >
      <View testID="auth-outcome" style={{ paddingTop: 24 }}>
        <SuccessBeat title={title} play={play}>
          <Text style={{ color: c.muted, textAlign: "center" }}>{body}</Text>
        </SuccessBeat>
      </View>
    </AuthScreen>
  );
}
