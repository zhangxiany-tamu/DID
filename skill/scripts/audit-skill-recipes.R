#!/usr/bin/env Rscript
# ## Contents
# - [Setup](#setup)
# - [Recipe helpers](#recipe-helpers)
# - [Treatment structure](#treatment-structure)
# - [TWFE diagnostics](#twfe-diagnostics)
# - [Estimation](#estimation)
# - [Power analysis](#power-analysis)
# - [Sensitivity analysis](#sensitivity-analysis)
#
# ============================================================================
# did-analysis skill — 5-step fallback recipe audit
# ============================================================================
# Runs the R recipes documented in skill/references/did-step-{1..5}-*.md on
# each of the 6 prepared CSVs listed in the input config, and emits a JSON
# report with per-step results (ATTs, breakdowns, errors).
#
# Usage:
#   Rscript audit-skill-recipes.R <config.json> <output.json>
#
# <config.json> shape:
# {
#   "datasets": [
#     {
#       "name": "medicaid-insurance",
#       "title": "Medicaid Insurance Coverage",
#       "csv": "/tmp/.../medicaid-insurance.csv",
#       "id_var": "state_id",
#       "time_var": "year",
#       "gname_var": "yexp2_clean",    // cohort column; NA/"" == never
#       "treat_post_var": "treat_post", // binary post-treatment indicator
#       "outcome_var": "dins",
#       "control_group": "notyettreated",
#       "weights_var": "W",             // optional
#       "has_never_treated": true
#     }, ...
#   ]
# }

# ## Setup
suppressPackageStartupMessages({
  ok <- TRUE
  for (pkg in c("jsonlite", "did", "fixest", "bacondecomp", "TwoWayFEWeights",
                "didimputation", "did2s", "staggered", "pretrends", "HonestDiD",
                "panelView", "data.table")) {
    if (!requireNamespace(pkg, quietly = TRUE)) {
      message(sprintf("[audit] missing package: %s", pkg))
      ok <- FALSE
    }
  }
})

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) stop("usage: audit-skill-recipes.R <config.json> <output.json>")
config_path <- args[1]
output_path <- args[2]

config <- jsonlite::read_json(config_path, simplifyVector = FALSE)

# Helper: capture warnings + errors from a block.
# ## Recipe helpers
run_block <- function(label, expr) {
  warnings_acc <- character(0)
  withCallingHandlers(
    tryCatch({
      v <- force(expr)
      list(ok = TRUE, value = v, warnings = warnings_acc, error = NULL, label = label)
    }, error = function(e) {
      list(ok = FALSE, value = NULL, warnings = warnings_acc,
           error = conditionMessage(e), label = label)
    }),
    warning = function(w) {
      warnings_acc <<- c(warnings_acc, conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  )
}

# Parse event-time integer out of a sunab coefficient label
# (e.g. "base::factor(sunab_cohorts)-2" -> -2L).
parse_sunab_event_time <- function(nms) {
  # Strip everything up to and including the last ')'.
  raw <- sub(".*\\)", "", nms)
  # Accept leading '=' from old fixest name schemes too.
  raw <- sub("^[=\\s]*", "", raw)
  suppressWarnings(as.integer(raw))
}

# Convert gname column (character) into numeric with never-treated coded per
# estimator's convention.
coerce_g <- function(g_col, code = c("zero", "inf", "na")) {
  code <- match.arg(code)
  g_num <- suppressWarnings(as.numeric(g_col))
  g_num[is.na(g_num) | g_num == 0 | is.infinite(g_num)] <- NA_real_
  if (code == "zero") {
    g_num[is.na(g_num)] <- 0
  } else if (code == "inf") {
    g_num[is.na(g_num)] <- Inf
  }
  # "na" leaves NA as-is.
  g_num
}

# Step 1 recipe — panelView rollout + balance summary.
# ## Treatment structure
step1_recipe <- function(df, ds) {
  cat(sprintf("[%s] step 1...\n", ds$name))
  balanced <- run_block("balance", {
    n_units <- length(unique(df[[ds$id_var]]))
    n_times <- length(unique(df[[ds$time_var]]))
    n_rows  <- nrow(df)
    list(
      n_units = n_units,
      n_times = n_times,
      n_rows  = n_rows,
      balanced = n_rows == n_units * n_times
    )
  })
  cohorts <- run_block("cohorts", {
    g <- coerce_g(df[[ds$gname_var]], "na")
    tbl <- table(g, useNA = "ifany")
    list(
      n_finite = sum(is.finite(g)),
      n_never  = sum(is.na(g)),
      cohorts  = as.list(tbl)
    )
  })
  # panelView rollout. Use tryCatch — some panelView versions throw on
  # too-many cohorts; we report the failure rather than hard-crash.
  pv <- run_block("panelView", {
    fml <- as.formula(sprintf("%s ~ %s", ds$outcome_var, ds$treat_post_var))
    tmp <- tempfile(fileext = ".png")
    png(tmp, width = 9, height = 7, units = "in", res = 150)
    p <- suppressWarnings(panelView::panelview(
      formula = fml,
      data = df,
      index = c(ds$id_var, ds$time_var),
      pre.post = TRUE
    ))
    # panelview returns a ggplot object; render it to the current device.
    if (inherits(p, "gg")) try(print(p), silent = TRUE)
    try(dev.off(), silent = TRUE)
    size <- if (file.exists(tmp)) as.numeric(file.info(tmp)$size) else 0
    list(plot_ok = size > 0, plot_path = tmp, plot_size = size)
  })
  list(balanced = balanced, cohorts = cohorts, panelview = pv)
}

# Step 2 recipe — Bacon + TwoWayFEWeights.
# ## TWFE diagnostics
step2_recipe <- function(df, ds) {
  cat(sprintf("[%s] step 2...\n", ds$name))
  bacon <- run_block("bacon", {
    fml <- as.formula(sprintf("%s ~ %s", ds$outcome_var, ds$treat_post_var))
    res <- bacondecomp::bacon(
      formula = fml,
      data = df,
      id_var = ds$id_var,
      time_var = ds$time_var,
      quietly = TRUE
    )
    as.data.frame(res)
  })
  bacon_summary <- NULL
  if (bacon$ok && is.data.frame(bacon$value) && nrow(bacon$value) > 0) {
    bw <- bacon$value
    bacon_summary <- list(
      weights_sum = sum(bw$weight, na.rm = TRUE),
      forbidden_weight = sum(bw$weight[bw$type == "Later vs Earlier Treated"], na.rm = TRUE),
      type_counts = as.list(table(bw$type))
    )
  }
  weights <- run_block("twowayfeweights", {
    # twowayfeweights needs the treat indicator column as numeric.
    df2 <- data.frame(df, stringsAsFactors = FALSE)
    df2[[ds$treat_post_var]] <- as.numeric(df2[[ds$treat_post_var]])
    df2[[ds$outcome_var]] <- as.numeric(df2[[ds$outcome_var]])
    res <- TwoWayFEWeights::twowayfeweights(
      data = df2,
      Y = ds$outcome_var,
      G = ds$id_var,
      T = ds$time_var,
      D = ds$treat_post_var,
      type = "feTR"
    )
    list(
      n_positive = as.integer(res$nplus %||% NA_integer_),
      n_negative = as.integer(res$nminus %||% NA_integer_),
      sum_positive = as.numeric(res$splus %||% NA_real_),
      sum_negative = as.numeric(res$sminus %||% NA_real_)
    )
  })
  list(bacon = bacon, bacon_summary = bacon_summary, weights = weights)
}

`%||%` <- function(a, b) if (is.null(a)) b else a

# Step 3 recipe — 5 estimators.
# ## Estimation
step3_recipe <- function(df, ds) {
  cat(sprintf("[%s] step 3...\n", ds$name))
  # did::att_gt requires gname with 0 for never-treated.
  cs <- run_block("cs", {
    df_cs <- df
    df_cs[[".gname"]] <- coerce_g(df_cs[[ds$gname_var]], "zero")
    ctrl <- ds$control_group %||% "notyettreated"
    args <- list(
      yname = ds$outcome_var,
      tname = ds$time_var,
      idname = ds$id_var,
      gname = ".gname",
      data = df_cs,
      control_group = ctrl,
      bstrap = FALSE,
      cband = FALSE
    )
    if (!is.null(ds$weights_var) && nchar(ds$weights_var) > 0) {
      df_cs[[ds$weights_var]] <- as.numeric(df_cs[[ds$weights_var]])
      args$weightsname <- ds$weights_var
    }
    cs_out <- do.call(did::att_gt, args)
    agg <- did::aggte(cs_out, type = "dynamic", na.rm = TRUE)
    grp <- did::aggte(cs_out, type = "group", na.rm = TRUE)
    list(
      att_dynamic = as.numeric(agg$overall.att),
      se_dynamic  = as.numeric(agg$overall.se),
      att_group   = as.numeric(grp$overall.att),
      se_group    = as.numeric(grp$overall.se),
      egt         = as.integer(agg$egt),
      att_egt     = as.numeric(agg$att.egt)
    )
  })
  sa <- run_block("sa", {
    df_sa <- df
    df_sa[[".gname_inf"]] <- coerce_g(df_sa[[ds$gname_var]], "inf")
    fml <- as.formula(sprintf("%s ~ sunab(.gname_inf, %s) | %s + %s",
                              ds$outcome_var, ds$time_var,
                              ds$id_var, ds$time_var))
    m <- fixest::feols(fml, data = df_sa, notes = FALSE)
    bv <- HonestDiD:::sunab_beta_vcv(m)
    # bv$beta is an (N x 1) matrix; event-time labels sit in rownames.
    nm <- rownames(bv$beta)
    beta_vec <- as.numeric(bv$beta)
    t_int <- parse_sunab_event_time(nm)
    # Dynamic ATT: average of positive-t beta.
    post <- !is.na(t_int) & t_int >= 0
    att <- if (any(post)) mean(beta_vec[post], na.rm = TRUE) else NA_real_
    list(
      att_dynamic = as.numeric(att),
      beta_names  = nm,
      beta        = beta_vec,
      t_int       = t_int,
      sigma_dim   = dim(bv$sigma)
    )
  })
  bjs <- run_block("bjs", {
    df_bj <- as.data.frame(df)
    df_bj[[".gname_bj"]] <- coerce_g(df_bj[[ds$gname_var]], "zero")
    res <- didimputation::did_imputation(
      data = df_bj,
      yname = ds$outcome_var,
      gname = ".gname_bj",
      tname = ds$time_var,
      idname = ds$id_var
    )
    list(
      att = as.numeric(res$estimate[1]),
      se  = as.numeric(res$std.error[1])
    )
  })
  did2s_res <- run_block("did2s", {
    # did2s expects a binary treat variable and gname (or first_stage formula).
    df_d2 <- df
    df_d2[[ds$treat_post_var]] <- as.numeric(df_d2[[ds$treat_post_var]])
    res <- did2s::did2s(
      data = df_d2,
      yname = ds$outcome_var,
      first_stage = as.formula(sprintf("~ 0 | %s + %s", ds$id_var, ds$time_var)),
      second_stage = as.formula(sprintf("~ i(%s, ref = FALSE)", ds$treat_post_var)),
      treatment = ds$treat_post_var,
      cluster_var = ds$id_var
    )
    list(
      att = as.numeric(res$coefficients[1]),
      se  = as.numeric(sqrt(diag(vcov(res)))[1])
    )
  })
  staggered_res <- run_block("staggered", {
    df_st <- df
    df_st[[".gname_stg"]] <- coerce_g(df_st[[ds$gname_var]], "inf")
    res <- staggered::staggered(
      df = df_st,
      i = ds$id_var,
      t = ds$time_var,
      g = ".gname_stg",
      y = ds$outcome_var,
      estimand = "simple"
    )
    list(
      att = as.numeric(res$estimate[1]),
      se  = as.numeric(res$se[1])
    )
  })
  list(cs = cs, sa = sa, bjs = bjs, did2s = did2s_res, staggered = staggered_res)
}

# Step 4 recipe — pretrends::slope_for_power on SA event study. Per the skill's
# step-4 reference, the preferred path re-fits SA with full VCOV (via
# HonestDiD:::sunab_beta_vcv). We re-fit here to get the real sigma rather
# than rely on JSON round-tripping of matrices.
# ## Power analysis
step4_recipe <- function(df, ds) {
  cat(sprintf("[%s] step 4...\n", ds$name))
  run_block("power", {
    df_sa <- df
    df_sa[[".gname_inf"]] <- coerce_g(df_sa[[ds$gname_var]], "inf")
    fml <- as.formula(sprintf("%s ~ sunab(.gname_inf, %s) | %s + %s",
                              ds$outcome_var, ds$time_var,
                              ds$id_var, ds$time_var))
    m <- fixest::feols(fml, data = df_sa, notes = FALSE)
    bv <- HonestDiD:::sunab_beta_vcv(m)
    t_int <- parse_sunab_event_time(rownames(bv$beta))
    if (any(is.na(t_int))) stop("SA tVec parse failed in step 4")

    slope_50 <- tryCatch(
      pretrends::slope_for_power(
        sigma = bv$sigma,
        targetPower = 0.50,
        tVec = t_int,
        referencePeriod = -1L
      ),
      error = function(e) NA_real_
    )
    slope_80 <- tryCatch(
      pretrends::slope_for_power(
        sigma = bv$sigma,
        targetPower = 0.80,
        tVec = t_int,
        referencePeriod = -1L
      ),
      error = function(e) NA_real_
    )
    list(
      source = "sa-full-vcv",
      slope_50 = as.numeric(slope_50),
      slope_80 = as.numeric(slope_80),
      tVec = t_int
    )
  })
}

# Step 5 recipe — HonestDiD on SA event study (preferred). Requires full
# sigma from SA — re-run sunab_beta_vcv here rather than relying on step3.
# ## Sensitivity analysis
step5_recipe <- function(df, ds) {
  cat(sprintf("[%s] step 5...\n", ds$name))
  run_block("honest", {
    df_sa <- df
    df_sa[[".gname_inf"]] <- coerce_g(df_sa[[ds$gname_var]], "inf")
    fml <- as.formula(sprintf("%s ~ sunab(.gname_inf, %s) | %s + %s",
                              ds$outcome_var, ds$time_var,
                              ds$id_var, ds$time_var))
    m <- fixest::feols(fml, data = df_sa, notes = FALSE)
    bv <- HonestDiD:::sunab_beta_vcv(m)
    beta <- as.numeric(bv$beta)
    sigma <- bv$sigma
    t_int <- parse_sunab_event_time(rownames(bv$beta))
    if (any(is.na(t_int))) stop("SA tVec parse failed in step 5")

    # Drop reference period (-1) and clip to a +/-5 window. HonestDiD's ARP
    # CI computation scales badly with n_pre — a 10-pre window already takes
    # ~70s per Mbar value on medicaid-insurance. Skill recipes recommend
    # slicing the event study before sensitivity.
    ref <- -1L
    keep <- t_int != ref & t_int >= -5 & t_int <= 5
    beta_k  <- beta[keep]
    sigma_k <- sigma[keep, keep, drop = FALSE]
    t_k     <- t_int[keep]
    n_pre   <- sum(t_k < 0)
    n_post  <- sum(t_k >= 0)
    if (n_pre == 0 || n_post == 0) stop(sprintf("need both pre and post periods (have pre=%d, post=%d)", n_pre, n_post))
    cat(sprintf("  step 5: n_pre=%d, n_post=%d, calling HonestDiD...\n", n_pre, n_post)); flush.console()

    robust <- HonestDiD::createSensitivityResults_relativeMagnitudes(
      betahat = beta_k,
      sigma = sigma_k,
      numPrePeriods = n_pre,
      numPostPeriods = n_post,
      Mbarvec = c(0.5, 1, 2)
    )
    original <- HonestDiD::constructOriginalCS(
      betahat = beta_k,
      sigma = sigma_k,
      numPrePeriods = n_pre,
      numPostPeriods = n_post
    )
    # Find breakdown M: smallest Mbar where robust CI covers 0.
    df_rob <- as.data.frame(robust)
    covers <- df_rob$lb <= 0 & df_rob$ub >= 0
    breakdown <- if (any(covers)) min(df_rob$Mbar[covers]) else NA_real_
    list(
      n_pre = n_pre,
      n_post = n_post,
      robust = df_rob,
      original_lb = as.numeric(original$lb),
      original_ub = as.numeric(original$ub),
      breakdown_M = breakdown
    )
  })
}

# Main loop.
results <- list()
for (ds in config$datasets) {
  cat(sprintf("\n### %s ###\n", ds$name))
  if (!file.exists(ds$csv)) {
    results[[ds$name]] <- list(
      name = ds$name,
      error = sprintf("CSV missing: %s", ds$csv)
    )
    next
  }
  df <- data.table::fread(ds$csv, data.table = FALSE, na.strings = c("", "NA"))
  # Coerce numeric columns defensively.
  for (col in c(ds$time_var, ds$outcome_var)) {
    if (col %in% names(df)) df[[col]] <- suppressWarnings(as.numeric(df[[col]]))
  }

  s1 <- tryCatch(step1_recipe(df, ds), error = function(e) list(error = conditionMessage(e)))
  flush.console()
  s2 <- tryCatch(step2_recipe(df, ds), error = function(e) list(error = conditionMessage(e)))
  flush.console()
  s3 <- tryCatch(step3_recipe(df, ds), error = function(e) list(error = conditionMessage(e)))
  flush.console()
  s4 <- tryCatch(step4_recipe(df, ds), error = function(e) list(error = conditionMessage(e)))
  flush.console()
  s5 <- tryCatch(step5_recipe(df, ds), error = function(e) list(error = conditionMessage(e)))
  flush.console()

  results[[ds$name]] <- list(
    name = ds$name,
    title = ds$title,
    csv   = ds$csv,
    step1 = s1,
    step2 = s2,
    step3 = s3,
    step4 = s4,
    step5 = s5
  )
}

jsonlite::write_json(
  list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3Z", tz = "UTC"),
    results = results
  ),
  output_path,
  auto_unbox = TRUE,
  na = "null",
  digits = 10
)
cat(sprintf("\nWrote: %s\n", output_path))
