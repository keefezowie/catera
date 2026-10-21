import { Easing, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Shot, type Layout } from "./Shot";
import type { Locale } from "./captions";

export type StorePreviewProps = {
  readonly locale: Locale;
  readonly layout: Layout;
};

/**
 * The seven shots of docs/STORE-PREVIEW-STORYBOARD.md. Cuts are a 7-frame fade (nativeMotion
 * content, 220 ms, with the app's ease); each of shots 1–6 carries 7 extra frames for its
 * outgoing fade, so the shots keep their storyboard lengths and the total stays 840 frames (28 s).
 */
export const StorePreview = ({ locale, layout }: StorePreviewProps) => {
  const { fps } = useVideoConfig();

  return (
    <TransitionSeries name="Store preview">
      <TransitionSeries.Sequence name="1 Jelajah" durationInFrames={112} premountFor={fps}>
        <Shot shot="jelajah" locale={locale} layout={layout} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 7, easing: Easing.bezier(0.16, 1, 0.3, 1) })}
      />
      <TransitionSeries.Sequence name="2 Paket" durationInFrames={97} premountFor={fps}>
        <Shot shot="paket" locale={locale} layout={layout} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 7, easing: Easing.bezier(0.16, 1, 0.3, 1) })}
      />
      <TransitionSeries.Sequence name="3 Beli" durationInFrames={157} premountFor={fps}>
        <Shot shot="beli" locale={locale} layout={layout} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 7, easing: Easing.bezier(0.16, 1, 0.3, 1) })}
      />
      <TransitionSeries.Sequence name="4 Bayar" durationInFrames={127} premountFor={fps}>
        <Shot shot="bayar" locale={locale} layout={layout} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 7, easing: Easing.bezier(0.16, 1, 0.3, 1) })}
      />
      <TransitionSeries.Sequence name="5 Jadwal" durationInFrames={142} premountFor={fps}>
        <Shot shot="jadwal" locale={locale} layout={layout} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 7, easing: Easing.bezier(0.16, 1, 0.3, 1) })}
      />
      <TransitionSeries.Sequence name="6 Beranda" durationInFrames={142} premountFor={fps}>
        <Shot shot="beranda" locale={locale} layout={layout} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 7, easing: Easing.bezier(0.16, 1, 0.3, 1) })}
      />
      <TransitionSeries.Sequence name="7 Menu besok" durationInFrames={105} premountFor={fps}>
        <Shot shot="menuBesok" locale={locale} layout={layout} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
