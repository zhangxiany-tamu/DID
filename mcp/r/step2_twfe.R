# ## Contents
# - [Severity classification](#severity-classification)
# - [Helpers](#helpers)
# - [Bacon decomposition](#bacon-decomposition)
# - [TwoWayFEWeights](#twowayfeweights)
# - [Main runner](#main-runner)
#
# ============================================================================
# did-mcp — Step 2: did_diagnose_twfe
# ============================================================================
# Two complementary diagnostics that expose when TWFE regression is biased
# under staggered adoption:
#   * bacondecomp::bacon()  — Goodman-Bacon decomposition; flags weight on
#                             "forbidden comparisons" (late-treated vs.
#                             already-treated as control).
#   * TwoWayFEWeights::twowayfeweights() — de Chaisemartin-D'Haultfoeuille
#                             weights; flags the share of negative weights.
#
# Both produce a % → {MINIMAL, MILD, MODERATE, SEVERE} band. The tool picks
# the worst of the two and returns an overall recommendation.
#
# Assumptions (enforced up-front, not deep inside library calls):
#   - Binary absorbing treatment. If the panel schema lacks treat_var, we
#     synthesize it from treat_timing_var as 1{t >= gname & gname > 0}.
#     Any unit with a monotonicity violation is flagged via warning().
#   - bacon requires a balanced panel AND scales O(N^2). On unbalanced or
#     large panels, we skip bacon with a warning() and run weights-only.
#     The skill doc confirms: TwoWayFEWeights ≥ 25% negative weights is a
#     sufficient diagnostic regardless of Bacon availability.
# ============================================================================

# ## Severity classification
classify_severity <- function(pct) {
  if (!is.finite(pct)) return("UNKNOWN")
  if (pct > 50) return("SEVERE")
  if (pct > 25) return("MODERATE")
  if (pct > 10) return("MILD")
  "MINIMAL"
}

severity_rank <- function(sev) {
  idx <- match(sev, c("MINIMAL", "MILD", "MODERATE", "SEVERE"))
  if (is.na(idx)) 0L else as.integer(idx)
}

twfe_recommendation <- function(severity) {
  switch(severity,
    "SEVERE"   = "Abandon TWFE. Use heterogeneity-robust estimators (CS, SA, BJS, Gardner) — did_estimate with estimator in {cs, sa, bjs, did2s, staggered}.",
    "MODERATE" = "Strongly prefer heterogeneity-robust estimators over TWFE. Report TWFE only alongside a robust estimate.",
    "MILD"     = "Report TWFE alongside at least one robust estimator (CS) as a robustness check.",
    "MINIMAL"  = "TWFE is likely acceptable. Still recommended: run a robust estimator once for documentation.",
    "Severity undetermined; cannot recommend. Inspect bacon/weights output directly."
  )
}

# ## Helpers
synthesize_binary_treat <- function(df, treat_var, treat_timing_var, time_var) {
  # Use the user-supplied treat_var ONLY if it was explicitly passed to the
  # tool. We deliberately do NOT fall back to the panel's schema$treat_var:
  # many DiD fixtures (e.g. did::mpdta) store `treat` as an "ever-treated"
  # flag (1 for every row of a treated unit), not a "currently treated"
  # post-indicator. Bacon needs the latter; mis-using the former makes
  # every treated unit look always-treated, produces zero valid 2x2 pairs,
  # and causes "subscript out of bounds" inside bacondecomp.
  if (!is.null(treat_var) && nzchar(treat_var) && treat_var %in% names(df)) {
    return(list(df = df, treat_col = treat_var, synthesized = FALSE))
  }
  g <- suppressWarnings(as.numeric(df[[treat_timing_var]]))
  g[generated_never_treated_rows(df, treat_timing_var)] <- 0
  t <- suppressWarnings(as.numeric(df[[time_var]]))
  df$.did_twfe_treat <- as.integer(is.finite(g) & g > 0 & t >= g)
  list(df = df, treat_col = ".did_twfe_treat", synthesized = TRUE)
}

check_treatment_monotonicity <- function(df, id_var, time_var, treat_col) {
  violations <- character()
  for (uid in unique(df[[id_var]])) {
    mask <- df[[id_var]] == uid
    sub <- df[mask, c(time_var, treat_col), drop = FALSE]
    sub <- sub[order(sub[[time_var]]), ]
    d <- diff(as.integer(sub[[treat_col]]))
    if (any(d < 0, na.rm = TRUE)) {
      violations <- c(violations, as.character(uid))
    }
  }
  violations
}

# ## Bacon decomposition
run_bacon_decomp <- function(df, outcome_var, id_var, time_var, treat_col) {
  if (!requireNamespace("bacondecomp", quietly = TRUE)) {
    stop("did_diagnose_twfe requires `bacondecomp`. Run mcp/r/install_packages.R.",
         call. = FALSE)
  }

  fml <- stats::as.formula(sprintf("%s ~ %s", outcome_var, treat_col))
  res <- bacondecomp::bacon(fml, data = df, id_var = id_var,
                            time_var = time_var, quietly = TRUE)

  # res is a data.frame with columns: treated, untreated, estimate, weight, type
  types <- as.character(res$type)
  forbidden_mask <- types == "Later vs Earlier Treated"
  forbidden_weight <- sum(res$weight[forbidden_mask], na.rm = TRUE)
  forbidden_pct <- 100 * forbidden_weight

  overall_estimate <- sum(res$weight * res$estimate, na.rm = TRUE)

  # Group summary (one row per comparison type)
  by_type <- list()
  for (ty in sort(unique(types))) {
    idx <- types == ty
    by_type[[length(by_type) + 1]] <- list(
      type           = ty,
      total_weight   = as.numeric(sum(res$weight[idx], na.rm = TRUE)),
      mean_estimate  = as.numeric(mean(res$estimate[idx], na.rm = TRUE)),
      n_pairs        = sum(idx)
    )
  }

  severity <- classify_severity(forbidden_pct)
  list(
    forbidden_weight_pct = as.numeric(forbidden_pct),
    severity             = severity,
    overall_estimate     = as.numeric(overall_estimate),
    by_type              = by_type,
    n_pairs              = nrow(res)
  )
}

# ## TwoWayFEWeights
run_twfe_weights <- function(df, outcome_var, id_var, time_var, treat_col,
                             type = "feTR") {
  if (!requireNamespace("TwoWayFEWeights", quietly = TRUE)) {
    stop("did_diagnose_twfe requires `TwoWayFEWeights`. Run mcp/r/install_packages.R.",
         call. = FALSE)
  }

  # twowayfeweights requires numeric group IDs — character state abbreviations
  # produce cryptic errors. Coerce idempotently.
  df$.did_twfe_G <- as.integer(as.factor(df[[id_var]]))
  df[[outcome_var]] <- as.numeric(df[[outcome_var]])
  df[[time_var]]    <- as.numeric(df[[time_var]])
  df[[treat_col]]   <- as.numeric(df[[treat_col]])

  wt <- TwoWayFEWeights::twowayfeweights(
    data = df,
    Y    = outcome_var,
    G    = ".did_twfe_G",
    T    = time_var,
    D    = treat_col,
    type = type
  )

  sum_plus  <- as.numeric(wt$sum_plus  %||% 0)
  sum_minus <- as.numeric(wt$sum_minus %||% 0)
  denom <- sum_plus + abs(sum_minus)
  neg_pct <- if (denom > 0) 100 * abs(sum_minus) / denom else 0

  list(
    negative_weight_pct = as.numeric(neg_pct),
    severity            = classify_severity(neg_pct),
    n_positive          = as.integer(wt$nr_plus  %||% NA_integer_),
    n_negative          = as.integer(wt$nr_minus %||% NA_integer_),
    sum_positive        = sum_plus,
    sum_negative        = sum_minus,
    beta                = as.numeric(wt$beta %||% NA_real_),
    sensibility         = as.numeric(wt$sensibility %||% NA_real_),
    type                = type
  )
}

# ## Main runner
run_diagnose_twfe <- function(df, schema, params) {
  id_var           <- schema$id_var
  time_var         <- schema$time_var
  treat_timing_var <- schema$treat_timing_var
  outcome_var      <- params$outcome_var %||% schema$outcome_var %||% ""
  if (!nzchar(outcome_var) || !outcome_var %in% names(df)) {
    stop("diagnose_twfe: outcome_var is required and must exist in the panel.",
         call. = FALSE)
  }

  # Synthesize a binary currently-treated indicator from (gname, t). We do NOT
  # fall back to schema$treat_var silently — that column often means
  # "ever-treated" in common fixtures, and using it here would break bacon.
  # If the user genuinely has a correct post-indicator they want to use, they
  # pass it explicitly via the `treat_var` parameter.
  syn <- synthesize_binary_treat(df, params$treat_var,
                                 treat_timing_var, time_var)
  df <- syn$df
  treat_col <- syn$treat_col

  # Monotonicity check — bacondecomp is designed for absorbing treatment only.
  viols <- check_treatment_monotonicity(df, id_var, time_var, treat_col)
  if (length(viols) > 0) {
    warning(sprintf(
      "Treatment reverts for %d unit(s) (e.g. %s). bacondecomp assumes absorbing treatment; results may be unreliable or the call may error.",
      length(viols), paste(head(viols, 5), collapse = ", ")),
      call. = FALSE)
  }

  run_bacon   <- isTRUE(params$run_bacon   %||% TRUE)
  run_weights <- isTRUE(params$run_weights %||% TRUE)
  weights_type <- params$weights_type %||% "feTR"
  if (!weights_type %in% c("feTR", "feS", "fdTR", "fdS")) {
    stop(sprintf("diagnose_twfe: weights_type must be feTR/feS/fdTR/fdS (got '%s')", weights_type),
         call. = FALSE)
  }

  # Bacon prerequisites: balanced panel + manageable unit count. We skip with
  # a warning rather than erroring so the tool still returns a useful result
  # via weights-only — per the skill's "if neg_share > 25% the conclusion is
  # definitive" decision rule.
  bacon_result <- NULL
  if (run_bacon) {
    if (!panel_is_balanced(df, id_var, time_var)) {
      warning("diagnose_twfe: panel is unbalanced; skipping bacon decomposition. Running weights-only. Balance the panel or use TwoWayFEWeights alone.",
              call. = FALSE)
    } else {
      n_units <- length(unique(df[[id_var]]))
      if (n_units > 1000) {
        warning(sprintf(
          "diagnose_twfe: panel has %d units; bacondecomp is O(N^2) and may be very slow. Consider aggregating to treatment level before calling the tool.",
          n_units), call. = FALSE)
      }
      bacon_result <- tryCatch(
        run_bacon_decomp(df, outcome_var, id_var, time_var, treat_col),
        error = function(e) {
          warning(sprintf("diagnose_twfe: bacon decomposition failed: %s", conditionMessage(e)),
                  call. = FALSE)
          NULL
        }
      )
    }
  }

  weights_result <- NULL
  if (run_weights) {
    weights_result <- tryCatch(
      run_twfe_weights(df, outcome_var, id_var, time_var, treat_col,
                       type = weights_type),
      error = function(e) {
        warning(sprintf("diagnose_twfe: TwoWayFEWeights failed: %s", conditionMessage(e)),
                call. = FALSE)
        NULL
      }
    )
  }

  if (is.null(bacon_result) && is.null(weights_result)) {
    stop("diagnose_twfe: both bacon and weights were unavailable; nothing to report.",
         call. = FALSE)
  }

  severities <- c(bacon_result$severity, weights_result$severity)
  severities <- severities[!is.null(severities) & !is.na(severities)]
  overall <- if (length(severities) == 0) {
    "UNKNOWN"
  } else {
    c("MINIMAL", "MILD", "MODERATE", "SEVERE")[max(
      vapply(severities, severity_rank, integer(1)))]
  }

  list(
    bacon            = bacon_result,
    weights          = weights_result,
    overall_severity = overall,
    recommendation   = twfe_recommendation(overall),
    treat_col_used   = treat_col,
    n_monotonicity_violations = length(viols)
  )
}
