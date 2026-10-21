import { copyFile, mkdir } from "node:fs/promises";

// Studio only serves files inside this project, so copy the brand font (and its licence) into public/.
const source = new URL("../../../packages/brand/assets/fonts/", import.meta.url);
const target = new URL("../public/fonts/", import.meta.url);
await mkdir(target, { recursive: true });
await copyFile(new URL("PlusJakartaSans[wght].woff2", source), new URL("PlusJakartaSans.woff2", target));
await copyFile(new URL("OFL.txt", source), new URL("OFL.txt", target));
