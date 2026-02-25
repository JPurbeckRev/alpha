# Round 2 Execution Report (Sprint 2)

**Window:** 2026-02-24
**Status:** Completed
**Theme:** Complete M2 backend semantics + start M3 browse surface + establish UAT environment

## Sprint Goal
Deliver Sprint 2 scope from handoff:
1. Complete album-rule semantics and metadata extraction for import flows.
2. Add library read APIs and album CRUD APIs (M3 start).
3. Stand up a clear UAT environment for PM validation.

## Completed Deliverables

### 1) Metadata extraction in ingest pipeline
- Added metadata extraction module (`src/lib/metadata.js`) using EXIF + filesystem fallback.
- Captured and persisted:
  - `takenAt`
  - `cameraModel`
  - `metadataSource`
- Extended staging summary with `missingTakenAtCount`.

### 2) Album rule semantics (M2 completion)
- Import rules implemented and validated:
  - `day_taken`
  - `day_imported`
  - `new_name` (with validation)
- Album creation still tied explicitly to import execution step.

### 3) Library read API surface (M3 start)
- Added paginated asset query API:
  - filters: type, search, rawOnly, jpegOnly, cameraModel
- Added timeline API grouped by:
  - day taken
  - day imported
- New helper modules:
  - `src/lib/library.js`
  - `src/lib/paginate.js`

### 4) Album CRUD API surface (M3 start)
- Added endpoints for:
  - list/create/get/patch/delete album
  - add/remove assets in album
- Implemented album helper module: `src/lib/albums.js`.

### 5) UAT environment (requested)
- Added browser-based UAT Console: `http://localhost:8787/uat`
  - health/summary checks
  - upload/import flow
  - timeline/assets query checks
  - album CRUD checks
- Added UAT guide checklist: `docs/UAT.md`
- Added sample-media seed script: `npm run uat:seed`
- Added smoke validation script: `scripts/smoke-uat.mjs`

### 6) Test coverage expansion
- Added tests for:
  - album helper behavior (`test/albums.test.js`)
  - library query/timeline behavior (`test/library.test.js`)
- Existing ingest tests remain passing.
- Total passing tests: 6.

## Verification Evidence
- `npm test` passes.
- Smoke run (`node scripts/smoke-uat.mjs`) validates:
  - health = true
  - upload + import succeeds
  - timeline returns groups
  - albums and assets are queryable

## PRD Progress Estimate (post Sprint 2)
Estimated completion of total PRD scope: **44%**

### Scoring method (milestone-weighted)
- M1 Upload + Staging + Import Log (25%): **~82%** complete → 20.5%
- M2 Album creation rules (15%): **~95%** complete → 14.25%
- M3 Browse + Album CRUD (20%): **~45%** complete → 9.0%
- M4 Sharing via derivatives (20%): **0%** complete → 0%
- M5 Hardening/admin (20%): **~1%** complete → 0.2%

**Total:** 43.95% → rounded to **44%**

## Remaining Gaps (highest impact)
1. Derivative generation + share links (M4)
2. Auth and owner/private access controls
3. Chunked resumable uploads for very large batches
4. Stronger failure/retry/stress test coverage
5. Production persistence migration from JSON store

## Recommended Next Sprint Target
**Sprint 3:** start M4 (sharing)
1. Implement derivative pipeline (image preview/share + video web delivery baseline).
2. Implement tokenized album share links with optional password/expiry.
3. Add owner-gated original download path.
4. Add rate limiting on share endpoints.
