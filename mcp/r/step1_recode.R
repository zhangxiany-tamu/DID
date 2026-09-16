# ============================================================================
# did-mcp — Step 1: did_recode_never_treated
# ============================================================================
# Unifies never-treated coding (0 / NA / Inf / max_plus_10) so a panel can be
# passed to the estimator that expects that convention. The recode function
# helpers are mirrored in the skill's Step 1 never-treated coding section.
#
# ## Contents
# - [Coding helpers](#coding-helpers)
# - [Dispatch handler](#dispatch-handler)
# ============================================================================

# ## Coding helpers
# Record only sentinels created here: an arbitrary future cohort in imported
# data is not enough evidence that a unit is never treated. The attribute
# survives RDS worker recycling; CSV export does not preserve it.
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

# ## Dispatch handler

dispatch_recode_never_treated <- function(id, params) {
  run_with_capture(id, function() {
    panel_id  <- params$panel_id
    handle_id <- params$handle_id
    target    <- params$target %||% "zero"

    if (is.null(panel_id))  stop("recode_never_treated: `panel_id` is required",  call. = FALSE)
    if (is.null(handle_id)) stop("recode_never_treated: `handle_id` is required", call. = FALSE)
    if (!target %in% c("zero", "na", "inf", "max_plus_10")) {
      stop(sprintf("recode_never_treated: target must be one of zero/na/inf/max_plus_10 (got '%s')", target),
           call. = FALSE)
    }

    treat_timing_var <- params$treat_timing_var
    if (is.null(treat_timing_var)) {
      stop("recode_never_treated: treat_timing_var is required (read from panel handle's schema).",
           call. = FALSE)
    }

    df <- get_object(panel_id)
    if (!treat_timing_var %in% names(df)) {
      stop(sprintf("recode_never_treated: column '%s' not found in panel %s", treat_timing_var, panel_id),
           call. = FALSE)
    }

    df_new <- recode_never_treated(df, treat_timing_var, target = target,
                                  time_var = params$time_var)
    store_object(handle_id, df_new)

    # Count how many rows were recoded (for the result summary)
    n_never_source <- sum(never_treated_rows(df, treat_timing_var))

    # Build schema — inherit columns from source panel's RPC call params
    schema <- list(
      id_var           = params$id_var,
      time_var         = params$time_var,
      treat_timing_var = treat_timing_var
    )
    if (!is.null(params$treat_var)   && nzchar(params$treat_var))   schema$treat_var   <- params$treat_var
    if (!is.null(params$outcome_var) && nzchar(params$outcome_var)) schema$outcome_var <- params$outcome_var

    list(
      result = list(
        handle         = handle_id,
        source_handle  = panel_id,
        target         = target,
        gname_col      = treat_timing_var,
        n_never_source = n_never_source,
        n_obs          = nrow(df_new)
      ),
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "panel",
          rClass    = "data.frame",
          summary   = sprintf("panel (recoded never-treated in '%s' -> %s): %d obs",
                              treat_timing_var, target, nrow(df_new)),
          sizeBytes = object_size(df_new),
          schema    = schema
        )
      )
    )
  })
}
