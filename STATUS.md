# DCP Simulator — Status

Last updated: 2026-04-13

## Progress summary

| Milestone | Status | Notes |
|---|---|---|
| M1 Grid generator + assets | ✅ Done | R script; 70- and 140-block grids; 100+ random plans per district-count option |
| M2 Uni mode (solo) | ✅ Done | Drag-paint, hotkeys, validation incl. doughnut rule, random plan, live stats |
| M3 DCP solo practice | ✅ Done | Define + combine stages with perimeter outline, pair-validation, live seat counts |
| M4 Multi-user sessions | ✅ Done | Netlify Functions + Blobs; create/join/round flow working end-to-end |
| M5 Teacher dashboard | ✅ Done | Passphrase auth, scoreboard, round history, end-session, copy code |
| M6 Polish | ⬜ Pending | Undo/redo, a11y, end-of-session summary, mobile layout check |
| M7 Classroom dry run | ⬜ Pending | 12-tab simulation, 2 rounds, verify dashboard |

**Tests:** 27 unit tests passing (Vitest). Production build: ~505 KB (incl. bundled grid JSON).

## What works now

### Solo modes (no backend needed)
- Run: `cd app && npm run dev` → http://localhost:5173
- **Uni**: pick grid (70/140) and district count; drag-paint; validate; random plan; stats
- **DCP**: define stage → combine stage with live final-seat counts; pair validation

### Multi-user mode (needs Netlify Functions)
- Run: `cd app && npm run dev:session` → http://localhost:8888
- Top nav → "Classroom session"
- Teacher creates session (passphrase optional); shares code
- Students join with code + name
- Teacher starts round → define → auto-swap → combine → done
- Teacher advances, sees live progress, cumulative scoreboard, per-round history
- End session wipes blobs

## Repo layout

```
/app
  /src
    /lib          Pure logic (validation, voters, stats, scoreboard, api, ...)
    /components   MapView, DistrictPicker, StatsTable
    /modes
      UniMode.tsx
      DCPMode.tsx
      MultiplayerMode.tsx
      /multiplayer
        DefineStage.tsx
        CombineStage.tsx
        ResultsView.tsx
        TeacherPanel.tsx
    /assets       grid_70.json, grid_140.json (generated, committed)
  /netlify/functions
    session-create / join / state / start-round /
    submit-define / submit-combine / advance / end / verify-teacher
  /shared
    session.ts    Types shared between frontend and functions
/scripts
  generate_grids.R
/docs             Reference PDFs (Palmer et al., summary, conversation)
PLAN.md           Overall plan and testing strategy
CLAUDE.md         Guidance for Claude agents
STATUS.md         This file
```

## Local-dev notes

- `npm run dev` (vite only) works for Uni and DCP solo modes — no API needed.
- `npm run dev:session` (netlify dev) starts both Vite and the Netlify Functions at http://localhost:8888. Required for Classroom mode.
- `npm run test` runs the Vitest unit suite.
- Asset regeneration: `Rscript scripts/generate_grids.R all` (from repo root). Only needed if grid geometry or district options change.

## Known gaps / caveats

- **Netlify dev untested by Claude** — I built the functions but haven't run `netlify dev` myself. If blobs fail locally, may need `netlify login` / linked site, or `NETLIFY_BLOBS_CONTEXT` env var. Production (deployed) should work out of the box.
- **No persistence tests** — function handlers don't have integration tests yet. Gap to fill before classroom use.
- **No Playwright / E2E** — planned but not built. Manual testing only.
- **Mobile layout untested** — laptop-first; verify before dry run.
- **Round pairing is random each round** — no logic to avoid re-pairing the same two students across rounds. Minor issue; address if it matters for a 12-student 3-round session.
- **Odd student sits out** — if an odd number joins, one student doesn't participate that round. Could rotate the "sitter" to be fair across rounds; not currently implemented.
- **Teacher token auto-generated at create** — teacher can bookmark `?code=X&role=teacher`, the localStorage has the token. If they lose it, the passphrase login still works (only if they set one).

## Next steps (in recommended order)

### Immediate (before first real classroom use)
1. **Actually run `netlify dev` locally** — verify functions and blobs work. Fix any CLI / auth issues.
2. **12-tab smoke test (M7, partial)** — one teacher + 11 students across browser windows; 2 rounds; confirm pairings, swaps, scoreboard all behave.
3. **Deploy to Netlify** — push to GitHub, connect Netlify, verify production flow.

### M6 Polish
1. Undo/redo in all drawing modes (solo + multiplayer define + combine).
2. Accessibility pass: axe-core run, keyboard navigation, ARIA labels on key buttons.
3. End-of-session summary screen for students when all rounds done.
4. Mobile/tablet layout check (header wraps; side panel stacks vertically).
5. Better loading states and error recovery (network errors, lost studentId, etc.).
6. Re-pairing avoidance across rounds.
7. Rotate which student sits out (if odd count) across rounds.

### M7 Classroom dry run
1. Write a scripted 12-client walkthrough (optional: Playwright E2E).
2. Pilot with real students; log issues.

### Backlog / ideas
- QR code for session code (landing page + dashboard).
- Export session results as CSV.
- Ability for teacher to "peek" at any student's map live.
- Dark mode.
- Configurable voter split (not just 40/60).
- More voter-distribution shapes (urban/rural, split cluster, etc.).
- Animations when blocks assign/unassign.
- Session resume: teacher can view results of a past session via URL.

## Design decisions worth remembering

- **Hex grid geometry** reused from 2024 R/Shiny prototype (70-block file) for continuity; 140-block is newly generated.
- **Random plans** generated server-side once by `redist::redist_smc`, committed as JSON. No runtime R dependency.
- **Client-side math** for everything: validation, voter shuffling, stats, scoreboard. Server only stores and routes.
- **Polling, not WebSockets** — 2s poll is cheap and fine at classroom scale.
- **One session per grid+district choice** — teacher picks at create; cannot change mid-session.
- **Voter distribution is per-round**, teacher picks before starting each round; paired students always see the same distribution (same seed).
- **Combine = each student combines their partner's sub-districts** (not their own). Defined per PLAN.md.
