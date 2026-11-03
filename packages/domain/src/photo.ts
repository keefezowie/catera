/**
 * A food photo is one string. An upload carries its ThumbHash after `#th=`, so the blurred placeholder travels with
 * the photo through every read without a column of its own; a fragment is never sent to the server that serves it.
 * The bundled photos keep theirs here.
 */
const bundled: Record<string, string> = {
  "/assets/food/ayam-panggang.png": "XzkOFYS/aYp7Z5eshneHaAho0lA4",
  "/assets/food/ayam-sambal.png": "n1kGHYbmvGYckmevh1SbqUVmgCEG",
  "/assets/food/ikan-kuning.png": "4TkKJYSPiIlqVIerpZR2dwuEsUBH",
  "/assets/food/nasi-nusantara.png": "4TkKFYK+u3s/d3etmUKGdgVKYOQB",
  "/assets/food/plant-based.png": "nTkKFYT7iVs6aHiMd5aIihxWoCEG",
  "/assets/food/salmon-teriyaki.png": "nzkGHYaqcWfNiZifdbd6ZxWHgEIJ",
};

/** The photo's address without the placeholder, and its ThumbHash (base64) when it has one. A bundled photo is
 * known by its path, also once an app has put its API base in front. */
export function photoParts(src: string): { uri: string; thumbhash?: string } {
  const at = src.indexOf("#th=");
  if (at < 0) return { uri: src, thumbhash: bundled[src.slice(Math.max(0, src.indexOf("/assets/food/")))] };
  return { uri: src.slice(0, at), thumbhash: src.slice(at + 4) || undefined };
}

export const withThumbhash = (url: string, thumbhash: string) => `${url}#th=${thumbhash}`;
