import fs from "node:fs/promises";

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function safeMoveFile(from, to) {
  try {
    await fs.rename(from, to);
  } catch (error) {
    if (error?.code !== "EXDEV") throw error;
    await fs.copyFile(from, to);
    await fs.unlink(from);
  }
}
