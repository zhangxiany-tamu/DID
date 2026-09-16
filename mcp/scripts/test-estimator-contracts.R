#!/usr/bin/env Rscript
# Verify statistical contracts against package results, not frozen estimates.
# Run from any directory: Rscript mcp/scripts/test-estimator-contracts.R
#
# ## Contents
# - [Setup](#setup)
# - [Never-treated recoding](#never-treated-recoding)
# - [BJS package parity](#bjs-package-parity)
# - [did2s covariance](#did2s-covariance)

# ## Setup
script_arg <- grep("^--file=", commandArgs(FALSE), value = TRUE)
mcp_dir <- dirname(dirname(normalizePath(sub("^--file=", "", script_arg[[1]]))))
for (file in c("object_store.R", "step1_recode.R", "step1_profile.R",
               "step1_checks.R", "step3_common.R", "step3_estimators.R",
               "step3_extractors.R", "step3_dispatch.R")) {
  source(file.path(mcp_dir, "r", file))
}
`%||%` <- function(x, y) if (is.null(x)) y else x
run_with_capture <- function(id, fn) fn()
assert <- function(ok, message) if (!isTRUE(ok)) stop(message, call. = FALSE)
same <- function(actual, expected, message) {
  assert(isTRUE(all.equal(actual, expected, tolerance = 1e-10,
                         check.attributes = FALSE)), message)
}
assert_error <- function(expr, pattern) {
  error <- tryCatch({ force(expr); NULL }, error = identity)
  assert(inherits(error, "error") && grepl(pattern, conditionMessage(error)),
         paste("Expected error matching", pattern))
}

# ## Never-treated recoding
long <- expand.grid(id = 1:5, year = 1980:2020)
long$g <- c(1981, 0, NA, Inf, 2030)[long$id]
known_never <- long$id %in% 2:4
legacy <- recode_never_treated(long, "g", "max_plus_10", time_var = "year")
assert(all(legacy$g[known_never] > max(long$year)), "Sentinel lies inside sample")
assert(all(legacy$g[known_never] != 2030), "Sentinel collides with a real cohort")
same(legacy$g[!known_never], long$g[!known_never], "Real cohorts were changed")
same(long$g[long$id == 2], rep(0, 41), "Source panel was modified")
for (target in c("zero", "na", "inf")) {
  back <- recode_never_treated(legacy, "g", target)
  expected <- switch(target, zero = 0, na = NA_real_, inf = Inf)
  same(back$g[known_never], rep(expected, sum(known_never)), "Round-trip lost identity")
  same(back$g[!known_never], long$g[!known_never], "Round-trip changed real cohorts")
}
scratch <- tempfile(fileext = ".rds")
saveRDS(legacy, scratch)
restored <- readRDS(scratch)
unlink(scratch)
same(never_treated_rows(restored, "g"), known_never, "RDS lost sentinel provenance")
same(coerce_never_treated_for_estimator(restored, "g", "bjs")$g[known_never],
     rep(0, sum(known_never)), "BJS did not recover recorded never-treated units")
assert(length(summarize_cohort_sizes(legacy, "g", "id")) == 2L,
       "Cohort summary includes the generated sentinel")
invisible(capture.output(profile <- profile_did_design(legacy, "id", "year", "g")))
assert(profile$never_treated == 3L && profile$n_cohorts == 2L,
       "Profiling lost never-treated identity")
future <- suppressWarnings(check_future_treatment(legacy, "id", "year", "g"))
same(unname(future), "5", "Generated sentinel was flagged as real future treatment")
all_never <- data.frame(year = 2000:2002, g = c(0, NA, Inf))
all_legacy <- recode_never_treated(all_never, "g", "max_plus_10", "year")
same(all_legacy$g, rep(2012, 3), "All-never-treated recode is not finite")
assert_error(recode_never_treated(all_never, "g", "max_plus_10"), "time_var")
raw_future <- data.frame(year = 2000:2002, g = rep(2012, 3))
same(coerce_never_treated_for_estimator(raw_future, "g", "bjs")$g,
     raw_future$g, "An imported finite cohort was guessed to be never-treated")
cat("PASS: never-treated identity and finite-sentinel round-trips\n")

# ## BJS package parity
for (pkg in c("didimputation", "did2s")) {
  if (!requireNamespace(pkg, quietly = TRUE)) stop("Contract test needs ", pkg)
}
panel <- read.csv(file.path(mcp_dir, "test", "fixtures", "mpdta.csv"))
schema <- list(id_var = "countyreal", time_var = "year",
               treat_timing_var = "first.treat")
params <- list(outcome_var = "lemp", min_e = -3, max_e = 3)
reference <- didimputation::did_imputation(
  data = panel, yname = "lemp", gname = "first.treat", tname = "year",
  idname = "countyreal", horizon = TRUE, pretrends = -3:-1)
bjs <- est_bjs(panel, schema, params, "estimate_bjs")
same(as.data.frame(bjs$r_object), as.data.frame(reference),
     "BJS wrapper differs from package's documented zero-coding path")
mixed <- panel
never_ids <- unique(mixed$countyreal[mixed$first.treat == 0])
mixed$first.treat[mixed$countyreal %in% never_ids[seq_along(never_ids) %% 2 == 0]] <- NA
mixed$first.treat[mixed$countyreal %in% never_ids[seq_along(never_ids) %% 2 == 1]] <- Inf
finite <- recode_never_treated(mixed, "first.treat", "max_plus_10", "year")
bjs_finite <- est_bjs(finite, schema, params, "estimate_bjs_finite")
same(as.data.frame(bjs_finite$r_object), as.data.frame(reference),
     "BJS changed after recorded finite-sentinel recoding")
cat("PASS: BJS matches direct package results across never-treated conventions\n")

# ## did2s covariance
d2 <- est_did2s(panel, schema, params, "estimate_did2s")
es <- extract_event_study(d2$r_object)
nms <- names(coef(d2$r_object))
nms <- nms[!is.na(parse_event_times(nms))]
V <- vcov(d2$r_object)[nms, nms, drop = FALSE]
same(es$sigma, V, "did2s extraction discarded or misaligned covariance")
assert(!es$sigma_is_diagonal_fallback, "did2s was incorrectly marked as diagonal fallback")
assert(any(abs(es$sigma[row(es$sigma) != col(es$sigma)]) > 1e-12),
       "Fixture no longer exercises off-diagonal covariance")
trim <- dispatch_extract_event_study(1, list(estimate_id = "estimate_did2s",
                                            handle_id = "event_trim", min_e = -2, max_e = 1))
kept <- es$tVec >= -2 & es$tVec <= 1
same(get_object("event_trim")$sigma, V[kept, kept, drop = FALSE],
     "Event-window trimming did not subset both covariance dimensions")

# A small named model isolates alignment and invalid-matrix behavior.
coef.contract_fit <- function(object, ...) object$beta
vcov.contract_fit <- function(object, ...) object$V
names3 <- c(".did2s_rel::-2", ".did2s_rel::0", ".did2s_rel::1")
V3 <- matrix(c(2, .2, .3, .2, 3, .4, .3, .4, 4), 3,
             dimnames = list(names3, names3))
fake <- structure(list(beta = setNames(c(.1, .3, .5), names3),
                       V = V3[c(3, 1, 2), c(2, 3, 1)]),
                  class = c("contract_fit", "fixest"))
same(extract_event_study(fake)$sigma, V3, "Covariance names were ignored")
bad <- fake
rownames(bad$V)[1] <- "unmatched"
assert_error(extract_event_study(bad), "cannot be matched")
bad <- fake
bad$V[1, 1] <- NA_real_
assert_error(extract_event_study(bad), "finite and symmetric")
zero <- fake
zero$V <- V3
zero$V[1, ] <- zero$V[, 1] <- 0
cleaned <- suppressWarnings(extract_event_study(zero))
same(cleaned$sigma, V3[-1, -1, drop = FALSE], "Dropping zero SE lost retained covariance")
same(cleaned$tVec, c(0L, 1L), "Dropping zero SE misaligned event times")
cat("PASS: did2s full covariance, named alignment, trimming, and invalid-matrix checks\n")
