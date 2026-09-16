# ## Contents
# - [Design profile](#design-profile)
# - [Dispatch handler](#dispatch-handler)
#
# ============================================================================
# did-mcp — Step 1: did_profile_design
# ============================================================================
# Classifies a panel as NO_TREATMENT / CANONICAL / STAGGERED and recommends
# a route (NONE / CANONICAL / STAGGERED / ADVANCED). The `profile_did_design`
# function body below is a byte-aligned copy of the skill doc at
# skill/references/did-step-1-treatment-structure.md:34-194. Do not edit the
# body semantically; if the skill version changes, re-sync both sides.
# ============================================================================

# ## Design profile
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

# ---- Dispatch handler -------------------------------------------------------

# ## Dispatch handler
dispatch_profile_design <- function(id, params) {
  run_with_capture(id, function() {
    panel_id  <- params$panel_id
    handle_id <- params$handle_id
    if (is.null(panel_id))  stop("profile_design: `panel_id` is required",  call. = FALSE)
    if (is.null(handle_id)) stop("profile_design: `handle_id` is required", call. = FALSE)

    df <- get_object(panel_id)

    id_var           <- params$id_var
    time_var         <- params$time_var
    treat_timing_var <- params$treat_timing_var
    treat_var        <- params$treat_var  # may be NULL

    if (is.null(id_var) || is.null(time_var) || is.null(treat_timing_var)) {
      stop("profile_design: id_var / time_var / treat_timing_var are required (read from panel handle's schema).", call. = FALSE)
    }

    prof <- profile_did_design(df, id_var, time_var, treat_timing_var,
                               treat_var = if (!is.null(treat_var) && nzchar(treat_var)) treat_var else NULL)

    # Normalize cohort_dates to a plain numeric vector (strip tapply names)
    cohort_dates <- as.numeric(unname(prof$cohort_dates))

    result <- list(
      handle            = handle_id,
      timing            = prof$timing,
      route             = prof$route,
      n_units           = prof$n_units,
      n_periods         = prof$n_periods,
      n_cohorts         = prof$n_cohorts,
      is_balanced       = prof$is_balanced,
      is_absorbing      = prof$is_absorbing,
      ever_treated      = prof$ever_treated,
      never_treated     = prof$never_treated,
      has_never_treated = isTRUE(prof$never_treated > 0),
      cohort_dates      = as.list(cohort_dates)
    )

    # Store under handle for downstream tools (and persistence)
    store_object(handle_id, prof)

    list(
      result = result,
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "design_profile",
          rClass    = "list",
          summary   = sprintf("design_profile: timing=%s route=%s cohorts=%d units=%d",
                              prof$timing, prof$route, prof$n_cohorts, prof$n_units),
          sizeBytes = object_size(prof)
        )
      )
    )
  })
}
