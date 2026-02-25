# Alpha

Project workspace for Alpha.

## Core Operating Files
- `SPRINT_TEAM_PERSONAS.md` — domain personas and guiding principles
- `PRD.md` — product requirements and round-specific scope
- `MEMORY.md` — durable project thoughts/decisions
- `HANDOFF.md` — authoritative current state + timestamped handoff progression log (updated every dev cycle)
- `TEAM_VOICES.md` — per-round discipline voices (objections/advice/guidance/admonishments/frustration)
- `RISK_ESCALATION.md` — pre-failure escalation triggers and reporting format

## Build Surface (current)
- Backend service: `src/server.js`
- API docs: `docs/API.md`
- Sprint reports: `SPRINTS/`

## Run
```bash
npm install
npm start
npm test
```

## UAT
```bash
npm run uat:seed
npm run uat:start
# in another terminal
npm run uat:smoke
```
- UAT Console: `http://localhost:8787/uat`
- UAT Checklist: `http://localhost:8787/docs/UAT.md`
