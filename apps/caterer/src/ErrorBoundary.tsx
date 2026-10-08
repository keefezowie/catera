import { Component, type ReactNode } from "react";
import { useMobile } from "@catera/mobile-core";
import { Button, Screen, Text } from "@catera/mobile-ui";

type Props = { children: ReactNode; message: string; retryLabel: string };
type State = { failed: boolean };

class Boundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Screen>
        <Text>{this.props.message}</Text>
        <Button label={this.props.retryLabel} onPress={() => this.setState({ failed: false })} />
      </Screen>
    );
  }
}

/** One bad value on a screen shows a plain retry state instead of blanking the whole app. */
export function ScreenGuard({ children, message }: { children: ReactNode; message?: string }) {
  const { t } = useMobile();
  return (
    <Boundary message={message ?? t("Halaman ini belum bisa ditampilkan.", "This page can't be shown right now.")} retryLabel={t("Coba lagi", "Try again")}>
      {children}
    </Boundary>
  );
}
