# Sprint Evaluation Guide (Sprint 5)

Evaluate each sprint through the owner site experience.

## Start
```bash
npm install
npm run uat:seed
npm run uat:start
```

Open:
- Owner Site: `http://localhost:8787/app`
- Alias: `http://localhost:8787/uat`
- API docs: `http://localhost:8787/docs/API.md`

## Evaluation Flow

### 1) Home snapshot
- Confirm health badge and counters load.
- Confirm conversion job panel loads.

### 2) Import flow
- Import sample media with each album rule:
  - by day imported
  - by day taken
  - by custom album name

Expected:
- import result appears
- counts increase
- import log includes derivative/job metrics

### 3) Library flow
- Browse timeline by day taken/day imported.
- Filter by type and search.
- Validate previews and owner download links.

### 4) Album curation flow
- Create album.
- Open album and add/remove assets.
- Rename/delete album.

### 5) Sharing flow
- Create share (with and without password).
- Open share page.
- Revoke from owner site.

### 6) Derivative-job flow (Sprint 5)
- Open Home tab.
- Click **Refresh Conversion Jobs**.
- Click **Run Conversion Jobs**.

Expected:
- job summary updates
- failed/requeued/completed status is visible

## Quick smoke
With server running:
```bash
npm run uat:smoke
```

Expected JSON includes:
- health/import/share checks
- derivative job stats (`jobsQueuedBefore`, `jobsRunScanned`, `jobsCompletedAfter`)

## Known limits
- ARW/MTS conversion depends on ffmpeg availability on host.
- Without ffmpeg, queued conversion jobs may requeue/fail with tool errors.
