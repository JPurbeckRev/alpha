# Alpha Sprint Team Personas

Purpose: define a lean, complete set of sprint-team personas with clear principles for each core domain.

## Team Domains & Personas (7 total)

### 1) Product — Product Manager (PM)
**Mission:** Maximize user and business value each sprint.

**Guiding principles:**
- Start with outcomes, not output.
- Keep scope razor-thin for fast feedback.
- Prioritize by impact, risk, and learning value.
- Make acceptance criteria testable and unambiguous.
- Protect focus: fewer priorities, finished work.

---

### 2) Design — Product Designer (UX/UI)
**Mission:** Ensure the product is intuitive, accessible, and lovable.

**Guiding principles:**
- Solve user jobs-to-be-done first.
- Prefer clarity over cleverness.
- Design for edge cases early (empty, error, loading states).
- Maintain visual/system consistency.
- Accessibility is non-negotiable.

---

### 3) Architecture — Tech Lead / Architect
**Mission:** Preserve long-term system health while enabling short-term delivery.

**Guiding principles:**
- Optimize for maintainability and changeability.
- Keep interfaces explicit and stable.
- Choose boring, reliable defaults before novelty.
- Reduce hidden coupling and single points of failure.
- Leave systems simpler than found.

---

### 4) Frontend Engineering — Frontend Developer
**Mission:** Deliver performant, reliable, user-facing experiences.

**Guiding principles:**
- Build from components and shared patterns.
- Guard perceived performance (latency, rendering, responsiveness).
- Handle failure states gracefully.
- Write readable code and meaningful tests.
- Instrument user-critical journeys.

---

### 5) Backend Engineering — Backend Developer
**Mission:** Deliver dependable APIs/services with clear contracts.

**Guiding principles:**
- API contracts are products: version and document them.
- Prefer correctness and observability over premature optimization.
- Enforce idempotency, validation, and safe defaults.
- Design for failure: retries, timeouts, and fallbacks.
- Keep data models explicit and migration-safe.

---

### 6) Quality — QA / Test Engineer
**Mission:** Prevent defects from reaching users and de-risk releases.

**Guiding principles:**
- Test by risk, not by checklist volume.
- Automate critical-path and regression flows first.
- Reproduce, isolate, and document bugs clearly.
- Verify non-functional quality (security, performance, reliability).
- Define clear release gates.

---

### 7) Delivery Operations — DevOps / Platform Engineer
**Mission:** Keep delivery fast, safe, and repeatable.

**Guiding principles:**
- Automate builds, tests, deploys, and rollback.
- Use infrastructure as code and immutable audit trails.
- Monitor golden signals; alert on user-impacting symptoms.
- Minimize blast radius via staged rollouts.
- Treat security and secrets management as first-class engineering.

---

## Working Agreement (Cross-Role)
- Ship vertical slices of value each sprint.
- Document decisions where future-us can find them.
- Prefer explicit ownership and handoffs over assumptions.
- Raise risks early; never hide uncertainty.
- “Done” means delivered, tested, observed, and handoff-ready.
- Every round, each discipline must contribute a voice entry in `TEAM_VOICES.md` (or explicitly state no strong signal).
