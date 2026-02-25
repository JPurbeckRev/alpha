# Alpha API (Sprint 2)

## Run
```bash
npm install
npm start
```
Default URL: `http://localhost:8787`

UAT Console: `http://localhost:8787/uat`

## Health
### `GET /api/health`
Returns service status + object counts.

## Staging & Import
### `POST /api/staging/upload`
Multipart form-data:
- field: `files` (multiple)

Returns:
- `batchId`
- `status`
- `summary`:
  - `totalFiles`
  - `duplicateCount`
  - `formats`
  - `shotsDetected`
  - `missingTakenAtCount`

### `GET /api/staging/:batchId`
Returns batch summary/status.

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

### `GET /api/imports/:importId/log`
Returns import log + counts.

## Library Read APIs
### `GET /api/library/summary`
Object totals for high-level status.

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
Paginated list with `assetCount`.

### `POST /api/albums`
Body:
```json
{ "name": "Yosemite 2026" }
```

### `GET /api/albums/:albumId`
Returns album + paginated assets.

### `PATCH /api/albums/:albumId`
Body supports:
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
Removes single asset from album.

## Storage Notes
- Storage root: `storage/`
- Originals: `storage/originals`
- Staging: `storage/staging`
- Metadata DB: `storage/db.json`
