# CLAUDE.md

Guidance for Claude when working in this repository.

## Project

Classroom simulator for the **Define Combine Procedure (DCP)**, a redistricting mechanism from Palmer, Schneer, and DeLuca. Used in a ~12-student political science class. Rebuild of a 2024 R/Shiny prototype at `../DefineCombineApp2024/`.

See `PLAN.md` for the full plan, milestones, and testing strategy. Read it before making architectural decisions.

## User

Max is a political science researcher. He is **not fluent in JavaScript** and will rely on Claude to make updates. Optimize for:
- **Readable, conventional code** — prefer idiomatic React/TS patterns over clever ones.
- **Strong types** — TypeScript strict mode. Types are documentation.
- **Good error messages** — when something fails, the user should see what and why in plain language.
- **Tests that double as spec** — when Max asks "does it enforce X?", a test file should be the answer.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind. SVG for map rendering.
- **Backend:** Netlify Functions + Netlify Blobs (free tier).
- **Asset generation:** Python (script is source of truth; generated JSON is committed).
- **Tests:** Vitest (unit + integration), fast-check (property-based), Playwright (E2E + visual), axe-core (a11y).
- **CI:** GitHub Actions.

## Repo layout (planned)

```
/app                React app (Vite)
  /src
    /lib            Pure logic (contiguity, validation, voter distributions, seat counts)
    /components     UI components
    /modes          uni / dcp-solo / dcp-competitive
    /assets         Generated grid JSON
/functions          Netlify Functions
/scripts            Python grid generator
/tests              Playwright E2E
/docs               DCP research PDFs (read-only reference)
PLAN.md             Plan + testing strategy
CLAUDE.md           This file
```

## Conventions

- **Pure functions in `/lib`** — no React, no DOM, no fetch. Fully unit-testable.
- **No logic in components** — components call lib functions and render.
- **Validation errors are structured** — `{code, message, details}`, not bare strings. UI translates to user text.
- **Seeded randomness everywhere** — never call `Math.random()` directly. Use a seeded PRNG (e.g., `seedrandom`). Enables reproducible tests and same-seed voter distributions across paired students.
- **IDs over indices** — block IDs, district labels ("A"–"J" for sub-districts, 1–N for final districts), student IDs. Avoid positional coupling.

## Testing rules

- Every function in `/lib` has a unit test.
- Validation rules (population, contiguity, doughnut, pair adjacency) each have dedicated test files citing the rule.
- Before marking a milestone complete: units pass, integration passes, Playwright passes, manual UX checklist from `PLAN.md` run.

## Workflow

- Commit at the end of each milestone and at meaningful sub-steps within.
- Push to GitHub after each milestone.
- Netlify deploys automatically from `main`.
- When adding a validation rule, add the test first.

## Reference

- `../DefineCombineApp2024/uni/` and `../DefineCombineApp2024/dcp/` — original Shiny prototypes. Data files in `data/` show the grid/adjacency/plan encoding.
- `docs/Palmer_Schneer_DeLuca_Define_Combine.pdf` — the paper defining DCP rules.
