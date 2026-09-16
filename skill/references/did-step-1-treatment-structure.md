# Step 1: Assess Treatment Structure

## Contents
- [Goal](#goal)
- [Master Profiling Function](#master-profiling-function)
- [Treatment Pattern Examples](#treatment-pattern-examples)
- [Panel Integrity Checks](#panel-integrity-checks)
  - [Check 4: Sentinel Value Detection](#check-4-sentinel-value-detection)
  - [Check 5: Already-Treated-Before-Sample Detection](#check-5-already-treated-before-sample-detection)
  - [Check 6: Treatment Timing Beyond Sample Range](#check-6-treatment-timing-beyond-sample-range)
- [Never-Treated Coding Conversion](#never-treated-coding-conversion)
- [Cohort Size Summary Table](#cohort-size-summary-table)
- [Treatment Rollout Visualization](#treatment-rollout-visualization)
- [Complete Step 1 Workflow Example](#complete-step-1-workflow-example)
- [Simulating Example Data](#simulating-example-data)
- [Decision Routing Summary](#decision-routing-summary)
- [Multi-Level Treatment Structure](#multi-level-treatment-structure)
- [Packages Used Next](#packages-used-next)
- [Read Next](#read-next)

Use this step before diagnostics/estimation to classify the treatment design and route to the correct DiD workflow. Treat this file as the authoritative Step 1 workflow contract; `SKILL.md` should only route here.

## Tool-Aware Path

When the `did-mcp` server is registered (tools `did_ping`, `did_load_panel`, … visible in your tool list), use these tools instead of emitting the R code below. The five Step 1 tools implement byte-aligned wrappers around the function bodies in this guide, so results are identical.

| Sub-step | Tool | Produces |
|---|---|---|
| Load panel (csv / parquet) | `did_load_panel` | `panel_N` handle with the column schema baked in |
| Panel integrity checks | `did_check_panel` | Structured report with `overall_ok` flag |
| Timing profile and routing | `did_profile_design` | `design_profile_N` handle with `timing`, `route`, cohort counts, balance/absorbing flags |
| Never-treated recoding | `did_recode_never_treated` (target ∈ {zero, na, inf, max_plus_10}) | New `panel_M` handle; source panel unchanged |
| Rollout / outcome plot | `did_plot_rollout` (plot_type ∈ {rollout, outcome, both}) | `plot_N` handle(s); PNG on disk |

Every subsequent tool (Steps 2–5) accepts a `panel_id` (or `design_profile_id`) — plumb the handles through, don't re-load the data. See `SKILL.md` → "Execution Mode: Tools vs. Code-gen" for the canonical route.

The remainder of this guide is the **code-gen fallback** — use it when `did_*` tools are not registered, or when you need a detail the tools don't expose (e.g., custom plot layouts, interactive diagnostics).

## Goal

Programmatically profile the dataset's treatment variable and panel structure to determine which estimators are valid. The output is a routing decision: standard staggered DiD pipeline (Steps 2-5) vs. advanced methods.

---

## Master Profiling Function

Run this on any panel dataset to get a full treatment structure report:

```r
profile_did_design <- function(data, id_var, time_var, treat_timing_var, treat_var = NULL) {
  cat("========================================\n")
  cat("  DiD Treatment Structure Profile\n")
  cat("========================================\n\n")

  ids   <- data[[id_var]]
  times <- data[[time_var]]
  g     <- data[[treat_timing_var]]
  sentinel <- attr(data, "did_never_treated_sentinels")[[treat_timing_var]]
  if (!is.null(sentinel)) g[!is.na(g) & g == sentinel] <- 0

  n_units   <- length(unique(ids))
  n_periods <- length(unique(times))
  n_obs     <- nrow(data)

  cat(sprintf("Units: %d | Periods: %d | Observations: %d\n", n_units, n_periods, n_obs))

  # --- Panel balance ---
  expected <- n_units * n_periods
  is_balanced <- (n_obs == expected)
  cat(sprintf("Panel balance: %s (%d of %d expected obs)\n\n",
              ifelse(is_balanced, "BALANCED", "UNBALANCED"), n_obs, expected))

  # --- Treatment timing groups ---
  # Get one gname per unit (first non-NA value)
  unit_g <- tapply(g, ids, function(x) {
    vals <- unique(x[!is.na(x)])
    if (length(vals) == 0) return(NA_real_)
    vals[1]
  })

  never_treated  <- sum(is.na(unit_g) | unit_g == 0 | is.infinite(unit_g))
  ever_treated   <- n_units - never_treated
  treat_dates    <- sort(unique(unit_g[!is.na(unit_g) & unit_g != 0 & !is.infinite(unit_g)]))
  n_cohorts      <- length(treat_dates)

  cat(sprintf("Ever-treated units: %d (%.1f%%)\n", ever_treated, 100 * ever_treated / n_units))
  cat(sprintf("Never-treated units: %d (%.1f%%)\n", never_treated, 100 * never_treated / n_units))
  cat(sprintf("Treatment cohorts: %d\n", n_cohorts))
  if (n_cohorts <= 10) {
    cat(sprintf("Cohort timing: %s\n", paste(treat_dates, collapse = ", ")))
  } else {
    cat(sprintf("Cohort timing (first 10): %s, ...\n", paste(head(treat_dates, 10), collapse = ", ")))
  }
  cat("\n")

  # --- Staggering classification ---
  if (n_cohorts == 0) {
    timing <- "NO_TREATMENT"
    cat("Timing: NO TREATMENT VARIATION (no treated units found)\n")
  } else if (n_cohorts == 1) {
    timing <- "CANONICAL"
    cat("Timing: CANONICAL (single treatment date)\n")
  } else {
    timing <- "STAGGERED"
    cat("Timing: STAGGERED (multiple treatment dates)\n")
  }

  # --- Treatment type: binary absorbing vs reversible ---
  # Reversal detection requires the actual binary treatment variable (treat_var),
  # not the timing variable. Timing-based flags (time >= g) are monotone by
  # construction and cannot detect reversals.
  is_absorbing <- TRUE
  reversal_units <- character()
  if (!is.null(treat_var)) {
    for (uid in unique(ids[!is.na(unit_g[as.character(ids)]) &
                            unit_g[as.character(ids)] != 0 &
                            !is.infinite(unit_g[as.character(ids)])])) {
      mask <- ids == uid
      unit_data <- data[mask, ]
      unit_data <- unit_data[order(unit_data[[time_var]]), ]
      treat_vals <- unit_data[[treat_var]]
      diffs <- diff(treat_vals)
      # A reversal is any drop in treatment (e.g. 1→0)
      if (any(diffs < 0)) {
        is_absorbing <- FALSE
        reversal_units <- c(reversal_units, as.character(uid))
      }
    }
  }

  # Also check if treatment variable itself is non-binary
  treat_vals <- sort(unique(g[!is.na(g) & g != 0 & !is.infinite(g)]))

  if (is.null(treat_var)) {
    cat("Absorbing: ASSUMED (supply treat_var to detect reversals)\n")
  } else {
    cat(sprintf("Absorbing: %s\n", ifelse(is_absorbing, "YES", "NO")))
    if (!is_absorbing) {
      cat(sprintf("  Reversal units: %d (e.g., %s)\n",
                  length(reversal_units),
                  paste(head(reversal_units, 5), collapse = ", ")))
    }
  }

  # --- Missing data ---
  n_missing_outcome <- sum(is.na(data[[time_var]]))  # placeholder; user can extend
  n_missing_g       <- sum(is.na(g))
  cat(sprintf("\nMissing treatment timing: %d obs (%.1f%%)\n",
              n_missing_g, 100 * n_missing_g / n_obs))

  # --- Never-treated coding ---
  has_zero  <- any(g == 0, na.rm = TRUE)
  has_na    <- any(is.na(g))
  has_inf   <- any(is.infinite(g))
  cat(sprintf("Never-treated coding: 0=%s NA=%s Inf=%s\n",
              ifelse(has_zero, "yes", "no"),
              ifelse(has_na, "yes", "no"),
              ifelse(has_inf, "yes", "no")))

  # --- Routing decision ---
  cat("\n========================================\n")
  cat("  ROUTING DECISION\n")
  cat("========================================\n\n")

  if (timing == "NO_TREATMENT") {
    cat("ERROR: No treatment variation detected. Cannot run DiD.\n")
    route <- "NONE"
  } else if (!is_absorbing) {
    cat("ROUTE: Advanced Methods (treatment is reversible/non-absorbing)\n")
    cat("  -> Use DIDmultiplegt, DIDmultiplegtDYN, or etwfe\n")
    cat("  -> See: did-advanced-methods.md\n")
    route <- "ADVANCED"
  } else if (timing == "CANONICAL") {
    cat("ROUTE: Standard 2x2 DiD\n")
    cat("  -> TWFE is valid (single treatment date, no forbidden comparisons)\n")
    cat("  -> Still recommended: run parallel trends checks (Steps 4-5)\n")
    cat("  -> Skip Step 2 diagnostics (no staggering to diagnose)\n")
    route <- "CANONICAL"
  } else {
    cat("ROUTE: Staggered DiD Pipeline (Steps 2-5)\n")
    cat("  -> Step 2: Diagnose TWFE problems (bacondecomp, TwoWayFEWeights)\n")
    cat("  -> Step 3: Robust estimators (did, fixest/sunab, didimputation, did2s, staggered)\n")
    cat("  -> Step 4: Power analysis (pretrends)\n")
    cat("  -> Step 5: Sensitivity analysis (HonestDiD)\n")
    if (never_treated == 0) {
      cat("\n  WARNING: No never-treated units. Some estimators require them.\n")
      cat("  -> CS: use control_group = 'notyettreated'\n")
      cat("  -> SA: may need last-treated cohort as reference\n")
    }
    if (!is_balanced) {
      cat("\n  WARNING: Unbalanced panel.\n")
      cat("  -> CS (did): Handles unbalanced panels automatically (drops incomplete unit-time cells).\n")
      cat("  -> SA (fixest): Handles unbalanced panels (uses available observations).\n")
      cat("  -> BJS (didimputation): REQUIRES balanced panel; balance first or skip BJS.\n")
      cat("  -> Gardner (did2s): Handles unbalanced panels.\n")
    }
    route <- "STAGGERED"
  }

  invisible(list(
    timing       = timing,
    route        = route,
    n_units      = n_units,
    n_periods    = n_periods,
    n_cohorts    = n_cohorts,
    is_balanced  = is_balanced,
    is_absorbing = is_absorbing,
    ever_treated = ever_treated,
    never_treated = never_treated,
    cohort_dates = treat_dates
  ))
}
```

---

## Treatment Pattern Examples

### Pattern 1: Canonical (Single Treatment Date)

All treated units adopt at the same time. Standard 2x2 DiD is valid.

```r
library(fixest)

# Simulate canonical DiD
set.seed(42)
n_units <- 100; n_periods <- 10; treat_date <- 6
df_canon <- expand.grid(unit = 1:n_units, time = 1:n_periods)
df_canon$treated_unit <- as.integer(df_canon$unit <= 50)
df_canon$post <- as.integer(df_canon$time >= treat_date)
df_canon$first_treat <- ifelse(df_canon$treated_unit == 1, treat_date, 0)
df_canon$y <- 1 + 0.5 * df_canon$treated_unit + 0.3 * df_canon$time +
              2 * df_canon$treated_unit * df_canon$post + rnorm(nrow(df_canon))

# Profile
profile <- profile_did_design(df_canon, "unit", "time", "first_treat")
# -> ROUTE: Standard 2x2 DiD

# Standard TWFE is valid here
model <- feols(y ~ treated_unit:post | unit + time, data = df_canon, cluster = ~unit)
summary(model)
```

### Pattern 2: Staggered Adoption (Binary Absorbing)

Units adopt treatment at different times and never revert. This is the most common case in applied work. Requires robust estimators.

```r
library(did)

data(mpdta)

# Profile
profile <- profile_did_design(mpdta, "countyreal", "year", "first.treat")
# -> ROUTE: Staggered DiD Pipeline (Steps 2-5)

# Proceed to Step 2 diagnostics, then Step 3 estimation
```

### Pattern 3: Reversible Treatment

Units can switch treatment on and off. Standard staggered DiD estimators are invalid. Route to advanced methods.

```r
# Simulate reversible treatment
set.seed(42)
n_units <- 50; n_periods <- 10
df_rev <- expand.grid(unit = 1:n_units, time = 1:n_periods)
# Some units turn treatment on and off
df_rev$treatment_level <- 0
for (uid in 1:25) {
  mask <- df_rev$unit == uid
  on_period  <- sample(3:6, 1)
  off_period <- on_period + sample(2:3, 1)
  df_rev$treatment_level[mask & df_rev$time >= on_period & df_rev$time < off_period] <- 1
}
df_rev$first_treat <- ave(
  ifelse(df_rev$treatment_level == 1, df_rev$time, NA),
  df_rev$unit, FUN = function(x) min(x, na.rm = TRUE)
)
df_rev$first_treat[is.infinite(df_rev$first_treat)] <- 0

# Profile detects reversals (pass treat_var to enable reversal detection)
profile <- profile_did_design(df_rev, "unit", "time", "first_treat",
                              treat_var = "treatment_level")
# -> ROUTE: Advanced Methods (treatment is reversible)
# -> Use DIDmultiplegt or DIDmultiplegtDYN
```

---

## Panel Integrity Checks

Run these before any DiD estimation to catch common data issues.

### Check 1: Unique Unit-Time Observations

```r
check_panel_uniqueness <- function(data, id_var, time_var) {
  dups <- duplicated(data[, c(id_var, time_var)]) |
          duplicated(data[, c(id_var, time_var)], fromLast = TRUE)
  n_dups <- sum(dups)
  if (n_dups > 0) {
    warning(sprintf("%d duplicate unit-time observations found. Panel must have unique (id, time) pairs.", n_dups))
    dup_examples <- unique(data[dups, c(id_var, time_var)])[1:min(5, sum(dups)), ]
    print(dup_examples)
  } else {
    cat("OK: All unit-time pairs are unique.\n")
  }
  n_dups == 0
}
```

### Check 2: Treatment Timing Consistency

Each unit's treatment timing variable should be constant across all its observations:

```r
check_timing_consistency <- function(data, id_var, treat_timing_var) {
  inconsistent <- character()
  for (uid in unique(data[[id_var]])) {
    vals <- unique(data[[treat_timing_var]][data[[id_var]] == uid])
    vals <- vals[!is.na(vals)]
    if (length(vals) > 1) {
      inconsistent <- c(inconsistent, as.character(uid))
    }
  }
  if (length(inconsistent) > 0) {
    warning(sprintf(
      "%d unit(s) have inconsistent treatment timing (e.g., %s). The gname variable must be constant within each unit.",
      length(inconsistent), paste(head(inconsistent, 5), collapse = ", ")))
  } else {
    cat("OK: Treatment timing is constant within each unit.\n")
  }
  length(inconsistent) == 0
}
```

### Check 3: Panel Balance Report

```r
check_panel_balance <- function(data, id_var, time_var) {
  obs_per_unit <- table(data[[id_var]])
  n_periods <- length(unique(data[[time_var]]))

  fully_observed <- sum(obs_per_unit == n_periods)
  partially_observed <- sum(obs_per_unit < n_periods)
  n_units <- length(obs_per_unit)

  cat(sprintf("Total units: %d\n", n_units))
  cat(sprintf("Total periods: %d\n", n_periods))
  cat(sprintf("Fully observed: %d (%.1f%%)\n", fully_observed, 100 * fully_observed / n_units))
  cat(sprintf("Partially observed: %d (%.1f%%)\n", partially_observed, 100 * partially_observed / n_units))

  if (partially_observed > 0) {
    min_obs <- min(obs_per_unit)
    cat(sprintf("Min observations per unit: %d (of %d periods)\n", min_obs, n_periods))
    cat("Note: BJS (didimputation) requires a balanced panel.\n")
  }

  invisible(list(
    is_balanced = (partially_observed == 0),
    n_units = n_units,
    n_periods = n_periods,
    fully_observed = fully_observed
  ))
}
```

### Check 4: Sentinel Value Detection

Treatment timing variables often use sentinel values (e.g., `gname = 2000` when the sample ends in 1998) to encode never-treated units. These can silently create phantom cohorts.

```r
check_sentinel_values <- function(data, id_var, time_var, treat_timing_var) {
  g <- data[[treat_timing_var]]
  sentinel <- attr(data, "did_never_treated_sentinels")[[treat_timing_var]]
  if (!is.null(sentinel)) g[!is.na(g) & g == sentinel] <- 0
  time_range <- range(data[[time_var]], na.rm = TRUE)

  # Get unique gname values (excluding NA, 0, Inf)
  g_vals <- unique(g[!is.na(g) & g != 0 & !is.infinite(g)])

  # Flag values outside the sample time range
  out_of_range <- g_vals[g_vals < time_range[1] | g_vals > time_range[2]]

  if (length(out_of_range) > 0) {
    warning(sprintf(
      "Possible sentinel values in '%s': %s\n  Sample time range: [%s, %s]\n  These may be never-treated units coded with an out-of-range value.\n  Recode to 0/NA/Inf before estimation.",
      treat_timing_var, paste(out_of_range, collapse = ", "),
      time_range[1], time_range[2]))
  } else {
    cat("OK: All treatment timing values are within the sample time range.\n")
  }
  invisible(out_of_range)
}
```

### Check 5: Already-Treated-Before-Sample Detection

Units treated at or before the first observed period are "always treated" within the sample. Including them creates extremely long pre-treatment windows, collinearity, and non-PSD covariance matrices.

```r
check_already_treated <- function(data, id_var, time_var, treat_timing_var) {
  min_time <- min(data[[time_var]], na.rm = TRUE)
  g <- data[[treat_timing_var]]
  sentinel <- attr(data, "did_never_treated_sentinels")[[treat_timing_var]]
  if (!is.null(sentinel)) g[!is.na(g) & g == sentinel] <- 0

  # Get one gname per unit
  unit_g <- tapply(g, data[[id_var]], function(x) {
    vals <- unique(x[!is.na(x) & x != 0 & !is.infinite(x)])
    if (length(vals) == 0) return(NA_real_)
    vals[1]
  })

  already <- names(unit_g)[!is.na(unit_g) & unit_g <= min_time]

  if (length(already) > 0) {
    warning(sprintf(
      "%d unit(s) treated at or before first period (%s): %s\n  These are 'always treated' in the sample. Options:\n  1. Reclassify as never-treated (gname = 0/NA/Inf) and exclude from treatment\n  2. Drop them entirely\n  Consequences if included: long noisy leads, collinearity, non-PSD VCOV.",
      length(already), min_time,
      paste(head(already, 5), collapse = ", ")))
  } else {
    cat("OK: No units treated before the sample begins.\n")
  }
  invisible(already)
}
```

### Check 6: Treatment Timing Beyond Sample Range

Units with `gname` values after the last observed period are effectively never-treated within the sample — they are never observed in a treated state. Including them as a separate "treated" cohort creates a phantom cohort with no post-treatment observations, which can cause estimation failures or misleading results.

```r
check_future_treatment <- function(data, id_var, time_var, treat_timing_var) {
  max_time <- max(data[[time_var]], na.rm = TRUE)
  g <- data[[treat_timing_var]]
  sentinel <- attr(data, "did_never_treated_sentinels")[[treat_timing_var]]
  if (!is.null(sentinel)) g[!is.na(g) & g == sentinel] <- 0

  # Get one gname per unit (excluding never-treated)
  unit_g <- tapply(g, data[[id_var]], function(x) {
    vals <- unique(x[!is.na(x) & x != 0 & !is.infinite(x)])
    if (length(vals) == 0) return(NA_real_)
    vals[1]
  })

  future <- names(unit_g)[!is.na(unit_g) & unit_g > max_time]

  if (length(future) > 0) {
    warning(sprintf(
      "%d unit(s) have treatment timing after the last observed period (%s).\n  These units are never observed as treated. Recode to never-treated\n  (gname = 0/NA/Inf) before estimation, or they create a phantom cohort.\n  Affected units (first 5): %s",
      length(future), max_time,
      paste(head(future, 5), collapse = ", ")))
  } else {
    cat("OK: All treatment timing values are within or before the sample range.\n")
  }
  invisible(future)
}
```

---

## Never-Treated Coding Conversion

Use zero for `did` and `didimputation`, and `Inf` for `fixest::sunab` and `staggered`. NA cohorts are dropped by `sunab`. The legacy `max_plus_10` target requires `time_var` and places a non-colliding sentinel after the observed time endpoint; BJS does not require it.

The helper records generated finite sentinels in an R attribute so later recoding preserves never-treated identity. This attribute survives RDS, but not CSV export. Normalize to zero before exporting; do not infer that arbitrary imported future cohorts are never-treated.

Use this helper to convert between conventions:

```r
generated_never_treated_rows <- function(data, gname_var) {
  sentinel <- attr(data, "did_never_treated_sentinels")[[gname_var]]
  g <- data[[gname_var]]
  if (is.null(sentinel)) return(rep(FALSE, length(g)))
  !is.na(g) & g == sentinel
}

never_treated_rows <- function(data, gname_var) {
  g <- data[[gname_var]]
  is.na(g) | g == 0 | is.infinite(g) |
    generated_never_treated_rows(data, gname_var)
}

recode_never_treated <- function(data, gname_var,
                                target = c("zero", "na", "inf", "max_plus_10"),
                                time_var = NULL) {
  target <- match.arg(target)
  g <- data[[gname_var]]
  is_never <- never_treated_rows(data, gname_var)
  sentinels <- attr(data, "did_never_treated_sentinels")
  if (is.null(sentinels)) sentinels <- list()
  sentinels[[gname_var]] <- NULL
  if (target == "max_plus_10") {
    if (is.null(time_var) || !time_var %in% names(data)) {
      stop("max_plus_10 requires time_var to place the sentinel after observed time.", call. = FALSE)
    }
    times <- data[[time_var]]
    if (!is.numeric(times) || !any(is.finite(times))) {
      stop("max_plus_10 requires finite numeric observed times.", call. = FALSE)
    }
    endpoint <- max(times[is.finite(times)])
    sentinel <- endpoint + 10
    # Do not turn a real future-treated cohort into a never-treated group.
    while (is.finite(sentinel) && sentinel %in% g[!is_never]) {
      next_sentinel <- sentinel + 10
      if (next_sentinel <= sentinel) break
      sentinel <- next_sentinel
    }
    if (!is.finite(sentinel) || sentinel <= endpoint || sentinel %in% g[!is_never]) {
      stop("Cannot construct a distinct finite sentinel beyond observed time.", call. = FALSE)
    }
    if (any(is_never)) sentinels[[gname_var]] <- sentinel
  } else {
    sentinel <- switch(target, zero = 0, na = NA_real_, inf = Inf)
  }
  g[is_never] <- sentinel
  data[[gname_var]] <- g
  attr(data, "did_never_treated_sentinels") <- if (length(sentinels)) sentinels else NULL
  data
}

# df_cs   <- recode_never_treated(df, "first_treat", target = "zero") # did (CS)
# df_sa   <- recode_never_treated(df, "first_treat", target = "inf")  # fixest (SA)
# df_bjs  <- recode_never_treated(df, "first_treat", target = "zero") # didimputation
# df_stag <- recode_never_treated(df, "first_treat", target = "inf")  # staggered
```

---

## Cohort Size Summary Table

Useful for checking whether any treatment cohort is too small for reliable estimation:

```r
cohort_summary <- function(data, id_var, treat_timing_var) {
  unit_g <- tapply(data[[treat_timing_var]], data[[id_var]], function(x) {
    vals <- unique(x[!is.na(x)])
    if (length(vals) == 0) return(NA_real_)
    vals[1]
  })

  tbl <- sort(table(unit_g), decreasing = TRUE)
  df_out <- data.frame(
    cohort = names(tbl),
    n_units = as.integer(tbl),
    pct = round(100 * as.integer(tbl) / length(unit_g), 1)
  )
  # Label never-treated
  df_out$label <- ifelse(
    df_out$cohort %in% c("0", "NA", "Inf"),
    "never-treated", "treated"
  )
  cat("Cohort Size Summary:\n")
  print(df_out, row.names = FALSE)
  smallest <- min(df_out$n_units[df_out$label == "treated"])
  cat(sprintf("\nSmallest treated cohort: %d units\n", smallest))

  if (smallest < 5) {
    small_cohorts <- df_out$cohort[df_out$label == "treated" & df_out$n_units < 5]
    cat(sprintf("\nWARNING: Cohort(s) %s have fewer than 5 units.\n",
                paste(small_cohorts, collapse = ", ")))
    cat("  Downstream consequences:\n")
    cat("  - SA (fixest::sunab) likely unstable: non-PSD VCOV, collinearity drops\n")
    cat("  - CS event study: compositional effects at extreme event times\n")
    cat("    (only small late-adopter cohorts contribute to long leads/lags)\n")
    cat("  - Power analysis (Step 4): noisy long-lead estimates distort slope_for_power()\n")
    cat("  - HonestDiD (Step 5): inflated baseline violation from thin-period noise\n")
    cat("  Consider: merge small cohorts, restrict event window, or prefer CS/Gardner.\n")
    cat("  See: 'Compositional Effects in CS Dynamic Aggregation' in Step 3.\n")
  }

  invisible(df_out)
}
```

---

## Treatment Rollout Visualization

Before running any profiling function or estimator, **visualize the treatment design** with `panelView`. This covers Items 1 and 3 of Sant'Anna's practitioner checklist.

### Treatment Status Heatmap

Shows which units are treated in which periods. Use `by.timing = TRUE` for staggered designs.

```r
library(panelView)
library(did)

data(mpdta)

# Create binary treatment indicator from timing variable
mpdta$treat <- ifelse(mpdta$first.treat > 0 & mpdta$year >= mpdta$first.treat, 1, 0)

# Treatment rollout heatmap grouped by cohort.
# panelview() returns a ggplot — wrap in print() when rendering to a device
# or calling from inside a function; at the REPL top level print is implicit.
print(panelview(lemp ~ treat, data = mpdta,
                index = c("countyreal", "year"),
                type = "treat", by.timing = TRUE,
                main = "Treatment Rollout: Minimum Wage Policy"))
```

**What to look for:**
- Clean staggered pattern (blocks of shading starting at different times)
- Units that switch treatment on and off (signals reversible treatment — route to advanced methods)
- Extremely small cohorts (may cause estimation instability)
- Missing cells (gaps in the panel)

### Outcome Trajectories by Treatment Status

Visual pre-trend check: do treated and control groups move in parallel before treatment?

```r
# Outcome trajectories separated by treatment status
print(panelview(lemp ~ treat, data = mpdta,
                index = c("countyreal", "year"),
                type = "outcome", by.group = TRUE,
                main = "Employment Trajectories: Treated vs Control"))
```

**What to look for:**
- Parallel movement of treated and control groups before treatment onset
- Divergence starting at or after treatment (suggests a treatment effect)
- Pre-treatment divergence (red flag for parallel trends assumption)
- Outlier units with extreme trajectories

> For full `panelview()` argument details and large-panel strategies, see
> `references/packages/panelView_quick_start.md`.

---

## Complete Step 1 Workflow Example

```r
# --- Full Step 1 walkthrough with real data ---
library(did)
library(panelView)
data(mpdta)

# 1. Panel integrity checks
check_panel_uniqueness(mpdta, "countyreal", "year")
check_timing_consistency(mpdta, "countyreal", "first.treat")
check_panel_balance(mpdta, "countyreal", "year")
check_sentinel_values(mpdta, "countyreal", "year", "first.treat")
check_already_treated(mpdta, "countyreal", "year", "first.treat")

# 2. Profile treatment structure
profile <- profile_did_design(mpdta, "countyreal", "year", "first.treat")

# 2b. Visualize treatment rollout (print() required when device-capturing)
mpdta$treat <- ifelse(mpdta$first.treat > 0 & mpdta$year >= mpdta$first.treat, 1, 0)
print(panelview(lemp ~ treat, data = mpdta, index = c("countyreal", "year"),
                type = "treat", by.timing = TRUE, main = "Treatment Rollout"))
print(panelview(lemp ~ treat, data = mpdta, index = c("countyreal", "year"),
                type = "outcome", by.group = TRUE, main = "Outcome Trajectories"))

# 3. Inspect cohort sizes
cohort_summary(mpdta, "countyreal", "first.treat")

# 4. Follow routing decision
if (profile$route == "STAGGERED") {
  cat("\nProceeding to Step 2: TWFE diagnostics...\n")
  # -> did-step-2-diagnostics.md
} else if (profile$route == "CANONICAL") {
  cat("\nProceeding to Step 3 (TWFE valid) or Steps 4-5 for pre-trends...\n")
} else if (profile$route == "ADVANCED") {
  cat("\nProceeding to Advanced Methods...\n")
  # -> did-advanced-methods.md
}
```

---

## Simulating Example Data

When the user does not yet have a panel dataset, use this helper to generate a simple staggered-adoption example for learning, testing code, or checking routing logic.

```r
create_did_example_data <- function(n_units = 100, n_periods = 10,
                                    treatment_period = 6, seed = 12345) {
  set.seed(seed)
  data <- expand.grid(unit_id = 1:n_units, time = 1:n_periods)

  # Staggered treatment: 30% never-treated, 4 treated cohorts
  n_never <- floor(n_units * 0.3)
  remaining <- n_units - n_never
  cohort_times <- treatment_period + c(-2, 0, 2, 3)
  cohort_sizes <- as.integer(c(0.2, 0.3, 0.3, 0.2) * remaining)
  cohort_sizes[length(cohort_sizes)] <- remaining - sum(cohort_sizes[-length(cohort_sizes)])
  first_treat <- c(rep(NA, n_never),
                   unlist(mapply(rep, cohort_times, cohort_sizes)))
  data$first_treat <- first_treat[data$unit_id]
  data$treated <- ifelse(is.na(data$first_treat), 0,
                         ifelse(data$time >= data$first_treat, 1, 0))

  # Outcome with true ATT = 2.0
  unit_fe <- rnorm(n_units, mean = 10, sd = 2)
  time_fe <- rnorm(n_periods, mean = 0, sd = 0.5)
  data$outcome <- unit_fe[data$unit_id] + time_fe[data$time] +
                  2.0 * data$treated + rnorm(nrow(data), sd = 1)
  data
}
```

This example is for workflow testing and teaching, not for substantive validation of a research design.

---

## Decision Routing Summary

| Treatment Pattern | Staggered? | Absorbing? | Route | Packages |
|---|---|---|---|---|
| Single date, binary | No | Yes | Standard 2x2 DiD | `fixest`, `DRDID` |
| Multiple dates, binary | Yes | Yes | Staggered pipeline (Steps 2-5) | `did`, `fixest`, `didimputation`, `did2s`, `staggered` |
| Reversible / switches on-off | Either | No | Advanced methods | `DIDmultiplegt`, `DIDmultiplegtDYN`, `etwfe` |
| Continuous / multi-valued | Either | Either | Advanced methods | `DIDmultiplegt`, `DIDmultiplegtDYN` |
| Synthetic control hybrid | Yes | Yes | Advanced methods | `gsynth`, `synthdid` |

## Multi-Level Treatment Structure

When treatment is assigned at a higher level than the units of observation (e.g., state-level policy evaluated with county-level data), special considerations apply.

### When Does This Arise?

- **State-level policy, county-level outcomes** (e.g., Medicaid expansion → county mortality)
- **School-district policy, student-level outcomes**
- **Firm-level treatment, worker-level data**

### Key Implications

1. **Clustering**: Standard errors must be clustered at the **treatment-assignment level** (e.g., state), not the unit level (e.g., county). This is critical — clustering at the unit level ignores the within-cluster correlation from common treatment and produces anti-conservative inference.

2. **Effective sample size**: The number of independent observations for inference is the **number of clusters** (e.g., 51 states), not the number of units (e.g., 3,064 counties). Few-cluster problems arise when treated clusters < 30.

3. **Per-estimator clustering syntax:**

| Estimator | Parameter | Multi-Level Example |
|-----------|-----------|-------------------|
| CS (`did`) | `clustervars` | `att_gt(..., clustervars = "state_id")` |
| SA (`fixest`) | `cluster` | `feols(..., cluster = ~state_id)` |
| BJS (`didimputation`) | `cluster_var` | `did_imputation(..., cluster_var = "state_id")` |
| Gardner (`did2s`) | `cluster_var` | `did2s(..., cluster_var = "state_id")` |
| Staggered | — | No explicit clustering; uses analytical SEs |

4. **Aggregation option**: When treatment is at the state level, you can aggregate outcomes to the state level (using population weights) before estimation. This simplifies analysis and avoids few-cluster issues but changes the estimand (state-average effect vs. county-level effect).

> See "Clustering Standard Errors" in `did-step-3-estimation.md` for detailed syntax, few-cluster diagnostics, and wild cluster bootstrap examples.

## Packages Used Next

- Step 2 diagnostics: `bacondecomp`, `TwoWayFEWeights`
- Step 3 robust estimation: `did`, `fixest`, `didimputation`, `did2s`, `staggered`
- Advanced branch: `DIDmultiplegt`, `DIDmultiplegtDYN`, `gsynth`, `synthdid`, `etwfe`, `YatchewTest`

## Read Next

- `did-step-2-diagnostics.md`
- `did-step-3-estimation.md`
- `did-advanced-methods.md`
