# DCP Simulator

A classroom webapp for the **Define Combine Procedure**, a redistricting mechanism from [Palmer, Schneer, and DeLuca](docs/Palmer_Schneer_DeLuca_Define_Combine.pdf). Students draw district maps on a hex grid, then swap and combine each other's maps in a competitive exercise that demonstrates how the DCP constrains gerrymandering.

**Live:** https://dcp-simulator.netlify.app

## Modes

### Uni (solo)
Draw the best unilateral gerrymander for your party on a hex grid. Practice mode — no opponent.

### DCP (solo)
Practice the full Define Combine Procedure: draw sub-districts, then pair them into final districts. Both stages in one view.

### Classroom session
Multiplayer competitive mode for ~6–12 students:

1. **Teacher** creates a session, picks grid size, district count, and number of rounds.
2. **Students** join with a 5-letter code and a display name.
3. Each round: every student draws sub-districts as **Party A** (define stage), then is randomly paired with a partner and combines their partner's sub-districts as **Party B** (combine stage).
4. **Score** = Party A seats in the map you *drew*, after your adversarial partner combined it. Higher is better.
5. Teacher dashboard shows live progress, per-round results, and a cumulative scoreboard.

## Features

- **Drag-paint** hex blocks to assign districts; click to toggle
- **Undo/redo** across all drawing surfaces (buttons + Cmd/Ctrl+Z)
- **Validation** enforces equal population, contiguity, no doughnut districts, and adjacent pairing
- **Random plan** button loads a pre-generated valid plan for quick starts
- **6 voter distributions**: Random 50/50, Random 40/60, and 4 spatially-clustered modes (fuzzy, not perfectly homogeneous)
- **Hotkeys**: arrow keys or 1–9 to switch districts, V to validate, Esc to dismiss
- **Pairing fairness**: avoids re-pairing prior partners; rotates sit-outs for odd class sizes
- **Offline resilience**: keeps last-known state during network blips; detects ended sessions
- **Accessible**: ARIA live regions, keyboard navigation, color-blind-safe palette, mobile-responsive layout

## Grid sizes

| Grid | Shape | District options |
|---|---|---|
| 70 blocks | Organic blob | 7 or 14 districts |
| 140 blocks | Elliptical | 7, 10, 14, or 20 districts |

## Quick start

### Solo modes (no server needed)
```bash
cd app
npm install
npm run dev
```
Open http://localhost:5173.

### Classroom sessions
```bash
cd app
npm install
npm run dev:session
```
Open http://localhost:8888. Requires [Netlify CLI](https://docs.netlify.com/cli/get-started/) login (`npx netlify login`).

### Run tests
```bash
cd app
npm test              # 33 unit tests (Vitest)
npm run test:e2e      # 15 browser tests (Playwright, auto-starts server)
npm run test:dryrun   # headless 12-student simulation (needs dev:session running)
```

### Regenerate grid assets
Only needed if grid geometry changes. Requires R with `sf`, `redist`, `jsonlite`, `dplyr`, `tidyr`, `purrr`.
```bash
Rscript scripts/generate_grids.R all
```

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Netlify Functions + Netlify Blobs (free tier)
- **Grid generation:** R (`sf` + `redist::redist_smc`), run once, output committed as JSON
- **Tests:** Vitest, Playwright, headless API dry-run script

## Deploy

Connected to Netlify via GitHub. Push to `main` triggers auto-deploy.

- **Base directory:** `app`
- **Build command:** `npm run build`
- **Publish directory:** `app/dist`

## Reference

- Palmer, Schneer, and DeLuca. "The Define-Combine Procedure for Redistricting." ([PDF](docs/Palmer_Schneer_DeLuca_Define_Combine.pdf))
