# Designer–Executor Workflow (Gemini ↔ Codex)

## Roles
- **Designer (Gemini):** Defines solution direction, architecture, UX decisions, and explicit implementation tasks.
- **Executor (Codex, this agent):** Implements code changes, runs checks, reports outcomes, and commits.

## Working Agreement
1. Designer sends a task packet (template below).
2. Executor implements exactly what's specified unless blocked.
3. Executor runs validation checks and reports pass/fail.
4. Executor commits with a scoped message.
5. Executor returns a completion report + commit hash.
6. Designer reviews and sends next packet.

## Task Packet Template (from Designer)
```md
Task ID:
Goal:
Scope (files allowed):
Non-goals:
Implementation notes:
Acceptance criteria:
Validation commands:
Commit message suggestion:
```

## Execution Report Template (from Executor)
```md
Task ID:
Status: Done | Blocked | Partial
What changed:
Files touched:
Validation results:
Commit: <hash>
Notes/Risks:
```

## Conflict Avoidance
- Prefer **file ownership per task** (no overlap).
- If overlap is required, lock order: **Designer spec → Executor edit → Designer review**.
- Keep commits small and single-purpose.

## Escalation
Executor escalates early when:
- acceptance criteria conflict with current code reality,
- required files exceed allowed scope,
- tests fail for unrelated pre-existing reasons,
- or spec ambiguity could cause rework.

## Branching
- Default: work on current branch unless directed otherwise.
- Optional for parallel work: `designer/*` for spec branches, `executor/*` for implementation branches.
