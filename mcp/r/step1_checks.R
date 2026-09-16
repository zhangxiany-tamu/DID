# ## Contents
# - [Checks](#checks)
# - [Dispatch handler](#dispatch-handler)
#
# ============================================================================
# did-mcp — Step 1: did_check_panel
# ============================================================================
# Runs the six panel integrity checks from the skill doc and returns a single
# structured report. The six check_*() function bodies below are byte-aligned
# copies of skill/references/did-step-1-treatment-structure.md:282-436. Do not
# edit them semantically; re-sync both sides if the skill version changes.
# ============================================================================

# ## Checks
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

# ---- Dispatch handler -------------------------------------------------------

# ## Dispatch handler
dispatch_check_panel <- function(id, params) {
  run_with_capture(id, function() {
    panel_id <- params$panel_id
    if (is.null(panel_id)) stop("check_panel: `panel_id` is required", call. = FALSE)

    df <- get_object(panel_id)

    id_var           <- params$id_var
    time_var         <- params$time_var
    treat_timing_var <- params$treat_timing_var
    if (is.null(id_var) || is.null(time_var) || is.null(treat_timing_var)) {
      stop("check_panel: id_var / time_var / treat_timing_var are required (read from panel handle's schema).", call. = FALSE)
    }

    u  <- check_panel_uniqueness(df, id_var, time_var)
    t_ <- check_timing_consistency(df, id_var, treat_timing_var)
    b  <- check_panel_balance(df, id_var, time_var)
    s  <- check_sentinel_values(df, id_var, time_var, treat_timing_var)
    a  <- check_already_treated(df, id_var, time_var, treat_timing_var)
    f  <- check_future_treatment(df, id_var, time_var, treat_timing_var)

    overall_ok <- isTRUE(u) && isTRUE(t_) && isTRUE(b$is_balanced) &&
                  length(s) == 0 && length(a) == 0 && length(f) == 0

    result <- list(
      uniqueness       = list(ok = isTRUE(u)),
      timing           = list(ok = isTRUE(t_)),
      balance          = list(
        is_balanced    = isTRUE(b$is_balanced),
        n_units        = b$n_units,
        n_periods      = b$n_periods,
        fully_observed = b$fully_observed
      ),
      sentinels        = list(ok = length(s) == 0,
                              out_of_range = as.list(as.numeric(s))),
      already_treated  = list(ok = length(a) == 0,
                              unit_ids = as.list(a)),
      future_treatment = list(ok = length(f) == 0,
                              unit_ids = as.list(f)),
      overall_ok       = overall_ok
    )

    list(
      result         = result,
      objectsCreated = list()  # informational tool; creates no handles
    )
  })
}
