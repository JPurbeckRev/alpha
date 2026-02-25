# Alpha

Project workspace for Alpha.

## Core Operating Files
- `SPRINT_TEAM_PERSONAS.md` — domain personas and guiding principles
- `PRD.md` — product requirements and round-specific scope
- `MEMORY.md` — durable project thoughts/decisions
- `HANDOFF.md` — authoritative current state + timestamped handoff progression log
- `TEAM_VOICES.md` — per-round discipline voices
- `RISK_ESCALATION.md` — pre-failure escalation protocol

## Design Gate Artifacts
- `docs/DESIGN_ASSESSMENT.md`
- `docs/UX_FLOW_MAP.md`
- `docs/WIREFRAME_SPEC.md`
- `docs/DESIGN_GATE_CHECKLIST.md`

## Build Surface
- Backend service: `src/server.js`
- Owner site: `app/index.html`
- Shared page: `app/share.html`
- API docs: `docs/API.md`
- Sprint reports: `SPRINTS/`

## Run
```bash
npm install
npm start
npm test
```

## Sprint Evaluation Site
```bash
npm run uat:seed
npm run uat:start
# optional smoke verification
npm run uat:smoke
```
- Owner site: `http://localhost:8787/app`
- Alias: `http://localhost:8787/uat`
- Evaluation checklist: `http://localhost:8787/docs/UAT.md`
- Includes derivative conversion-job controls on Home tab
