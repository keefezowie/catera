import { Video } from "@remotion/media";
import { colors } from "@catera/design-tokens";
import { getStaticFiles, staticFile, useVideoConfig } from "remotion";
import { captions, takes, type Locale, type ShotId } from "./captions";
import { fontFamily } from "./fonts";

export type Layout = "portrait" | "landscape";

type Props = {
  readonly shot: ShotId;
  readonly locale: Locale;
  readonly layout: Layout;
  /** Frames of the raw take to skip, for when the recording starts before the action. */
  readonly trimBefore?: number;
};

/** Takes are recorded at 20:9 (1080 × 2400 on the emulator); the screen keeps that shape. */
const SCREEN_RATIO = 9 / 20;

export const Shot = ({ shot, locale, layout, trimBefore = 0 }: Props) => {
  const { fps } = useVideoConfig();
  const file = `takes/${takes[shot]}`;
  const recorded = getStaticFiles().some((f) => f.name.replaceAll("\\", "/") === file);
  const portrait = layout === "portrait";
  const screenHeight = portrait ? 1440 : 960;
  const screenWidth = Math.round(screenHeight * SCREEN_RATIO);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: colors.cream,
        fontFamily,
        display: "flex",
        flexDirection: portrait ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: portrait ? 0 : 120,
        padding: portrait ? "0 63px 100px" : "60px 160px",
      }}
    >
      <div
        style={{
          flex: portrait ? 1 : "0 1 760px",
          display: "flex",
          alignItems: "center",
          justifyContent: portrait ? "center" : "flex-start",
          textAlign: portrait ? "center" : "left",
          maxWidth: 760,
          color: colors.forest,
          fontSize: portrait ? 64 : 76,
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: -1,
          textWrap: "balance",
        }}
      >
        {captions[shot][locale]}
      </div>
      <div
        style={{
          flex: "none",
          width: screenWidth,
          height: screenHeight,
          borderRadius: portrait ? 64 : 44,
          border: `${portrait ? 14 : 10}px solid ${colors.forestDeep}`,
          overflow: "hidden",
          backgroundColor: colors.sage,
        }}
      >
        {recorded ? (
          <Video
            name={takes[shot]}
            src={staticFile(file)}
            trimBefore={trimBefore}
            muted
            objectFit="cover"
            premountFor={fps}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <Missing file={file} />
        )}
      </div>
    </div>
  );
};

/** Shown until the raw take exists, so the timing can be reviewed before recording. Never export it. */
const Missing = ({ file }: { readonly file: string }) => (
  <div
    style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      padding: 40,
      textAlign: "center",
      color: colors.muted,
      fontSize: 28,
      fontWeight: 600,
    }}
  >
    <div>Rekaman belum ada</div>
    <div style={{ fontSize: 22, fontWeight: 500 }}>public/{file}</div>
  </div>
);
