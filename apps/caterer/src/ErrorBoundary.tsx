import { Component, type ReactNode } from "react";
import { useMobile } from "@catera/mobile-core";
import { MoodHeader, Screen } from "@catera/mobile-ui";
import { ReadError } from "./ReadError";

type Props = { children: ReactNode; message: string; title: string };
type State = { failed: boolean };

class Boundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Screen header={<MoodHeader testID="guard-header" title={this.props.title} />}>
        <ReadError message={this.props.message} onRetry={() => this.setState({ failed: false })} />
      </Screen>
    );
  }
}

/** One bad value on a screen shows a plain retry state instead of blanking the whole app. */
export function ScreenGuard({ children, message }: { children: ReactNode; message?: string }) {
  const { t } = useMobile();
  return (
    <Boundary
      title={t("Belum bisa ditampilkan", "Can't be shown yet")}
      message={message ?? t("Halaman ini belum bisa ditampilkan.", "This page can't be shown right now.")}
    >
      {children}
    </Boundary>
  );
}
