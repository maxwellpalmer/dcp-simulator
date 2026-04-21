#!/usr/bin/env Rscript
# Generate grid assets (blocks, polygons, adjacency, boundaries, random plans)
# for each supported grid size. Outputs JSON to app/src/assets/.
#
# Run once per grid-size change. Output is committed to the repo; the webapp
# has no R dependency at runtime.
#
# Usage: Rscript scripts/generate_grids.R [size]
#   size: 70 | 140 | all (default: all)

suppressPackageStartupMessages({
  library(sf)
  library(dplyr)
  library(tidyr)
  library(purrr)
  library(jsonlite)
  library(redist)
})
sf_use_s2(FALSE)

args <- commandArgs(trailingOnly = TRUE)
target_size <- if (length(args) == 0) "all" else args[1]

SEED <- 0
N_RANDOM_PLANS <- 200  # per district-count option; 1000 in prototype but 200 is plenty

OUT_DIR <- file.path("app", "src", "assets")
dir.create(OUT_DIR, recursive = TRUE, showWarnings = FALSE)

# -------------------------------------------------------------------------
# Grid sources

# Size 70: reuse the hand-curated blob from the prototype.
load_hex_70 <- function() {
  load("../DefineCombineApp2024/data/blocks_hex_70.RData")
  # Renumber blocks to 1..N (source uses sparse IDs).
  blocks <- blocks |>
    mutate(block = row_number()) |>
    select(block, geometry)
  # Drop CRS so sf treats coords as planar (source has lng/lat hint).
  st_crs(blocks) <- NA
  blocks
}

# Size 140: elliptical pointy-top hex grid, hand-tuned. Wider than tall with
# tapered top/bottom edges. Row widths (bottom→top of image):
#   8, 9, 10, 11, 12, 13, 13+1, 13, 12, 11, 10, 9, 8  = 140
# The "+1" is an extra hex on the left edge (row 6, cx=0).
make_hex_140 <- function() {
  s <- sqrt(1/3)
  w <- 1
  vs <- 1.5 * s  # vertical spacing between rows

  # Row widths and starting x for each row (manually tuned).
  # Even rows (0,2,4,...) have integer cx; odd rows offset by w/2.
  row_specs <- list(
    list(row = 0,  n =  8, x0 = 3),
    list(row = 1,  n =  9, x0 = 2.5),
    list(row = 2,  n = 10, x0 = 2),
    list(row = 3,  n = 11, x0 = 1.5),
    list(row = 4,  n = 12, x0 = 1),
    list(row = 5,  n = 13, x0 = 0.5),
    list(row = 6,  n = 14, x0 = 0),     # 13 + 1 extra on left
    list(row = 7,  n = 13, x0 = 0.5),
    list(row = 8,  n = 12, x0 = 1),
    list(row = 9,  n = 11, x0 = 1.5),
    list(row = 10, n = 10, x0 = 2),
    list(row = 11, n =  9, x0 = 2.5),
    list(row = 12, n =  8, x0 = 3)
  )
  # Verify total
  stopifnot(sum(sapply(row_specs, `[[`, "n")) == 140)

  hexes <- list()
  i <- 1
  for (spec in row_specs) {
    cy <- spec$row * vs
    for (col in 0:(spec$n - 1)) {
      cx <- spec$x0 + col * w
      verts <- matrix(c(
        cx,       cy - s,
        cx - w/2, cy - s/2,
        cx - w/2, cy + s/2,
        cx,       cy + s,
        cx + w/2, cy + s/2,
        cx + w/2, cy - s/2,
        cx,       cy - s
      ), ncol = 2, byrow = TRUE)
      hexes[[i]] <- st_polygon(list(verts))
      i <- i + 1
    }
  }
  st_sf(block = seq_along(hexes), geometry = st_sfc(hexes))
}

# -------------------------------------------------------------------------
# Per-block data extraction

extract_vertices <- function(blocks) {
  map_dfr(seq_len(nrow(blocks)), function(i) {
    coords <- st_coordinates(blocks$geometry[[i]])
    # Drop the closing repeated vertex
    n <- nrow(coords)
    tibble(block = blocks$block[i],
           x = coords[-n, 1],
           y = coords[-n, 2])
  })
}

extract_centroids <- function(blocks) {
  cent <- st_centroid(blocks$geometry)
  coords <- st_coordinates(cent)
  tibble(block = blocks$block, cx = coords[, 1], cy = coords[, 2])
}

# Rook (shared-edge) adjacency, derived from inner line segments.
compute_adjacency_from_inner <- function(inner_segs) {
  inner_segs |>
    mutate(low = pmin(a, b), high = pmax(a, b)) |>
    distinct(low, high) |>
    transmute(a = low, b = high)
}

# Extract all edges of each hex polygon as line segments, then find segments
# shared between exactly two blocks (inner) vs. one block (outer).
extract_segments <- function(blocks) {
  eps <- 1e-6
  round_pt <- function(v) round(v / eps) * eps

  segs <- list()
  k <- 1
  for (i in seq_len(nrow(blocks))) {
    coords <- st_coordinates(blocks$geometry[[i]])
    n <- nrow(coords)
    for (j in 1:(n - 1)) {
      x1 <- round_pt(coords[j, 1]);     y1 <- round_pt(coords[j, 2])
      x2 <- round_pt(coords[j + 1, 1]); y2 <- round_pt(coords[j + 1, 2])
      # Canonical ordering so shared segments match
      if (x1 > x2 || (x1 == x2 && y1 > y2)) {
        tx <- x1; ty <- y1; x1 <- x2; y1 <- y2; x2 <- tx; y2 <- ty
      }
      segs[[k]] <- tibble(block = blocks$block[i],
                          x1 = x1, y1 = y1, x2 = x2, y2 = y2)
      k <- k + 1
    }
  }
  all <- bind_rows(segs)
  grouped <- all |> group_by(x1, y1, x2, y2) |>
    summarise(blocks = list(block), .groups = "drop")

  inner <- grouped |> filter(lengths(blocks) == 2) |>
    mutate(a = map_int(blocks, 1), b = map_int(blocks, 2)) |>
    select(a, b, x1, y1, x2, y2)

  outer_segs <- grouped |> filter(lengths(blocks) == 1) |>
    select(x1, y1, x2, y2)

  list(inner = inner, outer = outer_segs)
}

# Order outer segments into a single closed polygon ring.
order_outer_ring <- function(outer_segs) {
  if (nrow(outer_segs) == 0) return(tibble(x = numeric(), y = numeric()))
  eps <- 1e-5
  key <- function(x, y) sprintf("%.5f,%.5f", x, y)

  remaining <- outer_segs
  ring <- tibble(x = remaining$x1[1], y = remaining$y1[1])
  cur_x <- remaining$x2[1]; cur_y <- remaining$y2[1]
  remaining <- remaining[-1, ]

  while (nrow(remaining) > 0) {
    ring <- bind_rows(ring, tibble(x = cur_x, y = cur_y))
    hit_a <- which(abs(remaining$x1 - cur_x) < eps & abs(remaining$y1 - cur_y) < eps)
    hit_b <- which(abs(remaining$x2 - cur_x) < eps & abs(remaining$y2 - cur_y) < eps)
    if (length(hit_a) > 0) {
      i <- hit_a[1]
      cur_x <- remaining$x2[i]; cur_y <- remaining$y2[i]
    } else if (length(hit_b) > 0) {
      i <- hit_b[1]
      cur_x <- remaining$x1[i]; cur_y <- remaining$y1[i]
    } else {
      break
    }
    remaining <- remaining[-i, ]
  }
  ring
}

# -------------------------------------------------------------------------
# Random plan generation via redist

generate_random_plans <- function(blocks, adj_df, n_dists, n_plans) {
  cat(sprintf("  Generating %d random plans for %d districts... ", n_plans, n_dists))
  set.seed(SEED + n_dists)
  blocks_pop <- blocks
  blocks_pop$population <- 1L
  # Build redist adjacency list (0-indexed neighbors per block).
  nb <- vector("list", nrow(blocks_pop))
  for (i in seq_len(nrow(adj_df))) {
    a <- adj_df$a[i]; b <- adj_df$b[i]
    nb[[a]] <- c(nb[[a]], b - 1L)
    nb[[b]] <- c(nb[[b]], a - 1L)
  }
  nb <- lapply(nb, function(x) if (is.null(x)) integer(0) else as.integer(x))
  map <- redist_map(blocks_pop, ndists = n_dists, pop_tol = 0.001,
                    pop = population, adj = nb)
  plans <- redist_smc(map, n_plans, silent = TRUE)
  mat <- get_plans_matrix(plans)
  # mat is [n_blocks x n_plans]; keep unique plans
  dedup <- unique(as.data.frame(t(mat)))
  cat(sprintf("got %d unique\n", nrow(dedup)))
  # Return list of integer vectors (one per plan)
  lapply(seq_len(nrow(dedup)), function(i) as.integer(unlist(dedup[i, ])))
}

# -------------------------------------------------------------------------
# Build and write one grid

build_grid <- function(blocks, size_label, district_options) {
  cat(sprintf("Building grid %s (%d blocks)\n", size_label, nrow(blocks)))

  centroids <- extract_centroids(blocks)
  vertices <- extract_vertices(blocks)
  segs <- extract_segments(blocks)
  adj <- compute_adjacency_from_inner(segs$inner)
  outer_ring <- order_outer_ring(segs$outer)

  # Pack vertices per-block as list-of-[x,y]
  verts_per_block <- vertices |> group_by(block) |>
    summarise(pts = list(cbind(x, y)), .groups = "drop")

  blocks_out <- centroids |>
    left_join(verts_per_block, by = "block") |>
    mutate(vertices = lapply(pts, function(m) {
      lapply(seq_len(nrow(m)), function(i) as.numeric(m[i, ]))
    })) |>
    select(id = block, cx, cy, vertices)

  random_plans <- list()
  for (n in district_options) {
    random_plans[[as.character(n)]] <- generate_random_plans(blocks, adj, n, N_RANDOM_PLANS)
  }

  out <- list(
    size = nrow(blocks),
    label = size_label,
    districtOptions = as.integer(district_options),
    blocks = lapply(seq_len(nrow(blocks_out)), function(i) {
      list(id = blocks_out$id[i],
           cx = blocks_out$cx[i],
           cy = blocks_out$cy[i],
           vertices = blocks_out$vertices[[i]])
    }),
    adjacency = lapply(seq_len(nrow(adj)), function(i) c(adj$a[i], adj$b[i])),
    innerLines = lapply(seq_len(nrow(segs$inner)), function(i) {
      list(a = segs$inner$a[i], b = segs$inner$b[i],
           x1 = segs$inner$x1[i], y1 = segs$inner$y1[i],
           x2 = segs$inner$x2[i], y2 = segs$inner$y2[i])
    }),
    outerRing = lapply(seq_len(nrow(outer_ring)), function(i) {
      c(outer_ring$x[i], outer_ring$y[i])
    }),
    randomPlans = random_plans
  )

  path <- file.path(OUT_DIR, sprintf("grid_%s.json", size_label))
  write_json(out, path, auto_unbox = TRUE, digits = 6)
  cat(sprintf("  wrote %s\n", path))
}

# -------------------------------------------------------------------------
# Main

if (target_size == "70" || target_size == "all") {
  build_grid(load_hex_70(), "70", c(7, 10, 14))
}
if (target_size == "140" || target_size == "all") {
  build_grid(make_hex_140(), "140", c(7, 10, 14, 20))
}

cat("Done.\n")
