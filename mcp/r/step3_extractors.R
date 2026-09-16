# ## Contents
# - [Helper: drop rows with unusable SE](#helper-drop-rows-with-unusable-se)
# - [CS: aggte(mp, type="dynamic")](#cs-aggtemp-typedynamic)
# - [fixest: sunab (SA) or did2s](#fixest-sunab-sa-or-did2s)
# - [BJS: as.data.frame(res) has term/estimate/std.error](#bjs-asdataframeres-has-termestimatestderror)
# - [Roth-Sant'Anna: eventstudy slot](#roth-santanna-eventstudy-slot)
#
# ============================================================================
# did-mcp — Step 3 event-study extractors
# ============================================================================
# S3 dispatch: given a stored estimator R object (MP, fixest,
# did_imputation_result, staggered_combined), return a canonical
# list(betahat, sigma, tVec, sigma_is_diagonal_fallback, fallback_reason)
# that Phase 4 tools (HonestDiD, pretrends) can consume directly.
#
# `sigma_is_diagonal_fallback` is TRUE whenever sigma is diag(se^2) rather
# than the true event-time VCOV. Downstream HonestDiD/pretrends consumers
# MUST treat that as "ignore off-diagonal covariance." `fallback_reason`
# explains WHY the fallback happened:
#   "se_only"                   — estimator never exposes a full VCOV
#   "sunab_beta_vcv_unavailable"— HonestDiD helper absent / dim-mismatched
#   NA                          — sigma is the real VCOV, no fallback
#
# Event times whose SE is missing / infinite / non-positive would otherwise
# put 0 on the sigma diagonal and silently make the matrix singular — Phase
# 4 methods that invert sigma would then hard-fail. We drop those rows from
# betahat/sigma/tVec and surface a warning, so the returned event study is
# smaller but always usable.
# ============================================================================

extract_event_study <- function(obj, ...) UseMethod("extract_event_study")

extract_event_study.default <- function(obj, ...) {
  stop(sprintf("extract_event_study: no method for class '%s'",
               paste(class(obj), collapse = "/")), call. = FALSE)
}

# ## Helper: drop rows with unusable SE
# Returns list(betahat, tVec, se, dropped_tVec). If all rows are dropped, stops
# with a clear error — there is no meaningful event study to surface.

drop_missing_se_rows <- function(tVec, betahat, se, context) {
  bad <- is.na(se) | !is.finite(se) | se <= 0
  if (any(bad)) {
    warning(sprintf(
      "%s: dropping %d event time(s) with missing/non-positive SE: %s",
      context, sum(bad), paste(tVec[bad], collapse = ", ")),
      call. = FALSE)
  }
  keep <- !bad
  if (!any(keep)) {
    stop(sprintf("%s: every event time has missing SE; no usable event study.",
                 context), call. = FALSE)
  }
  list(
    tVec    = tVec[keep],
    betahat = betahat[keep],
    se      = se[keep],
    keep    = keep,
    dropped = tVec[!keep]
  )
}

# ## CS: aggte(mp, type="dynamic")
# Exposes att.egt, se.egt, and egt. V.analytical is present in current `did`
# versions; if absent, we fall back to diag(se^2) and flag accordingly.

extract_event_study.MP <- function(obj, ...) {
  if (!requireNamespace("did", quietly = TRUE)) {
    stop("extract_event_study.MP needs `did`.", call. = FALSE)
  }
  agg <- did::aggte(obj, type = "dynamic")
  tVec    <- as.integer(agg$egt)
  betahat <- as.numeric(agg$att.egt)

  V_full <- agg$V.analytical %||% agg$V_analytical %||% NULL
  use_full <- !is.null(V_full) && is.matrix(V_full) && nrow(V_full) == length(tVec)

  if (use_full) {
    sigma <- as.matrix(V_full)
    is_fallback <- FALSE
    reason <- NA_character_
  } else {
    se <- as.numeric(agg$se.egt)
    cleaned <- drop_missing_se_rows(tVec, betahat, se, "extract_event_study.MP")
    tVec    <- cleaned$tVec
    betahat <- cleaned$betahat
    sigma   <- diag(cleaned$se ^ 2, nrow = length(cleaned$se))
    is_fallback <- TRUE
    reason <- "se_only"
  }

  list(
    betahat = betahat, sigma = sigma, tVec = tVec,
    sigma_is_diagonal_fallback = is_fallback,
    fallback_reason = reason
  )
}

# ## fixest: sunab (SA) or did2s
extract_event_study.fixest <- function(obj, ...) {
  # coef names carry the event time ("year::-4" for sunab, ".did2s_rel::-4"
  # for did2s). The shared helper matches did2s covariance by coefficient
  # names and uses the sunab-specific helper for SA.
  coefs <- stats::coef(obj)
  nms <- names(coefs)
  tVec_all <- parse_event_times(nms)
  keep <- !is.na(tVec_all)
  coefs <- coefs[keep]
  tVec <- tVec_all[keep]

  vcov_info <- extract_sunab_vcov(obj, length(coefs), nms[keep])
  if (isTRUE(vcov_info$is_fallback) &&
      identical(vcov_info$reason, "sunab_beta_vcv_unavailable")) {
    warning(sprintf("extract_event_study.fixest: %s", vcov_info$message),
            call. = FALSE)
  }

  # Screen unusable variances without discarding covariance among kept rows.
  sigma <- vcov_info$V
  betahat <- as.numeric(coefs)
  if (isTRUE(vcov_info$is_fallback) || is_did2s_fixest_model(obj)) {
    se <- suppressWarnings(sqrt(diag(sigma)))
    cleaned <- drop_missing_se_rows(tVec, betahat, se,
                                    "extract_event_study.fixest")
    tVec    <- cleaned$tVec
    betahat <- cleaned$betahat
    sigma   <- sigma[cleaned$keep, cleaned$keep, drop = FALSE]
  }

  list(
    betahat = betahat, sigma = sigma, tVec = tVec,
    sigma_is_diagonal_fallback = isTRUE(vcov_info$is_fallback),
    fallback_reason = vcov_info$reason
  )
}

# ## BJS: as.data.frame(res) has term/estimate/std.error
extract_event_study.did_imputation_result <- function(obj, ...) {
  dfr <- as.data.frame(obj)
  term <- as.character(dfr$term)
  et <- parse_event_times(term)
  ok <- !is.na(et)
  tVec    <- et[ok]
  betahat <- as.numeric(dfr$estimate[ok])
  se      <- as.numeric(dfr$std.error[ok])
  cleaned <- drop_missing_se_rows(tVec, betahat, se,
                                  "extract_event_study.did_imputation_result")

  list(
    betahat = cleaned$betahat,
    sigma   = diag(cleaned$se ^ 2, nrow = length(cleaned$se)),
    tVec    = cleaned$tVec,
    sigma_is_diagonal_fallback = TRUE,
    fallback_reason = "se_only"
  )
}

# ## Roth-Sant'Anna: eventstudy slot
extract_event_study.staggered_combined <- function(obj, ...) {
  es <- obj$eventstudy
  if (is.null(es)) {
    stop("extract_event_study: staggered estimate has no event-study slot",
         call. = FALSE)
  }
  tVec    <- as.integer(es$eventTime)
  betahat <- as.numeric(es$estimate)
  se      <- as.numeric(es$se)
  cleaned <- drop_missing_se_rows(tVec, betahat, se,
                                  "extract_event_study.staggered_combined")

  list(
    betahat = cleaned$betahat,
    sigma   = diag(cleaned$se ^ 2, nrow = length(cleaned$se)),
    tVec    = cleaned$tVec,
    sigma_is_diagonal_fallback = TRUE,
    fallback_reason = "se_only"
  )
}
