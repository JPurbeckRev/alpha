# Alpha API (Sprint 5)

## Run
```bash
npm install
npm start
```

## Site Entry Points
- Owner Site: `http://localhost:8787/app`
- Legacy alias: `http://localhost:8787/uat`
- Shared album page: `http://localhost:8787/app/share.html?token=<token>`
- Docs index: `http://localhost:8787/docs/`

## Health
### `GET /api/health`
Service state and top-level counts including:
- `derivatives`
- `derivativeJobs`
- `shares`

## Staging & Import
### `POST /api/staging/upload`
Multipart form-data (`files` field).

### `GET /api/staging/:batchId`
Batch summary/status.

### `POST /api/imports/:batchId/execute`
Body:
```json
{
  "createAlbums": true,
  "rule": "day_imported",
  "albumName": null
}
```
Rules:
- `day_taken`
- `day_imported`
- `new_name` (requires `albumName`)

Import now includes derivative-job queue metrics:
- `derivativeJobsQueued`
- `derivativeJobsProcessed`
- `derivativeJobsCompleted`

### `GET /api/imports/:importId/log`
Import log payload.

## Library
### `GET /api/library/summary`
Totals for assets/sourceFiles/derivatives/derivativeJobs/albums/shares/imports.

### `GET /api/library/assets`
Paginated hydrated asset list with:
- owner source-file download URLs
- owner preview URL

Query:
- `page`, `pageSize`
- `type=photo|video`
- `search`
- `rawOnly=true|false`
- `jpegOnly=true|false`
- `cameraModel`

### `GET /api/library/assets/:assetId`
Single hydrated asset payload.

### `GET /api/library/timeline`
Day-grouped timeline with hydrated assets and preview URLs.

Query:
- `groupBy=day_taken|day_imported`
- `type=photo|video`
- `page`, `pageSize`

## Owner Media Endpoints
### `GET /api/owner/assets/:assetId/preview`
Best-available owner preview:
- preferred: ready derivative
- fallback: JPEG/MP4 source when available

### `GET /api/owner/source-files/:sourceFileId/download`
Original source-file download path (owner privilege endpoint).

## Albums
### `GET /api/albums`
List albums with asset counts.

### `POST /api/albums`
Create album.

### `GET /api/albums/:albumId`
Album details + hydrated assets.

### `PATCH /api/albums/:albumId`
Update album metadata.

### `DELETE /api/albums/:albumId?deleteAssets=false`
Delete album.

### `POST /api/albums/:albumId/assets`
Add assets to album.

### `DELETE /api/albums/:albumId/assets/:assetId`
Remove asset from album.

## Derivative Conversion Jobs (Sprint 5)
### `GET /api/jobs/derivatives`
List derivative-job queue with summary counts:
- queued
- processing
- completed
- failed

### `POST /api/jobs/derivatives/run`
Trigger queued derivative conversions.

Body:
```json
{ "limit": 20, "force": true }
```
- `force=true` ignores backoff windows and runs eligible queued/failed jobs immediately.

## Shares
### `GET /api/shares`
Owner list of active shares.

### `POST /api/shares/albums/:albumId`
Create tokenized share (optional password + expiry).

Body:
```json
{
  "password": "optional",
  "expiresAt": "optional ISO"
}
```

### `DELETE /api/shares/:shareId`
Revoke share.

### `GET /api/shares/:token`
Public shared payload (rate-limited).
- password via `?password=` or `x-share-password`

### `GET /api/shares/:token/assets/:assetId/file`
Public derivative media file (rate-limited, derivative-only).
