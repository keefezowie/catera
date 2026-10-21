import { Composition, Folder } from "remotion";
import "./fonts";
import { StorePreview } from "./StorePreview";

/**
 * App Store: portrait, 886 × 1920 (largest iPhone), 30 fps, 15–30 s.
 * Google Play: a 16:9 YouTube video. Check both against the current store help before export.
 */
export const RemotionRoot = () => {
  return (
    <>
      <Folder name="App-Store">
        <Composition
          id="AppStoreID"
          component={StorePreview}
          durationInFrames={840}
          fps={30}
          width={886}
          height={1920}
          defaultProps={{ locale: "id", layout: "portrait" }}
        />
        <Composition
          id="AppStoreEN"
          component={StorePreview}
          durationInFrames={840}
          fps={30}
          width={886}
          height={1920}
          defaultProps={{ locale: "en", layout: "portrait" }}
        />
      </Folder>
      <Folder name="Google-Play">
        <Composition
          id="GooglePlayID"
          component={StorePreview}
          durationInFrames={840}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ locale: "id", layout: "landscape" }}
        />
        <Composition
          id="GooglePlayEN"
          component={StorePreview}
          durationInFrames={840}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ locale: "en", layout: "landscape" }}
        />
      </Folder>
    </>
  );
};
