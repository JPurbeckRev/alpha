import path from "node:path";

const root = process.cwd();
const storageRoot = path.join(root, "storage");

export const paths = {
  root,
  storageRoot,
  tempUploads: path.join(storageRoot, "tmp_uploads"),
  stagingRoot: path.join(storageRoot, "staging"),
  originalsRoot: path.join(storageRoot, "originals"),
  dbPath: path.join(storageRoot, "db.json"),
};

export const limits = {
  maxFilesPerBatch: 5000,
};
