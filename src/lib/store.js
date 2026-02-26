import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, pathExists } from "./fs-utils.js";

function defaultDb() {
  return {
    assets: [],
    sourceFiles: [],
    derivatives: [],
    derivativeJobs: [],
    batches: [],
    imports: [],
    albums: [],
    albumAssets: [],
    shares: [],
    settings: {
      theme: "dark",
      viewMode: "comfortable",
      defaultGrouping: "day_taken",
    },
    users: [],
    sessions: [],
  };
}

function normalizeDb(db) {
  const normalized = { ...defaultDb(), ...(db ?? {}) };
  normalized.assets = Array.isArray(normalized.assets) ? normalized.assets : [];
  normalized.sourceFiles = Array.isArray(normalized.sourceFiles) ? normalized.sourceFiles : [];
  normalized.derivatives = Array.isArray(normalized.derivatives) ? normalized.derivatives : [];
  normalized.derivativeJobs = Array.isArray(normalized.derivativeJobs) ? normalized.derivativeJobs : [];
  normalized.batches = Array.isArray(normalized.batches) ? normalized.batches : [];
  normalized.imports = Array.isArray(normalized.imports) ? normalized.imports : [];
  normalized.albums = Array.isArray(normalized.albums) ? normalized.albums : [];
  normalized.albumAssets = Array.isArray(normalized.albumAssets) ? normalized.albumAssets : [];
  normalized.shares = Array.isArray(normalized.shares) ? normalized.shares : [];
  normalized.settings = normalized.settings ?? defaultDb().settings;
  normalized.users = Array.isArray(normalized.users) ? normalized.users : [];
  normalized.sessions = Array.isArray(normalized.sessions) ? normalized.sessions : [];
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
    this.#writeQueue = this.#writeQueue
      .catch(() => {
        // Prevent a prior failed mutation from permanently poisoning the queue.
      })
      .then(async () => {
        const db = await this.read();
        const result = await mutator(db);
        await this.write(db);
        return result;
      });

    return this.#writeQueue;
  }
}
