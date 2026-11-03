import { photoParts } from "@catera/domain";

/**
 * expo-image props for a food photo: the address without its `#th=` fragment, and the blurred ThumbHash placeholder it
 * carries (or a bundled photo's), shown until the photo arrives and dissolved by the image's own `transition`.
 */
export function photoSource(src: string, headers?: Record<string, string>) {
  const { uri, thumbhash } = photoParts(src);
  return {
    source: headers ? { uri, headers } : { uri },
    placeholder: thumbhash ? { thumbhash } : undefined,
  };
}
