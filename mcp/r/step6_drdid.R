# ## Contents
# - [Estimation](#estimation)
# - [Dispatch handler](#dispatch-handler)
#
# ============================================================================
# did-mcp — did_drdid: doubly-robust DiD (DRDID::drdid)
# ============================================================================
# Single-period doubly-robust DiD for two-period panels (or repeated cross-
# sections). Complements Callaway-Sant'Anna: DRDID is what CS uses under the
# hood for each (g, t) cell, exposed as a standalone estimator so users can
# run it on a pre-aggregated two-period slice with explicit covariates.
#
# Inputs: panel (must have two distinct time values per unit), outcome,
# treatment-at-post indicator (dname), covariate formula, estMethod. Returns
# an `estimate` handle with a simplified envelope (single overall ATT, no
# event study — DRDID only produces one ATT per call).
# ============================================================================

# ## Estimation
run_drdid <- function(df, schema, params, handle_id) {
  if (!requireNamespace("DRDID", quietly = TRUE)) {
    stop("did_drdid requires the `DRDID` package. Run mcp/r/install_packages.R.",
         call. = FALSE)
  }

  id_var      <- schema$id_var
  time_var    <- schema$time_var
  outcome_var <- params$outcome_var %||% schema$outcome_var %||% ""
  if (!nzchar(outcome_var) || !outcome_var %in% names(df)) {
    stop("did_drdid: outcome_var is required and must exist in the panel.",
         call. = FALSE)
  }

  # dname: a binary 1-if-eventually-treated indicator (time-invariant within
  # unit). If the user didn't pass one, synthesize from treat_timing_var as
  # 1{gname > 0 & is.finite(gname)}.
  dname <- params$treated_var
  if (is.null(dname) || !nzchar(dname) || !dname %in% names(df)) {
    g <- suppressWarnings(as.numeric(df[[schema$treat_timing_var]]))
    g[generated_never_treated_rows(df, schema$treat_timing_var)] <- 0
    df$.did_drdid_treated <- as.integer(is.finite(g) & g > 0)
    dname <- ".did_drdid_treated"
  }

  # DRDID expects exactly 2 time values. If the panel has more, the user must
  # pass time_values to select the pre/post pair explicitly.
  times <- sort(unique(df[[time_var]]))
  if (length(times) > 2) {
    tv <- params$time_values
    if (is.null(tv) || length(tv) != 2) {
      stop(sprintf(
        "did_drdid: panel has %d time values (%s); DRDID needs exactly 2. Pass `time_values: [pre, post]` to select the pair.",
        length(times), paste(times, collapse = ", ")), call. = FALSE)
    }
    tv <- sort(as.numeric(tv))
    df <- df[df[[time_var]] %in% tv, , drop = FALSE]
    times <- tv
  }
  if (length(times) != 2) {
    stop(sprintf("did_drdid: need exactly 2 time values, got %d", length(times)),
         call. = FALSE)
  }

  xformla_vars <- unlist(params$xformla_vars %||% list())
  xformla <- if (length(xformla_vars) > 0) {
    stats::as.formula(paste("~", paste(xformla_vars, collapse = " + ")))
  } else {
    NULL
  }

  # DRDID >=1.2 replaced estMethod="dr" with "imp" (improved doubly-robust).
  # Calling the legacy alias emits "estMethod = dr is not supported. Using
  # 'imp'." on every call. We accept "dr" as a backwards-compat alias and
  # transparently translate it to "imp" — the mathematical method is the
  # same. Default is now "imp" explicitly.
  est_method_requested <- params$est_method %||% "imp"
  if (!est_method_requested %in% c("dr", "ipw", "reg", "trad", "imp")) {
    stop(sprintf("did_drdid: est_method must be imp/ipw/reg/trad (got '%s')",
                 est_method_requested), call. = FALSE)
  }
  legacy_dr_alias <- identical(est_method_requested, "dr")
  est_method <- if (legacy_dr_alias) "imp" else est_method_requested

  # DRDID::drdid with panel=TRUE needs panel structure (same id across times).
  is_panel <- isTRUE(params$panel %||% TRUE)

  dr_args <- list(
    yname     = outcome_var,
    tname     = time_var,
    idname    = id_var,
    dname     = dname,
    xformla   = xformla,
    data      = df,
    panel     = is_panel,
    estMethod = est_method
  )
  if (!is.null(params$weights_var) && nzchar(params$weights_var)) {
    dr_args$weightsname <- params$weights_var
  }
  if (!is.null(params$boot)) dr_args$boot <- isTRUE(params$boot)
  if (!is.null(params$nboot)) dr_args$nboot <- as.integer(params$nboot)

  res <- do.call(DRDID::drdid, dr_args)

  # res has fields: ATT, se, uci, lci, boots, ...
  overall <- make_overall(res$ATT, res$se)
  # Prefer DRDID's reported CI if present (bootstrap-based in some modes).
  if (is.numeric(res$lci) && is.finite(res$lci)) overall$ci_lower <- as.numeric(res$lci)
  if (is.numeric(res$uci) && is.finite(res$uci)) overall$ci_upper <- as.numeric(res$uci)

  reliability_notes <- character()
  if (legacy_dr_alias) {
    reliability_notes <- c(reliability_notes,
      "est_method='dr' is a legacy alias; DRDID renamed it to 'imp' (improved doubly-robust). Translated automatically.")
  }

  metadata <- list(
    estimator          = "drdid",
    n_obs              = nrow(df),
    n_units            = length(unique(df[[id_var]])),
    n_cohorts          = 1L,
    control_group      = "untreated",
    est_method         = est_method,
    est_method_requested = est_method_requested,
    time_values        = as.list(as.numeric(times)),
    cohort_sizes       = list(),
    reliability_notes  = as.list(reliability_notes),
    warnings           = list()
  )

  # DRDID returns no event study (single ATT). Keep the envelope shape for
  # consistency with other estimators.
  envelope_out <- envelope(handle_id, overall, list(), metadata)

  store_object(handle_id, res)

  list(
    r_object = res,
    rClass   = "drdid",
    std      = envelope_out
  )
}

# ## Dispatch handler
dispatch_drdid <- function(id, params) {
  run_with_capture(id, function() {
    panel_id  <- params$panel_id
    handle_id <- params$handle_id
    if (is.null(panel_id))  stop("drdid: `panel_id` is required",  call. = FALSE)
    if (is.null(handle_id)) stop("drdid: `handle_id` is required", call. = FALSE)

    schema <- list(
      id_var           = params$id_var,
      time_var         = params$time_var,
      treat_timing_var = params$treat_timing_var,
      treat_var        = params$treat_var,
      outcome_var      = params$outcome_var
    )
    if (is.null(schema$id_var) || is.null(schema$time_var) ||
        is.null(schema$treat_timing_var)) {
      stop("drdid: id_var / time_var / treat_timing_var are required.", call. = FALSE)
    }

    df <- get_object(panel_id)
    result <- run_drdid(df, schema, params, handle_id)

    list(
      result = result$std,
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "estimate",
          rClass    = result$rClass,
          summary   = sprintf("estimate (drdid) on panel=%s: ATT=%.4f",
                              panel_id, result$std$overall$att %||% NA_real_),
          sizeBytes = object_size(result$r_object)
        )
      )
    )
  })
}
