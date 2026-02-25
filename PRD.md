# PRD — Local Storage Photos

**Working title:** Google Photos replacement (self-hosted / bring-your-own-storage)
**Status:** Draft for MVP
**Last updated:** 2026-02-24

## Tagline
A private, fast, “your-storage” photo library that imports camera batches, auto-builds albums, and shares web-friendly versions—without taking ownership of your originals.

---

## 1) Problem Statement
Google Photos is convenient, but it assumes third-party hosting and control over storage policy, compression behavior, pricing, and account rules.

We want:
- A web app that feels like Google Photos for browsing, albuming, and sharing.
- Files stored on infrastructure we control (NAS, local server, S3-compatible object storage, etc.).
- A simple, repeatable flow: upload batches → review/import → optionally auto-create albums.

## 2) Goals

### 2.1 Core workflow goals
1. Batch upload photos/videos from camera dumps and phone exports.
2. Require explicit import confirmation (uploading to staging is not import).
3. Prompt for album creation at import time:
   - By **Day Taken** (EXIF `DateTimeOriginal` / video creation date)
   - By **Day Imported**
   - By **New Album Name** (user-provided)
4. Support album management end-to-end (create/read/update/delete).
5. Support file management end-to-end (upload, metadata view, move, delete/restore).
6. Share albums via web-friendly derivatives while originals stay private.

### 2.2 Non-functional goals
- Browsing should feel fast for large libraries.
- Originals must never be silently rewritten.
- Imports must be auditable and reproducible.

### 2.3 Success criteria (MVP)
- User can complete Upload → Import → Album creation without docs/help.
- RAW+JPEG pairs are preserved and represented as a single logical shot.
- Shared album opens quickly on mobile and does not expose internal storage paths.

## 3) Non-goals (MVP)
- Full non-destructive editing suite (Lightroom-class workflows).
- Face recognition / people clustering.
- AI auto-tagging.
- Advanced multi-user permissions beyond owner + public share links.

## 4) Target User & Primary Use Cases

### 4.1 Primary user
- Solo owner (Sony a6600 user) importing mixed photo/video formats and organizing by shooting day.

### 4.2 Primary use cases
- “I shot a weekend trip. One upload, then albums per day taken.”
- “I imported a folder. Put everything into an album named ‘Yosemite 2026’.”
- “I need a share link for family that loads quickly on any device.”

## 5) Supported Formats (MVP Must-Have)
The system must support all still/movie formats commonly produced by Sony a6600 workflows.

### 5.1 Still images
- JPEG (`.jpg`, `.jpeg`)
- Sony RAW (`.arw`)
- RAW+JPEG pairs (two source files, one logical shot)

### 5.2 Video
- XAVC S 4K (MP4 / H.264)
- XAVC S HD (MP4 / H.264)
- AVCHD (commonly `.mts`)

### 5.3 Format requirement
For all above formats, MVP must:
1. Ingest successfully,
2. Generate web-friendly derivatives for preview/share,
3. Preserve originals exactly.

## 6) Product Principles
1. **Your storage is source of truth.**
2. **Derivatives are disposable.** They can be regenerated at any time.
3. **Import is explicit.** Staging is separate from library ingestion.
4. **Sharing defaults to safe.** Share endpoints serve derivatives, not originals.
5. **Auditability over guesswork.** Import outcomes are logged and inspectable.

## 7) MVP User Experience

### 7.1 Primary flow: Upload → Review → Import → Album creation

#### A) Upload Batch (Staging)
- User selects folder/files.
- Upload lands in **Staging Area** (not in library yet).
- UI shows progress, counts, and detected formats.

#### B) Pre-import Review
Display:
- Total files,
- Duplicate candidates,
- Missing metadata warnings,
- “Shots detected” count (RAW+JPEG counted as one shot when paired).

User options:
- Import all,
- Skip duplicates (default: on),
- Keep RAW+JPEG paired (default: on).

#### C) Import Prompt (required)
When user clicks **Import**, show:

> **Create albums from this import?**

Options:
- No (import only)
- Yes:
  - By Day Taken
  - By Day Imported
  - New Album Name: [text input]

#### D) Post-import Result
Confirmation page with links:
- Open Library
- Open Created Album(s)
- View Import Log

### 7.2 Library Browsing
- Date-grouped browsing (MVP: by Day Taken).
- Search (MVP): filename + basic metadata.
- Filters:
  - Photos / Videos
  - RAW only / JPEG only
  - Camera model

### 7.3 Albums (CRUD)
Album fields:
- Name,
- Cover (auto from first item; editable),
- Sort order (taken date / import date / manual later),
- Sharing status (off / link / link+password / expiry).

Actions:
- Create,
- Rename,
- Delete (with policy choice: remove album only vs delete contained files),
- Add/remove items.

### 7.4 Files (CRUD)
Actions:
- View (derivative preview),
- Metadata panel (EXIF, taken date, camera, lens if available),
- Download original (owner-only),
- Move between album(s),
- Delete (soft delete with retention window).

## 8) Sharing Requirements

### 8.1 Share object
- Unguessable tokenized share link.
- Optional password.
- Optional expiry.
- Scope (MVP): album-level.

### 8.2 Delivery format rules
- **Photos:** share-optimized JPEG (optional WebP).
- **Videos:** streaming-friendly derivative (HLS preferred, MP4 acceptable fallback).

### 8.3 Security and privacy
- No exposure of internal filesystem paths, storage bucket names, or metadata that leaks infra topology.
- Rate limiting + basic abuse protection on share endpoints.
- Owner authentication required for originals and management actions.

## 9) Data Model (Conceptual)
- **Asset**: logical media item (`photo`/`video`), taken/imported timestamps, camera model, checksum(s).
- **SourceFile**: immutable original file record (supports RAW+JPEG pairing).
- **Derivative**: thumbnail/preview/share/stream outputs.
- **Album**: name, cover, sort policy, timestamps.
- **AlbumAsset**: many-to-many join for assets and albums.
- **ImportBatch**: status, file list, dedupe results, errors, created albums.
- **Share**: token, scope, password hash (optional), expiry (optional).

## 10) Storage & Processing Architecture (MVP)

### 10.1 Storage zones
1. Originals store (authoritative)
2. Derivatives store (separate folder/prefix recommended)
3. Metadata DB (assets, albums, shares, import logs)

### 10.2 Processing pipeline
On import:
1. Extract metadata (EXIF/container),
2. Pair RAW+JPEG,
3. Compute checksum(s),
4. De-duplicate idempotently,
5. Generate derivatives (thumb/preview/share/stream),
6. Persist import log + results.

### 10.3 Idempotency
Re-importing the same file set must not create duplicate assets.

## 11) Non-Functional Requirements (MVP)
- **Performance:**
  - Library grid first render should feel responsive for large albums.
  - Share pages should load quickly on mobile networks.
- **Reliability:** import jobs survive transient failures with retry/resume.
- **Observability:** structured logs + import/job status visibility.
- **Data safety:** originals immutable except explicit delete by owner.
- **Portability:** storage backend can be local or S3-compatible.

## 12) Acceptance Criteria (MVP)

### 12.1 Upload & import
- User can upload batches from 1 to 5,000 files using chunked upload without browser crash.
- Import prompt offers exactly: Day Taken / Day Imported / New Album Name.
- Selected rule creates correct album set.

### 12.2 Format support
- Ingest succeeds for JPEG, ARW, RAW+JPEG, XAVC S 4K/HD, AVCHD.
- Derivative generation succeeds for preview/share for each media type.
- Originals are preserved unmodified.

### 12.3 Albums & files
- Album CRUD works end-to-end.
- File operations work end-to-end (view metadata, move, soft delete/restore, owner download original).

### 12.4 Sharing
- Share link works in private/incognito browser.
- Optional password and expiry are enforced.
- Share pages serve derivatives only (no direct original exposure by default).

### 12.5 Auditability
- Every import produces an import log with counts, duplicates, failures, and created albums.

## 13) Milestones

### M1 — Upload + Staging + Import Log
- Chunked upload, staging UI, checksum de-dupe, import logs.

### M2 — Album creation rules
- Day Taken / Day Imported / New Name during import.

### M3 — Browse + Album CRUD
- Date browse, album pages, add/remove assets.

### M4 — Sharing via derivatives
- Tokenized links, optional password/expiry, optimized photo/video delivery.

### M5 — Hardening & admin quality
- Performance pass, backup guidance, storage config UX, admin maintenance tools.
