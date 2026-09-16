# ## Contents
# - [Never-treated coercion](#never-treated-coercion)
# - [Cohort-size summary](#cohort-size-summary)
# - [Small-cohort flag](#small-cohort-flag)
# - [Panel balance check (silent)](#panel-balance-check-silent)
# - [VCOV diagnostics](#vcov-diagnostics)
# - [Envelope builders](#envelope-builders)
# - [fixest / sunab VCOV extraction](#fixest--sunab-vcov-extraction)
# - [Event-time name parsing](#event-time-name-parsing)
#
# ============================================================================
# did-mcp — Step 3 common helpers
# ============================================================================
# Shared utilities for the five Step 3 estimator wrappers:
#   * coerce_never_treated_for_estimator — map gname sentinels per estimator
#   * summarize_cohort_sizes             — {<cohort>: n_units, ...}
#   * check_vcov_psd                     — report non-PSD VCOV + min eigenvalue
#   * standardize_overall / standardize_event_study — build the JSON envelope
#   * envelope                            — assemble the final list
# Each estimator wrapper (step3_estimators.R) calls these to emit a consistent
# JSON shape across all five packages.
# ============================================================================

# ## Never-treated coercion
# Each estimator expects gname to encode never-treated with a specific sentinel.
# Finite sentinels are recognized only when created by our recoding helper.
# Imported finite values require an explicit, design-informed recoding.

coerce_never_treated_for_estimator <- function(df, gname, estimator) {
  target <- switch(estimator,
    "cs"        = "zero",
    "sa"        = "inf",
    "staggered" = "inf",
    "bjs"       = "zero",                    # documented didimputation convention
    "did2s"     = "zero",                    # did2s uses a binary treat col
    stop(sprintf("coerce_never_treated_for_estimator: unknown estimator '%s'", estimator),
         call. = FALSE)
  )

  recode_never_treated(df, gname, target)
}

# ## Cohort-size summary
summarize_cohort_sizes <- function(df, gname, id_var) {
  g <- df[[gname]]
  is_never <- never_treated_rows(df, gname)
  sub <- df[!is_never, c(id_var, gname), drop = FALSE]
  if (nrow(sub) == 0) return(list())
  # first g per unit
  first_g <- tapply(sub[[gname]], sub[[id_var]], function(x) x[1])
  tbl <- table(first_g)
  out <- as.list(as.integer(tbl))
  names(out) <- as.character(names(tbl))
  out
}

# ## Small-cohort flag
# Given a cohort_sizes list ({cohort: n_units}), return a list of the cohorts
# with fewer than `threshold` units. Estimators (did, fixest::sunab) silently
# drop these in several common cases, which agents and downstream consumers
# need to see. Default threshold of 2 matches `did`'s "single cross-sectional
# unit" drop path.

flag_small_cohorts <- function(cohort_sizes, threshold = 2L) {
  if (length(cohort_sizes) == 0) return(list())
  sizes <- unlist(cohort_sizes)
  small <- sizes[sizes < threshold]
  if (length(small) == 0) return(list())
  mapply(
    function(cohort, n) list(cohort = as.character(cohort), n_units = as.integer(n)),
    names(small), small,
    SIMPLIFY = FALSE, USE.NAMES = FALSE
  )
}

# ## Panel balance check (silent)
# step1_checks.R::check_panel_balance() prints to stdout. Step 3 wrappers need
# a silent balance probe — we do not want the cat() output captured into the
# RpcResponse.stdout field every time BJS runs. Keep this self-contained so
# step3 does not implicitly depend on step1 source order.

panel_is_balanced <- function(df, id_var, time_var) {
  n_periods <- length(unique(df[[time_var]]))
  obs_per_unit <- table(df[[id_var]])
  all(obs_per_unit == n_periods)
}

# ## VCOV diagnostics
check_vcov_psd <- function(V) {
  if (is.null(V) || any(!is.finite(V))) {
    return(list(psd = FALSE, min_eig = NA_real_, note = "VCOV contains non-finite entries"))
  }
  eig <- tryCatch(eigen(V, symmetric = TRUE, only.values = TRUE)$values,
                  error = function(e) NULL)
  if (is.null(eig)) return(list(psd = FALSE, min_eig = NA_real_, note = "eigen() failed"))
  min_eig <- min(eig)
  list(psd = min_eig >= -1e-8, min_eig = as.numeric(min_eig),
       note = if (min_eig < -1e-8) "VCOV has negative eigenvalue" else "OK")
}

# ## Envelope builders
make_overall <- function(att, se, alpha = 0.05) {
  if (is.null(att) || !is.finite(att)) {
    return(list(att = NA_real_, se = NA_real_,
                ci_lower = NA_real_, ci_upper = NA_real_, pvalue = NA_real_))
  }
  if (is.null(se) || !is.finite(se) || se <= 0) {
    return(list(att = as.numeric(att), se = NA_real_,
                ci_lower = NA_real_, ci_upper = NA_real_, pvalue = NA_real_))
  }
  z <- stats::qnorm(1 - alpha / 2)
  list(
    att      = as.numeric(att),
    se       = as.numeric(se),
    ci_lower = as.numeric(att - z * se),
    ci_upper = as.numeric(att + z * se),
    pvalue   = as.numeric(2 * (1 - stats::pnorm(abs(att / se))))
  )
}

make_event_rows <- function(event_time, estimate, se, alpha = 0.05) {
  n <- length(event_time)
  if (n == 0) return(list())
  z <- stats::qnorm(1 - alpha / 2)
  out <- vector("list", n)
  for (i in seq_len(n)) {
    e  <- event_time[i]
    b  <- estimate[i]
    s  <- if (i <= length(se)) se[i] else NA_real_
    lo <- if (is.finite(s) && s > 0) b - z * s else NA_real_
    hi <- if (is.finite(s) && s > 0) b + z * s else NA_real_
    out[[i]] <- list(
      event_time = as.integer(e),
      estimate   = as.numeric(b),
      se         = if (is.finite(s)) as.numeric(s) else NA_real_,
      ci_lower   = as.numeric(lo),
      ci_upper   = as.numeric(hi)
    )
  }
  out
}

# ## fixest / sunab VCOV extraction
# Shared helper for SA (est_sa) and extract_event_study.fixest. Returns a
# structured record instead of silently degrading, so callers can decide
# whether to warn, fail, or surface a flag downstream.
#
# did2s models expose the full event-time covariance directly via vcov().
# Match its names explicitly; the private sunab helper is only for SA.
#
# `is_fallback` is TRUE whenever the returned V is diag(se^2) rather than the
# matched event-time VCOV; downstream HonestDiD/pretrends consumers MUST
# treat that as an ignore-off-diagonal approximation.

is_did2s_fixest_model <- function(model) {
  nms <- tryCatch(names(stats::coef(model)), error = function(e) character())
  any(grepl("^\\.did2s_rel::", nms))
}

extract_sunab_vcov <- function(model, expected_len, coef_names = NULL) {
  if (is_did2s_fixest_model(model)) {
    if (is.null(coef_names)) {
      nms <- names(stats::coef(model))
      coef_names <- nms[!is.na(parse_event_times(nms))]
    }
    V <- tryCatch(stats::vcov(model), error = function(e) NULL)
    if (length(coef_names) != expected_len || anyDuplicated(coef_names) ||
        !is.matrix(V) || !is.numeric(V) ||
        is.null(rownames(V)) || is.null(colnames(V)) ||
        anyDuplicated(rownames(V)) || anyDuplicated(colnames(V)) ||
        !all(coef_names %in% rownames(V)) || !all(coef_names %in% colnames(V))) {
      stop("did2s covariance cannot be matched to the event-study coefficient names.", call. = FALSE)
    }
    V <- V[coef_names, coef_names, drop = FALSE]
    if (any(!is.finite(V)) || !isSymmetric(unname(V), tol = 1e-8)) {
      stop("did2s matched event-study covariance must be finite and symmetric.", call. = FALSE)
    }
    return(list(V = V, is_fallback = FALSE, reason = NA_character_,
                message = NA_character_))
  }

  if (requireNamespace("HonestDiD", quietly = TRUE)) {
    bv <- tryCatch(HonestDiD:::sunab_beta_vcv(model), error = function(e) NULL)
    if (!is.null(bv) && is.matrix(bv$sigma) &&
        nrow(as.matrix(bv$sigma)) == expected_len) {
      return(list(V = as.matrix(bv$sigma), is_fallback = FALSE,
                  reason = NA_character_, message = NA_character_))
    }
  }

  # Fallback: diag(se^2). This is a real degradation for SA — off-diagonal
  # covariance is zeroed out, so overall SEs and downstream HonestDiD results
  # based on this sigma will be wrong. Callers must surface a warning.
  se <- tryCatch(fixest::se(model), error = function(e) NULL)
  V <- if (!is.null(se) && length(se) == expected_len) {
    diag(as.numeric(se)^2)
  } else {
    diag(expected_len)
  }
  list(V = V, is_fallback = TRUE, reason = "sunab_beta_vcv_unavailable",
       message = "HonestDiD:::sunab_beta_vcv unavailable or dim-mismatched; sigma is diag(se^2). Overall SE and downstream HonestDiD/pretrends results will ignore off-diagonal covariance.")
}

# ## Event-time name parsing
# Parses the integer relative-time from estimator-specific coefficient / term
# names. Handles:
#   * fixest sunab:  "year::-4", "year::0"                  (anchored after "::")
#   * did2s:         ".did2s_rel::-4", ".did2s_rel::0"      (anchored after "::")
#   * didimputation: "-4", "0", "1"                         (whole-string int)
# A generic regex like "-?[0-9]+" was too loose — a time-variable name that
# contains digits (e.g. "cohort_2012") would return the wrong match.

parse_event_times <- function(nms) {
  # Primary: capture the signed integer immediately after "::".
  m <- regmatches(nms, regexec("::(-?[0-9]+)(?![0-9])", nms, perl = TRUE))
  out <- vapply(m, function(x) {
    if (length(x) >= 2) suppressWarnings(as.integer(x[[2]])) else NA_integer_
  }, integer(1))

  # Fallback: whole-string integer (BJS term column).
  needs_fallback <- is.na(out)
  if (any(needs_fallback)) {
    whole <- suppressWarnings(as.integer(
      regmatches(nms[needs_fallback],
                 regexpr("^-?[0-9]+$", nms[needs_fallback]))
    ))
    # regmatches returns a shorter vector when some don't match; align by name.
    matches <- regexpr("^-?[0-9]+$", nms[needs_fallback]) != -1
    filled <- rep(NA_integer_, sum(needs_fallback))
    if (any(matches)) filled[matches] <- whole
    out[needs_fallback] <- filled
  }

  out
}

trim_event_window <- function(event_time, min_e, max_e) {
  keep <- rep(TRUE, length(event_time))
  if (!is.null(min_e)) keep <- keep & event_time >= as.numeric(min_e)
  if (!is.null(max_e)) keep <- keep & event_time <= as.numeric(max_e)
  keep
}

envelope <- function(handle_id, overall, event_study, metadata) {
  if (exists("did_estimator_provenance", mode = "function")) {
    metadata$packages <- did_estimator_provenance(metadata$estimator)
  }
  list(
    handle      = handle_id,
    overall     = overall,
    event_study = event_study,
    metadata    = metadata
  )
}
