# DCP Simulator — Status

Last updated: 2026-04-17

**Live:** https://dcp-simulator.netlify.app
**Repo:** https://github.com/maxwellpalmer/dcp-simulator

## Progress summary

All milestones complete.

| Milestone | Status | Notes |
|---|---|---|
| M1 Grid generator + assets | ✅ | R script; 70-block blob + 140-block elliptical grids; 100+ random plans per district-count option |
| M2 Uni mode (solo) | ✅ | Drag-paint, hotkeys, validation (pop/contiguity/doughnut), random plan, live stats, undo/redo |
| M3 DCP solo practice | ✅ | Define + combine stages, perimeter outlines, pair validation, live seat counts |
| M4 Multi-user sessions | ✅ | Netlify Functions + Blobs; concurrent-safe per-student blob keys; create/join/round flow |
| M5 Teacher dashboard | ✅ | Passphrase + token auth, cumulative A-only scoreboard, round history, copy code, end session |
| M6 Polish | ✅ | Undo/redo, pairing fairness, end-of-session summary, role banners, error/offline UI, a11y, mobile |
| M7 Classroom dry run | ✅ | Headless script (12×2, 11×3), Playwright E2E (15 tests) |

## Tests

- **33 unit tests** (Vitest): grid, validation, voters, combine, serialize, scoreboard, undo/redo
- **15 Playwright E2E tests**: Uni solo (7), DCP solo (5), multiplayer (3)
- **Headless dry-run script**: full session API with configurable N students × R rounds

## How to run

### Solo modes (no backend)
```
cd app && npm run dev
```
Open http://localhost:5173. Uni and DCP solo modes work immediately.

### Classroom sessions (needs backend)
```
cd app && npm run dev:session
```
Open http://localhost:8888. "Classroom session" tab in top nav.

### Tests
```
cd app
npm test              # 33 unit tests
npm run test:e2e      # 15 Playwright (auto-starts netlify dev)
npm run test:dryrun   # headless session sim (needs netlify dev in another terminal)
```

### Asset regeneration
Only needed if grid geometry or district options change:
```
Rscript scripts/generate_grids.R all    # from repo root
```
Requires R with `sf`, `redist`, `jsonlite`, `dplyr`, `tidyr`, `purrr`.

### Deploy
Push to `main` → Netlify auto-deploys. Base directory: `app`. Build command: `npm run build`. Publish: `app/dist`.

## Repo layout

```
/app
  /src
    /lib              Pure logic (types, grid, validate, voters, combine,
                      stats, scoreboard, random, serialize, palette,
                      centroid, api, useSession, useHistoryState, sessionStorage)
    /components       MapView, DistrictPicker, StatsTable
    /modes
      UniMode.tsx
      DCPMode.tsx
      MultiplayerMode.tsx
      /multiplayer    DefineStage, CombineStage, ResultsView,
                      SessionSummary, TeacherPanel
    /assets           grid_70.json, grid_140.json
  /e2e                Playwright tests (uni-solo, dcp-solo, multiplayer)
  /netlify/functions  9 API endpoints (create, join, state, start-round,
                      submit-define, submit-combine, advance, end, verify-teacher)
  /shared
    session.ts        Types shared between frontend and functions
/scripts
  generate_grids.R    Grid + random plan generator (R)
  dry_run.ts          Headless classroom simulation (tsx)
/docs                 DCP research PDFs
PLAN.md               Full plan with design decisions
CLAUDE.md             Guidance for Claude
STATUS.md             This file
```

## Design decisions

- **Hex grids:** 70-block blob reused from 2024 prototype; 140-block elliptical shape hand-tuned.
- **Random plans:** generated once by `redist::redist_smc`, committed as JSON. No runtime R.
- **Client-side math:** validation, voter shuffling, stats, scoreboard all computed in the browser. Server only stores and routes.
- **Polling, not WebSockets:** 2s poll interval, sufficient for classroom scale (~12 students).
- **Per-student blob keys:** each student's define/combine stored separately to avoid read-modify-write races under concurrent submissions.
- **A-only scoring:** in competitive mode, each student's score is the A seats in the map they *drew* (after adversarial partner combined it). The combiner's work tests the definer's gerrymander.
- **Pairing fairness:** randomized backtracking avoids re-pairing prior partners; sitter rotation distributes sit-outs evenly for odd class sizes.
- **Voter distributions:** 50/50 default; 40/60, and 4 clustered modes (fuzzy spatial clustering with ~15–20% noise).
