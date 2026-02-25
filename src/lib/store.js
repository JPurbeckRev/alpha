import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, pathExists } from "./fs-utils.js";

function defaultDb() {
  return {
    assets: [],
    sourceFiles: [],
    derivatives: [],
    batches: [],
    imports: [],
    albums: [],
    albumAssets: [],
    shares: [],
  };
}

function normalizeDb(db) {
  const normalized = { ...defaultDb(), ...(db ?? {}) };
  normalized.assets = Array.isArray(normalized.assets) ? normalized.assets : [];
  normalized.sourceFiles = Array.isArray(normalized.sourceFiles) ? normalized.sourceFiles : [];
  normalized.derivatives = Array.isArray(normalized.derivatives) ? normalized.derivatives : [];
  normalized.batches = Array.isArray(normalized.batches) ? normalized.batches : [];
  normalized.imports = Array.isArray(normalized.imports) ? normalized.imports : [];
  normalized.albums = Array.isArray(normalized.albums) ? normalized.albums : [];
  normalized.albumAssets = Array.isArray(normalized.albumAssets) ? normalized.albumAssets : [];
  normalized.shares = Array.isArray(normalized.shares) ? normalized.shares : [];
  return normalized;
}

export class JsonStore {
  #dbPath;
  #writeQueue = Promise.resolve();

  constructor(dbPath) {
    this.#dbPath = dbPath;
  }

  async init() {
    const dir = path.dirname(this.#dbPath);
    await ensureDir(dir);

    if (!(await pathExists(this.#dbPath))) {
      await fs.writeFile(this.#dbPath, JSON.stringify(defaultDb(), null, 2), "utf8");
    }
  }

  async read() {
    const raw = await fs.readFile(this.#dbPath, "utf8");
    return normalizeDb(JSON.parse(raw));
  }

  async write(db) {
    await fs.writeFile(this.#dbPath, JSON.stringify(db, null, 2), "utf8");
  }

  async update(mutator) {
    this.#writeQueue = this.#writeQueue.then(async () => {
      const db = await this.read();
      const result = await mutator(db);
      await this.write(db);
      return result;
    });

    return this.#writeQueue;
  }
}
