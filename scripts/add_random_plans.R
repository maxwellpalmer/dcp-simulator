#!/usr/bin/env Rscript
# Add (or replace) random plans for a given district count to an existing
# grid JSON, reusing the committed geometry + adjacency. Useful when the
# upstream RData source isn't available and we only need to add a new
# district-count option.
#
# Usage: Rscript scripts/add_random_plans.R <size> <nDistricts>
#   size:       70 | 140
#   nDistricts: integer > 1, must evenly divide the block count
#
# Writes back to app/src/assets/grid_<size>.json and updates
# districtOptions to include nDistricts.

suppressPackageStartupMessages({
  library(sf)
  library(jsonlite)
  library(redist)
})
sf_use_s2(FALSE)

SEED <- 0L
N_RANDOM_PLANS <- 200L

args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 2) stop("Usage: Rscript scripts/add_random_plans.R <size> <nDistricts>")
size_label <- args[1]
new_n <- as.integer(args[2])
if (is.na(new_n) || new_n < 2L) stop("nDistricts must be an integer >= 2")

json_path <- file.path("app", "src", "assets", sprintf("grid_%s.json", size_label))
if (!file.exists(json_path)) stop(sprintf("Not found: %s", json_path))

cat(sprintf("Loading %s...\n", json_path))
g <- fromJSON(json_path, simplifyVector = FALSE)

n_blocks <- length(g$blocks)
if (n_blocks %% new_n != 0) {
  stop(sprintf("n_blocks=%d is not evenly divisible by nDistricts=%d", n_blocks, new_n))
}
cat(sprintf("  %d blocks, %d per district\n", n_blocks, n_blocks / new_n))

# Reconstruct sf polygons from the vertex lists in the JSON.
polys <- lapply(g$blocks, function(b) {
  verts <- do.call(rbind, lapply(b$vertices, function(v) c(v[[1]], v[[2]])))
  verts <- rbind(verts, verts[1, , drop = FALSE])  # close the ring
  st_polygon(list(verts))
})
blocks <- st_sf(block = seq_along(polys), geometry = st_sfc(polys))
blocks$population <- 1L

# Reconstruct 0-indexed neighbor lists from the adjacency pairs.
nb <- vector("list", n_blocks)
for (i in seq_along(g$adjacency)) {
  pair <- g$adjacency[[i]]
  a <- as.integer(pair[[1]]); b <- as.integer(pair[[2]])
  nb[[a]] <- c(nb[[a]], b - 1L)
  nb[[b]] <- c(nb[[b]], a - 1L)
}
nb <- lapply(nb, function(x) if (is.null(x)) integer(0) else as.integer(x))

cat(sprintf("Running redist_smc for %d districts (%d plans)... ", new_n, N_RANDOM_PLANS))
set.seed(SEED + new_n)
map <- redist_map(blocks, ndists = new_n, pop_tol = 0.001, pop = population, adj = nb)
plans <- redist_smc(map, N_RANDOM_PLANS, silent = TRUE)
mat <- get_plans_matrix(plans)
dedup <- unique(as.data.frame(t(mat)))
cat(sprintf("got %d unique plans\n", nrow(dedup)))
plan_list <- lapply(seq_len(nrow(dedup)), function(i) as.integer(unlist(dedup[i, ])))

# Merge into the JSON: add n to districtOptions and write plans.
existing_opts <- as.integer(unlist(g$districtOptions))
g$districtOptions <- as.integer(sort(unique(c(existing_opts, new_n))))
g$randomPlans[[as.character(new_n)]] <- plan_list

write_json(g, json_path, auto_unbox = TRUE, digits = 6)
cat(sprintf("Wrote %s (districtOptions=[%s])\n",
            json_path, paste(g$districtOptions, collapse = ",")))
