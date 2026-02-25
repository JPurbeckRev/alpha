# Risk Escalation Protocol (Alpha)

This protocol operationalizes Jon's directive: execute independently, escalate before likely failure.

## Escalate Immediately If Any Trigger Is True
1. Estimated miss risk >30% on committed sprint objective.
2. Blocker older than 4 working hours with no clear workaround.
3. Requirement ambiguity likely to cause >1 day rework.
4. Security/privacy concern that could violate PRD storage/sharing principles.
5. Data-loss risk or irrecoverable migration risk.

## Escalation Message Format
- **Risk:** what may fail
- **Confidence:** low/medium/high
- **Impact:** scope/time/quality consequences
- **Options:** 2-3 concrete paths
- **Recommendation:** one clear choice
- **Needed from Jon:** exact decision/input

## Cadence
- At sprint start: identify top 3 risks.
- Mid-sprint: refresh risk table.
- Sprint close: capture realized vs avoided failures in TEAM_VOICES/HANDOFF.
