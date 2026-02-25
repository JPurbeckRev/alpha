# UAT Guide (Sprint 2)

This environment is prepared for PM/Creative Director validation of Sprint 2 scope.

## 1) Start UAT Environment
```bash
npm install
npm run uat:seed
npm run uat:start
```

Open:
- UAT Console: `http://localhost:8787/uat`
- API docs: `http://localhost:8787/docs/API.md`

## 2) Minimum UAT Flow (Expected Pass)

### A. Health & baseline
1. Click **Check Health**
2. Click **Check Library Summary**

Expected:
- `ok: true`
- summary values present

### B. Upload + import with album rule
1. In the Upload section, select files from `uat/sample_media`
2. Click **Upload to Staging**
3. Choose album rule (test all 3 over separate uploads):
   - `day_imported`
   - `day_taken`
   - `new_name` (set album name)
4. Click **Execute Import**

Expected:
- import log returned with counts
- duplicates skipped when duplicate content exists
- album(s) created when createAlbums is true

### C. Validate browse APIs
1. Click **Timeline (day_taken)**
2. Click **Timeline (day_imported)**
3. Click **List Assets**

Expected:
- paginated response shape
- assets grouped by day
- source file metadata present

### D. Validate album CRUD
1. Create album
2. List albums
3. Rename album
4. Delete album

Expected:
- all operations succeed
- list reflects changes

## 3) Sprint 2 Exit Criteria for UAT
- [ ] Upload + staging works from browser
- [ ] Import execution works and returns log
- [ ] Album creation rules are selectable and functional
- [ ] Library read APIs return data for timeline/assets
- [ ] Album CRUD endpoints work via UAT UI

## 4) Notes
- This is a backend-heavy UAT slice with lightweight operator UI.
- Full production UI is deferred to later milestones.
