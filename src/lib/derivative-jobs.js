import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { ensureDir } from "./fs-utils.js";

const toolAvailabilityCache = new Map();

function nowIso() {
  return new Date().toISOString();
}

function ext(name = "") {
  return path.extname(name).toLowerCase();
}

function sourceByPreferenceForJob(sourceFiles = []) {
  const mts = sourceFiles.find((sf) => ext(sf.originalName) === ".mts");
  if (mts) return { sourceFile: mts, targetFormat: "mp4", targetExt: ".mp4", mimeType: "video/mp4" };

  const arw = sourceFiles.find((sf) => ext(sf.originalName) === ".arw");
  if (arw) return { sourceFile: arw, targetFormat: "jpeg", targetExt: ".jpg", mimeType: "image/jpeg" };

  return null;
}

function runExecFile(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const msg = stderr?.toString()?.trim() || stdout?.toString()?.trim() || error.message;
        const wrapped = new Error(msg);
        wrapped.code = error.code;
        reject(wrapped);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function detectBinary(bin) {
  if (toolAvailabilityCache.has(bin)) return toolAvailabilityCache.get(bin);

  try {
    await runExecFile(bin, ["-version"]);
    toolAvailabilityCache.set(bin, true);
    return true;
  } catch {
    toolAvailabilityCache.set(bin, false);
    return false;
  }
}

export function requiredBinaryForTarget(targetFormat) {
  if (targetFormat === "mp4" || targetFormat === "jpeg") return "ffmpeg";
  return null;
}

export async function canRunJob(job) {
  const bin = requiredBinaryForTarget(job.targetFormat);
  if (!bin) return { ok: false, reason: `No converter configured for ${job.targetFormat}` };
  const available = await detectBinary(bin);
  if (!available) return { ok: false, reason: `${bin} is not installed or not on PATH` };
  return { ok: true, bin };
}

function isNonRetryableConversionError(error) {
  if (!error) return false;
  const code = String(error.code ?? "").toUpperCase();
  if (["ENOENT", "EACCES"].includes(code)) return true;

  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("not installed") || msg.includes("not on path") || msg.includes("no converter configured");
}

async function transcodeWithFfmpeg({ sourcePath, outputPath, targetFormat }) {
  if (targetFormat === "mp4") {
    await runExecFile("ffmpeg", [
      "-y",
      "-i",
      sourcePath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "26",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      outputPath,
    ]);
    return;
  }

  if (targetFormat === "jpeg") {
    await runExecFile("ffmpeg", [
      "-y",
      "-i",
      sourcePath,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      outputPath,
    ]);
    return;
  }

  throw new Error(`Unsupported target format: ${targetFormat}`);
}

function backoffMs(attempts) {
  const clamped = Math.max(1, Math.min(attempts, 6));
  return clamped * 30_000;
}

export function queueDerivativeJobsForAssets({ db, assets, sourceFiles, importId = null }) {
  const existingActiveJobs = new Set(
    (db.derivativeJobs ?? [])
      .filter((j) => j.status === "queued" || j.status === "processing")
      .map((j) => j.assetId),
  );

  const sourceById = new Map(sourceFiles.map((sf) => [sf.id, sf]));
  let queued = 0;

  for (const asset of assets) {
    if (existingActiveJobs.has(asset.id)) continue;

    const hasReady = (db.derivatives ?? []).some(
      (d) => d.assetId === asset.id && d.type === "share" && d.status === "ready",
    );
    if (hasReady) continue;

    const ownedSources = (asset.sourceFileIds ?? []).map((id) => sourceById.get(id)).filter(Boolean);
    const preferred = sourceByPreferenceForJob(ownedSources);
    if (!preferred) continue;

    const createdAt = nowIso();
    db.derivativeJobs.push({
      id: randomUUID(),
      importId,
      assetId: asset.id,
      sourceFileId: preferred.sourceFile.id,
      sourceExt: ext(preferred.sourceFile.originalName),
      targetFormat: preferred.targetFormat,
      targetExt: preferred.targetExt,
      targetMimeType: preferred.mimeType,
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      createdAt,
      updatedAt: createdAt,
      nextRunAt: createdAt,
      lastError: null,
    });
    queued += 1;
  }

  return { queued };
}

export function listDerivativeJobs(db) {
  return [...(db.derivativeJobs ?? [])].sort(
    (a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime(),
  );
}

export function recoverStaleDerivativeJobs(db, { staleMs = 5 * 60_000 } = {}) {
  const now = Date.now();
  let recovered = 0;

  for (const job of db.derivativeJobs ?? []) {
    if (job.status !== "processing") continue;
    const updatedAt = new Date(job.updatedAt ?? job.createdAt ?? 0).getTime();
    if (Number.isNaN(updatedAt)) continue;
    if (now - updatedAt < staleMs) continue;

    job.status = "queued";
    job.updatedAt = nowIso();
    job.nextRunAt = nowIso();
    job.lastError = "Recovered stale processing job for retry";
    recovered += 1;
  }

  return recovered;
}

export async function processDerivativeJobs({ db, paths, limit = 10, force = false, staleMs = 5 * 60_000 }) {
  await ensureDir(paths.derivativesRoot);

  const recovered = recoverStaleDerivativeJobs(db, { staleMs });
  const now = Date.now();
  const jobs = (db.derivativeJobs ?? [])
    .filter((job) => {
      const maxAttempts = Number(job.maxAttempts ?? 3);
      const attempts = Number(job.attempts ?? 0);
      const nextRunAt = new Date(job.nextRunAt ?? 0).getTime();
      const runnableStatus = job.status === "queued" || job.status === "failed";
      const due = force ? true : nextRunAt <= now;
      return runnableStatus && attempts < maxAttempts && due;
    })
    .slice(0, limit);

  const sourceById = new Map((db.sourceFiles ?? []).map((sf) => [sf.id, sf]));

  const summary = {
    scanned: jobs.length,
    recovered,
    completed: 0,
    failed: 0,
    requeued: 0,
    nonRetryableFailures: 0,
  };

  for (const job of jobs) {
    job.status = "processing";
    job.updatedAt = nowIso();

    const sourceFile = sourceById.get(job.sourceFileId);
    if (!sourceFile) {
      job.status = "failed";
      job.attempts = Number(job.attempts ?? 0) + 1;
      job.lastError = "Source file missing";
      job.updatedAt = nowIso();
      job.nextRunAt = new Date(Date.now() + backoffMs(job.attempts)).toISOString();
      summary.failed += 1;
      continue;
    }

    const capability = await canRunJob(job);
    if (!capability.ok) {
      job.status = "failed";
      job.attempts = Number(job.maxAttempts ?? 3);
      job.lastError = capability.reason;
      job.updatedAt = nowIso();
      job.nextRunAt = null;
      summary.failed += 1;
      summary.nonRetryableFailures += 1;
      continue;
    }

    const outputPath = path.join(paths.derivativesRoot, `${job.assetId}-share-conv-${job.id}${job.targetExt}`);

    try {
      await transcodeWithFfmpeg({
        sourcePath: sourceFile.storagePath,
        outputPath,
        targetFormat: job.targetFormat,
      });

      const stat = await fs.stat(outputPath);
      if (!stat.isFile() || stat.size <= 0) {
        throw new Error("Generated derivative is empty");
      }

      db.derivatives.push({
        id: randomUUID(),
        assetId: job.assetId,
        type: "share",
        format: job.targetFormat,
        mimeType: job.targetMimeType,
        storagePath: outputPath,
        status: "ready",
        reason: null,
        createdAt: nowIso(),
      });

      job.status = "completed";
      job.updatedAt = nowIso();
      job.lastError = null;
      job.completedAt = nowIso();
      summary.completed += 1;
    } catch (error) {
      const nonRetryable = isNonRetryableConversionError(error);
      job.attempts = nonRetryable
        ? Number(job.maxAttempts ?? 3)
        : Number(job.attempts ?? 0) + 1;
      job.lastError = error?.message || "Unknown conversion error";
      job.updatedAt = nowIso();

      if (!nonRetryable && job.attempts < Number(job.maxAttempts ?? 3)) {
        job.status = "queued";
        job.nextRunAt = new Date(Date.now() + backoffMs(job.attempts)).toISOString();
        summary.requeued += 1;
      } else {
        job.status = "failed";
        job.nextRunAt = null;
        summary.failed += 1;
        if (nonRetryable) summary.nonRetryableFailures += 1;
      }
    }
  }

  return summary;
}
