import { rename, realpath } from "node:fs/promises";
import path from "node:path";

// Stop the development server before running this command. Preserve, never delete.
const root = await realpath(path.resolve(".data"));
const source = path.resolve(root, "postgres");
const destination = path.resolve(
  root,
  "postgres-backup-" + new Date().toISOString().replaceAll(/[:.]/g, "-"),
);
if (
  !source.startsWith(root + path.sep) ||
  !destination.startsWith(root + path.sep)
)
  throw Error("Invalid local database path");
await rename(source, destination);
console.log(
  "Previous synthetic database preserved at " +
    destination +
    ". Restart the app to create fresh fixtures.",
);
