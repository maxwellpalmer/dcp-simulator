# CLAUDE.md

Guidance for Claude when working in this repository.

## Project

Classroom simulator for the **Define Combine Procedure (DCP)**, a redistricting mechanism from Palmer, Schneer, and DeLuca. Used in a ~12-student political science class. Rebuild of a 2024 R/Shiny prototype at `../DefineCombineApp2024/`.

**Live at:** https://dcp-simulator.netlify.app
**Repo:** https://github.com/maxwellpalmer/dcp-simulator

## User

Max is a political science researcher. He is **not fluent in JavaScript** and will rely on Claude to make updates. Optimize for:
- **Readable, conventional code** — prefer idiomatic React/TS patterns over clever ones.
- **Strong types** — TypeScript strict mode. Types are documentation.
- **Good error messages** — when something fails, the user should see what and why in plain language.
- **Tests that double as spec** — when Max asks "does it enforce X?", a test file should be the answer.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind. SVG for map rendering.
- **Backend:** Netlify Functions + Netlify Blobs (free tier). Per-student blob keys to avoid concurrent-write races.
- **Asset generation:** R script (`scripts/generate_grids.R`) using `sf` + `redist::redist_smc`. Run once; JSON output committed. Zero R dependency at runtime.
- **Tests:** Vitest (33 unit tests), Playwright (15 E2E tests), dry-run script (headless API simulation).

## Repo layout

```
/app                    React app (Vite)
  /src
    /lib                Pure logic (types, grid, validate, voters, combine,
                        stats, scoreboard, random, serialize, palette,
                        centroid, api, useSession, useHistoryState, sessionStorage)
    /components         MapView, DistrictPicker, StatsTable
    /modes
      UniMode.tsx       Solo unilateral redistricting
      DCPMode.tsx       Solo DCP (define + combine)
      MultiplayerMode.tsx  Classroom session wrapper (join, lobby, routing)
      /multiplayer
        DefineStage.tsx
        CombineStage.tsx
        ResultsView.tsx
        SessionSummary.tsx
        TeacherPanel.tsx
    /assets             grid_70.json, grid_140.json (generated, committed)
  /e2e                  Playwright E2E tests
  /netlify/functions    Netlify Functions (9 endpoints)
  /shared
    session.ts          Types shared between frontend and functions
/scripts
  generate_grids.R      Grid + random plan generator
  dry_run.ts            Headless classroom simulation
/docs                   DCP research PDFs (read-only reference)
```

## Conventions

- **Pure functions in `/lib`** — no React, no DOM, no fetch. Fully unit-testable.
- **No logic in components** — components call lib functions and render.
- **Validation errors are structured** — `{code, message, details}`, not bare strings.
- **Seeded randomness everywhere** — never call `Math.random()` directly. Use `makeRng()` from `lib/random.ts`.
- **IDs over indices** — block IDs, district labels ("A"–"T" for sub-districts, 1–N for final districts), student IDs.
- **Per-student blob keys** — defines and combines stored at `session/{code}/round/{n}/define/{studentId}` to avoid read-modify-write races under concurrent submissions. `loadRound()` re-aggregates.

## Testing

- `npm test` — 33 Vitest unit tests (grid, validation, voters, combine, serialize, scoreboard, undo/redo)
- `npm run test:e2e` — 15 Playwright E2E tests (auto-starts netlify dev). Uni solo (7), DCP solo (5), multiplayer (3).
- `npm run test:dryrun` — headless API simulation of a full classroom session (requires `netlify dev` running). Configurable: `STUDENTS=12 ROUNDS=2 BASE=http://localhost:8888`.

## Workflow

- Commit at meaningful sub-steps.
- **Do not push without user approval.** Netlify auto-deploys from `main`.
- When adding a validation rule, add the test first.

## Competitive mode scoring

In classroom sessions, each student plays **Party A during Define** and **Party B during Combine**. A student's score = the A seats in the map they *drew*, after their partner combined it adversarially. The combiner's work tests the definer's gerrymander, not the combiner's skill.

## Reference

- `../DefineCombineApp2024/uni/` and `../DefineCombineApp2024/dcp/` — original Shiny prototypes.
- `docs/Palmer_Schneer_DeLuca_Define_Combine.pdf` — the paper defining DCP rules.
