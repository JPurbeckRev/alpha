# Alpha API (Current)

## Run
```bash
npm install
npm start
```
Default URL: `http://localhost:8787`

## Endpoints

### Health
`GET /api/health`

Returns basic service + object counts.

### Stage Upload
`POST /api/staging/upload`

Multipart form-data:
- field: `files` (multiple)

Response:
- `batchId`
- `status`
- `summary` (total files, duplicates, shots detected, format breakdown)

### Batch Summary
`GET /api/staging/:batchId`

### Execute Import
`POST /api/imports/:batchId/execute`

JSON body:
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

### Import Log
`GET /api/imports/:importId/log`

### Library Summary
`GET /api/library/summary`

## Notes
- Storage root: `storage/`
- Originals are checksum-keyed in `storage/originals`
- Staging batches are stored in `storage/staging`
