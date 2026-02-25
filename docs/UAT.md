# UAT Guide (Sprint 3)

This environment is prepared for PM/Creative Director validation through Sprint 3 scope.

## 1) Start UAT Environment
```bash
npm install
npm run uat:seed
npm run uat:start
```

Open:
- Sprint Review Site: `http://localhost:8787/uat`
- API Docs: `http://localhost:8787/docs/API.md`

## 2) Minimum UAT Flow (Expected Pass)

### A. Health baseline
1. Click **Check Health**
2. Click **Check Library Summary**

Expected:
- `ok: true`
- counts include `derivatives` and `shares`

### B. Upload + import + album rule
1. Upload files from `uat/sample_media`
2. Run import with each rule over separate batches:
   - `day_imported`
   - `day_taken`
   - `new_name`

Expected:
- import log returns without error
- duplicate content is skipped
- album creation reflects selected rule
- derivative counts appear in import log (`derivativesReady`, `derivativesUnavailable`)

### C. Validate read APIs
1. Click **Timeline (day_taken)** and **Timeline (day_imported)**
2. Click **List Assets**

Expected:
- timeline groups by day
- assets are paginated and queryable

### D. Validate album CRUD
1. Create album
2. Rename album
3. Delete album

Expected:
- operations reflect immediately in list APIs

### E. Validate sharing (Sprint 3)
1. From **List Albums**, copy an album ID with assets
2. In sharing section, create a share:
   - without password, then with password
3. Open share payload by token
4. For protected share, verify wrong/missing password fails, correct password succeeds

Expected:
- tokenized share object returned
- shared payload includes derivative URLs only (`/api/shares/:token/assets/:assetId/file`)
- expired share (if tested) returns access failure

## 3) Quick Smoke Test
With server running:
```bash
node scripts/smoke-uat.mjs
```

Expected:
- JSON output with healthy status and nonzero imported assets

## 4) Sprint 3 Exit Criteria
- [ ] Share links can be created for albums
- [ ] Password + expiry controls function
- [ ] Share file endpoint serves derivative content only
- [ ] UAT console can drive end-to-end validation without command-line API calls

## 5) Notes / Current Limits
- Derivative generation currently supports web-friendly source files already in JPEG/MP4 form.
- ARW/MTS derivative conversion pipeline is not complete yet and will be expanded in follow-on sprint work.
