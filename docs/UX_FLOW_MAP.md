# Alpha UX Flow Map (Design Gate)

Purpose: define the organic, user-led flow for the owner experience before Sprint 4 implementation.

## Core Intent Flows

## 1) Ingest Quickly (Owner)
**Trigger:** "I just came back from shooting"

1. Open site (owner home)
2. Start import with batch files
3. Pick album behavior (day taken / day imported / custom)
4. Confirm import summary
5. Land on "Import Complete" state with:
   - created album links
   - import counts
   - quick actions: browse library / open album / share album

**Primary UX outcome:** low-friction ingest + immediate confidence.

---

## 2) Relive Naturally (Owner)
**Trigger:** "Show me what I shot"

1. Open Library timeline (default view)
2. Browse by day sections (hero card + supporting assets)
3. Filter (photo/video/search/camera)
4. Open asset detail
5. Optional actions:
   - download original
   - add to album
   - remove from album

**Primary UX outcome:** memory-first browsing, not admin-first browsing.

---

## 3) Curate Album (Owner)
**Trigger:** "I want this trip/story organized"

1. Open Album Studio
2. Create or open album
3. Add/remove assets
4. Rename and tune ordering policy
5. Confirm album composition

**Primary UX outcome:** clean curation loop with clear state.

---

## 4) Share Confidently (Owner)
**Trigger:** "I want family/friends to view this"

1. Choose album
2. Create share token
3. Optional controls: password + expiry
4. Preview recipient page
5. Copy and send share link
6. Revoke share if needed

**Primary UX outcome:** trust + control + speed.

---

## 5) View Shared Album (Recipient)
**Trigger:** user opens share link

1. Open `share.html?token=...`
2. If protected, enter password
3. See album items (derivative only)
4. View media smoothly on mobile/desktop

**Primary UX outcome:** instant, safe, low-confusion sharing experience.

## Key Decision Points
- Import rule selection
- Duplicate handling visibility
- Asset availability when derivatives are missing
- Share access policy (open/password/expiry)

## Failure States (must be explicit)
- Upload failure (network)
- Import partial success
- Derivative unavailable
- Share expired
- Share password invalid

## Success Metrics (experience-level)
- Time to first successful import
- Time from import complete to first album open
- Share creation success rate
- Share access success rate (password flow)
