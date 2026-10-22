import { useData, useMobile } from "@catera/mobile-core";
import { ConnectionBanner, FadeSwap, ReadError, Screen, Text, useColors } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { usePullToRefresh } from "../refresh";
import { WaitingSkeleton } from "../skeletons";
import { StaleCopy } from "../staleCopy";
import { keptCustomer, loadCustomer } from "./customerRead";
import { WaitingList } from "./WaitingList";

/**
 * "Perlu kamu urus": the whole list behind Beranda's live slot, pushed over it. Beranda shows only the most urgent
 * waiting item and counts the rest; here they are all, as the same rows with the same actions (menus to choose, plans to
 * renew, trials ending, the review). Its own reads: the customer (the kept copy first, as Beranda does) and the menu
 * choices that are due. The kept copy gives no menu or review rows, and a row leaves after its action.
 */
export function PerluDiurus() {
  const { actor, ready, t } = useMobile();
  const title = t("Perlu kamu urus", "Needs you");
  // Before the session is known the page is already the list's shape under its title.
  if (!ready)
    return (
      <Screen nativeTitle={title}>
        <WaitingSkeleton />
      </Screen>
    );
  if (!actor) return <SignInFirst title={title} next="/perlu-diurus" />;
  return <Waiting key={actor.id} actorId={actor.id} title={title} />;
}

function Waiting({ actorId, title }: { actorId: string; title: string }) {
  const { runtime, t } = useMobile();
  const c = useColors();
  const home = useData("perlu-diurus:customer", () => loadCustomer(runtime, actorId), { cached: () => keptCustomer(actorId) });
  // Menu choices that are due; the list still shows the rest without them (offline or a failed feed).
  const actions = useData("perlu-diurus:actions", () => runtime.api.customerActions(20).catch(() => null));
  const pull = usePullToRefresh(() => Promise.all([home.reload(), actions.reload()]));
  const state = home.data?.data;
  const savedAt = home.data?.savedAt;
  const loading = !state && home.loading;
  const failed = !state && !home.loading;
  const now = new Date();

  return (
    <Screen nativeTitle={title} refreshControl={state ? pull : undefined}>
      <FadeSwap swapKey={loading ? "loading" : failed ? "error" : savedAt ? "kept" : "fresh"} style={{ gap: 16 }}>
        {loading ? (
          <WaitingSkeleton />
        ) : failed ? (
          <ReadError art message={home.error} onRetry={() => void home.reload()} />
        ) : (
          <>
            <ConnectionBanner lastSeen={savedAt ? new Date(savedAt) : undefined} onRetry={() => void home.reload()} />
            {!savedAt && home.error ? <ReadError message={home.error} onRetry={() => void home.reload()} /> : null}
            <StaleCopy savedAt={savedAt} onRetry={home.reload} />
            <WaitingList
              state={state!}
              actions={actions.data?.items ?? null}
              offline={!!savedAt}
              now={now}
              empty={
                <Text variant="bodyL" style={{ color: c.muted }}>
                  {t("Tidak ada yang perlu kamu urus sekarang.", "Nothing needs you right now.")}
                </Text>
              }
            />
          </>
        )}
      </FadeSwap>
    </Screen>
  );
}
