# Alpha Team Voices Log

Purpose: capture the explicit voice of each core discipline every development round, including strong objections, advice, guidance, admonishments, and frustration signals.

## Core Rule (Mandatory)
For every dev round, log entries by team discipline. If there is a strong signal (objection/advice/guidance/admonishment/frustration), it must be recorded verbatim or near-verbatim with clear action implications.

## Disciplines (must all be represented)
1. Product (PM)
2. Design (UX/UI)
3. Architecture (Tech Lead)
4. Frontend Engineering
5. Backend Engineering
6. Quality (QA)
7. Delivery Operations (DevOps)

## Signal Types
- **Objection** — disagrees with scope/approach and may block progression
- **Advice** — recommended improvement or optimization
- **Guidance** — directional instruction to reduce risk
- **Admonishment** — warning about process/quality deviation
- **Frustration** — pain signal indicating hidden process or technical debt

## Severity
- **Low:** informational, non-blocking
- **Medium:** should be addressed this round
- **High:** likely sprint risk if unaddressed
- **Blocker:** progression should pause until resolved or explicitly waived

## Round Template

## Round: <ID/Name>
**Window:** <start> → <end>
**PRD Version:** <link or note>

| Timestamp (PST) | Discipline | Signal Type | Severity | Voice (quote or concise summary) | Impact if Ignored | Prescribed Action | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| YYYY-MM-DD HH:MM | Product | Guidance | Medium | ... | ... | ... | ... | Open |
| YYYY-MM-DD HH:MM | Design | Objection | High | ... | ... | ... | ... | Open |
| YYYY-MM-DD HH:MM | Architecture | Advice | Medium | ... | ... | ... | ... | Open |
| YYYY-MM-DD HH:MM | Frontend | Frustration | Medium | ... | ... | ... | ... | Open |
| YYYY-MM-DD HH:MM | Backend | Guidance | Low | ... | ... | ... | ... | Open |
| YYYY-MM-DD HH:MM | Quality | Admonishment | High | ... | ... | ... | ... | Open |
| YYYY-MM-DD HH:MM | DevOps | Objection | Blocker | ... | ... | ... | ... | Open |

## Logging Rules
- Append-only. Never rewrite historical voice entries.
- One or more entries per discipline per round.
- If a discipline has no strong signal, log: `No strong signal this round`.
- Any **Blocker** must be referenced in `HANDOFF.md` before moving to next step.
- Resolve each open high/blocker signal with an explicit status update.

## Initial Entry
- 2026-02-24 22:17 PST — Directive adopted: discipline voices are mandatory round artifacts.
