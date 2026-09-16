# Step 5: Sensitivity Analysis and Inference (HonestDiD + DRDID)

## Contents
- [Coefficient Extraction Cookbook](#coefficient-extraction-cookbook)
  - [From Gardner / did2s](#from-gardner--did2s)
- [HonestDiD: Sensitivity Analysis](#honestdid-sensitivity-analysis)
  - [When the Baseline Effect Is Non-Significant](#when-the-baseline-effect-is-non-significant)
  - [Pre-Period Selection for HonestDiD](#pre-period-selection-for-honestdid)
  - [Uninformative HonestDiD Results](#uninformative-honestdid-results)
- [DRDID: Doubly-Robust DiD with Covariates](#drdid-doubly-robust-did-with-covariates)
- [Full Sensitivity Workflow Template](#full-sensitivity-workflow-template)
  - [SA (fixest) Path](#sa-fixest-path)
  - [CS (did) Path](#cs-did-path)
- [Final Evidence Assessment](#final-evidence-assessment)

Treat this file as the authoritative Step 5 workflow contract; `SKILL.md` should only route here.

## Tool-Aware Path

When `did-mcp` is registered, Step 5 is three tool calls:

| Goal | Tool | Notes |
|---|---|---|
| Pull `{betahat, sigma, tVec}` from any estimate | `did_extract_event_study` | Dispatches on the estimator's R class (MP / fixest / did_imputation_result / staggered_combined). Returns `sigma_is_diagonal_fallback` + `fallback_reason` so you know whether sigma is the true VCOV (SA with HonestDiD present, or did2s matched by coefficient names) or `diag(se^2)` — downstream HonestDiD results are only trustworthy when the matrix is the real thing. |
| Run HonestDiD sensitivity | `did_honest_sensitivity` on an `event_study` handle | Default `method="relative_magnitudes"` with `Mbarvec = seq(0.5, 2, by=0.5)`; switch to `method="smoothness"` + `Mvec` when appropriate. Returns robust CI rows + the original (non-robust) CI + the breakdown M (smallest M at which the robust CI includes zero, or `NA` if the effect is robust to every tested M). |
| Plot the sensitivity | `did_plot` on a `honest_result` handle | Auto-picks the HonestDiD plot kind; shows robust CIs vs. M with the original CI as a grey backdrop. |
| Doubly-robust single-period DiD | `did_drdid` | Takes a panel (two distinct time values or `time_values: [pre, post]` on a longer panel), optional `xformla_vars` + `est_method` ∈ {dr, ipw, reg, trad, imp}. Returns a standard `estimate` handle with the overall ATT. |

**Warnings to surface**: `did_honest_sensitivity` and `did_power_analysis` both emit diagonal-fallback warnings when the input event study's sigma is not a true VCOV. When the sensitivity breakdown M is very small or NA and the source was a diagonal-fallback event study, note that the result may be overly pessimistic or optimistic respectively — the recipes below describe the theoretically-correct construction of sigma for each estimator path.

The rest of this guide — the Coefficient Extraction Cookbook, DRDID recipes, and the SA / CS full-sensitivity templates — is the **code-gen fallback** when the MCP is not registered, and also the authoritative reference for the construction details the tools implement internally.

## Coefficient Extraction Cookbook

Before running HonestDiD or pretrends, you need three objects from your estimator:
- `betahat`: Named numeric vector of event study coefficients
- `sigma`: Variance-covariance matrix of those coefficients
- `tVec`: Numeric vector of relative time periods

### Time Period Parsing Utility

This function extracts relative time periods from coefficient names across different estimator output formats:

```r
extract_time_periods <- function(coef_names) {
  patterns <- c(
    ".*::([+-]?[0-9]+)$",                 # fixest sunab via coef(): "year::3" -> 3
    ".*\\)([+-]?[0-9]+)$",                # HonestDiD:::sunab_beta_vcv rownames:
                                          #   "base::factor(sunab_cohorts)-2" -> -2
    "^([+-]?[0-9]+)$",                    # did: "-2" -> -2
    ".*[Tt]ime[^0-9+-]*([+-]?[0-9]+)$"    # generic: "Time_to_treat-3" -> -3
  )
  for (pat in patterns) {
    m <- regmatches(coef_names, regexec(pat, coef_names))
    if (all(lengths(m) > 1)) {
      tVec <- as.numeric(vapply(m, `[[`, character(1), 2))
      if (!any(is.na(tVec))) return(tVec)
    }
  }
  return(NULL)  # No pattern matched -- caller must handle this
}
```

**Where to get coefficient names for SA.** Both sources work, but they have
different formats:

- `names(coef(sa_model))` — `"year::-2"`, matches pattern 1. Lengths align with
  `coef(sa_model)`, which aggregates over cohorts.
- `rownames(HonestDiD:::sunab_beta_vcv(sa_model)$beta)` —
  `"base::factor(sunab_cohorts)-2"`, matches pattern 2. Lengths align with
  `bv$beta` / `bv$sigma` used downstream for HonestDiD / pretrends.

Important: `bv$beta` is an `(N x 1)` matrix, not a named vector, so
`names(bv$beta)` returns `NULL`. Use `rownames(bv$beta)` or `names(coef(sa_model))`.

### From fixest / Sun-Abraham

```r
# NOTE: sunab() drops rows where gname is NA. Convert never-treated to Inf first.
# df$cohort[is.na(df$cohort)] <- Inf
sa_model <- feols(outcome ~ sunab(cohort, period) | id + period,
                  data = df, cluster = ~id)

# WARNING: coef() and vcov() have mismatched dimensions for sunab models.
# Use sunab_beta_vcv() which returns properly matched beta and sigma.
bv      <- HonestDiD:::sunab_beta_vcv(sa_model)
betahat <- bv$beta
sigma   <- bv$sigma
tVec    <- extract_time_periods(names(coef(sa_model)))
```

### From did / Callaway-Sant'Anna

```r
cs_out <- att_gt(yname = "outcome", tname = "time", idname = "id",
                 gname = "first_treat", data = df,
                 control_group = "notyettreated")
es <- aggte(cs_out, type = "dynamic")

betahat <- es$att.egt
names(betahat) <- es$egt
sigma <- diag(es$se^2)   # Diagonal covariance from standard errors
tVec  <- as.numeric(es$egt)
```

Note: The `did` package returns standard errors, not a full covariance matrix. Using `diag(se^2)` assumes zero covariance between event-study coefficients. For CS, use `es$V.analytical` if available for the full matrix.

### From Gardner / did2s

```r
# gardner_es is the did2s fit from Step 3. Match by names, not matrix position.
beta_all <- coef(gardner_es)
nms <- names(beta_all)
keep <- grepl("^rel_time::", nms)
coef_names <- nms[keep]
tVec <- as.integer(sub("^rel_time::", "", coef_names))
V <- vcov(gardner_es)
stopifnot(length(coef_names) > 0L, all(coef_names %in% rownames(V)),
          all(coef_names %in% colnames(V)))
betahat <- as.numeric(beta_all[keep])
sigma <- V[coef_names, coef_names, drop = FALSE]
valid <- is.finite(betahat) & is.finite(diag(sigma)) & diag(sigma) > 0
betahat <- betahat[valid]
tVec <- tVec[valid]
sigma <- sigma[valid, valid, drop = FALSE]
stopifnot(all(is.finite(sigma)))
```

Use the actual relative-time variable's coefficient prefix if it differs from
`rel_time`. The MCP wrapper uses `.did2s_rel`. Preserve the off-diagonal entries.

### From didimputation / BJS

`did_imputation()` returns a `data.table`, not a fixest object. Extract coefficients from the columns:

```r
bjs_model <- did_imputation(data = dt, yname = "outcome",
                            gname = "first_treat", tname = "year",
                            idname = "unit_id", horizon = TRUE)

# did_imputation() returns a data.table, not a fixest object.
betahat <- bjs_model$estimate
names(betahat) <- bjs_model$term
sigma   <- diag(bjs_model$std.error^2)  # Diagonal approximation
tVec    <- extract_time_periods(bjs_model$term)
```

### Period Structure Validation

Before passing coefficients to HonestDiD, validate the period structure:

```r
validate_periods <- function(tVec) {
  base_index <- which(tVec == -1)

  if (length(base_index) == 1) {
    # Base period present (e.g., CS output) — will be excluded for HonestDiD
    pre_indices  <- which(tVec < -1)
    post_indices <- which(tVec >= 0)
  } else if (length(base_index) == 0) {
    # Base period already excluded (e.g., SA via sunab_beta_vcv)
    pre_indices  <- which(tVec < 0)
    post_indices <- which(tVec >= 0)
  } else {
    stop("Multiple periods with tVec == -1 found")
  }

  if (length(pre_indices) == 0)
    stop("At least one pre-treatment period required")
  if (length(post_indices) == 0)
    stop("At least one post-treatment period (t >= 0) required")

  list(pre = pre_indices, post = post_indices, base = base_index)
}
```

### Subsetting for HonestDiD

HonestDiD expects coefficients with the base period (t = -1) **excluded**. Subset betahat and sigma to pre + post indices only:

```r
ps <- validate_periods(tVec)
keep <- c(ps$pre, ps$post)

betahat_sub <- betahat[keep]
sigma_sub   <- sigma[keep, keep]

numPrePeriods  <- length(ps$pre)
numPostPeriods <- length(ps$post)
```

---

## HonestDiD: Sensitivity Analysis

### Installation

```r
install.packages("HonestDiD")  # now on CRAN
```

### Core Functions

**`createSensitivityResults_relativeMagnitudes(betahat, sigma, numPrePeriods, numPostPeriods, Mbarvec, ...)`**

Constructs robust confidence intervals under the assumption that post-treatment trend violations are bounded by M times the maximum pre-treatment violation.

Parameters:
- `betahat`: Coefficient vector (pre + post periods, **excluding** base period)
- `sigma`: Corresponding covariance matrix
- `numPrePeriods`: Number of pre-treatment periods in betahat
- `numPostPeriods`: Number of post-treatment periods in betahat
- `Mbarvec`: Vector of M values to test (e.g., `seq(0.5, 2, by = 0.5)`)
- `l_vec`: Weights on post-treatment periods (default: equal weights)

> **Performance warning (real-world rule of thumb)**: The ARP CI computation
> inside `createSensitivityResults_relativeMagnitudes` scales poorly with
> `numPrePeriods` and is roughly linear in `length(Mbarvec)`. On a 10-pre,
> 6-post event study a single Mbar value can take ~70s; 4 Mbar values = ~4–5
> minutes. **Slice the event study to a reasonable window** (e.g. pre/post in
> `[-5, 5]`) before calling. Subset `beta`, `sigma`, and `tVec` consistently:
> ```r
> keep <- tVec >= -5 & tVec <= 5 & tVec != -1   # also drop reference period
> betahat_k <- betahat[keep]
> sigma_k   <- sigma[keep, keep, drop = FALSE]
> tVec_k    <- tVec[keep]
> n_pre     <- sum(tVec_k < 0)
> n_post    <- sum(tVec_k >= 0)
> ```
> This mirrors the MCP's `did_honest_sensitivity` default behavior and keeps
> runtime under ~30s per dataset.

**`createSensitivityResults(betahat, sigma, numPrePeriods, numPostPeriods, method, Mvec)`**

Alternative using smoothness restrictions on trend violations.
- `method`: `"FLCI"` (fixed-length CIs) or `"conditional"`
- `Mvec`: Smoothness parameter values

**`constructOriginalCS(betahat, sigma, numPrePeriods, numPostPeriods)`**

Constructs the original (non-robust) confidence set for comparison.

### Complete Example

```r
library(HonestDiD)
library(fixest)

# Step 1: Estimate event study
# NOTE: sunab() drops rows where gname is NA. Convert never-treated to Inf first.
# df$cohort[is.na(df$cohort)] <- Inf
sa_model <- feols(outcome ~ sunab(cohort, period) | id + period,
                  data = df, cluster = ~id)
bv      <- HonestDiD:::sunab_beta_vcv(sa_model)
betahat <- bv$beta
sigma   <- bv$sigma
tVec    <- extract_time_periods(names(coef(sa_model)))

# Step 2: Validate and subset
ps <- validate_periods(tVec)
keep <- c(ps$pre, ps$post)
beta_sub  <- betahat[keep]
sigma_sub <- sigma[keep, keep]

# Step 3: Relative magnitudes sensitivity analysis
honest_rm <- createSensitivityResults_relativeMagnitudes(
  betahat = beta_sub,
  sigma = sigma_sub,
  numPrePeriods = length(ps$pre),
  numPostPeriods = length(ps$post),
  Mbarvec = seq(0.5, 2, by = 0.5))

print(honest_rm)

# Step 4: Construct original CI for comparison
original_ci <- constructOriginalCS(
  betahat = beta_sub,
  sigma = sigma_sub,
  numPrePeriods = length(ps$pre),
  numPostPeriods = length(ps$post))

# Step 5: Sensitivity plot (robust first, original second)
createSensitivityPlot_relativeMagnitudes(
  robustResults = honest_rm,
  originalResults = original_ci)
```

### Finding the Breakdown M

The breakdown M is the smallest value where the robust CI includes zero (effect becomes insignificant):

```r
find_breakdown_M <- function(honest_results) {
  # Check if results include zero for each M
  for (i in seq_len(nrow(honest_results))) {
    lb <- honest_results$lb[i]
    ub <- honest_results$ub[i]
    if (lb <= 0 && ub >= 0) {
      return(honest_results$Mbar[i])
    }
  }
  return(NULL)  # Effect robust to all tested M values
}

breakdown <- find_breakdown_M(honest_rm)
```

### Breakdown M Interpretation

| Breakdown M | Evidence Strength | Interpretation |
|-------------|-------------------|----------------|
| NULL (none) | **Strong** | Effect remains significant for all tested M values. Robust to substantial parallel trends violations. |
| < 1 | **Weak** | Effect fragile. Even if post-treatment violations are *smaller* than pre-treatment, the effect could be spurious. |
| 1 - 1.5 | **Moderate** | Effect robust if post-treatment violations are similar in magnitude to pre-treatment violations. |
| > 1.5 | **Fairly robust** | Post-treatment violations would need to be substantially *larger* than pre-treatment violations to invalidate the finding. |

**Recommendations based on breakdown M:**
- NULL or > 2: Results appear robust to parallel trends violations
- 1 to 2: Moderate robustness; report sensitivity analysis prominently
- < 1: Results are fragile; interpret with substantial caution

### When the Baseline Effect Is Non-Significant

If the original CI already covers zero (e.g., [-0.085, 0.138]), the effect is not significant even under exact parallel trends. In this case:

- **Breakdown M is trivially small**: The smallest tested M value will be the breakdown, since even zero violation already includes zero.
- **HonestDiD cannot rescue an already-insignificant finding**: Sensitivity analysis widens the CI; if it already covers zero, all robust CIs will too.
- **What to report**: State the original CI and note that sensitivity analysis confirms the null result is robust. Focus on effect size interpretation and statistical power (Step 4) — is the non-significance due to a true null or insufficient power?
- **Power matters most here**: If detectable slope at 50% power is large relative to the treatment effect, the pre-test is uninformative and the null finding may reflect low power rather than no effect.

**Auto-Detection for Insignificant Baseline:**

```r
detect_insignificant_baseline <- function(betahat_sub, sigma_sub, numPrePeriods, numPostPeriods) {
  # Construct original CI
  original <- constructOriginalCS(
    betahat = betahat_sub, sigma = sigma_sub,
    numPrePeriods = numPrePeriods, numPostPeriods = numPostPeriods)

  covers_zero <- original$lb <= 0 & original$ub >= 0

  if (covers_zero) {
    cat("BASELINE EFFECT IS NON-SIGNIFICANT.\n")
    cat(sprintf("  Original CI: [%.4f, %.4f] — covers zero.\n", original$lb, original$ub))
    cat("  Breakdown M is trivially achieved (smallest M = breakdown).\n")
    cat("  HonestDiD cannot rescue an already-insignificant finding.\n")
    cat("  Focus on: (1) effect size interpretation, (2) power analysis (Step 4),\n")
    cat("  (3) whether non-significance reflects a true null or insufficient power.\n")
  }
  invisible(list(covers_zero = covers_zero, original_ci = original))
}
```

### Pre-Period Selection for HonestDiD

HonestDiD's relative magnitudes approach uses the **maximum pre-treatment violation** as the baseline for bounding post-treatment violations. When compositionally thin event times (see "Compositional Effects in CS Dynamic Aggregation" in `did-step-3-estimation.md`) produce large noisy pre-treatment coefficients, this inflates the baseline and makes the sensitivity analysis overly conservative.

**Symptom**: Breakdown M is low with all pre-periods but substantially higher when restricted to near pre-periods. Example: M = 1.0 (all) vs M = 1.5 (near only) — a 50% shift in robustness assessment.

**Run sensitivity with both full and restricted pre-periods:**

```r
library(HonestDiD)

# --- Full pre-period sensitivity ---
ps_full <- validate_periods(tVec)
keep_full <- c(ps_full$pre, ps_full$post)

honest_full <- createSensitivityResults_relativeMagnitudes(
  betahat = betahat[keep_full], sigma = sigma[keep_full, keep_full],
  numPrePeriods = length(ps_full$pre),
  numPostPeriods = length(ps_full$post),
  Mbarvec = seq(0.5, 2, by = 0.5))
breakdown_full <- find_breakdown_M(honest_full)

# --- Near pre-period sensitivity ---
near_pre <- which(tVec >= -5 & tVec < -1)   # adjust -5 based on data
post_idx <- which(tVec >= 0)
keep_near <- c(near_pre, post_idx)

honest_near <- createSensitivityResults_relativeMagnitudes(
  betahat = betahat[keep_near], sigma = sigma[keep_near, keep_near],
  numPrePeriods = length(near_pre),
  numPostPeriods = length(post_idx),
  Mbarvec = seq(0.5, 2, by = 0.5))
breakdown_near <- find_breakdown_M(honest_near)

# --- Compare ---
cat(sprintf("Breakdown M (all pre-periods):  %s\n",
            if (is.null(breakdown_full)) "None" else sprintf("%.2f", breakdown_full)))
cat(sprintf("Breakdown M (near pre-periods): %s\n",
            if (is.null(breakdown_near)) "None" else sprintf("%.2f", breakdown_near)))
```

**Reporting guidance:**
- **Always report both** breakdown M values when they differ
- Explain the source: "Long-lead pre-treatment coefficients are driven by compositional changes (only late-adopting cohorts contribute at extreme event times)"
- The **near-period analysis is usually more informative** because it uses pre-periods where the composition of contributing cohorts is stable and representative
- If both breakdown M values are low (< 1), the result is fragile regardless of window choice
- For "open endpoint" warnings in HonestDiD output, see `did-troubleshooting.md` Section 5

### Uninformative HonestDiD Results

Sometimes HonestDiD produces results that are effectively uninformative — typically when confidence intervals "explode" (become extremely wide) even at low M values.

**Symptoms:**
- Robust CIs span from large negative to large positive values (e.g., [-50, 80]) at M = 0.5
- Breakdown M is very low (< 0.5) despite seemingly clean pre-trends
- CI width increases dramatically between M = 0.5 and M = 1.0

**Causes:**
1. **Noisy pre-periods**: Large pre-treatment coefficient magnitudes set a high baseline violation, and even small M multiples produce wide CIs
2. **Underpowered analysis**: When the outcome is noisy relative to the effect size, both the original and robust CIs are wide
3. **Compositionally thin pre-periods**: Long-lead estimates dominated by 1-2 cohorts inflate the baseline (see "Compositional Effects" in Step 3)

**What to do:**
1. **Restrict pre-periods**: Use only near pre-periods (e.g., t = -5 to -2) where composition is stable. Compare breakdown M with full vs. restricted pre-periods.
2. **Check baseline significance**: Use `detect_insignificant_baseline()` above. If the original CI already covers zero, HonestDiD cannot help.
3. **Check power context**: Use `assess_power_context()` (Step 4). If bias/|ATT| > 100%, the analysis is fundamentally underpowered.
4. **Report honestly**: State that sensitivity analysis is uninformative and explain why. Use `final_evidence_assessment()` below for a structured verdict.

---


## DRDID: Doubly-Robust DiD with Covariates

> **Prerequisites**: Before using DRDID with covariates, complete the
> selection assessment and overlap checks in `references/did-step-3-estimation.md`
> (Section "Iterative Parallel Trends Workflow", Steps A-C).

### Installation

```r
install.packages("DRDID")  # now on CRAN
```

### When to Use

Use DRDID when:
- Unconditional parallel trends is implausible but conditional parallel trends (after controlling for covariates) is more credible
- You have a 2x2 DiD setup (2 periods, 2 groups) with covariates
- You want double robustness: consistent if either the outcome model OR the propensity score model is correct
- You have assessed selection mechanisms and checked covariate overlap (Step 3)

### Core Functions

**`drdid(yname, tname, idname, dname, xformla, data, panel, ...)`**
- `dname`: Treatment group indicator (string)
- `xformla`: Covariate formula (e.g., `~ age + educ + black`)
- `panel`: TRUE for panel data, FALSE for repeated cross-sections
- `boot`: Bootstrap inference (logical)
- `nboot`: Bootstrap replications

**`ipwdid()`** -- Inverse probability weighting DiD
**`ordid()`** -- Outcome regression DiD

### Complete Example

```r
library(DRDID)

data(nsw_long)

# Panel data: Doubly-robust estimator
dr_panel <- drdid(
  yname = "re", tname = "year", idname = "id",
  dname = "experimental",
  xformla = ~ age + educ + black + married + nodegree + hisp + re74,
  data = nsw_long, panel = TRUE, boot = TRUE, nboot = 999)
summary(dr_panel)

# Repeated cross-section
rcs_data <- nsw_long
rcs_data$id <- NULL
dr_rcs <- drdid(
  yname = "re", tname = "year", dname = "experimental",
  xformla = ~ age + educ + black + married + nodegree + hisp + re74,
  data = rcs_data, panel = FALSE, boot = TRUE, nboot = 999)
summary(dr_rcs)
```

### Extracting Results for Downstream Use

```r
# Extract ATT and SE from DRDID output
att <- dr_panel$ATT   # or dr_panel$att depending on version
se  <- dr_panel$se

# Calculate confidence interval
ci <- att + c(-1, 1) * 1.96 * se

# p-value
z <- att / se
p_value <- 2 * (1 - pnorm(abs(z)))

cat(sprintf("ATT: %.3f (SE: %.3f)\n", att, se))
cat(sprintf("95%% CI: [%.3f, %.3f]\n", ci[1], ci[2]))
cat(sprintf("p-value: %.4f\n", p_value))
```

### Comparing Estimators

```r
# Compare DR, IPW, and OR estimators
dr  <- drdid(yname = "re", tname = "year", idname = "id",
             dname = "experimental",
             xformla = ~ age + educ + black + married + nodegree,
             data = nsw_long, panel = TRUE)

ipw <- ipwdid(yname = "re", tname = "year", idname = "id",
              dname = "experimental",
              xformla = ~ age + educ + black + married + nodegree,
              data = nsw_long, panel = TRUE)

orr <- ordid(yname = "re", tname = "year", idname = "id",
             dname = "experimental",
             xformla = ~ age + educ + black + married + nodegree,
             data = nsw_long, panel = TRUE)

cat(sprintf("Doubly Robust ATT:        %.1f\n", dr$ATT))
cat(sprintf("IPW ATT:                  %.1f\n", ipw$ATT))
cat(sprintf("Outcome Regression ATT:   %.1f\n", orr$ATT))
```

---

## Full Sensitivity Workflow Template

Two complete templates are provided: one for the SA (fixest) path and one for the CS (did) path.

### SA (fixest) Path

Putting it all together -- from estimation through sensitivity analysis:

```r
library(fixest)
library(pretrends)
library(HonestDiD)

# === 1. Estimate robust event study ===
# NOTE: sunab() drops rows where gname is NA. Convert never-treated to Inf first.
# df$cohort[is.na(df$cohort)] <- Inf
sa_model <- feols(outcome ~ sunab(cohort, period) | id + period,
                  data = df, cluster = ~id)
bv      <- HonestDiD:::sunab_beta_vcv(sa_model)
betahat <- bv$beta
sigma   <- bv$sigma
tVec    <- extract_time_periods(names(coef(sa_model)))

# === 2. Power analysis ===
slope_50 <- slope_for_power(sigma = sigma, targetPower = 0.50,
                            tVec = tVec, referencePeriod = -1)
slope_80 <- slope_for_power(sigma = sigma, targetPower = 0.80,
                            tVec = tVec, referencePeriod = -1)
cat(sprintf("Detectable slope at 50%% power: %.4f\n", slope_50))
cat(sprintf("Detectable slope at 80%% power: %.4f\n", slope_80))

# === 3. HonestDiD sensitivity ===
ps <- validate_periods(tVec)
keep <- c(ps$pre, ps$post)

honest_rm <- createSensitivityResults_relativeMagnitudes(
  betahat = betahat[keep], sigma = sigma[keep, keep],
  numPrePeriods = length(ps$pre),
  numPostPeriods = length(ps$post),
  Mbarvec = seq(0.5, 2, by = 0.5))

breakdown <- find_breakdown_M(honest_rm)

# === 4. Report ===
if (is.null(breakdown)) {
  cat("Strong evidence: effect robust to all tested M values.\n")
} else if (breakdown < 1) {
  cat(sprintf("Weak evidence: breakdown at M = %.2f.\n", breakdown))
} else if (breakdown <= 1.5) {
  cat(sprintf("Moderate evidence: breakdown at M = %.2f.\n", breakdown))
} else {
  cat(sprintf("Fairly robust: breakdown at M = %.2f.\n", breakdown))
}
```

### CS (did) Path

Complete workflow using Callaway-Sant'Anna, which handles small cohorts more gracefully and is often the best choice when SA is unstable.

```r
library(did)
library(pretrends)
library(HonestDiD)

# === 1. Estimate robust event study ===
cs_out <- att_gt(yname = "outcome", tname = "time", idname = "unit_id",
                 gname = "first_treat", data = df,
                 control_group = "notyettreated", est_method = "dr")
cs_es <- aggte(cs_out, type = "dynamic", min_e = -10, max_e = 15)

# === 2. Extract coefficients (filter invalid periods) ===
valid <- !is.na(cs_es$se) & cs_es$se > 0
betahat <- cs_es$att.egt[valid]
names(betahat) <- cs_es$egt[valid]
tVec <- as.numeric(cs_es$egt[valid])
sigma <- diag(cs_es$se[valid]^2)  # diagonal approximation

# === 3. Power analysis ===
slope_50 <- slope_for_power(sigma = sigma, targetPower = 0.50,
                            tVec = tVec, referencePeriod = -1)
cat(sprintf("Detectable slope at 50%% power: %.4f\n", slope_50))

# === 4. HonestDiD sensitivity ===
ps <- validate_periods(tVec)
keep <- c(ps$pre, ps$post)

honest_rm <- createSensitivityResults_relativeMagnitudes(
  betahat = betahat[keep], sigma = sigma[keep, keep],
  numPrePeriods = length(ps$pre),
  numPostPeriods = length(ps$post),
  Mbarvec = seq(0.5, 2, by = 0.5))

original_ci <- constructOriginalCS(
  betahat = betahat[keep], sigma = sigma[keep, keep],
  numPrePeriods = length(ps$pre),
  numPostPeriods = length(ps$post))

# === 5. Sensitivity plot ===
createSensitivityPlot_relativeMagnitudes(
  robustResults = honest_rm,
  originalResults = original_ci)

# === 6. Report ===
breakdown <- find_breakdown_M(honest_rm)
overall_att <- aggte(cs_out, type = "simple")
cat(sprintf("Overall ATT: %.4f (SE: %.4f)\n",
            overall_att$overall.att, overall_att$overall.se))
cat(sprintf("Breakdown M: %s\n",
            if (is.null(breakdown)) "None (robust to all tested M)"
            else sprintf("%.2f", breakdown)))
```

---

## Final Evidence Assessment

After completing Steps 3-5, synthesize the evidence into a structured verdict. This function integrates ATT significance, power context, pre-test results, breakdown M, and estimator agreement:

```r
final_evidence_assessment <- function(att, att_se, bias_ratio, pretest_pval,
                                       breakdown_m, estimators_agree) {
  cat("========================================\n")
  cat("  FINAL EVIDENCE ASSESSMENT\n")
  cat("========================================\n\n")

  att_sig <- abs(att / att_se) > 1.96
  powered <- bias_ratio < 1.0
  pretest_pass <- is.na(pretest_pval) || pretest_pval > 0.05
  robust <- is.null(breakdown_m) || breakdown_m >= 1.0

  cat(sprintf("ATT: %.4f (SE: %.4f) — %s\n", att, att_se,
              ifelse(att_sig, "SIGNIFICANT", "NOT SIGNIFICANT")))
  cat(sprintf("Bias/|ATT|: %.1f%% — %s\n", 100 * bias_ratio,
              ifelse(powered, "POWERED", "UNDERPOWERED")))
  cat(sprintf("Pre-test p-value: %s — %s\n",
              ifelse(is.na(pretest_pval), "N/A", sprintf("%.4f", pretest_pval)),
              ifelse(pretest_pass, "PASS", "FAIL")))
  breakdown_str <- if (is.null(breakdown_m)) "None" else sprintf("%.2f", breakdown_m)
  cat(sprintf("Breakdown M: %s — %s\n", breakdown_str,
              ifelse(robust, "ROBUST", "FRAGILE")))
  cat(sprintf("Estimator agreement: %s\n\n", ifelse(estimators_agree, "YES", "NO")))

  # Determine verdict
  if (att_sig && pretest_pass && robust && estimators_agree) {
    verdict <- "STRONG EVIDENCE"
    detail <- "Significant effect, pre-test passes, robust to sensitivity analysis, estimators agree."
  } else if (att_sig && pretest_pass && robust && !estimators_agree) {
    verdict <- "MIXED"
    detail <- "Significant and robust, but estimators disagree. Investigate sources of disagreement."
  } else if (att_sig && (!pretest_pass || !robust)) {
    verdict <- "FRAGILE"
    detail <- "Significant effect, but fragile to parallel trends violations or pre-test fails."
  } else if (att_sig && pretest_pass && !powered) {
    verdict <- "SUGGESTIVE"
    detail <- "Significant effect, but pre-test is uninformative (low power). Cannot rule out large violations."
  } else if (!att_sig && powered && pretest_pass) {
    verdict <- "EVIDENCE OF NULL"
    detail <- "No significant effect despite adequate power. Consistent with no treatment effect."
  } else if (!att_sig && !powered) {
    verdict <- "UNINFORMATIVE"
    detail <- "No significant effect, but analysis lacks power. Cannot distinguish null from small effect."
  } else {
    verdict <- "INCONCLUSIVE"
    detail <- "Mixed signals across diagnostics. Report all results and let readers assess."
  }

  cat(sprintf("VERDICT: %s\n", verdict))
  cat(sprintf("  %s\n", detail))

  invisible(list(verdict = verdict, detail = detail,
                 att_sig = att_sig, powered = powered,
                 pretest_pass = pretest_pass, robust = robust))
}
```

**Verdict Interpretation:**

| Verdict | Meaning | Recommended Action |
|---------|---------|-------------------|
| STRONG EVIDENCE | All diagnostics support the finding | Report confidently with sensitivity analysis |
| SUGGESTIVE | Effect found but power is low | Report with prominent caveats about power |
| EVIDENCE OF NULL | Adequate power, no effect | Report as a well-powered null result |
| UNINFORMATIVE | Low power, no effect | State that the data cannot distinguish null from small effects |
| FRAGILE | Effect found but sensitive to violations | Report with strong caveats; discuss identification |
| MIXED | Estimators disagree or other mixed signals | Report all results; discuss sources of disagreement |

**Usage example:**
```r
# After completing Steps 3-5:
final_evidence_assessment(
  att = overall_att$overall.att,
  att_se = overall_att$overall.se,
  bias_ratio = power_context$bias_ratio,
  pretest_pval = ftest_result$p_value,
  breakdown_m = breakdown,
  estimators_agree = (comparison_cv < 0.2)
)
```
