# Alpha Wireframe Spec (Low-Fi)

Purpose: provide implementation-ready wireframe guidance for owner site experience.

## Screen 1 — Owner Home (Primary Experience Launchpad)

### Intent
Home is not an admin dashboard. It is the fastest path through the core owner journey:
**Ingest quickly → Relive naturally → Share confidently**.

### Zones (priority order)
1. **Primary Hero: Import CTA**
   - Main action: "Import Photos/Videos"
   - Supporting text: upload a batch, choose album behavior, confirm import
   - Secondary action: "Resume Last Import" (shown when applicable)
2. **Continue Where You Left Off**
   - Last import summary (time, file count, albums created, errors if any)
   - Quick actions: Open Import Result / Open Created Albums / View Queue
3. **Recent Stories (Albums)**
   - 3–6 recent albums with cover, title, asset count, date span
   - Per-card actions: Open / Share / Edit
4. **Relive by Day (Timeline Preview)**
   - Day cards grouped by Day Taken with hero thumbnail + count
   - CTA: Open Library Timeline
5. **Sharing Quick Actions**
   - Create share link inline (album picker + optional password + optional expiry)
   - Active shares mini-list with revoke control
6. **Conversion & Processing Health (Compact Utility Panel)**
   - queued/running/failed counts
   - actions: View Jobs / Retry Failed
   - intentionally compact and secondary in visual hierarchy
7. **New User Empty State**
   - If no assets/imports: guided first-run module with single CTA "Import Your First Trip"

### Copy/Label Guidance
- Prefer memory-led language (trip, day, moments, story) over implementation-led terms (batch ID, payload).
- Keep technical terms visible only in secondary/advanced surfaces.

### Acceptance
- Primary import CTA is visible without scroll on standard laptop viewport.
- User can reach one of these outcomes in <=2 clicks from Home:
  1) start import,
  2) open latest album/story,
  3) create/revoke share,
  4) inspect conversion failures.
- Home communicates current progress without requiring API/log literacy.
- Conversion/job controls are present but not dominant over memory/story browsing.
- Empty state clearly instructs first action and expected outcome.

---

## Screen 2 — Import Flow

### Components
- File picker
- Album rule selector
- Optional custom album name
- Primary CTA: "Upload + Import"
- Import result panel (summary + created albums)

### States
- Idle
- Uploading
- Importing
- Success
- Error

### Acceptance
- User can complete upload/import without raw API knowledge
- Results include actionable next steps

---

## Screen 3 — Library Timeline

### Components
- Grouping control (day taken/day imported)
- Filter controls (type/search)
- Day sections containing media cards
- Each media card shows:
  - thumbnail/preview
  - media type
  - date
  - source download links (owner)

### Acceptance
- Cards render with meaningful hierarchy
- Missing preview handled gracefully

---

## Screen 4 — Album Studio

### Components
- Left panel: album list with counts
- Right panel:
  - selected album controls (rename/delete)
  - add asset input
  - album asset grid with remove controls

### Acceptance
- Album operations are discoverable without docs
- Owner can curate with minimal clicks

---

## Screen 5 — Sharing Studio

### Components
- Create share form:
  - album ID
  - optional password
  - optional expiry
- Share list:
  - link
  - status (expired/protected)
  - revoke control
- copy-link action

### Acceptance
- Owner can create, verify, and revoke share in one place

---

## Screen 6 — Recipient Share Page

### Components
- Album title and count
- optional password gate
- media grid
- derivative-only playback/viewing

### Acceptance
- Protected shares request password clearly
- Invalid password and expiry errors are friendly and precise

## Interaction States (global)
- Empty state: instructional, not dead-end
- Loading state: visible progress text/skeleton style
- Error state: short, actionable explanation
- Success state: clear next action CTA
