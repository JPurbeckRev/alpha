# Sprint Evaluation Guide

This guide is for evaluating each sprint through the **actual owner site experience**.

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
- Confirm health badge and project counters load.

### 2) Import flow
- Import sample media with each album rule:
  - by day imported
  - by day taken
  - by custom album name

Expected:
- import result appears
- albums/assets counts increase
- derivative readiness appears in import log

### 3) Library flow
- Browse timeline by day taken/day imported.
- Filter by type and search.
- Validate previews and owner download links.

Expected:
- media cards render
- fallback behavior appears when preview unavailable

### 4) Album curation flow
- Create an album.
- Open album and add/remove assets.
- Rename and delete album.

Expected:
- operations reflect immediately in album list/detail.

### 5) Sharing flow
- Create share (with and without password).
- Open public share page.
- Validate revoke flow from owner site.

Expected:
- share page loads derivative-only media.
- password-protected share blocks unauthorized access.
- revoked share no longer accessible.

## Quick smoke
With server running:
```bash
npm run uat:smoke
```

Expected: JSON output including health/import/share checks.

## Known limits
- ARW and MTS full conversion pipeline is still pending.
- Derivative support currently favors JPEG/MP4 inputs.
