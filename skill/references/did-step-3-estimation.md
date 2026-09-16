# Step 3: Choose and Run Robust Estimators (5 Core Methods)

## Contents
- [Estimator Comparison Table](#estimator-comparison-table)
- [1. Callaway & Sant'Anna (did)](#1-callaway--santanna-did)
- [2. Sun & Abraham (fixest)](#2-sun--abraham-fixest)
- [3. Borusyak-Jaravel-Spiess / BJS (didimputation)](#3-borusyak-jaravel-spiess--bjs-didimputation)
- [4. Gardner Two-Stage (did2s)](#4-gardner-two-stage-did2s)
- [5. Roth & Sant'Anna (staggered)](#5-roth--santanna-staggered)
- [Restricting Event Study Windows](#restricting-event-study-windows)
- [Compositional Effects in CS Dynamic Aggregation](#compositional-effects-in-cs-dynamic-aggregation)
- [Multi-Estimator Comparison Template](#multi-estimator-comparison-template)
  - [Interpreting Multi-Estimator Comparison](#interpreting-multi-estimator-comparison)
  - [Diagnosing SA Ran But Is Biased](#diagnosing-sa-ran-but-is-biased)
  - [Estimator Failure / Fallback Decision Tree](#estimator-failure--fallback-decision-tree)
- [Common Pitfalls](#common-pitfalls)
- [Clustering Standard Errors](#clustering-standard-errors)
- [Iterative Parallel Trends Workflow](#iterative-parallel-trends-workflow)
  - [Step A: Assess Selection Mechanisms](#step-a-assess-selection-mechanisms)
  - [Step B: Estimate Without Covariates First](#step-b-estimate-without-covariates-first)
  - [Step C: Check Covariate Overlap](#step-c-check-covariate-overlap)
  - [Step D: Re-Estimate with Covariates](#step-d-re-estimate-with-covariates)
  - [Covariate Syntax Across Estimators](#covariate-syntax-across-estimators)
  - [Step E: Formal Conditional Pre-Test](#step-e-formal-conditional-pre-test)

This file covers the five core heterogeneity-robust estimators for staggered DiD with binary, absorbing treatment. Treat this file as the authoritative Step 3 workflow contract; `SKILL.md` should only route here. For non-binary, reversible, or continuous treatments, see `did-advanced-methods.md`.

## Tool-Aware Path

When `did-mcp` is registered, run estimators via the three Step 3 tools instead of writing the per-package R by hand. Each tool handles the never-treated coding conversion automatically and returns a standardized `{overall, event_study, metadata, handle}` envelope so all five estimators produce the same response shape.

| Goal | Tool | Notes |
|---|---|---|
| Run one of five estimators | `did_estimate` with `estimator` ∈ {`cs`, `sa`, `bjs`, `did2s`, `staggered`} | `cs` → CS (`did::att_gt` + `aggte`), `sa` → SA (`fixest::feols` + `sunab`), `bjs` → BJS (`didimputation::did_imputation`, requires balanced panel), `did2s` → Gardner (`did2s::did2s`), `staggered` → Roth-Sant'Anna (`staggered::staggered`). |
| Run several and compare | `did_compare_estimators` with an `estimators` array | Returns per-estimator envelopes + a wide comparison table keyed on `event_time`. |
| Pull a canonical event study | `did_extract_event_study` on any `estimate_N` handle | Returns `{betahat, sigma, tVec, sigma_is_diagonal_fallback, fallback_reason}`. SA uses a matched event-time VCOV via `HonestDiD:::sunab_beta_vcv`; did2s preserves its full `vcov()` matrix matched by coefficient names. Other paths may use diagonal fallback with `reason="se_only"`. Always check that flag before downstream inference. |

**Covariates**: pass `xformla_vars: string[]` (e.g. `["lpop", "educ"]`); each wrapper converts to the right native syntax. **Clustering**: pass `cluster_var`; defaults to the panel's id_var. **Event window**: `min_e` / `max_e` restrict both the event-study output and any internal aggregation.

**Covariate-aware single-period DiD**: when the design reduces to a two-period pre/post slice and you want doubly-robust inference with explicit covariates, use `did_drdid` (wraps `DRDID::drdid`) — see Step 5.

The R recipes in the rest of this guide remain the authoritative reference and are the **code-gen fallback** when the MCP is not registered.

## Estimator Comparison Table

| Package | Function | Approach | Speed | Control Group | Data Requirement |
|---------|----------|----------|-------|---------------|------------------|
| `did` | `att_gt()` + `aggte()` | Callaway-Sant'Anna | Moderate | Not-yet or never | gname = 0 for never-treated |
| `fixest` | `feols()` + `sunab()` | Sun-Abraham | Very fast | Never or last cohort | Inf for never-treated (NA drops rows) |
| `didimputation` | `did_imputation()` | Borusyak-Jaravel-Spiess | Moderate | Not-yet-treated | Balanced panel; data.table; gname = 0 for never-treated |
| `did2s` | `did2s()` | Gardner two-stage | Fast | Not-yet-treated | Binary `treat` indicator |
| `staggered` | `staggered()` | Roth-Sant'Anna | Moderate | Not-yet-treated | gname = Inf for never-treated |

---

## 1. Callaway & Sant'Anna (`did`)

### Installation
```r
install.packages("did")
```

### Key Functions

**`att_gt(yname, tname, idname, gname, data, ...)`** -- Group-time ATTs

Key parameters:
- `control_group`: `"notyettreated"` (preferred when few never-treated) or `"nevertreated"`
- `est_method`: `"dr"` (doubly robust, recommended), `"ipw"`, or `"reg"`
- `xformla`: Covariate formula (e.g., `~ age + educ`)
- `anticipation`: Periods of possible anticipation (default: 0)
- `bstrap`: Bootstrap inference (default: TRUE)
- `clustervars`: Clustering variables

**`aggte(MP, type, ...)`** -- Aggregate treatment effects
- `type`: `"simple"` (overall ATT), `"dynamic"` (event study), `"group"`, `"calendar"`
- `balance_e`: Balance event time across groups
- `min_e`, `max_e`: Restrict event time window

**`ggdid(object)`** -- Event study plot

### Data Preparation
```r
# CS requires gname = 0 for never-treated (not NA)
df$first_treat[is.na(df$first_treat)] <- 0
```

### Complete Example
```r
library(did)
library(ggplot2)

data(mpdta)

# Step 1: Group-time ATTs
cs_out <- att_gt(
  yname = "lemp", tname = "year", idname = "countyreal",
  gname = "first.treat", data = mpdta,
  control_group = "notyettreated",
  est_method = "dr", xformla = ~ lpop,
  bstrap = TRUE, biters = 1000, clustervars = "countyreal")

summary(cs_out)

# Step 2: Event study aggregation
cs_es <- aggte(cs_out, type = "dynamic")
summary(cs_es)

# Step 3: Plot
ggdid(cs_es, title = "Event Study: Callaway & Sant'Anna")

# Step 4: Overall ATT
cs_overall <- aggte(cs_out, type = "simple")
summary(cs_overall)

# Step 5: Group-specific effects
cs_group <- aggte(cs_out, type = "group")
summary(cs_group)
```

### With Sampling Weights

```r
# CS uses `weightsname` (not `weights`) — must be a column name string
cs_wt <- att_gt(yname = "lemp", tname = "year", idname = "countyreal",
                gname = "first.treat", data = mpdta,
                control_group = "notyettreated",
                weightsname = "pop_weight")
```

---

## 2. Sun & Abraham (`fixest`)

### Installation
```r
install.packages("fixest")
```

If `sunab()` is unavailable, your installed `fixest` is too old for this workflow. Update `fixest` before running Sun-Abraham examples.

### Key Functions

**`feols(fml, data, ...)`** with `sunab(cohort, period)` -- Event study estimation
- `sunab(cohort, period)`: Automatically creates interaction-weighted estimator
- Fixed effects specified after `|` (e.g., `| unit + time`)
- `cluster`: Clustering specification (e.g., `~unit`)

**`iplot(model, ...)`** -- Event study coefficient plot
**`etable(...)`** -- Publication-ready regression tables

### Data Preparation
```r
# sunab() drops rows where first_treat is NA — convert to Inf for never-treated
df$first_treat[is.na(df$first_treat)] <- Inf
```

### Complete Example
```r
library(fixest)

data(base_stagg)

# Event study with Sun-Abraham
sa_out <- feols(
  y ~ sunab(year_treated, year) | id + year,
  data = base_stagg, cluster = ~id)

summary(sa_out)

# Built-in event study plot
iplot(sa_out,
      main = "Event Study: Sun & Abraham",
      xlab = "Periods Relative to Treatment",
      ylab = "Treatment Effect")

# Extract matched beta/sigma for HonestDiD/pretrends
# WARNING: coef() and vcov() have mismatched dimensions for sunab models.
# Use sunab_beta_vcv() which returns properly matched beta and sigma.
bv    <- HonestDiD:::sunab_beta_vcv(sa_out)
beta  <- bv$beta
sigma <- bv$sigma
```

> **Weights**: `feols(..., weights = ~W)` uses formula syntax (not a string).

### Warning: Small or Singleton Cohorts

SA becomes unstable when treatment cohorts contain very few units. Symptoms include non-PSD VCOV matrices, standard errors of exactly 0.000, wildly large SEs, and many variables dropped for collinearity.

**Diagnostic check:**
```r
# Check cohort sizes (run before SA estimation)
cohort_sizes <- table(df$cohort[!duplicated(df$unit_id) & df$cohort > 0 &
                                 !is.na(df$cohort)])
cat("Cohort sizes:\n"); print(cohort_sizes)
small <- names(cohort_sizes[cohort_sizes < 5])
if (length(small) > 0) {
  warning(sprintf("Cohorts with < 5 units: %s\n  SA may be unreliable. Consider:\n  1. Merge small cohorts into neighboring ones\n  2. Drop singleton cohorts\n  3. Use CS (did) instead — more robust to small cohorts",
                  paste(small, collapse = ", ")))
}
```

**Remedies:**
- **Merge**: Combine small cohorts with the nearest timing cohort
- **Drop**: Remove singleton cohorts and re-estimate
- **Switch**: Use CS (`att_gt()`) which handles small cohorts more gracefully via group-time ATT estimation

> **SA instability is driven by T-to-cohort ratio, NOT total number of units.** A dataset with 3,000 counties but only 3 cohorts and 10 time periods has ratio 3.3 — marginal. Adding more units does not help; you need more time periods or fewer cohorts. Rule of thumb: T should be >= 3× treated cohorts. See the T-to-cohort ratio check below.

### Warning: Insufficient Time Periods for SA

SA also fails when there are too few time periods relative to cohorts — the `sunab()` interaction terms become rank-deficient even when cohorts are not small. **Rule of thumb**: T should be >= 3× the number of treated cohorts.

```r
# Check T-to-cohort ratio before running SA
n_periods <- length(unique(df$time))
n_cohorts <- length(unique(df$cohort[df$cohort > 0 & !is.na(df$cohort)]))
ratio <- n_periods / n_cohorts
cat(sprintf("Time periods: %d | Treated cohorts: %d | Ratio: %.1f\n",
            n_periods, n_cohorts, ratio))
if (ratio < 3) {
  warning(sprintf(
    "T/cohort ratio (%.1f) < 3. SA likely rank-deficient.\n  Use CS or Gardner instead.",
    ratio))
}
```

### Warning: Non-Positive-Semi-Definite VCOV

If fixest reports `"The VCOV matrix is not positive semi-definite"`, it has replaced negative eigenvalues with zero. This affects downstream analysis:

- **HonestDiD**: May produce unreliable sensitivity intervals (requires valid covariance)
- **pretrends**: Power calculations may be distorted
- **Standard errors**: Some SEs may be exactly 0.000 (from the eigenvalue fix)

**Response strategies:**
1. **Diagnose the cause**: Usually small/singleton cohorts or extreme collinearity. Check `cohort_sizes` above.
2. **Merge or drop** problematic cohorts (see above)
3. **Restrict the event window**: `iplot(sa_out, xlim = c(-10, 15))` — long leads from early adopters cause rank-deficiency
4. **Use heteroskedasticity-robust SEs**: `vcov(sa_out, "hetero")` instead of cluster-robust
5. **Switch estimator**: CS provides valid SEs even with small cohorts

> See `references/did-troubleshooting.md` for the full troubleshooting entry.

### Multiple Specifications
```r
# Compare different outcomes
multi <- feols(c(y1, y2, y3) ~ sunab(cohort, period) | id + year,
               data = df, cluster = ~id)
etable(multi)

# Two-way clustering
sa_2way <- feols(y ~ sunab(cohort, period) | id + year,
                 data = df, cluster = ~id + year)
```

---

## 3. Borusyak-Jaravel-Spiess / BJS (`didimputation`)

### Installation
```r
install.packages("didimputation")
```

### Key Function

**`did_imputation(data, yname, gname, tname, idname, ...)`**
- `horizon`: Logical, estimate event study effects (default: FALSE)
- `pretrends`: Vector of pre-treatment periods or TRUE for all

### Data Preparation (Critical)

BJS is the most demanding estimator for data preparation. It requires:
1. A **balanced panel** (all units observed at all times)
2. Data in **data.table** format
3. Never-treated coded as `gname = 0` (the package also documents NA); finite future sentinels create artificial event times
4. Specific column types: idname as integer, tname as integer, gname as numeric, yname as numeric

```r
library(data.table)

prepare_bjs_data <- function(df, yname, tname, idname, gname) {
  # Recover only finite sentinels recorded by the Step 1 helper.
  sentinel <- attr(df, "did_never_treated_sentinels")[[gname]]
  if (!is.null(sentinel)) {
    g <- df[[gname]]
    df[[gname]][!is.na(g) & g == sentinel] <- 0
  }
  # 1. Create balanced grid
  unique_ids   <- sort(unique(df[[idname]]))
  unique_times <- sort(unique(df[[tname]]))
  balanced <- expand.grid(
    temp_id = unique_ids, temp_time = unique_times,
    stringsAsFactors = FALSE)
  names(balanced) <- c(idname, tname)

  # 2. Merge with original data
  merged <- merge(balanced, df, by = c(idname, tname), all.x = TRUE)

  # 3. Convert to data.table (required by didimputation)
  dt <- data.table::as.data.table(merged)

  # 4. Use the documented never-treated convention
  g <- dt[[gname]]
  g[is.na(g) | g == 0 | is.infinite(g)] <- 0
  dt[[gname]] <- g

  # 5. Coerce column types (all required)
  dt[[idname]] <- as.integer(dt[[idname]])
  dt[[tname]]  <- as.integer(dt[[tname]])
  dt[[gname]]  <- as.numeric(dt[[gname]])
  dt[[yname]]  <- as.numeric(dt[[yname]])

  dt
}
```

### Complete Example
```r
library(didimputation)
library(data.table)

# Prepare data (assuming df has: unit_id, year, outcome, first_treat)
dt <- prepare_bjs_data(df, yname = "outcome", tname = "year",
                       idname = "unit_id", gname = "first_treat")

# Static estimation
bjs_static <- did_imputation(
  data = dt, yname = "outcome", gname = "first_treat",
  tname = "year", idname = "unit_id")
print(bjs_static)

# Event study
bjs_es <- did_imputation(
  data = dt, yname = "outcome", gname = "first_treat",
  tname = "year", idname = "unit_id",
  horizon = TRUE, pretrends = -5:-1)
print(bjs_es)
```

### With Sampling Weights

```r
bjs_wt <- did_imputation(
  data = dt, yname = "outcome", gname = "first_treat",
  tname = "year", idname = "unit_id",
  wname = "pop_weight")
```

---

## 4. Gardner Two-Stage (`did2s`)

### Installation
```r
install.packages("did2s")
```

### Key Function

**`did2s(data, yname, first_stage, second_stage, treatment, cluster_var, ...)`**
- `first_stage`: Formula for fixed effects (e.g., `~ 0 | unit + time`)
- `second_stage`: Treatment specification (e.g., `~ i(treat, ref = FALSE)`)
- `treatment`: Name of binary treatment indicator (string)
- `cluster_var`: Clustering variable (string)
- `bootstrap`, `n_bootstraps`: Bootstrap inference options

### Data Preparation
```r
# Gardner needs an explicit binary treat indicator (handle NAs for never-treated)
df$treat <- ifelse(!is.na(df$first_treat) & df$first_treat > 0 &
                   df$year >= df$first_treat, 1, 0)
```

### Complete Example
```r
library(did2s)
library(fixest)

# Create treatment indicator
df$treat <- ifelse(!is.na(df$first_treat) & df$first_treat > 0 &
                   df$year >= df$first_treat, 1, 0)

# Static estimation
gardner_static <- did2s(
  data = df, yname = "outcome",
  first_stage = ~ 0 | unit_id + year,
  second_stage = ~ i(treat, ref = FALSE),
  treatment = "treat", cluster_var = "unit_id")
summary(gardner_static)

# Event study (need relative time variable)
df$rel_time <- ifelse(df$first_treat > 0, df$year - df$first_treat, Inf)

gardner_es <- did2s(
  data = df, yname = "outcome",
  first_stage = ~ 0 | unit_id + year,
  second_stage = ~ i(rel_time, ref = c(-1, Inf)),
  treatment = "treat", cluster_var = "unit_id")

# Plot using fixest's iplot
iplot(gardner_es,
      main = "Event Study: Gardner (did2s)",
      xlab = "Periods Relative to Treatment",
      ylab = "Treatment Effect")
```

### With Controls and Weights
```r
# Include controls in first stage
gardner_ctrl <- did2s(
  data = df, yname = "outcome",
  first_stage = ~ x1 + x2 | unit_id + year,
  second_stage = ~ i(treat, ref = FALSE),
  treatment = "treat", cluster_var = "unit_id")

# With sampling weights
gardner_wt <- did2s(
  data = df, yname = "outcome",
  first_stage = ~ 0 | unit_id + year,
  second_stage = ~ i(treat, ref = FALSE),
  treatment = "treat", cluster_var = "unit_id",
  weights = "sample_weight")
```

---

## 5. Roth & Sant'Anna (`staggered`)

### Installation
```r
install.packages("staggered")  # now on CRAN
```

### Key Function

**`staggered(df, i, t, g, y, estimand, ...)`**
- `i`: Unit identifier (string)
- `t`: Time variable (string)
- `g`: First treatment period (string); `Inf` for never-treated
- `y`: Outcome variable (string)
- `estimand`: `"simple"`, `"cohort"`, `"calendar"`, or `"eventstudy"`
- `eventTime`: Vector of event times (for `"eventstudy"`)

### Data Preparation
```r
# Staggered requires Inf for never-treated (not 0 or NA)
df$first_treat[is.na(df$first_treat) | df$first_treat == 0] <- Inf
```

### Complete Example
```r
library(staggered)
library(ggplot2)

# Load sample data
df <- staggered::pj_officer_level_balanced

# Simple weighted average
stag_simple <- staggered(
  df = df, i = "uid", t = "period",
  g = "first_trained", y = "complaints",
  estimand = "simple")
print(stag_simple)

# Event study
stag_es <- staggered(
  df = df, i = "uid", t = "period",
  g = "first_trained", y = "complaints",
  estimand = "eventstudy", eventTime = 0:12)

ggplot(stag_es, aes(x = eventTime, y = estimate)) +
  geom_pointrange(aes(ymin = estimate - 1.96 * se,
                      ymax = estimate + 1.96 * se)) +
  geom_hline(yintercept = 0, linetype = "dashed") +
  labs(title = "Event Study: Staggered (Roth & Sant'Anna)",
       x = "Periods Since Treatment", y = "Effect") +
  theme_minimal()

# Compare different estimands
for (est in c("simple", "cohort", "calendar")) {
  result <- staggered(df = df, i = "uid", t = "period",
                      g = "first_trained", y = "complaints",
                      estimand = est)
  cat(sprintf("%s: estimate = %.4f (SE = %.4f)\n",
              est, result$estimate, result$se))
}
```

> **Weights**: `staggered()` does not support sampling weights. If population weighting is needed, use CS (`weightsname`) or Gardner (`weights`).

## Restricting Event Study Windows

With early adopters or long panels, default event studies can span 30+ periods with unreliable extreme leads/lags. Restrict the window for each estimator:

**SA (fixest):** Restrict the plot window (coefficients are still estimated for all periods):
```r
iplot(sa_out, xlim = c(-10, 15))
```

**CS (did):** Use `min_e` / `max_e` in `aggte()` to restrict aggregation:
```r
cs_es <- aggte(cs_out, type = "dynamic", min_e = -10, max_e = 15)
ggdid(cs_es)
```

**Gardner (did2s):** Recode extreme relative times to `Inf` before estimation so they are absorbed into the reference category:
```r
df$rel_time <- ifelse(df$first_treat > 0, df$year - df$first_treat, Inf)
df$rel_time[df$rel_time < -10 | df$rel_time > 15] <- Inf
gardner_es <- did2s(
  data = df, yname = "outcome",
  first_stage = ~ 0 | unit_id + year,
  second_stage = ~ i(rel_time, ref = c(-1, Inf)),
  treatment = "treat", cluster_var = "unit_id")
```

> **Rule of thumb**: Set the window to cover the range where most cohorts have data. Periods with only one or two cohorts contributing produce noisy estimates.

---

## Compositional Effects in CS Dynamic Aggregation

When `aggte(type = "dynamic")` produces an event study, it averages group-time ATTs across all cohorts observed at each event time. The **composition of contributing cohorts changes across event times**: at extreme leads, only late adopters contribute, while near the treatment date, all cohorts contribute. This compositional shift can produce spurious significant pre-trends at long leads, inflate F-tests, distort power analysis (Step 4), and inflate HonestDiD's baseline violation (Step 5).

### Diagnosing Composition

```r
diagnose_composition <- function(cs_out) {
  # cs_out: output from att_gt()
  gt <- data.frame(group = cs_out$group, t = cs_out$t)
  gt$e <- gt$t - gt$group  # event time

  event_times <- sort(unique(gt$e))
  cat("Event Time | # Cohorts | Cohorts Contributing\n")
  cat("-----------|-----------|---------------------\n")
  thin <- integer()
  for (e in event_times) {
    cohorts <- sort(unique(gt$group[gt$e == e]))
    flag <- if (length(cohorts) <= 2) " <-- THIN" else ""
    cat(sprintf("%10d | %9d | %s%s\n", e, length(cohorts),
                paste(cohorts, collapse = ", "), flag))
    if (length(cohorts) <= 2) thin <- c(thin, e)
  }
  if (length(thin) > 0) {
    cat(sprintf("\nWARNING: %d event times have <= 2 cohorts contributing.\n",
                length(thin)))
    cat("Estimates at these event times are dominated by 1-2 cohorts and may be noisy.\n")
    cat("Downstream consequences:\n")
    cat("  - F-tests (Step 4) may reject due to compositional artifacts, not real violations\n")
    cat("  - Power analysis (Step 4) is distorted by noisy long-lead estimates\n")
    cat("  - HonestDiD (Step 5) baseline violation is inflated by thin-period noise\n")
  }
  invisible(list(event_times = event_times, thin = thin))
}
```

### Remedy 1: Balanced Composition with `balance_e`

Use `balance_e` to restrict the event study to event times where all included cohorts contribute. This ensures stable composition but **drops cohorts that don't span the full window**:

```r
# Only include event times where the composition is constant
cs_es_bal <- aggte(cs_out, type = "dynamic", balance_e = -5)
ggdid(cs_es_bal, title = "Balanced Composition (balance_e = -5)")
```

> **Tradeoff**: `balance_e = X` drops cohorts with fewer than `|X|` pre-treatment periods. With very different adoption dates, this can exclude most late adopters. Check how many cohorts remain.

### Remedy 2: Restrict Event Window with `min_e` / `max_e`

A lighter-touch approach: keep all cohorts but truncate the event study to the range where most cohorts have data (see "Restricting Event Study Windows" above):

```r
cs_es_trim <- aggte(cs_out, type = "dynamic", min_e = -5, max_e = 5)
ggdid(cs_es_trim, title = "Trimmed Window (min_e=-5, max_e=5)")
```

### Decision Tree: Significant Pre-Trends at Long Leads

```
Pre-trends significant?
├─ All pre-periods significant → PT likely violated. Use HonestDiD conservatively.
├─ Only long leads significant → Run diagnose_composition().
│   ├─ Those leads are THIN (1-2 cohorts)
│   │   → Compositional artifact. Restrict window with min_e/max_e or balance_e.
│   │     Run F-test and HonestDiD on restricted window (Steps 4-5).
│   │     Report both full and restricted results.
│   └─ Composition is stable at those leads
│       → Genuine concern. Report both analyses, discuss credibility.
└─ None significant → Check power (Step 4). Proceed to HonestDiD (Step 5).
```

---

## Multi-Estimator Comparison Template

Run multiple estimators on the same dataset and compare results:

```r
run_did_comparison <- function(df, yname, tname, idname, gname) {

  results <- data.frame(Method = character(), ATT = numeric(),
                        SE = numeric(), stringsAsFactors = FALSE)

  # 1. Callaway-Sant'Anna
  tryCatch({
    df_cs <- df; df_cs[[gname]][is.na(df_cs[[gname]])] <- 0
    cs <- did::att_gt(yname = yname, tname = tname, idname = idname,
                      gname = gname, data = df_cs,
                      control_group = "notyettreated")
    cs_agg <- did::aggte(cs, type = "simple")
    results <- rbind(results,
      data.frame(Method = "CS", ATT = cs_agg$overall.att,
                 SE = cs_agg$overall.se))
  }, error = function(e) message("CS failed: ", e$message))

  # 2. Sun-Abraham
  tryCatch({
    sa <- fixest::feols(
      as.formula(paste(yname, "~ sunab(", gname, ",", tname, ") |",
                       idname, "+", tname)),
      data = df, cluster = as.formula(paste("~", idname)))
    beta_sa <- coef(sa)
    # Average post-treatment coefficients
    tVec_sa <- as.numeric(gsub(".*::", "", names(beta_sa)))
    post_idx <- which(tVec_sa >= 0)
    results <- rbind(results,
      data.frame(Method = "SA", ATT = mean(beta_sa[post_idx]),
                 SE = NA))
  }, error = function(e) message("SA failed: ", e$message))

  # 3. Staggered
  tryCatch({
    df_stag <- df
    df_stag[[gname]][is.na(df_stag[[gname]]) | df_stag[[gname]] == 0] <- Inf
    stag <- staggered::staggered(
      df = df_stag, i = idname, t = tname,
      g = gname, y = yname, estimand = "simple")
    results <- rbind(results,
      data.frame(Method = "Staggered", ATT = stag$estimate, SE = stag$se))
  }, error = function(e) message("Staggered failed: ", e$message))

  results
}
```

### Interpreting Multi-Estimator Comparison

After running `run_did_comparison()`, check for large discrepancies:

```r
interpret_comparison <- function(results) {
  if (nrow(results) < 2) {
    cat("Only one estimator succeeded. Cannot compare.\n")
    return(invisible(NULL))
  }
  atts <- results$ATT
  range_att <- diff(range(atts))
  mean_att <- mean(atts)
  cv <- if (abs(mean_att) > 0) range_att / abs(mean_att) else Inf

  cat(sprintf("ATT range: [%.4f, %.4f] (spread: %.4f)\n",
              min(atts), max(atts), range_att))
  if (cv > 0.5) {
    cat("WARNING: Large discrepancy (>50% of mean). Investigate:\n")
    cat("  - Different control groups or weighting schemes\n")
    cat("  - Small/singleton cohorts destabilizing some estimators\n")
    cat("  - Panel imbalance affecting BJS\n")
  } else if (cv > 0.2) {
    cat("CAUTION: Moderate discrepancy. Report all estimates.\n")
  } else {
    cat("Results are consistent across estimators.\n")
  }

  # Check for sign disagreement with all insignificant estimates
  ses <- results$SE
  has_se <- !is.na(ses) & ses > 0
  if (sum(has_se) >= 2) {
    sig <- abs(atts[has_se]) / ses[has_se] > 1.96
    if (!any(sig) && length(unique(sign(atts))) > 1) {
      cat("NOTE: All estimates are insignificant AND disagree in sign.\n")
      cat("  The data cannot distinguish the direction of the effect.\n")
      cat("  Do NOT interpret the sign. Focus on confidence intervals\n")
      cat("  and power analysis (Step 4) to assess informativeness.\n")
    }
  }
}
```

### Diagnosing SA Ran But Is Biased

When SA produces results without errors but disagrees with CS/Gardner, the issue is usually estimation instability rather than genuine treatment effect heterogeneity. Use this diagnostic:

```r
diagnose_sa_reliability <- function(sa_model, cs_overall_att) {
  # NOTE: vcov() returns the disaggregated (cohort x period) VCOV, which is
  # larger than coef() (aggregated event-time). This is intentional here —
  # we check the raw VCOV for problems. For downstream analysis (HonestDiD,
  # pretrends), use HonestDiD:::sunab_beta_vcv() instead.
  sigma <- vcov(sa_model)
  beta  <- coef(sa_model)
  issues <- character()

  # 1. VCOV positive semi-definiteness
  eig <- eigen(sigma, symmetric = TRUE, only.values = TRUE)$values
  if (any(eig <= 0)) issues <- c(issues, "Non-PSD VCOV (negative eigenvalues)")

  # 2. Zero standard errors
  se <- sqrt(diag(sigma))
  n_zero <- sum(se < 1e-10)
  if (n_zero > 0) issues <- c(issues, sprintf("%d zero SEs (collinearity)", n_zero))

  # 3. ATT divergence from CS
  tVec <- as.numeric(gsub(".*::", "", names(beta)))
  post_att <- mean(beta[tVec >= 0])
  divergence <- abs(post_att - cs_overall_att) / abs(cs_overall_att)
  if (divergence > 0.3) {
    issues <- c(issues, sprintf("ATT diverges from CS by %.0f%%", divergence * 100))
  }

  # Verdict
  cat("SA Reliability Diagnostic:\n")
  if (length(issues) == 0) {
    cat("  VERDICT: RELIABLE — VCOV is clean, SEs are valid, ATT agrees with CS.\n")
  } else if (length(issues) == 1 && divergence <= 0.3) {
    cat(sprintf("  VERDICT: INVESTIGATE — %s\n", issues[1]))
  } else {
    cat("  VERDICT: UNRELIABLE — Multiple red flags:\n")
    for (iss in issues) cat(sprintf("    - %s\n", iss))
    cat("  Prefer CS or Gardner for this dataset.\n")
  }
  invisible(list(issues = issues, sa_att = post_att, divergence = divergence))
}
```

> **Key insight**: SA disagreement with clean diagnostics (low forbidden weight, no VCOV issues in CS) usually signals SA estimation instability, not genuine heterogeneity. When SA is UNRELIABLE, report CS and Gardner estimates and note that SA was unstable.

### Estimator Failure / Fallback Decision Tree

When an estimator fails or produces unreliable results, use this decision tree:

```
Estimator failed or unreliable?
│
├─ CS failed
│   ├─ "No valid groups" → Check gname coding (must be 0 for never-treated)
│   ├─ "Singular matrix" → Too few control units; use control_group = "notyettreated"
│   └─ Fallback: SA or Gardner
│
├─ SA failed / non-PSD VCOV
│   ├─ Small/singleton cohorts? → Merge cohorts or drop singletons
│   ├─ Too many collinear terms? → Restrict event window
│   └─ Fallback: CS (most robust to small cohorts)
│
├─ BJS failed
│   ├─ Unbalanced panel? → Balance first (prepare_bjs_data) or skip BJS
│   ├─ "data must be data.table" → Convert with as.data.table()
│   └─ Fallback: CS or SA
│
├─ Gardner failed
│   ├─ Missing treat column? → Create: treat = (time >= gname & gname > 0)
│   ├─ Convergence issues? → Simplify first_stage formula
│   └─ Fallback: CS or SA
│
└─ Multiple estimators disagree substantially
    ├─ Check if the disagreement is driven by one outlier estimator
    ├─ Report the range and discuss possible causes
    └─ Prefer CS for transparency, SA for speed, BJS for efficiency
```

> **Key insight**: Estimator failure is often informative about data structure (small cohorts, panel gaps, collinearity). Diagnose the failure before switching estimators.

---

## Common Pitfalls

1. **Forgetting to recode never-treated**: Each estimator has a different convention (0, NA, Inf)
2. **Unbalanced panels with BJS**: `didimputation` will fail silently or give wrong results
3. **Missing treatment indicator for Gardner**: `did2s` needs an explicit 0/1 `treat` column
4. **Wrong clustering**: Always cluster at the treatment assignment level
5. **Confusing `gname` with `treat`**: `gname` is the timing variable (when treatment starts); `treat` is a 0/1 indicator for whether the unit-time is treated
6. **Finite never-treated gname for BJS**: Normalize known never-treated units to zero. A finite future sentinel creates artificial event times, even when it lies beyond the observed sample.
7. **Small/singleton cohorts with SA**: Cohorts with < 5 units cause non-PSD VCOV, zero SEs, and collinearity drops. Check cohort sizes before running SA.
8. **Non-PSD VCOV from fixest**: Downstream HonestDiD/pretrends require valid covariance. If fixest "fixes" the VCOV, results are unreliable. Merge cohorts or switch to CS.
9. **Unrestricted event windows with early adopters**: Default event studies include all leads/lags, producing 30+ period plots dominated by noise. Restrict windows to where data is dense.
10. **Clustering at the wrong level**: If treatment is assigned at the state level but units are counties, you must cluster at the state level. See the "Clustering Standard Errors" section below.

---

## Clustering Standard Errors

### Principle

Cluster standard errors at the **level of treatment assignment**, not the level of observation. If a policy is implemented at the state level but your data are at the county level, cluster at the state level. This accounts for the within-cluster correlation induced by a common treatment shock.

### Per-Estimator Clustering Syntax

| Estimator | Parameter | Syntax Example |
|-----------|-----------|----------------|
| CS (`did`) | `clustervars` | `att_gt(..., clustervars = "state_id")` |
| SA (`fixest`) | `cluster` | `feols(..., cluster = ~state_id)` |
| BJS (`didimputation`) | `cluster_var` | `did_imputation(..., cluster_var = "state_id")` |
| Gardner (`did2s`) | `cluster_var` | `did2s(..., cluster_var = "state_id")` |
| Staggered | — | No explicit clustering parameter; uses analytical SEs |

> **CS note**: The `clustervars` parameter accepts a character vector of variable names (e.g., `clustervars = "state_id"`), not a formula. This differs from fixest's `cluster = ~state_id` formula syntax.

### Few-Cluster Problem

When the number of treated clusters is small, cluster-robust standard errors can be severely biased (typically too small):

| Treated Clusters | Reliability | Action |
|-----------------|-------------|--------|
| >= 50 | Reliable | Standard cluster-robust SEs are trustworthy |
| 30 - 50 | Moderate | Generally OK; consider wild cluster bootstrap for verification |
| 10 - 30 | Caution | Cluster-robust SEs may be anti-conservative; use wild cluster bootstrap |
| < 10 | Unreliable | Aggregate to the treatment level before estimation, or use randomization inference |

### Wild Cluster Bootstrap

When cluster count is between 10 and 50, supplement cluster-robust SEs with wild cluster bootstrap:

```r
library(fwildclusterboot)

# After running SA estimation with state-level clustering:
sa_model <- feols(outcome ~ sunab(first_treat, year) | county_id + year,
                  data = df, cluster = ~state_id)

# Wild cluster bootstrap test for a specific coefficient
boot_result <- boottest(sa_model,
                        param = "first_treat::0",  # post-treatment coefficient
                        clustid = "state_id",
                        B = 9999,
                        type = "webb")  # Webb weights recommended for few clusters
summary(boot_result)
```

### Two-Way Clustering

When treatment is assigned at the state level but outcomes may also be correlated over time within states:

```r
# fixest supports multi-way clustering natively
sa_2way <- feols(outcome ~ sunab(first_treat, year) | county_id + year,
                 data = df, cluster = ~state_id + year)

# CS: pass multiple variables to clustervars
cs_2way <- att_gt(yname = "outcome", tname = "year", idname = "county_id",
                  gname = "first_treat", data = df,
                  clustervars = c("state_id", "year"))
```

---

## Iterative Parallel Trends Workflow

This section implements Sant'Anna's practitioner checklist Items 4-8: a structured, iterative approach to deciding whether and how to condition on covariates when estimating DiD. The key insight is that **unconditional parallel trends should be the starting point**, and covariates should be added only when there is a substantive reason and adequate overlap.

### Step A: Assess Selection Mechanisms

Before choosing between unconditional and conditional parallel trends, ask: **why do units receive treatment at different times?**

| Question | If YES → | If NO → |
|----------|----------|---------|
| Is treatment timing effectively random (lottery, administrative cutoff)? | Unconditional PT likely holds. Skip to Step B. | Continue assessment. |
| Do observable characteristics predict treatment timing? | Conditioning on covariates may be needed. | Unconditional PT may suffice. |
| Are there known confounders that affect both timing and outcome trends? | Conditional PT required. Go to Step C. | Unconditional PT may suffice. |

**Quick diagnostic**: Compare covariate means across treatment cohorts to check whether timing is correlated with observables.

```r
library(did)
library(dplyr)

data(mpdta)

# Compare baseline covariates across treatment cohorts
baseline <- mpdta %>%
  filter(year == min(year)) %>%
  group_by(first.treat) %>%
  summarise(
    n = n(),
    mean_lpop = mean(lpop, na.rm = TRUE),
    sd_lpop = sd(lpop, na.rm = TRUE),
    .groups = "drop"
  )
print(baseline)
# If means differ substantially across cohorts, selection on observables
# is likely and conditional PT should be considered.
```

**Decision rule**: If covariate means are similar across cohorts (standardized differences < 0.1), treatment timing is likely unrelated to observables and unconditional PT is a reasonable starting point. If means differ substantially (standardized differences > 0.25), proceed to Steps C-D.

### Step B: Estimate Without Covariates First

Always start with the unconditional (no covariates) estimator as a baseline. This establishes what the data say under the simplest assumptions.

```r
library(did)

data(mpdta)

# Unconditional Callaway-Sant'Anna (xformla = ~1 means no covariates)
cs_uncond <- att_gt(
  yname = "lemp", tname = "year", idname = "countyreal",
  gname = "first.treat", data = mpdta,
  control_group = "notyettreated",
  xformla = ~1)

cs_es_uncond <- aggte(cs_uncond, type = "dynamic")
summary(cs_es_uncond)
ggdid(cs_es_uncond, title = "Event Study: Unconditional PT")
```

**Decision rule**:
- If pre-treatment coefficients are near zero AND the selection assessment (Step A) supports unconditional PT → **stop here**. Report the unconditional estimates.
- If pre-treatment coefficients show a trend or the selection story suggests confounding → proceed to Steps C-D.

### Step C: Check Covariate Overlap

Before conditioning on covariates, verify that treated and control groups have adequate **covariate overlap** (common support). Poor overlap means the doubly-robust or IPW estimator will rely heavily on extrapolation, producing unreliable estimates.

**Using `cobalt` for standardized mean differences:**

```r
library(cobalt)
library(did)

data(mpdta)

# Create a treatment group indicator (ever-treated vs never-treated)
mpdta$ever_treated <- ifelse(mpdta$first.treat > 0, 1, 0)

# Use baseline period only for balance checking
baseline_data <- mpdta[mpdta$year == min(mpdta$year), ]

# Standardized mean differences
bal <- bal.tab(
  ever_treated ~ lpop,
  data = baseline_data,
  s.d.denom = "pooled"
)
print(bal)
```

**Interpretation of standardized mean differences:**

| Std. Mean Diff | Quality | Action |
|----------------|---------|--------|
| < 0.10 | Good | Covariates are well-balanced; conditioning unlikely to change results much |
| 0.10 - 0.25 | Moderate | Some imbalance; conditioning may improve estimates |
| 0.25 - 0.50 | Caution | Substantial imbalance; conditioning important but check overlap carefully |
| > 0.50 | Severe | Poor overlap; doubly-robust estimator may extrapolate heavily; consider trimming |

**Propensity score overlap check:**

```r
library(ggplot2)

# Estimate propensity score (probability of being ever-treated)
baseline_data$pscore <- predict(
  glm(ever_treated ~ lpop, data = baseline_data, family = binomial),
  type = "response"
)

# Visualize overlap
ggplot(baseline_data, aes(x = pscore, fill = factor(ever_treated))) +
  geom_density(alpha = 0.5) +
  labs(title = "Propensity Score Overlap",
       x = "Propensity Score", fill = "Ever Treated") +
  theme_minimal()

# Check for extreme propensity scores
extreme <- mean(baseline_data$pscore < 0.05 | baseline_data$pscore > 0.95)
if (extreme > 0.10) {
  warning(sprintf("%.0f%% of units have extreme propensity scores (< 0.05 or > 0.95). Consider trimming.", 100 * extreme))
}
```

**If overlap is poor** (>10% of units have extreme propensity scores):
1. Trim the sample to the common support region
2. Use fewer covariates (the most theoretically important ones)
3. Report sensitivity of results to trimming choices

### Step D: Re-Estimate with Covariates

If Steps A-C indicate that conditioning on covariates is warranted and overlap is adequate, re-estimate with covariates.

```r
library(did)

data(mpdta)

# Conditional Callaway-Sant'Anna (with covariates)
cs_cond <- att_gt(
  yname = "lemp", tname = "year", idname = "countyreal",
  gname = "first.treat", data = mpdta,
  control_group = "notyettreated",
  xformla = ~ lpop,        # Add covariates here
  est_method = "dr")        # Doubly robust (recommended)

cs_es_cond <- aggte(cs_cond, type = "dynamic")
summary(cs_es_cond)
ggdid(cs_es_cond, title = "Event Study: Conditional PT (with lpop)")
```

**Comparing unconditional vs conditional estimates:**

```r
# Compare overall ATTs
uncond_att <- aggte(cs_uncond, type = "simple")
cond_att   <- aggte(cs_cond, type = "simple")

cat(sprintf("Unconditional ATT: %.4f (SE: %.4f)\n",
            uncond_att$overall.att, uncond_att$overall.se))
cat(sprintf("Conditional ATT:   %.4f (SE: %.4f)\n",
            cond_att$overall.att, cond_att$overall.se))

# Relative change
pct_change <- 100 * abs(cond_att$overall.att - uncond_att$overall.att) /
              abs(uncond_att$overall.att)
cat(sprintf("Relative change: %.1f%%\n", pct_change))
```

**Reporting guidance:**
- **Always report both** unconditional and conditional estimates
- If results are similar (relative change < 10%), prefer the simpler unconditional model
- If results differ substantially, discuss which PT assumption is more credible given the selection mechanism
- For the 2x2 case (single treatment date), also consider `DRDID::drdid()` for the doubly-robust panel estimator (see `references/did-step-5-sensitivity-inference.md`, Section "DRDID: Doubly-Robust DiD with Covariates")

### Covariate Syntax Across Estimators

When Step D indicates covariates are warranted, each estimator has a different syntax for including them:

**CS (`did`)**:
```r
cs_cond <- att_gt(yname = "outcome", tname = "year", idname = "unit_id",
                  gname = "first_treat", data = df,
                  xformla = ~ x1 + x2,  # covariates as formula
                  est_method = "dr")     # doubly robust
```

**SA (`fixest`)**:
```r
# Covariates go in the main formula, before the sunab() term
sa_cond <- feols(outcome ~ x1 + x2 + sunab(first_treat, year) | unit_id + year,
                 data = df, cluster = ~state_id)
```

**BJS (`didimputation`)**:
```r
bjs_cond <- did_imputation(data = dt, yname = "outcome", gname = "first_treat",
                           tname = "year", idname = "unit_id",
                           first_stage = ~ x1 + x2 | unit_id + year)
```

**Gardner (`did2s`)**:
```r
# Covariates go in first_stage formula, before fixed effects
gardner_cond <- did2s(data = df, yname = "outcome",
                      first_stage = ~ x1 + x2 | unit_id + year,
                      second_stage = ~ i(treat, ref = FALSE),
                      treatment = "treat", cluster_var = "state_id")
```

**Staggered**: Does not support external covariates. Use CS or Gardner if covariates are needed.

> **Covariate types**: Only include covariates that are **time-invariant** or **pre-treatment** values. Including post-treatment covariates introduces bad control bias. If you must use time-varying covariates, use only their baseline (pre-treatment) values.

### Step E: Formal Conditional Pre-Test

The `did` package provides `conditional_did_pretest()` to formally test the conditional parallel trends assumption across all pre-treatment periods and groups.

```r
library(did)

data(mpdta)

# Formal test of conditional parallel trends
cond_pretest <- conditional_did_pretest(
  yname = "lemp",
  tname = "year",
  idname = "countyreal",
  gname = "first.treat",
  xformla = ~ lpop,
  data = mpdta,
  control_group = "notyettreated",
  est_method = "ipw"
)

# The test returns a p-value for the null hypothesis that
# conditional parallel trends holds in all pre-treatment periods
summary(cond_pretest)
```

**Interpretation:**
- High p-value (> 0.05): Fail to reject conditional PT — consistent with the assumption holding
- Low p-value (< 0.05): Evidence against conditional PT — covariates may not be sufficient, or the PT assumption may be fundamentally violated
- **Caution**: A non-significant pre-test does NOT prove that parallel trends holds — it may simply lack power. Always complement with Step 4 (power analysis) and Step 5 (HonestDiD sensitivity).
