import Image, { type ImageProps } from "next/image";
import { photoParts } from "@catera/domain";
import { thumbHashToDataURL } from "thumbhash";

const placeholders = new Map<string, string>();

/** A food photo's address without its `#th=` fragment, and its blurred ThumbHash as a small PNG data URL. */
export function foodPhoto(src: string): { uri: string; placeholder?: string } {
  const { uri, thumbhash } = photoParts(src);
  if (!thumbhash) return { uri };
  let placeholder = placeholders.get(thumbhash);
  if (!placeholder) {
    try {
      placeholder = thumbHashToDataURL(
        Uint8Array.from(atob(thumbhash), (c) => c.charCodeAt(0)),
      );
      placeholders.set(thumbhash, placeholder);
    } catch {
      return { uri };
    }
  }
  return { uri, placeholder };
}

/** Plain-img props for a food photo: its address, standing on its blurred placeholder until it loads. */
export function foodImgProps(src: string) {
  const { uri, placeholder } = foodPhoto(src);
  return {
    src: uri,
    style: placeholder
      ? { background: `center / cover url("${placeholder}")` }
      : undefined,
    onLoad: (e: { currentTarget: HTMLImageElement }) => {
      e.currentTarget.style.background = "";
    },
  };
}

/** Responsive derivatives for approved local art; uploaded/signed URLs keep their existing delivery path. Each stands
 * on its blurred placeholder until it arrives. */
export function FoodImage({
  src,
  ...props
}: Omit<ImageProps, "src"> & { src: string }) {
  const { uri, placeholder } = foodPhoto(src);
  return (
    <Image
      {...(placeholder
        ? { placeholder: "blur" as const, blurDataURL: placeholder }
        : {})}
      {...props}
      src={uri}
      unoptimized={!uri.startsWith("/assets/food/")}
    />
  );
}
