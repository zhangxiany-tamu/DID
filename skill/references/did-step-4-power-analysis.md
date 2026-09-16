# Step 4: Power Analysis for Pre-Trends (pretrends)

## Contents
- [pretrends: Power Analysis for Pre-Trend Tests](#pretrends-power-analysis-for-pre-trend-tests)
  - [Power Analysis with Callaway-Sant'Anna (CS) Estimates](#power-analysis-with-callaway-santanna-cs-estimates)
  - [Handling Singular Covariance Matrix from CS](#handling-singular-covariance-matrix-from-cs)
  - [Contextualizing the Detectable Slope](#contextualizing-the-detectable-slope)
  - [Pre-Period Window Selection](#pre-period-window-selection)
  - [Fundamentally Underpowered Analysis](#fundamentally-underpowered-analysis)

This step focuses on statistical power for pre-trend testing. Treat this file as the authoritative Step 4 workflow contract; `SKILL.md` should only route here. For coefficient extraction patterns and period validation helpers, see `did-step-5-sensitivity-inference.md`.

## Tool-Aware Path

When `did-mcp` is registered, call `did_power_analysis` on an `event_study` handle (produced by `did_extract_event_study`) instead of running `pretrends::slope_for_power` manually.

- **Tool**: `did_power_analysis`
- **Inputs**: `event_study_id` (required), `target_powers` (default `[0.5, 0.8]`), `reference_period` (default `-1`), optional `deltatrue` (hypothesized linear trend vector) — if supplied, the tool also runs `pretrends::pretrends()` and returns the `df_power` table.
- **Output**: `power_result_N` handle + `detectable_slopes` array with one entry per target power, plus the optional `pretrends` payload.
- **Diagonal-fallback warning**: if the input event study has `sigma_is_diagonal_fallback=true` (inspect the returned flag; SA and did2s normally preserve full covariance), the tool emits a warning in the `warnings` array — off-diagonal covariance is being ignored and power may be over- or understated. Report that caveat to the user.

**Common route**: `did_estimate` → `did_extract_event_study` → `did_power_analysis`. Plumb the `event_study_1` handle in, not a raw estimate.

The `pretrends` recipes and diagnostics below are the **code-gen fallback** when the MCP is not registered.

## pretrends: Power Analysis for Pre-Trend Tests

### Installation

```r
# install.packages("devtools")
devtools::install_github("jonathandroth/pretrends")
```

### Coefficient Time Parsing Helper

Use this utility if your coefficient names come from `fixest::sunab()` output:

```r
extract_time_periods <- function(coef_names) {
  m <- regmatches(coef_names, regexec(".*::([+-]?[0-9]+)$", coef_names))
  if (all(lengths(m) > 1)) {
    tVec <- as.numeric(vapply(m, `[[`, character(1), 2))
    if (!any(is.na(tVec))) return(tVec)
  }
  stop("Could not parse relative-time periods from coefficient names.")
}
```

### Core Functions

**`slope_for_power(sigma, targetPower, tVec, referencePeriod, alpha)`**

Finds the slope of a linear trend that would be detected with the specified power.

- `sigma`: Covariance matrix of event study estimates
- `targetPower`: Target power level (e.g., 0.5 or 0.8)
- `tVec`: Vector of relative time periods
- `referencePeriod`: Reference (omitted) period, typically -1
- `alpha`: Significance level (default: 0.05)

**`pretrends(betahat, sigma, tVec, referencePeriod, deltatrue)`**

Full power analysis for a hypothesized trend violation.

- `betahat`: Event study coefficients
- `deltatrue`: Hypothesized trend violation vector

### Complete Example

```r
library(fixest)
library(pretrends)
library(HonestDiD)

# Extract from robust estimator
# NOTE: sunab() drops rows where gname is NA. Convert never-treated to Inf first.
# df$cohort[is.na(df$cohort)] <- Inf
sa_model <- feols(outcome ~ sunab(cohort, period) | id + period,
                  data = df, cluster = ~id)
# WARNING: coef() and vcov() have mismatched dimensions for sunab models.
# Use sunab_beta_vcv() which returns properly matched beta and sigma.
bv    <- HonestDiD:::sunab_beta_vcv(sa_model)
beta  <- bv$beta
sigma <- bv$sigma
tVec  <- extract_time_periods(names(coef(sa_model)))

# What linear trend slope would we detect with 50% power?
slope_50 <- slope_for_power(
  sigma = sigma, targetPower = 0.50,
  tVec = tVec, referencePeriod = -1)

# What about 80% power?
slope_80 <- slope_for_power(
  sigma = sigma, targetPower = 0.80,
  tVec = tVec, referencePeriod = -1)

cat(sprintf("Slope detectable at 50%% power: %.4f\n", slope_50))
cat(sprintf("Slope detectable at 80%% power: %.4f\n", slope_80))

# Full power analysis for the 50%-power slope
delta_hyp <- slope_50 * tVec
pt_results <- pretrends(
  betahat = beta, sigma = sigma,
  deltatrue = delta_hyp, tVec = tVec)

# View power diagnostics
print(pt_results$df_power)

# Visualization
print(pt_results$event_plot)
```

### Power Analysis with Callaway-Sant'Anna (CS) Estimates

CS returns standard errors but not a full covariance matrix. Extract coefficients from the `aggte()` event study object:

```r
library(did)
library(pretrends)

data(mpdta)

# Step 1: Estimate group-time ATTs and aggregate to event study
cs_out <- att_gt(yname = "lemp", tname = "year", idname = "countyreal",
                 gname = "first.treat", data = mpdta,
                 control_group = "notyettreated")
cs_es <- aggte(cs_out, type = "dynamic")

# Step 2: Extract coefficients and build diagonal covariance
betahat <- cs_es$att.egt
names(betahat) <- cs_es$egt
tVec <- as.numeric(cs_es$egt)

# Filter out periods with invalid/zero SEs (from failed cohort-time cells)
valid <- !is.na(cs_es$se) & cs_es$se > 0
betahat <- betahat[valid]
tVec <- tVec[valid]
sigma <- diag(cs_es$se[valid]^2)

# Step 3: Power analysis
slope_50 <- slope_for_power(sigma = sigma, targetPower = 0.50,
                            tVec = tVec, referencePeriod = -1)
cat(sprintf("Detectable slope at 50%% power: %.4f\n", slope_50))

delta_hyp <- slope_50 * tVec
pt_results <- pretrends(betahat = betahat, sigma = sigma,
                        deltatrue = delta_hyp, tVec = tVec)
print(pt_results$event_plot)
```

> **Diagonal covariance limitation**: `diag(se^2)` assumes zero cross-period correlation. This is an approximation — actual coefficient correlations may cause power to be over- or understated. For analyses where precise power calculations are critical, use SA (which provides a full VCOV via `HonestDiD:::sunab_beta_vcv()`) or did2s with its covariance matched to event-study coefficient names. A CS diagonal approximation remains a limitation, not a guaranteed conservative bound.

### Handling Singular Covariance Matrix from CS

If CS reports `"Not returning pre-test Wald statistic due to singular covariance matrix"`, some cohort-time cells produced zero or NA standard errors. This makes `diag(se^2)` singular.

**Fix**: Filter to valid periods before constructing the covariance matrix:
```r
valid <- !is.na(cs_es$se) & cs_es$se > 0
betahat <- cs_es$att.egt[valid]
tVec <- as.numeric(cs_es$egt[valid])
sigma <- diag(cs_es$se[valid]^2)

# Verify sigma is invertible
if (any(diag(sigma) == 0)) stop("Sigma still has zero diagonal entries")
```

**Common cause**: Singleton cohorts (one unit in a treatment timing group) produce zero SEs for some event-time cells. If many periods are dropped, consider merging small cohorts before estimation.

### Interpreting Power Results

| Power Level | Interpretation |
|-------------|---------------|
| > 80% | Good: likely to detect meaningful pre-trends if they exist |
| 50-80% | Moderate: some ability to detect, but not highly reassuring |
| < 50% | Low: "no significant pre-trend" is not very informative |

**Key question**: Is the detectable slope economically meaningful relative to the treatment effect? If the smallest detectable trend would produce a bias comparable to the estimated effect, the pre-trend test has limited value.

### Contextualizing the Detectable Slope

Absolute slope thresholds (e.g., "0.05 is large") are **scale-dependent** and meaningless without context. A slope of 0.05 is tiny for mortality counts per 100K but large for mortality proportions. Instead, express the detectable violation as a fraction of the treatment effect:

```r
assess_power_context <- function(slope_50, tVec, att_estimate) {
  # Bias at treatment onset (t=0): slope × number of pre-periods
  # This measures the total pre-treatment trend deviation at the longest lead
  pre_periods <- tVec[tVec < 0]
  cumulative_bias <- abs(slope_50 * length(pre_periods))
  bias_ratio <- cumulative_bias / abs(att_estimate)

  quality <- {
    if (bias_ratio < 0.05) "EXCELLENT"
    else if (bias_ratio < 0.25) "GOOD"
    else if (bias_ratio < 1.0) "MODERATE"
    else "POOR"
  }

  cat(sprintf("Detectable slope at 50%% power: %.4f\n", slope_50))
  cat(sprintf("Cumulative bias at t=0:        %.4f\n", cumulative_bias))
  cat(sprintf("ATT estimate:                  %.4f\n", att_estimate))
  cat(sprintf("Bias / |ATT|:                  %.1f%%\n", 100 * bias_ratio))
  cat(sprintf("Power quality:                 %s\n\n", quality))

  if (quality == "POOR") {
    cat("WARNING: The pre-test cannot detect violations as large as the effect itself.\n")
    cat("A non-significant pre-test is UNINFORMATIVE. See 'Fundamentally Underpowered\n")
    cat("Analysis' below.\n")
  }

  invisible(list(cumulative_bias = cumulative_bias, bias_ratio = bias_ratio,
                 quality = quality))
}

# Usage:
# assess_power_context(slope_50, tVec, att_estimate = overall_att)
```

**Relative Power Thresholds:**

| Bias / |ATT| | Power Quality | Implication |
|---------------|---------------|-------------|
| < 5%          | Excellent     | Can detect violations far smaller than the effect |
| 5% - 25%      | Good          | Good power relative to effect size |
| 25% - 100%    | Moderate      | Undetectable violations could rival the effect; interpret with caution |
| > 100%        | Poor          | Pre-test is uninformative; non-rejection does not support parallel trends |

### Joint F-Test for Pre-Treatment Coefficients

A complement to power analysis -- test whether pre-treatment coefficients are jointly significantly different from zero:

```r
joint_pretrends_test <- function(betahat_pre, sigma_pre, alpha = 0.05) {
  k <- length(betahat_pre)
  se <- sqrt(diag(sigma_pre))

  # Individual t-tests
  t_stats <- betahat_pre / se
  z_crit <- qnorm(1 - alpha / 2)
  sig_individual <- abs(t_stats) > z_crit

  # Joint F-test: beta' * inv(sigma) * beta / k
  sigma_inv <- solve(sigma_pre)
  f_stat <- as.numeric(t(betahat_pre) %*% sigma_inv %*% betahat_pre) / k
  p_value <- 1 - pf(f_stat, df1 = k, df2 = Inf)

  cat(sprintf("Individual tests: %d/%d significant at alpha=%.2f\n",
              sum(sig_individual), k, alpha))
  cat(sprintf("Joint F-test: F=%.3f, p=%.4f\n", f_stat, p_value))

  if (p_value < alpha) {
    cat("WARNING: Significant pre-trends detected. Parallel trends may not hold.\n")
  } else {
    cat("No significant pre-trends (but check power before concluding).\n")
  }

  list(individual_significant = sig_individual, f_stat = f_stat,
       p_value = p_value, assessment = ifelse(p_value < alpha,
       "FAIL - Significant pre-trends", "PASS - No significant pre-trends"))
}

# Usage: separate pre-treatment coefficients, then test
pre_idx <- which(tVec < 0)
joint_pretrends_test(betahat[pre_idx], sigma[pre_idx, pre_idx])
```

### Pre-Period Window Selection

When treatment cohorts differ in size, the composition of contributing cohorts changes across event times (see "Compositional Effects in CS Dynamic Aggregation" in `did-step-3-estimation.md`). This affects both the F-test and `slope_for_power()`:
- **F-test**: Including compositionally thin long leads can cause rejection even when near-period pre-trends are clean
- **Power analysis**: Noisy long-lead estimates inflate the covariance matrix, distorting the detectable slope

**Run both full and near-period analyses:**

```r
# Assume betahat, sigma, tVec already extracted from estimator
pre_idx_full <- which(tVec < 0)
pre_idx_near <- which(tVec >= -5 & tVec < 0)  # adjust -5 based on data

# --- F-tests ---
cat("=== Full Pre-Period F-Test ===\n")
ftest_full <- joint_pretrends_test(betahat[pre_idx_full],
                                   sigma[pre_idx_full, pre_idx_full])

cat("\n=== Near Pre-Period F-Test ===\n")
ftest_near <- joint_pretrends_test(betahat[pre_idx_near],
                                   sigma[pre_idx_near, pre_idx_near])
```

**Interpretation table:**

| Full F-Test | Near F-Test | Interpretation |
|-------------|-------------|----------------|
| Rejects | Passes | Compositional artifact at long leads. Trust the near-period result. |
| Rejects | Rejects | Genuine pre-trend concern across all horizons. |
| Passes | Passes | No pre-trend evidence (check power). |
| Passes | Rejects | Unusual — investigate near-period instability. |

**Power analysis on both windows:**

```r
# --- Detectable slopes ---
slope_full <- slope_for_power(sigma = sigma[pre_idx_full, pre_idx_full],
                              targetPower = 0.50,
                              tVec = tVec[pre_idx_full],
                              referencePeriod = -1)
slope_near <- slope_for_power(sigma = sigma[pre_idx_near, pre_idx_near],
                              targetPower = 0.50,
                              tVec = tVec[pre_idx_near],
                              referencePeriod = -1)

cat(sprintf("Detectable slope (full pre-period):  %.4f\n", slope_full))
cat(sprintf("Detectable slope (near pre-period):  %.4f\n", slope_near))
```

> **Rule of thumb**: Trust the near-period result for decision-making; report the full-period result for completeness. If they disagree substantially, run `diagnose_composition()` (Step 3) to confirm whether composition is the driver.

### Comprehensive Pre-Trends Assessment

Combine visual inspection, joint testing, and power analysis for a complete picture:

1. **Visual**: Plot pre-treatment coefficients with CIs. Look for systematic patterns.
2. **Joint F-test**: Test whether pre-treatment coefficients are jointly zero.
3. **Power analysis**: Calculate detectable slope at 50% and 80% power.
4. **Contextualize**: Compare detectable slope to treatment effect magnitude.

If the joint test fails: parallel trends is questionable. Consider alternative identification, different control groups, or covariate adjustment (DRDID).

If the joint test passes but power is low: the test is uninformative. The "pass" does not validate parallel trends. Report power analysis prominently.

If the joint test passes and power is high: stronger (but not conclusive) evidence for parallel trends. Proceed with main analysis and sensitivity.

### Fundamentally Underpowered Analysis

When `assess_power_context()` returns `POOR` (bias/|ATT| > 100%), the pre-trends test is **fundamentally uninformative**. This means a linear violation large enough to fully explain the estimated treatment effect would go undetected with > 50% probability. The non-rejection of parallel trends provides essentially no reassurance.

**What to report:**

> "The pre-trends test has limited power in this setting. A linear violation producing cumulative bias of [X]% of the estimated ATT would be undetectable at 50% power. The non-significant pre-test should not be interpreted as evidence supporting parallel trends."

**What to consider:**

1. **Aggregate to treatment level**: If units are finer than treatment assignment (e.g., counties within states), aggregate the outcome to the treatment level using population weights. Fewer, less noisy unit-level observations can improve power.
2. **Longer pre-treatment window**: More pre-periods improve the power to detect a linear trend.
3. **Alternative outcomes**: A different outcome variable with less noise may have better power.
4. **Sensitivity-first approach**: When pre-tests are uninformative, HonestDiD sensitivity analysis (Step 5) becomes the primary tool. Report the breakdown M and robust CIs rather than relying on the pre-test.
5. **Evidence assessment**: Use `final_evidence_assessment()` (Step 5) to synthesize the overall strength of evidence, accounting for low power.

**Template for papers:**

```
We acknowledge that our pre-trends test has limited power: the minimum detectable
linear violation at 50% power produces cumulative bias equal to [X]% of the
estimated ATT. We therefore emphasize the HonestDiD sensitivity analysis, which
shows that the effect [remains significant / becomes insignificant] when allowing
post-treatment violations up to [M] times the magnitude of pre-treatment violations.
```

---
