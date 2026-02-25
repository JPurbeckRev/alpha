# Alpha API (Owner Experience Baseline)

## Run
```bash
npm install
npm start
```

## Site Entry Points
- Owner Site: `http://localhost:8787/app`
- Legacy alias: `http://localhost:8787/uat`
- Shared album page: `http://localhost:8787/app/share.html?token=<token>`
- Docs: `http://localhost:8787/docs/`

## Health
### `GET /api/health`
Returns service and counts (batches/imports/assets/albums/derivatives/shares).

## Staging & Import
### `POST /api/staging/upload`
Multipart form-data (`files` field).

### `GET /api/staging/:batchId`
Staging batch summary/status.

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

Import log counts include derivative readiness.

### `GET /api/imports/:importId/log`
Import log payload.

## Library
### `GET /api/library/summary`
Totals for assets/sourceFiles/derivatives/albums/shares/imports.

### `GET /api/library/assets`
Paginated asset list with owner-safe source-file download URLs and preview URL.

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
Day-grouped timeline with preview URLs.

Query:
- `groupBy=day_taken|day_imported`
- `type=photo|video`
- `page`, `pageSize`

## Owner Media Endpoints
### `GET /api/owner/assets/:assetId/preview`
Returns best-available preview for owner experience:
- preferred: ready derivative
- fallback: JPEG/MP4 source when available

### `GET /api/owner/source-files/:sourceFileId/download`
Downloads original source file (owner privilege path).

## Albums
### `GET /api/albums`
List albums with asset counts.

### `POST /api/albums`
Create album.

### `GET /api/albums/:albumId`
Album details + paginated hydrated assets.

### `PATCH /api/albums/:albumId`
Update album metadata.

### `DELETE /api/albums/:albumId?deleteAssets=false`
Delete album.

### `POST /api/albums/:albumId/assets`
Add assets.

### `DELETE /api/albums/:albumId/assets/:assetId`
Remove asset.

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
Read shared payload (public, rate-limited).
- password via `?password=` or `x-share-password`

### `GET /api/shares/:token/assets/:assetId/file`
Streams derivative file only (public, rate-limited).
