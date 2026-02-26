import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const storageRoot = path.join(root, "storage");

export const paths = {
  root,
  storageRoot,
  tempUploads: path.join(storageRoot, "tmp_uploads"),
  stagingRoot: path.join(storageRoot, "staging"),
  originalsRoot: path.join(storageRoot, "originals"),
  derivativesRoot: path.join(storageRoot, "derivatives"),
  dbPath: path.join(storageRoot, "db.json"),
};

export const limits = {
  maxFilesPerBatch: 5000,
};
