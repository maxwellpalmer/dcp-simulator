# Define Combine Procedure Webapp — Plan

A classroom simulator for the Define Combine Procedure (DCP), rebuilt from the 2024 Shiny prototype as a polished, reliable, server-light webapp.

## Goals

Students practice redistricting in three modes:
1. **Uni mode** — draw the best unilateral gerrymander for their party.
2. **DCP practice (solo)** — draw sub-districts, then combine them.
3. **DCP competitive** — in each round, every student defines their own map, is randomly paired with another student, and combines their partner's map. Multiple rounds; cumulative scoreboard.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind. SVG rendering (hex count is small; SVG gives crisp styling and easy click targets).
- **Hosting:** Netlify (static site + Netlify Functions + Netlify Blobs). Free tier sufficient for classroom scale.
- **Asset generation:** R script (`scripts/generate_grids.R`) using `sf` for geometry and `redist::redist_smc` for valid random plan generation. Run once per grid-size change; JSON output committed to repo. The webapp has zero R dependency at runtime.
- **Testing:** Vitest (unit + integration), fast-check (property-based), Playwright (E2E + visual regression), axe-core (a11y), GitHub Actions (CI).

## Grid sizes (pre-generated)

Uni and DCP share one grid per session. The 140-block grid supports multiple district counts, so teacher picks both the grid size and the district count (or equivalently, district size).

| Grid | District options (Uni) | Sub-district options (DCP) |
|---|---|---|
| 70 blocks | 7 districts × 10 blocks | 14 sub × 5 blocks (7 final) |
| 140 blocks | 7 × 20, or 10 × 14 | 14 × 10 (7 final), or 20 × 7 (10 final) |

Each grid JSON ships with: block list (id, centroid, vertices), adjacency graph, inner boundary segments, outer boundary ring, and 100+ unique pre-generated valid random plans per supported district count.

## Voter distributions (teacher picks per round)

All 40/60 splits. Clusters are fuzzy (probabilistic falloff from a seed block, ~15–20% noise), not perfectly homogeneous.

- **Random** — uniform shuffle, seeded
- **Minority clustered (A)** — Party A at 40%, clustered
- **Majority clustered (A)** — Party A at 60%, clustered
- **Minority clustered (B)** — Party B at 40%, clustered
- **Majority clustered (B)** — Party B at 60%, clustered

Both students in a pair see the same distribution (same seed).

## Validation rules (enforced)

- Equal population per district / sub-district
- Contiguity (BFS on adjacency graph)
- No doughnut sub-districts (sub-district fully enclosed by another)
- Combine stage: paired sub-districts must be adjacent; each sub-district used exactly once

## Session / round flow

1. Teacher creates session → picks grid size, number of rounds, sets teacher passphrase.
2. Students join with session code + display name.
3. Teacher starts round → picks voter distribution → server pairs students randomly.
4. Each student defines their own map (sub-districts).
5. On submit, students swap: each receives their partner's sub-districts and performs the combine stage.
6. Teacher sees per-pair results and cumulative scoreboard on dashboard.
7. Teacher starts next round (re-pair). End session wipes blobs.

## Auth

- Students: session code + display name, no login.
- Teacher: session-scoped passphrase set at creation, required for dashboard and round controls.

## Data model (Netlify Blobs)

- `session/{code}` — grid size, rounds config, teacher passphrase hash, status
- `session/{code}/students` — roster
- `session/{code}/round/{n}/pairings` — pairings + voter seed + distribution type
- `session/{code}/round/{n}/plan/{studentId}` — define + combine submissions
- TTL: 24h auto-expire

## Testing plan

### 1. Unit tests (Vitest)
Pure logic:
- Contiguity BFS: connected / disconnected / single-block
- Population balance: exact, off-by-one, unbalanced
- Doughnut detection: contrived doughnut vs. legitimately enclosed-by-boundary
- Combine-pair adjacency across all grid sizes
- Voter distribution generators: counts sum correctly, clustering shows measurable spatial autocorrelation (Moran's I > threshold for cluster modes, ≈0 for random), seeded → deterministic
- Seat-count computation

### 2. Property-based (fast-check)
Random valid plans, invariants: total pop conserved, every block assigned exactly once, seat counts sum to N.

### 3. Grid asset validation
JS-side smoke tests: load each grid JSON and assert — adjacency graph is a single connected component, every random plan is contiguous and equal-population per JS validator (round-trip with R), vertex/inner-line counts are consistent.

### 4. Integration tests (Vitest + MSW)
Netlify Function handlers with mocked Blobs: create session → join → submit → retrieve; pairing algorithm handles odd/even class sizes; passphrase gate rejects wrong passphrase.

### 5. End-to-end (Playwright)
- Solo Uni: draw valid plan, validate, see stats
- Solo DCP: define + combine, see seats
- Two-browser competitive: teacher creates, two students join, round runs, results on dashboard
- Error paths: invalid submit, reconnect mid-round
- All three grid sizes

### 6. Visual regression
Playwright screenshots of map rendering at each size, each mode, each validation error state.

### 7. Accessibility
axe-core; keyboard-only flow (hotkeys are core to the prototype); color-blind-safe district palette.

### 8. Manual UX checklist (before each milestone ships)
- Click accuracy at grid edges / dense areas
- Hotkey discoverability (tooltips)
- Error messages actionable ("District 3 not contiguous — blocks 12, 15 disconnected")
- Undo/redo across all actions
- Laptop/tablet layout usable

### 9. Classroom dry run
Before first real use: simulate 12-student session with 12 browser tabs, run 2 rounds, verify dashboard.

### 10. CI
GitHub Actions runs units + integration + Playwright on every push. Netlify deploy previews per PR.

## Milestones

Each milestone fully tested before moving on.

1. **Grid generator + asset pipeline** ✅ — R script (`scripts/generate_grids.R`), 70- and 140-block grids, JSONs at `app/src/assets/grid_{70,140}.json`, 100+ valid random plans per district-count option.
2. **Uni mode (solo)** — full interactive map drawing, validation, stats
3. **DCP solo practice** — define + combine stages
4. **Multi-user session** — join, voter sync, round orchestration
5. **Teacher dashboard** — create session, monitor rounds, results
6. **Polish** — hotkeys, undo/redo, scoreboard, end-session cleanup
7. **Classroom dry run**
