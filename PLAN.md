# Define Combine Procedure Webapp — Plan

A classroom simulator for the Define Combine Procedure (DCP), rebuilt from the 2024 Shiny prototype as a polished, reliable, server-light webapp.

## Goals

Students practice redistricting in three modes:
1. **Uni mode** — draw the best unilateral gerrymander for their party.
2. **DCP practice (solo)** — draw sub-districts, then combine them.
3. **DCP competitive** — in each round, every student defines their own map (as Party A), is randomly paired, and combines their partner's map (as Party B). Multiple rounds; cumulative scoreboard. Score = A seats in the map you *drew*.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind. SVG rendering.
- **Hosting:** Netlify (static site + Netlify Functions + Netlify Blobs). Free tier.
- **Asset generation:** R script (`scripts/generate_grids.R`) using `sf` for geometry and `redist::redist_smc` for valid random plan generation. Run once per grid-size change; JSON output committed. Zero R dependency at runtime.
- **Tests:** Vitest (unit), Playwright (E2E), dry-run script (headless API simulation).

## Grid sizes (pre-generated)

Uni and DCP share one grid per session. Teacher picks both grid size and district count.

| Grid | Shape | District options (Uni) | Sub-district options (DCP) |
|---|---|---|---|
| 70 blocks | Hand-curated blob (from 2024 prototype) | 7 districts × 10 blocks | 14 sub × 5 blocks (7 final) |
| 140 blocks | Elliptical, hand-tuned edges | 7 × 20, or 10 × 14 | 14 × 10 (7 final), or 20 × 7 (10 final) |

Each grid JSON ships with: block list (id, centroid, vertices), adjacency graph, inner boundary segments, outer boundary ring, and 100+ unique pre-generated valid random plans per supported district count.

## Voter distributions (teacher picks per round)

Default is 50/50. All options:

- **Random (50/50)** — uniform shuffle, seeded, equal A and B (default)
- **Random (40/60)** — uniform shuffle, seeded, 40% A / 60% B
- **Minority clustered (A)** — Party A at 40%, spatially clustered with ~15–20% noise
- **Majority clustered (A)** — Party A at 60%, spatially clustered
- **Minority clustered (B)** — Party B at 40%, spatially clustered
- **Majority clustered (B)** — Party B at 60%, spatially clustered

Both students in a pair see the same distribution (same seed).

## Validation rules (enforced)

- Equal population per district / sub-district
- Contiguity (BFS on adjacency graph)
- No doughnut sub-districts (sub-district fully enclosed by another)
- Combine stage: paired sub-districts must be adjacent; each sub-district used exactly once

## Session / round flow

1. Teacher creates session → picks grid size, district count, number of rounds, default voter distribution. Optional passphrase.
2. Students join with session code + display name.
3. Teacher starts round → picks voter distribution for this round → server pairs students randomly (avoids re-pairing prior partners when possible; rotates sitter for odd counts).
4. Each student is Party A and defines their own map (sub-districts).
5. On submit, students swap: each receives their partner's sub-districts and, as Party B, performs the combine stage.
6. Teacher sees per-pair results and cumulative scoreboard on dashboard. Score = A seats in the map the student defined.
7. Teacher starts next round (re-pair). End session wipes blobs.

## Auth

- Students: session code + display name, no login.
- Teacher: random token (auto-generated, bookmarkable via URL) and/or optional passphrase set at creation.

## Data model (Netlify Blobs)

Per-student blob keys to avoid concurrent-write races:

- `session/{code}/meta` — grid size, rounds config, teacher token/hash, status
- `session/{code}/students` — roster
- `session/{code}/round/{n}/meta` — pairings, voter seed + distribution, status
- `session/{code}/round/{n}/define/{studentId}` — one student's sub-district assignment
- `session/{code}/round/{n}/combine/{studentId}` — one student's pairing + definerId

`loadRound()` re-aggregates per-student keys and recomputes status from contents (robust to any partial-write ordering).

## Milestones (all complete)

1. ✅ **Grid generator + asset pipeline** — R script, 70-block (blob) and 140-block (elliptical) grids, JSONs committed.
2. ✅ **Uni mode (solo)** — drag-paint, hotkeys, validation (pop/contiguity/doughnut), random plan, live stats, undo/redo.
3. ✅ **DCP solo practice** — define + combine stages, sub-district labels, perimeter outlines, live final-seat counts.
4. ✅ **Multi-user sessions** — Netlify Functions + Blobs, create/join/round flow, concurrent-safe per-student blob keys.
5. ✅ **Teacher dashboard** — passphrase + token auth, session code + copy, round control, live progress, cumulative A-only scoreboard, per-round history, end session.
6. ✅ **Polish** — undo/redo all surfaces, pairing fairness (avoidance + sitter rotation), end-of-session student summary, role banners (A define / B combine), error/offline UI, a11y (ARIA live regions, tablist, SVG title), mobile layout.
7. ✅ **Classroom dry run** — headless script (12×2, 11×3 verified), Playwright E2E (15 tests).

## Testing

| Layer | Count | Tool | Coverage |
|---|---|---|---|
| Unit | 33 | Vitest | Grid, contiguity, validation, voters, combine, serialize, scoreboard, undo/redo |
| API dry run | 1 script | tsx | Full session lifecycle: 12 students, 2 rounds, pairing fairness, sitter rotation, cleanup |
| E2E browser | 15 | Playwright | Uni solo (7), DCP solo (5), Multiplayer (3): drawing, validation, undo, stage transitions, teacher dashboard, full round flow |

Run:
- `npm test` — unit tests
- `npm run test:e2e` — Playwright (auto-starts netlify dev)
- `npm run test:dryrun` — headless API simulation (needs `netlify dev` running)

## Backlog / ideas

- QR code for session code
- Export session results as CSV
- Teacher peek at student maps live
- Configurable voter split beyond 40/60 and 50/50
- More voter-distribution shapes (urban/rural, split cluster)
- Session resume: teacher can view past session results via URL
