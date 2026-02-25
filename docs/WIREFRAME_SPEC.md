# Alpha Wireframe Spec (Low-Fi)

Purpose: provide implementation-ready wireframe guidance for owner site experience.

## Screen 1 — Owner Home

### Zones
1. Top nav: Home / Import / Library / Albums / Sharing
2. Health/status badges (assets, albums, shares, imports)
3. Quick links to design and sprint docs

### Acceptance
- Status visible in <2 seconds
- Navigation obvious and persistent

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
