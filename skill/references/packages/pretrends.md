# pretrends: Power Calculations and Visualization for Pre-trends

> **Historical reference snapshot.** The version recorded here belongs to this
> snapshot and may differ from the installed package or validation ledger. Use
> [installed help](pretrends_quick_start.md#installed-help-topics) for current
> arguments. This file remains available as a historical fallback.

## Contents
- [Package Overview](#package-overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Function Reference](#function-reference)
- [Internal (Non-Exported) Functions](#internal-non-exported-functions)
- [Included Data](#included-data)
- [Workflows & Recipes](#workflows--recipes)
- [Common Pitfalls & Tips](#common-pitfalls--tips)
- [Related Packages](#related-packages)
- [References](#references)

## Package Overview
- **Version**: 0.1.0
- **Authors**: Jonathan Roth (Maintainer: jonathan.roth@microsoft.com)
- **Dependencies**: mvtnorm, tmvtnorm, stats, magrittr, dplyr, ggplot2
- **License**: MIT
- **Purpose**: The pretrends package provides tools for evaluating the power of pre-trends tests and the potential distortions from pre-testing in difference-in-differences (DiD) designs. Given a hypothesized difference in trends, users can calculate the power of a pre-trends test to detect that trend, the expected bias conditional on passing the pre-test, and the linear violations of parallel trends against which the pre-test has a particular power level. The package also provides visualization tools for displaying violations of parallel trends on an event-study plot. Calculations are based on Roth (2022, AER: Insights).

## Installation

```r
# Install from GitHub (recommended)
# install.packages("devtools")
devtools::install_github("jonathandroth/pretrends")
```

## Quick Start

```r
library(pretrends)

# Load example data from He and Wang (2017)
beta <- pretrends::HeAndWangResults$beta
sigma <- pretrends::HeAndWangResults$sigma
tVec <- pretrends::HeAndWangResults$tVec
referencePeriod <- -1

# Step 1: Find the slope of a linear trend against which the pre-test has 50% power
slope50 <- slope_for_power(
  sigma = sigma,
  targetPower = 0.5,
  tVec = tVec,
  referencePeriod = referencePeriod
)

# Step 2: Conduct full power analysis and visualization
results <- pretrends(
  betahat = beta,
  sigma = sigma,
  tVec = tVec,
  referencePeriod = referencePeriod,
  deltatrue = slope50 * (tVec - referencePeriod)
)

# View power statistics
results$df_power

# View event-study plot with hypothesized trend
results$event_plot

# View event-study plot including expectation after pre-testing
results$event_plot_pretest
```

## Function Reference

### `pretrends()`

**Description**: The main function of the package. Conducts power calculations for a test of pre-treatment trends given the results of an event-study and a user-hypothesized violation of parallel trends. Produces event-study plots for visualization and computes statistics about the distortions from pre-testing (including the expected value of event-study coefficients conditional on passing the pre-test).

**Usage**:
```r
pretrends(
  betahat,
  sigma,
  deltatrue,
  tVec,
  referencePeriod = 0,
  prePeriodIndices = which(tVec < referencePeriod),
  postPeriodIndices = which(tVec > referencePeriod)
)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `betahat` | numeric vector | (required) | The estimated event-study coefficients from an event-study regression. These are the point estimates associated with each relative time period (excluding the reference period). |
| `sigma` | matrix | (required) | The variance-covariance matrix for `betahat`. Must be a symmetric positive-definite matrix with dimensions matching the length of `betahat`. Can come from any asymptotically normal estimator (TWFE, Callaway & Sant'Anna, Sun & Abraham, etc.). |
| `deltatrue` | numeric vector | (required) | The hypothesized difference in trends (violation of parallel trends). Must have the same length as `betahat`. Can be linear (e.g., `slope * (tVec - referencePeriod)`) or nonlinear (e.g., quadratic). |
| `tVec` | numeric vector | (required) | The vector of relative time periods corresponding with the coefficients in `betahat`. Must have the same length as `betahat`. Does not include the reference period (which is normalized to 0). |
| `referencePeriod` | numeric | `0` | The omitted pre-treatment reference period, normalized to 0 in the event-study regression. The reference period coefficient is implicitly zero. |
| `prePeriodIndices` | integer vector | `which(tVec < referencePeriod)` | The indices of `betahat` corresponding with pre-treatment periods. Automatically determined from `tVec` and `referencePeriod` if not specified. |
| `postPeriodIndices` | integer vector | `which(tVec > referencePeriod)` | The indices of `betahat` corresponding with post-treatment periods. Automatically determined from `tVec` and `referencePeriod` if not specified. |

**Returns**: A named list with four elements:

- **`df_eventplot`**: A data.frame with columns:
  - `t` -- the relative time period
  - `betahat` -- the estimated event-study coefficients (0 for the reference period)
  - `deltatrue` -- the hypothesized difference in trends
  - `se` -- the standard errors of `betahat` (computed as `sqrt(diag(sigma))`)
  - `meanAfterPretesting` -- the expected value of `betahat` conditional on no individually significant pre-period coefficient under `deltatrue`. This shows what the event-study coefficients would look like on average if the true trend were `deltatrue` but the researcher only analyzed the data when no pre-treatment coefficient was significant.

- **`df_power`**: A data.frame with one row and three columns:
  - `Power` -- the probability of rejecting the pre-test (i.e., finding at least one individually significant pre-treatment coefficient at the 5% level) under the hypothesized trend `deltatrue`. Higher power means the test is more likely to detect the violation.
  - `Bayes.Factor` -- the ratio of the probability of "passing" the pre-test under `deltatrue` relative to under parallel trends (delta = 0). A smaller Bayes factor means that passing the pre-test provides stronger evidence in favor of parallel trends relative to the hypothesized violation.
  - `Likelihood.Ratio` -- the ratio of the likelihood of the observed `betahat` under `deltatrue` relative to under parallel trends. A small value means the observed data is much more consistent with parallel trends than with the hypothesized violation.

- **`event_plot`**: A ggplot2 object showing the event-study coefficients (with 95% confidence intervals) and the hypothesized trend (`deltatrue`) overlaid.

- **`event_plot_pretest`**: A ggplot2 object extending `event_plot` with an additional dashed series showing the `meanAfterPretesting` -- the expected value of the coefficients conditional on passing the pre-test under `deltatrue`.

**Details**:

The pre-test used is the "no individually significant" (NIS) test: the pre-test passes if and only if no individual pre-treatment coefficient has a t-statistic exceeding 1.96 in absolute value. This is the most common form of pre-trends testing in applied work.

Internally, the function:
1. Computes the rejection probability of the NIS pre-test under `deltatrue` using the multivariate normal CDF (`mvtnorm::pmvnorm`).
2. Computes the likelihood ratio and Bayes factor by evaluating the multivariate normal density at the observed `betahat` under both the hypothesized trend and parallel trends.
3. Computes the conditional expectation of the pre-treatment coefficients given passing the pre-test using truncated multivariate normal moments (`tmvtnorm::mtmvnorm`).
4. Computes the conditional expectation of the post-treatment coefficients using the law of iterated expectations and the covariance between pre- and post-treatment coefficient estimates.

The function removes row/column names from `sigma` before computation (required by tmvtnorm). It validates that `sigma` is symmetric, and that `betahat`, `sigma`, `tVec`, and `deltatrue` have compatible dimensions.

**Examples**:

```r
library(pretrends)

# --- Application to He and Wang (2017) ---
beta <- pretrends::HeAndWangResults$beta
sigma <- pretrends::HeAndWangResults$sigma
tVec <- pretrends::HeAndWangResults$tVec
referencePeriod <- -1

# Find slope with 50% power
slope50 <- slope_for_power(
  sigma = sigma,
  targetPower = 0.5,
  tVec = tVec,
  referencePeriod = referencePeriod
)

# Conduct power analysis with a linear trend
pretrendsResults <- pretrends(
  betahat = beta,
  sigma = sigma,
  tVec = tVec,
  referencePeriod = referencePeriod,
  deltatrue = slope50 * (tVec - referencePeriod)
)

# View the event plot
pretrendsResults$event_plot

# View the event plot with conditional expectations
pretrendsResults$event_plot_pretest

# View power statistics
pretrendsResults$df_power

# View detailed event-study data
pretrendsResults$df_eventplot

# --- Quadratic violation of parallel trends ---
quadraticPretrend <- pretrends(
  betahat = beta,
  sigma = sigma,
  tVec = tVec,
  referencePeriod = referencePeriod,
  deltatrue = 0.024 * (tVec - referencePeriod)^2
)

quadraticPretrend$event_plot_pretest
quadraticPretrend$df_power
```

---

### `slope_for_power()`

**Description**: Computes the slope of a linear violation of parallel trends for which the conventional pre-trends test (NIS test) has a pre-specified power level. This is analogous to a minimum detectable effect (MDE) for an RCT: it tells you how large a linear violation of parallel trends would need to be for the pre-test to detect it a given fraction of the time.

**Usage**:
```r
slope_for_power(
  sigma,
  targetPower = 0.5,
  tVec,
  referencePeriod = 0,
  prePeriodIndices = which(tVec < referencePeriod)
)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sigma` | matrix | (required) | The variance-covariance matrix for the event-study coefficients. Must be a symmetric positive-definite matrix with dimensions matching the length of `tVec`. |
| `targetPower` | numeric | `0.5` | The desired power level for the pre-test. The function finds the linear trend slope at which the NIS pre-test rejects with probability equal to `targetPower`. Must be between 0 and 1 (exclusive). |
| `tVec` | numeric vector | (required) | The vector of relative time periods corresponding with the event-study coefficients. Must have length equal to the number of rows/columns of `sigma`. |
| `referencePeriod` | numeric | `0` | The omitted pre-treatment reference period, normalized to 0 in the event-study regression. |
| `prePeriodIndices` | integer vector | `which(tVec < referencePeriod)` | The indices of the event-study coefficients corresponding with pre-treatment periods. If the reference period is not the last pre-treatment period, this must be specified manually. |

**Returns**: A single numeric value -- the slope of the linear trend `delta_t = slope * (t - referencePeriod)` for which the NIS pre-test achieves power equal to `targetPower`. The slope is always non-negative.

**Details**:

The function works by:
1. Extracting the pre-period sub-matrix of `sigma`.
2. Defining a power function that takes a slope, constructs the linear trend `beta_pre = slope * (tVec_pre - referencePeriod)`, and computes the rejection probability of the NIS test using `mvtnorm::pmvnorm`.
3. Using `stats::uniroot` to find the slope at which the power function equals `targetPower`. The search interval is `[0, 8 * max(se)]`, where `se` are the standard errors of the pre-treatment coefficients.

The function validates that `sigma` is symmetric, that `tVec` has compatible dimensions, and that there is at least one pre-treatment period.

**Examples**:

```r
library(pretrends)

beta <- pretrends::HeAndWangResults$beta
sigma <- pretrends::HeAndWangResults$sigma
tVec <- pretrends::HeAndWangResults$tVec
referencePeriod <- -1

# Slope for 50% power
slope50 <- slope_for_power(
  sigma = sigma,
  targetPower = 0.5,
  tVec = tVec,
  referencePeriod = referencePeriod
)
slope50
# Interpretation: A linear pre-trend with this slope would be detected
# (at least one significant pre-period coefficient) only 50% of the time.

# Slope for 80% power
slope80 <- slope_for_power(
  sigma = sigma,
  targetPower = 0.8,
  tVec = tVec,
  referencePeriod = referencePeriod
)
slope80
# A larger slope is needed for the test to have 80% power.
```

---

## Internal (Non-Exported) Functions

The following functions are used internally by the exported functions and are not intended for direct use. They are documented here for completeness.

### `rejectionProbability_NIS()`

**Description**: Computes the probability that the NIS (no-individually-significant) pre-test rejects, i.e., the probability that at least one pre-treatment t-statistic exceeds the threshold in absolute value.

**Usage**: `rejectionProbability_NIS(betaPre, SigmaPre, thresholdTstat.Pretest = 1.96)`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `betaPre` | numeric vector | (required) | The true pre-treatment coefficients (the hypothesized trend values). |
| `SigmaPre` | matrix | (required) | The covariance matrix for the pre-treatment coefficient estimates. |
| `thresholdTstat.Pretest` | numeric | `1.96` | The critical value threshold for the t-test. |

**Returns**: Numeric scalar -- the rejection probability (power).

**Details**: Computes `1 - P(all |betahat_j| < threshold * se_j)` using the multivariate normal CDF from `mvtnorm::pmvnorm`.

---

### `meanBetaPre_NIS()`

**Description**: Computes the expected value of the pre-treatment coefficient estimates conditional on no individual coefficient being significant (i.e., conditional on passing the NIS pre-test).

**Usage**: `meanBetaPre_NIS(betaPre, sigmaPre, thresholdTstat.Pretest = 1.96)`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `betaPre` | numeric vector | (required) | The true pre-treatment coefficients. |
| `sigmaPre` | matrix | (required) | The covariance matrix for the pre-treatment coefficient estimates. |
| `thresholdTstat.Pretest` | numeric | `1.96` | The critical value threshold for the t-test. |

**Returns**: Numeric vector -- the truncated mean of the pre-treatment coefficients.

**Details**: Uses `tmvtnorm::mtmvnorm` to compute the mean of a multivariate normal distribution truncated to the region where all coefficients lie within `[-threshold * se, threshold * se]`.

---

### `meanBetaPost_NIS()`

**Description**: Computes the expected value of the post-treatment coefficient estimates conditional on no individually significant pre-treatment coefficient.

**Usage**: `meanBetaPost_NIS(beta, sigma, prePeriodIndices, postPeriodIndices, tVec, referencePeriod, thresholdTstat.Pretest = 1.96, eta = NULL, ...)`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `beta` | numeric vector | (required) | The full vector of true coefficients (pre and post). |
| `sigma` | matrix | (required) | The full covariance matrix. |
| `prePeriodIndices` | integer vector | `1:(K-1)` | Indices for pre-treatment periods. |
| `postPeriodIndices` | integer vector | `K` | Indices for post-treatment periods. |
| `tVec` | numeric vector | auto-generated | Time periods for the coefficients. |
| `referencePeriod` | numeric | `0` | The omitted reference period. |
| `thresholdTstat.Pretest` | numeric | `1.96` | The critical value threshold. |
| `eta` | numeric vector or NULL | `NULL` | Optional weighting vector so that the target parameter is `eta' * beta`. If NULL, returns results for each post-period individually. |

**Returns**: A data.frame with columns `betaPostConditional` (conditional mean), `betaPostUnconditional` (unconditional mean), and `relativeT` (relative time).

**Details**: Uses the conditional expectation formula: `E[beta_post | pre-test passes] = beta_post + Sigma_{post,pre} * Sigma_{pre,pre}^{-1} * (E[betahat_pre | pass] - beta_pre)`. This leverages the joint normality of pre- and post-treatment coefficient estimates.

---

### `betaPostNullRejectionProbability_NIS()`

**Description**: Computes the probability of rejecting the null hypothesis for the post-treatment effect, conditional on passing the NIS pre-test.

**Usage**: `betaPostNullRejectionProbability_NIS(beta, sigma, prePeriodIndices, postPeriodIndices, eta = NULL, thresholdT = 1.96, thresholdTstat.Pretest = 1.96, nullRejectionForZero = TRUE, sigmaActual = sigma, ...)`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `beta` | numeric vector | (required) | The true full coefficient vector. |
| `sigma` | matrix | (required) | The covariance matrix (possibly used for pre-testing). |
| `prePeriodIndices` | integer vector | (required) | Indices for pre-treatment periods. |
| `postPeriodIndices` | integer vector | (required) | Indices for post-treatment periods. |
| `eta` | numeric vector or NULL | `NULL` | Weighting vector for the target parameter. If NULL, iterates over post-period basis vectors. |
| `thresholdT` | numeric | `1.96` | Critical value for the post-treatment test. |
| `thresholdTstat.Pretest` | numeric | `1.96` | Critical value for the pre-test. |
| `nullRejectionForZero` | logical | `TRUE` | If TRUE, computes the rejection probability for the null that `tau = 0`. If FALSE, computes rejection probability for the null that `tau = eta' * beta_post`. |
| `sigmaActual` | matrix | `sigma` | The true covariance matrix (allows for pre-testing based on a different covariance matrix than the true one). |

**Returns**: A data.frame with a `rejectionProbability` column.

**Details**: Uses `tmvtnorm::ptmvnorm.marginal` to compute marginal probabilities of the post-treatment statistic conditional on the pre-treatment statistics falling in the acceptance region.

---

### `findSlopeForPower_NIS()`

**Description**: Internal solver that finds the slope of a linear trend achieving a target power level. Called by `slope_for_power()`.

**Usage**: `findSlopeForPower_NIS(targetPower = 0.5, sigma, prePeriodIndices, tVec, referencePeriod, maxiter = 1000, thresholdTstat.Pretest = 1.96, ...)`

**Details**: Uses `stats::uniroot` to solve for the slope in the interval `[0, 8 * max(se_pre)]`.

---

### Utility Functions

#### `basisVector(index, size)`
Creates a column vector of zeros with a 1 at the specified `index`. Used internally to iterate over individual post-treatment period effects.

#### `rbind.all.columns(x, y)`
Binds two data.frames by rows, filling in `NA` for columns that exist in one but not the other.

#### `rbindapply.allColumns(X, FUN, ...)`
Applies a function to each element of `X` (via `lapply`) and then row-binds the resulting data.frames using `rbind.all.columns`.

---

## Included Data

### `HeAndWangResults`

A list containing the event-study results from He and Wang (2017), used in the package examples. The list has three elements:

| Element | Type | Description |
|---------|------|-------------|
| `beta` | numeric vector | The estimated event-study coefficients from a two-way fixed effects regression (Figure 2C of He and Wang, 2017). |
| `sigma` | matrix | The variance-covariance matrix for the event-study coefficients. |
| `tVec` | numeric vector | The relative time periods corresponding to each coefficient. |

**Usage**:
```r
data <- pretrends::HeAndWangResults
beta <- data$beta
sigma <- data$sigma
tVec <- data$tVec
```

---

## Workflows & Recipes

### Recipe 1: Basic Power Analysis for a Linear Pre-Trend

This is the most common workflow. First find the slope that gives a specific power level, then visualize.

```r
library(pretrends)

# Assume you have event-study results: beta, sigma, tVec, referencePeriod
# (from fixest, did, or any other package)

# Step 1: What linear trend can the pre-test detect 50% of the time?
slope50 <- slope_for_power(
  sigma = sigma,
  targetPower = 0.5,
  tVec = tVec,
  referencePeriod = referencePeriod
)

# Step 2: Construct the hypothesized trend vector
deltatrue <- slope50 * (tVec - referencePeriod)

# Step 3: Run full analysis
results <- pretrends(
  betahat = beta,
  sigma = sigma,
  tVec = tVec,
  referencePeriod = referencePeriod,
  deltatrue = deltatrue
)

# Step 4: Examine results
results$df_power        # Power, Bayes Factor, Likelihood Ratio
results$event_plot      # Event plot + hypothesized trend
results$event_plot_pretest  # + conditional expectations
```

### Recipe 2: Power Analysis for a Non-Linear (Quadratic) Pre-Trend

```r
# Hypothesize a quadratic violation of parallel trends
deltatrue_quad <- 0.024 * (tVec - referencePeriod)^2

results_quad <- pretrends(
  betahat = beta,
  sigma = sigma,
  tVec = tVec,
  referencePeriod = referencePeriod,
  deltatrue = deltatrue_quad
)

results_quad$event_plot_pretest
results_quad$df_power
```

### Recipe 3: Comparing Power Across Different Trend Magnitudes

```r
# Compute slopes for different power levels
slopes <- sapply(c(0.25, 0.50, 0.75, 0.90), function(p) {
  slope_for_power(
    sigma = sigma,
    targetPower = p,
    tVec = tVec,
    referencePeriod = referencePeriod
  )
})

data.frame(
  target_power = c(0.25, 0.50, 0.75, 0.90),
  slope = slopes
)
# Larger slopes are needed for higher power levels
```

### Recipe 4: Using with fixest Event-Study Output

```r
library(fixest)
library(pretrends)

# Run event study
mod <- feols(y ~ i(relative_time, treated, ref = -1) | unit + time, data = mydata)

# Extract beta and sigma (excluding the reference period)
beta <- coef(mod)
sigma <- vcov(mod)
tVec <- c(-4, -3, -2, 0, 1, 2, 3)  # adjust to your setting; exclude ref period = -1
referencePeriod <- -1

# Now use pretrends as above
slope50 <- slope_for_power(sigma = sigma, targetPower = 0.5,
                           tVec = tVec, referencePeriod = referencePeriod)

results <- pretrends(betahat = beta, sigma = sigma, tVec = tVec,
                     referencePeriod = referencePeriod,
                     deltatrue = slope50 * (tVec - referencePeriod))
```

### Recipe 5: Using with did (Callaway and Sant'Anna) Output

```r
library(did)
library(pretrends)

# Run Callaway & Sant'Anna estimator
cs_out <- att_gt(yname = "y", tname = "time", idname = "id",
                 gname = "first_treat", data = mydata)

# Aggregate to event-study
es <- aggte(cs_out, type = "dynamic")

# Extract results
beta <- es$att.egt
sigma <- es$V_analytical  # or use the variance-covariance matrix
tVec <- es$egt

# Proceed with pretrends analysis
```

---

## Common Pitfalls & Tips

### 1. Sigma Must Be a Matrix
The `sigma` argument must be a symmetric positive-definite matrix. If you pass a data.frame or tibble, the function will attempt to coerce it via `as.matrix()`, but it is best to ensure it is already a proper matrix. Row and column names are automatically stripped (required by the `tmvtnorm` package).

### 2. Dimensions Must Match
- `betahat`, `deltatrue`, and `tVec` must all have the same length.
- `sigma` must have rows and columns equal to the length of `betahat`.
- These do **not** include the reference period (which is implicitly zero).

### 3. The Reference Period
The `referencePeriod` is the time period omitted in the event-study regression (normalized to 0). If you use `referencePeriod = -1`, then `tVec` should not include `-1`. The function will add the reference period to `df_eventplot` with `betahat = 0`, `deltatrue = 0`, and `se = 0` if it is not already in `tVec`.

### 4. Pre-Period Indices
By default, `prePeriodIndices = which(tVec < referencePeriod)`. If your reference period is not the last pre-treatment period (e.g., it is in the middle of the pre-treatment window), you must specify `prePeriodIndices` manually.

### 5. Interpreting the Results
- **Power near 0.05** (the size of the test) means the pre-test has essentially no ability to detect the hypothesized trend -- the rejection rate is no better than under the null of parallel trends.
- **Power near 1** means the test would almost always detect the hypothesized trend.
- **Bayes Factor close to 1** means passing the pre-test does not meaningfully update beliefs about parallel trends vs. the hypothesized violation.
- **Likelihood Ratio much less than 1** means the observed pre-treatment coefficients are much more consistent with parallel trends than with the hypothesized violation.

### 6. The NIS Pre-Test
The package uses the "no individually significant" (NIS) pre-test: the test rejects if **any** individual pre-treatment coefficient has a t-statistic exceeding 1.96 in absolute value. This is the most common pre-trends test in practice but is not the most powerful test. The threshold is hardcoded at 1.96 in the exported functions.

### 7. Complementary Analysis with HonestDiD
The author recommends also using the [HonestDiD](https://github.com/asheshrambachan/HonestDiD) package for a more complete solution. Rather than relying on the significance of a pre-test, HonestDiD imposes that post-treatment violations of parallel trends are not "too large" relative to pre-treatment violations and forms confidence intervals that account for uncertainty about the magnitude of violations.

### 8. Slope is Always Non-Negative
The `slope_for_power()` function returns a non-negative slope. The search interval is `[0, 8 * max(se)]`. If the target power is too high or too low for the given covariance structure, the root-finding may fail.

### 9. Arbitrary Hypothesized Trends
Although `slope_for_power()` only handles linear trends, the `pretrends()` function accepts any arbitrary `deltatrue` vector. You can specify quadratic, exponential, or any other functional form for the hypothesized violation of parallel trends.

---

## Related Packages

| Package | Relationship |
|---------|-------------|
| [HonestDiD](https://github.com/asheshrambachan/HonestDiD) | Sensitivity analysis for DiD that forms robust confidence intervals rather than relying on pre-test significance. Recommended complement to pretrends. |
| [did](https://github.com/bcallaway11/did) | Callaway and Sant'Anna (2021) estimator. Event-study output can be used as input for pretrends. |
| [fixest](https://github.com/lrberge/fixest) | Fast fixed effects estimation. TWFE event-study coefficients and vcov can be passed to pretrends. |
| [did2s](https://github.com/kylebutts/did2s) | Gardner (2022) two-stage DiD estimator. Output can feed into pretrends. |
| [didimputation](https://github.com/kylebutts/didimputation) | Borusyak, Jaravel, Spiess (2024) imputation estimator for DiD. |
| [sunab (fixest)](https://lrberge.github.io/fixest/) | Sun and Abraham (2021) interaction-weighted estimator via fixest. |
| [mvtnorm](https://CRAN.R-project.org/package=mvtnorm) | Multivariate normal distribution functions (dependency). |
| [tmvtnorm](https://CRAN.R-project.org/package=tmvtnorm) | Truncated multivariate normal distribution functions (dependency). |

---

## References

- Roth, Jonathan. 2022. "Pretest with Caution: Event-Study Estimates after Testing for Parallel Trends." *American Economic Review: Insights*, 4(3): 305-322. [Paper link](https://jonathandroth.github.io/assets/files/roth_pretrends_testing.pdf)
- He, Guojun, and Shaoda Wang. 2017. "Do College Graduates Serving as Village Officials Help Rural China?" *American Economic Journal: Applied Economics*, 9(4): 186-215.
- Companion tools: [Stata package](https://github.com/mcaceresb/stata-pretrends), [Shiny app](https://github.com/jonathandroth/PretrendsPower)
