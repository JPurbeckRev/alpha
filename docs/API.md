# Alpha API (Sprint 3)

## Run
```bash
npm install
npm start
```
Default URL: `http://localhost:8787`

- UAT Console: `http://localhost:8787/uat`
- UAT Checklist: `http://localhost:8787/docs/UAT.md`

## Health
### `GET /api/health`
Returns service status + counts (batches/imports/assets/albums/derivatives/shares).

## Staging & Import
### `POST /api/staging/upload`
Multipart form-data:
- field: `files` (multiple)

Returns:
- `batchId`
- `status`
- `summary`
  - `totalFiles`
  - `duplicateCount`
  - `formats`
  - `shotsDetected`
  - `missingTakenAtCount`

### `GET /api/staging/:batchId`
Returns batch status and summary.

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

Import now attempts share-derivative generation per logical asset.

### `GET /api/imports/:importId/log`
Returns import log + counts.

## Library Read APIs
### `GET /api/library/summary`
Top-level totals (assets/sourceFiles/derivatives/albums/shares/imports/stagedBatches).

### `GET /api/library/assets`
Query params:
- `page` (default 1)
- `pageSize` (default 50, max 200)
- `type=photo|video`
- `search=<filename substring>`
- `rawOnly=true|false`
- `jpegOnly=true|false`
- `cameraModel=<substring>`

### `GET /api/library/timeline`
Query params:
- `groupBy=day_taken|day_imported`
- `type=photo|video`
- `page`
- `pageSize`

## Album APIs (CRUD)
### `GET /api/albums`
Paginated album list with `assetCount`.

### `POST /api/albums`
Body:
```json
{ "name": "Yosemite 2026" }
```

### `GET /api/albums/:albumId`
Album + paginated assets.

### `PATCH /api/albums/:albumId`
Patch body fields:
- `name`
- `sortPolicy`
- `sharingStatus`
- `coverAssetId`

### `DELETE /api/albums/:albumId?deleteAssets=false`
Deletes album only by default.

### `POST /api/albums/:albumId/assets`
Body:
```json
{ "assetIds": ["..."] }
```

### `DELETE /api/albums/:albumId/assets/:assetId`
Removes one asset from album.

## Sharing APIs (Sprint 3)
> Basic rate limiting is applied on `/api/shares/*` endpoints.

### `POST /api/shares/albums/:albumId`
Create a tokenized album share.

Body:
```json
{
  "password": "optional",
  "expiresAt": "optional ISO timestamp"
}
```

Response includes:
- `token`
- `shareUrl`
- `requiresPassword`
- `expiresAt`

### `GET /api/shares/:token`
Read shared album payload.

Password-protected shares:
- pass `?password=...`
- or header `x-share-password`

Returns album metadata and asset URLs that point to derivative files only.

### `GET /api/shares/:token/assets/:assetId/file`
Streams share derivative file (never original).

If derivative does not exist yet, returns `415`.

## Storage Notes
- Originals: `storage/originals`
- Derivatives: `storage/derivatives`
- Staging: `storage/staging`
- Metadata DB: `storage/db.json`
