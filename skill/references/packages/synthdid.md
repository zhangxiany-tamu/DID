# synthdid: Synthetic Difference-in-Difference Estimation

> **Historical reference snapshot.** The version recorded here belongs to this
> snapshot and may differ from the installed package or validation ledger. Use
> [installed help](synthdid_quick_start.md#installed-help-topics) for current
> arguments. This file remains available as a historical fallback.

## Contents
- [Package Overview](#package-overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Function Reference](#function-reference)
- [Datasets](#datasets)
- [Internal (Non-Exported) Functions](#internal-non-exported-functions)
- [Workflows and Recipes](#workflows-and-recipes)
- [Common Pitfalls and Tips](#common-pitfalls-and-tips)
- [Related Packages](#related-packages)
- [References](#references)

## Package Overview
- **Version**: 0.0.9
- **Authors**: Dmitry Arkhangelsky, Susan Athey, David A. Hirshberg (maintainer), Guido W. Imbens, Stefan Wager
- **Maintainer**: David A. Hirshberg <david.a.hirshberg@gmail.com>
- **License**: GPL (>= 2) | BSD_3_clause + file LICENSE
- **Dependencies**: R (>= 3.4), mvtnorm (imported)
- **Suggests**: testthat, ggplot2, CVXR
- **Repository**: https://github.com/synth-inference/synthdid
- **Bug Reports**: https://github.com/synth-inference/synthdid/issues

- **Purpose**: This package implements the Synthetic Difference-in-Differences (SDID) estimator for average treatment effects in panel data, as proposed in Arkhangelsky et al. (2019). The package models outcomes as Y[i,j] = L[i,j] + tau[i,j] * W[i,j] + noise[i,j], where tau[i,j] is the treatment effect and W is a binary treatment indicator. The estimator combines insights from both the synthetic control method and difference-in-differences by constructing data-driven unit weights (omega) and time weights (lambda) to form a weighted double-difference estimator. All treated units must begin treatment simultaneously (block treatment adoption). The package provides three core estimators (SDID, SC, DiD), standard error computation via bootstrap, jackknife, and placebo methods, and a rich set of diagnostic and visualization tools built on ggplot2.

## Installation

```r
# Install from GitHub (recommended for latest version)
remotes::install_github("synth-inference/synthdid")

# Or from a local source
install.packages("synthdid", repos = NULL, type = "source")
```

## Quick Start

```r
library(synthdid)

# Load the California Proposition 99 dataset (cigarette consumption)
data('california_prop99')

# Convert long panel to matrix format
setup <- panel.matrices(california_prop99)

# Estimate the synthetic diff-in-diff treatment effect
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

# Compute standard error (placebo method for single treated unit)
se <- sqrt(vcov(tau.hat, method = 'placebo'))

# Print results
sprintf('point estimate: %1.2f', tau.hat)
sprintf('95%% CI (%1.2f, %1.2f)', tau.hat - 1.96 * se, tau.hat + 1.96 * se)

# Plot the estimate (requires ggplot2)
plot(tau.hat, se.method = 'placebo')
```

---

## Function Reference

### Core Estimators

---

### `synthdid_estimate()`

**Description**: Computes the Synthetic Difference-in-Differences estimate for an average treatment effect on a treated block. This is the main estimator implementing Algorithm 1 from Arkhangelsky et al. (2019). It constructs both unit weights (omega) and time weights (lambda) using a penalized optimization procedure (Frank-Wolfe algorithm), then computes a weighted double-difference estimator.

**Usage**:
```r
synthdid_estimate(
  Y,
  N0,
  T0,
  X = array(dim = c(dim(Y), 0)),
  noise.level = sd(apply(Y[1:N0, 1:T0], 1, diff)),
  eta.omega = ((nrow(Y) - N0) * (ncol(Y) - T0))^(1/4),
  eta.lambda = 1e-06,
  zeta.omega = eta.omega * noise.level,
  zeta.lambda = eta.lambda * noise.level,
  omega.intercept = TRUE,
  lambda.intercept = TRUE,
  weights = list(omega = NULL, lambda = NULL),
  update.omega = is.null(weights$omega),
  update.lambda = is.null(weights$lambda),
  min.decrease = 1e-05 * noise.level,
  max.iter = 10000,
  sparsify = sparsify_function,
  max.iter.pre.sparsify = 100
)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `Y` | matrix | (required) | The N x T observation matrix. Rows 1:N0 are control units; rows (N0+1):N are treated units. Columns 1:T0 are pre-treatment periods; columns (T0+1):T are post-treatment periods. |
| `N0` | integer | (required) | The number of control units (N_co in the paper). |
| `T0` | integer | (required) | The number of pre-treatment time steps (T_pre in the paper). |
| `X` | array | `array(dim=c(dim(Y),0))` | Optional 3-D array of time-varying covariates with shape N x T x C for C covariates. |
| `noise.level` | numeric | `sd(apply(Y[1:N0,1:T0], 1, diff))` | Estimate of the noise standard deviation sigma, computed as the SD of first differences of Y among control units in the pre-treatment period. |
| `eta.omega` | numeric | `((nrow(Y)-N0)*(ncol(Y)-T0))^(1/4)` | Determines the tuning parameter zeta.omega = eta.omega * noise.level. Controls ridge regularization strength for omega weights. Defaults to (N_tr * T_post)^(1/4). |
| `eta.lambda` | numeric | `1e-6` | Analogous to eta.omega but for lambda weights. Defaults to an "infinitesimal" value. |
| `zeta.omega` | numeric | `eta.omega * noise.level` | Direct specification of omega regularization. Overrides the default. Deprecated in favor of eta.omega. |
| `zeta.lambda` | numeric | `eta.lambda * noise.level` | Direct specification of lambda regularization. Overrides the default. Deprecated in favor of eta.lambda. |
| `omega.intercept` | logical | `TRUE` | Whether to include an intercept when estimating omega (unit weights). |
| `lambda.intercept` | logical | `TRUE` | Whether to include an intercept when estimating lambda (time weights). |
| `weights` | list | `list(omega=NULL, lambda=NULL)` | Pre-specified weights. If non-null weights$lambda is passed, they are used instead of estimating lambda. Same for weights$omega. |
| `update.omega` | logical | `is.null(weights$omega)` | If TRUE, solve for omega using weights$omega only as initialization. If FALSE, use exactly as passed. |
| `update.lambda` | logical | `is.null(weights$lambda)` | Analogous to update.omega for lambda weights. |
| `min.decrease` | numeric | `1e-5 * noise.level` | Stopping criterion for the Frank-Wolfe weight estimator. Stops when penalized MSE decrease is smaller than min.decrease^2. |
| `max.iter` | integer | `10000` | Fallback stopping criterion. Maximum number of Frank-Wolfe iterations. |
| `sparsify` | function or NULL | `sparsify_function` | A function mapping a numeric vector to a sparser vector summing to one. Enables a second round of Frank-Wolfe optimization initialized at the sparsified solution. Set to NULL to disable sparsification. |
| `max.iter.pre.sparsify` | integer | `100` | Max iterations for the pre-sparsification first round of optimization. Not used if sparsify=NULL. |

**Returns**: A scalar of class `synthdid_estimate` representing the average treatment effect estimate, with the following attributes:
- `weights`: A list containing `lambda` (time weights), `omega` (unit weights), `beta` (covariate coefficients if X is passed), `vals` (objective function values during optimization), `lambda.vals`, and `omega.vals`.
- `setup`: A list with `Y`, `X`, `N0`, `T0` describing the input problem.
- `opts`: A list of the estimation options used (zeta.omega, zeta.lambda, intercepts, etc.).
- `estimator`: Character string `"synthdid_estimate"`.

**Details**: The estimator works by:
1. Collapsing Y into an (N0+1) x (T0+1) matrix by averaging treated units and post-treatment periods.
2. Estimating lambda weights via Frank-Wolfe on the collapsed matrix to find a synthetic pre-treatment period.
3. Estimating omega weights via Frank-Wolfe on the transposed collapsed matrix to find synthetic control units.
4. Optionally sparsifying weights by zeroing out small components and re-optimizing.
5. Computing the weighted double-difference: `t(c(-omega, 1/N1, ...)) %*% (Y - X.beta) %*% c(-lambda, 1/T1, ...)`.

When covariates X are provided, a joint optimization using Frank-Wolfe for weights and gradient descent for beta coefficients is performed.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)
print(tau.hat)
```

---

### `sc_estimate()`

**Description**: Computes the traditional Synthetic Control (SC) estimate. This is a wrapper around `synthdid_estimate()` that sets lambda weights to zero (no time weighting), disables the omega intercept, and uses only infinitesimal ridge regularization by default.

**Usage**:
```r
sc_estimate(Y, N0, T0, eta.omega = 1e-06, ...)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `Y` | matrix | (required) | The observation matrix (same as synthdid_estimate). |
| `N0` | integer | (required) | The number of control units. |
| `T0` | integer | (required) | The number of pre-treatment time steps. |
| `eta.omega` | numeric | `1e-6` | Ridge regularization level for omega weights. Defaults to infinitesimal. |
| `...` | | | Additional arguments passed to `synthdid_estimate()`. |

**Returns**: An object of class `synthdid_estimate` with `attr(, 'estimator') = "sc_estimate"`. Lambda weights are fixed at zero (uniform across post-treatment, no pre-treatment weighting). Omega intercept is disabled.

**Details**: Internally calls `synthdid_estimate(Y, N0, T0, eta.omega=eta.omega, weights=list(lambda=rep(0, T0)), omega.intercept=FALSE, ...)`. The SC estimator constructs a weighted average of control units that matches the treated unit's pre-treatment trajectory, then uses the post-treatment divergence as the treatment effect estimate.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.sc <- sc_estimate(setup$Y, setup$N0, setup$T0)
print(tau.sc)
```

---

### `did_estimate()`

**Description**: Computes the standard Difference-in-Differences (DiD) estimate. This is a wrapper around `synthdid_estimate()` that fixes both omega and lambda to uniform weights (equal weight to all control units and all pre-treatment periods).

**Usage**:
```r
did_estimate(Y, N0, T0, ...)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `Y` | matrix | (required) | The observation matrix (same as synthdid_estimate). |
| `N0` | integer | (required) | The number of control units. |
| `T0` | integer | (required) | The number of pre-treatment time steps. |
| `...` | | | Additional arguments passed to `synthdid_estimate()`. |

**Returns**: An object of class `synthdid_estimate` with `attr(, 'estimator') = "did_estimate"`. Both omega (1/N0 each) and lambda (1/T0 each) weights are uniform.

**Details**: Internally calls `synthdid_estimate(Y, N0, T0, weights=list(lambda=rep(1/T0, T0), omega=rep(1/N0, N0)), ...)`. This produces the classic two-way fixed effects DiD estimator.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.did <- did_estimate(setup$Y, setup$N0, setup$T0)
print(tau.did)
```

---

### Post-Estimation Functions

---

### `synthdid_effect_curve()`

**Description**: Outputs the period-by-period treatment effect curve that was averaged to produce the overall SDID estimate. Each element corresponds to a post-treatment time period.

**Usage**:
```r
synthdid_effect_curve(estimate)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `estimate` | synthdid_estimate | (required) | An estimate as output by `synthdid_estimate()`, `sc_estimate()`, or `did_estimate()`. |

**Returns**: A numeric vector of length T1 (number of post-treatment periods), where each element is the estimated treatment effect for that post-treatment period. The overall SDID estimate is the simple average of these values.

**Details**: Computes `tau.sc = t(c(-omega, 1/N1, ...)) %*% (Y - X.beta)` for each period, then subtracts the lambda-weighted pre-treatment average: `tau.curve[t] = tau.sc[T0+t] - sum(tau.sc[1:T0] * lambda)`.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)
effect.curve <- synthdid_effect_curve(tau.hat)
plot(effect.curve, type = 'l', xlab = 'Post-treatment period', ylab = 'Effect')
```

---

### `synthdid_placebo()`

**Description**: Computes a placebo variant of the estimator using only pre-treatment data. A fraction of the pre-treatment periods are treated as if they were the post-treatment period, providing a diagnostic check for pre-treatment fit.

**Usage**:
```r
synthdid_placebo(estimate, treated.fraction = NULL)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `estimate` | synthdid_estimate | (required) | An estimate as output by `synthdid_estimate()`, `sc_estimate()`, or `did_estimate()`. |
| `treated.fraction` | numeric or NULL | `NULL` | The fraction of pre-treatment data to use as a placebo treatment period. NULL defaults to the original fraction of post-treatment to total periods: `1 - T0/ncol(Y)`. |

**Returns**: A `synthdid_estimate` object computed on the pre-treatment subset, using the same estimator type (SDID, SC, or DiD) and options as the original estimate.

**Details**: The placebo T0 is computed as `floor(T0 * (1 - treated.fraction))`. The estimator is then re-run on `Y[, 1:T0]` with this placebo T0. This tests whether the method would find a spurious effect in the pre-treatment period. A well-calibrated estimator should produce placebo estimates close to zero.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)
placebo <- synthdid_placebo(tau.hat)
print(placebo)  # Should be close to zero
```

---

### `synthdid_controls()`

**Description**: Outputs a table of important synthetic control units (or time periods) and their corresponding weights, sorted by weight in descending order. The table is truncated to exclude units/periods whose cumulative weight exceeds a threshold.

**Usage**:
```r
synthdid_controls(estimates, sort.by = 1, mass = 0.9, weight.type = "omega")
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `estimates` | synthdid_estimate or list | (required) | A single estimate or a list of estimates from `synthdid_estimate()`. |
| `sort.by` | integer | `1` | The index of the estimate to sort by (when multiple estimates are passed). |
| `mass` | numeric | `0.9` | Controls table length. For each estimate, truncated controls have total weight no larger than 1-mass. |
| `weight.type` | character | `"omega"` | `"omega"` for unit weights, `"lambda"` for time period weights. |

**Returns**: A matrix with one row per control unit (or time period) and one column per estimate. Rows are sorted by weight (descending, by the estimate indicated by `sort.by`). Row names are unit names (from `rownames(Y)`) or time period names (from `colnames(Y)`).

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

# Show top control units and their weights
synthdid_controls(tau.hat, weight.type = 'omega')

# Show time period weights
synthdid_controls(tau.hat, weight.type = 'lambda')

# Compare across estimators
tau.sc <- sc_estimate(setup$Y, setup$N0, setup$T0)
tau.did <- did_estimate(setup$Y, setup$N0, setup$T0)
estimates <- list(DID = tau.did, SC = tau.sc, SDID = tau.hat)
synthdid_controls(estimates, weight.type = 'omega')
```

---

### Standard Errors and Inference

---

### `vcov.synthdid_estimate()`

**Description**: Computes the variance-covariance matrix (a scalar variance, returned as a 1x1 matrix) for a synthdid_estimate object. Provides three methods for variance estimation corresponding to Algorithms 2-4 in Arkhangelsky et al.

**Usage**:
```r
## S3 method for class 'synthdid_estimate'
vcov(object, method = c("bootstrap", "jackknife", "placebo"), replications = 200, ...)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `object` | synthdid_estimate | (required) | A fitted synthdid model object. |
| `method` | character | `"bootstrap"` | The variance estimation method. One of `"bootstrap"` (Algorithm 2), `"jackknife"` (Algorithm 3), or `"placebo"` (Algorithm 4). |
| `replications` | integer | `200` | Number of bootstrap or placebo replications. Not used for jackknife. |
| `...` | | | Additional arguments (currently ignored). |

**Returns**: A 1x1 matrix containing the estimated variance (se^2). To get the standard error, use `sqrt(vcov(object))`.

**Details**:
- **Bootstrap** (Algorithm 2): Resamples units with replacement, re-normalizing omega weights. Returns `sqrt((R-1)/R) * sd(bootstrap.estimates)`. Returns NA if there is only one treated unit.
- **Jackknife** (Algorithm 3): Uses leave-one-unit-out estimates with fixed weights (no re-estimation). Not recommended for SC estimates (see Section 5 of the paper). Returns NA if there is one treated unit or one control with nonzero weight.
- **Placebo** (Algorithm 4): Randomly reassigns treatment among control units, re-estimating each time. The only method that works for a single treated unit. Requires more control than treated units.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

# Placebo SE (only option for single treated unit)
se <- sqrt(vcov(tau.hat, method = 'placebo'))
sprintf('95%% CI (%1.2f, %1.2f)', tau.hat - 1.96 * se, tau.hat + 1.96 * se)

# Bootstrap SE (may be slow on large datasets; NA for single treated unit)
# se.boot <- sqrt(vcov(tau.hat, method = 'bootstrap'))

# Jackknife SE (fastest; not recommended for SC)
# se.jack <- sqrt(vcov(tau.hat, method = 'jackknife'))
```

---

### `synthdid_se()`

**Description**: *Deprecated.* Convenience wrapper that computes the standard error directly. Use `sqrt(vcov(estimate, ...))` instead.

**Usage**:
```r
synthdid_se(...)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `...` | | | Any valid arguments for `vcov.synthdid_estimate()`. |

**Returns**: A scalar standard error (the square root of the variance).

---

### Data Preparation

---

### `panel.matrices()`

**Description**: Converts a long (balanced) panel data frame to the wide matrix format required by synthdid estimators. The input should be a data frame with columns for unit, time, outcome, and treatment indicator. Requires a balanced panel with simultaneous treatment adoption.

**Usage**:
```r
panel.matrices(panel, unit = 1, time = 2, outcome = 3, treatment = 4, treated.last = TRUE)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `panel` | data.frame | (required) | A data frame with columns for unit, time, outcome, and treatment indicator. |
| `unit` | integer or character | `1` | Column number or name for the unit identifier. |
| `time` | integer or character | `2` | Column number or name for the time identifier. |
| `outcome` | integer or character | `3` | Column number or name for the outcome variable. |
| `treatment` | integer or character | `4` | Column number or name for the binary treatment status (0/1). |
| `treated.last` | logical | `TRUE` | If TRUE, sort rows so control units appear before treated units. If FALSE, sort by unit name/number. |

**Returns**: A list with:
- `Y`: N x T outcome matrix with unit names as rownames and time periods as colnames.
- `N0`: Integer, the number of control units.
- `T0`: Integer, the number of pre-treatment time periods.
- `W`: N x T binary treatment indicator matrix.

**Details**: The function validates that:
- The panel is balanced (every unit observed at every time).
- Treatment status is binary (0/1).
- There is variation in treatment.
- Treatment adoption is simultaneous (all treated units start treatment at the same time).

Factor and Date columns are automatically converted to character. Missing values cause an error.

**Examples**:
```r
data("california_prop99")
setup <- panel.matrices(california_prop99, unit = 1, time = 2, outcome = 3, treatment = 4)
# Or equivalently using column names:
setup <- panel.matrices(california_prop99, unit = "State", time = "Year",
                        outcome = "PacksPerCapita", treatment = "treated")
dim(setup$Y)   # N x T matrix
setup$N0       # Number of control units
setup$T0       # Number of pre-treatment periods
```

---

### `timesteps()`

**Description**: Extracts timesteps (column names) from a panel outcome matrix Y, interpreting them as Date objects if possible.

**Usage**:
```r
timesteps(Y)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `Y` | matrix | (required) | An outcome matrix with column names representing time periods. |

**Returns**: A vector of Date objects if `colnames(Y)` are convertible via `as.Date()`, otherwise the raw column names as characters.

**Details**: Column names in R matrices cannot be Date objects, so synthdid uses strings. This function attempts `as.Date(colnames(Y))` and falls back to returning the raw column names on error. The plotting functions in synthdid use this to display dates correctly on axes.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
timesteps(setup$Y)  # Returns character years "1970", "1971", ...
```

---

### Visualization Functions

All plotting functions require the `ggplot2` package to be installed. They return ggplot objects that can be further customized with standard ggplot2 operations.

---

### `synthdid_plot()`

**Description**: Plots treated and synthetic control trajectories and overlays a 2x2 diff-in-diff diagram. The treatment effect is indicated by an arrow. The time weights (lambda) are shown as a ribbon below the trajectories. Supports plotting multiple estimates in facets or overlaid. For SC estimates (lambda = 0), plots trajectories and effect without the parallelogram diagram.

**Usage**:
```r
synthdid_plot(
  estimates,
  treated.name = "treated",
  control.name = "synthetic control",
  spaghetti.units = c(),
  spaghetti.matrices = NULL,
  facet = NULL,
  facet.vertical = TRUE,
  lambda.comparable = !is.null(facet),
  overlay = 0,
  lambda.plot.scale = 3,
  trajectory.linetype = 1,
  effect.curvature = 0.3,
  line.width = 0.5,
  guide.linetype = 2,
  point.size = 1,
  trajectory.alpha = 0.5,
  diagram.alpha = 0.95,
  effect.alpha = 0.95,
  onset.alpha = 0.3,
  ci.alpha = 0.3,
  spaghetti.line.width = 0.2,
  spaghetti.label.size = 2,
  spaghetti.line.alpha = 0.3,
  spaghetti.label.alpha = 0.5,
  se.method = "jackknife",
  alpha.multiplier = NULL
)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `estimates` | synthdid_estimate or list | (required) | A single estimate or named list of estimates. |
| `treated.name` | character | `"treated"` | Legend label for the treated curve. |
| `control.name` | character | `"synthetic control"` | Legend label for the control curve. |
| `spaghetti.units` | character vector | `c()` | Unit names (must be in `rownames(Y)`) to plot as individual trajectories. |
| `spaghetti.matrices` | list of matrices | `NULL` | Custom trajectory matrices (one per estimate) with named rows. |
| `facet` | vector or NULL | `NULL` | Facet assignment for each estimate. NULL = one facet per estimate. Same value = same facet (overlay). |
| `facet.vertical` | logical | `TRUE` | Stack facets vertically (TRUE) or horizontally (FALSE). |
| `lambda.comparable` | logical | `!is.null(facet)` | If TRUE, lambda ribbons have comparable scale across facets. |
| `overlay` | numeric [0,1] | `0` | Shifts the control trajectory toward treated. 0 = no shift, 1 = full overlay (suppresses diagram). |
| `lambda.plot.scale` | numeric | `3` | Scale factor for the lambda weight ribbon height. |
| `trajectory.linetype` | integer | `1` | Linetype for trajectory lines. |
| `effect.curvature` | numeric | `0.3` | Curvature of effect arrows (helps avoid overplotting). |
| `line.width` | numeric | `0.5` | Width of lines in the plot. |
| `guide.linetype` | integer | `2` | Linetype for the vertical parallelogram segments. |
| `point.size` | numeric | `1` | Size of parallelogram corner points. |
| `trajectory.alpha` | numeric | `0.5` | Transparency of trajectories. |
| `diagram.alpha` | numeric | `0.95` | Transparency of the DiD diagram overlay. |
| `effect.alpha` | numeric | `0.95` | Transparency of effect arrows. |
| `onset.alpha` | numeric | `0.3` | Transparency of vertical treatment onset line. |
| `ci.alpha` | numeric | `0.3` | Transparency of 95% CI bound arrows. |
| `spaghetti.line.width` | numeric | `0.2` | Width of spaghetti trajectory lines. |
| `spaghetti.label.size` | numeric | `2` | Text size of spaghetti trajectory labels. |
| `spaghetti.line.alpha` | numeric | `0.3` | Transparency of spaghetti trajectories. |
| `spaghetti.label.alpha` | numeric | `0.5` | Transparency of spaghetti labels. |
| `se.method` | character | `"jackknife"` | Method for SE used in CI arrows. `"none"` suppresses the CI. |
| `alpha.multiplier` | numeric vector | `NULL` (all ones) | Per-estimate alpha multiplier for highlighting specific estimates. |

**Returns**: A ggplot object.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

# Basic plot
synthdid_plot(tau.hat, se.method = 'placebo')

# Compare estimators side by side
tau.sc <- sc_estimate(setup$Y, setup$N0, setup$T0)
tau.did <- did_estimate(setup$Y, setup$N0, setup$T0)
estimates <- list('Diff-in-Diff' = tau.did, 'Synthetic Control' = tau.sc, 'SDID' = tau.hat)
synthdid_plot(estimates, se.method = 'placebo')

# Spaghetti plot with top control units
top.controls <- synthdid_controls(tau.hat)[1:10, , drop = FALSE]
synthdid_plot(tau.hat, spaghetti.units = rownames(top.controls))

# Overlay control onto treated to assess parallel trends
synthdid_plot(tau.hat, overlay = 1, se.method = 'placebo')
```

---

### `plot.synthdid_estimate()`

**Description**: S3 plot method for `synthdid_estimate` objects. Dispatches to `synthdid_plot()`.

**Usage**:
```r
## S3 method for class 'synthdid_estimate'
plot(x, ...)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `x` | synthdid_estimate | (required) | The estimate object to plot. |
| `...` | | | Additional arguments passed to `synthdid_plot()`. |

**Returns**: A ggplot object.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)
plot(tau.hat, se.method = 'placebo')
```

---

### `synthdid_units_plot()`

**Description**: Plots unit-by-unit difference-in-differences contributions. Dot size indicates each unit's omega weight. The overall estimate and 95% CI endpoints are shown as horizontal lines. Units with negligible weights are displayed as small, transparent x marks.

**Usage**:
```r
synthdid_units_plot(
  estimates,
  negligible.threshold = 0.001,
  negligible.alpha = 0.3,
  se.method = "jackknife",
  units = NULL
)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `estimates` | synthdid_estimate or list | (required) | A single estimate or list of estimates. |
| `negligible.threshold` | numeric | `0.001` | Weight threshold below which units are plotted as x marks instead of circles. |
| `negligible.alpha` | numeric | `0.3` | Transparency of negligible-weight unit marks. |
| `se.method` | character | `"jackknife"` | SE method for CI lines. `"none"` suppresses the CI. |
| `units` | character vector or NULL | `NULL` | Specific control unit names to plot. NULL plots all. |

**Returns**: A ggplot object.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

synthdid_units_plot(tau.hat, se.method = 'placebo')

# Restrict to top 10 controls
top.controls <- synthdid_controls(tau.hat)[1:10, , drop = FALSE]
synthdid_units_plot(tau.hat, units = rownames(top.controls))
```

---

### `synthdid_placebo_plot()`

**Description**: Plots the actual estimate alongside a placebo estimate (computed from pre-treatment data only), showing both treated/synthetic control trajectories with overlaid DiD diagrams.

**Usage**:
```r
synthdid_placebo_plot(estimate, overlay = FALSE, treated.fraction = NULL)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `estimate` | synthdid_estimate | (required) | An estimate as output by `synthdid_estimate()`. |
| `overlay` | logical | `FALSE` | If TRUE, overlay both estimates in one facet; if FALSE, separate facets. |
| `treated.fraction` | numeric or NULL | `NULL` | Fraction of pre-treatment data for placebo (see `synthdid_placebo()`). |

**Returns**: A ggplot object.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)
synthdid_placebo_plot(tau.hat)
synthdid_placebo_plot(tau.hat, overlay = TRUE)
```

---

### `synthdid_rmse_plot()`

**Description**: Diagnostic plot showing the regularized RMSE (objective function) as a function of Frank-Wolfe / gradient step iterations during weight optimization. Useful for diagnosing convergence of the weight estimation procedure.

**Usage**:
```r
synthdid_rmse_plot(estimates)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `estimates` | synthdid_estimate or list | (required) | A single estimate or named list of estimates. |

**Returns**: A ggplot object with log-scaled y-axis showing RMSE vs. iteration number.

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)
synthdid_rmse_plot(tau.hat)
```

---

### S3 Methods

---

### `summary.synthdid_estimate()`

**Description**: Produces a comprehensive summary of a synthdid estimate, including the point estimate, standard error, top control units and time period weights, and effective sample sizes.

**Usage**:
```r
## S3 method for class 'synthdid_estimate'
summary(object, weight.digits = 3, fast = FALSE, ...)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `object` | synthdid_estimate | (required) | The estimate to summarize. |
| `weight.digits` | integer | `3` | Number of decimal digits for displaying weights. |
| `fast` | logical | `FALSE` | If TRUE, uses jackknife instead of bootstrap for SE (faster but potentially less accurate). |
| `...` | | | Additional arguments (currently ignored). |

**Returns**: A list with:
- `estimate`: The scalar point estimate.
- `se`: The standard error (bootstrap by default, jackknife if fast=TRUE).
- `controls`: Matrix of top unit weights (from `synthdid_controls(..., weight.type='omega')`).
- `periods`: Matrix of top time weights (from `synthdid_controls(..., weight.type='lambda')`).
- `dimensions`: Named vector with N1, N0, N0.effective, T1, T0, T0.effective. Effective sizes are computed as 1/sum(weights^2).

**Examples**:
```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)
print(summary(tau.hat))
```

---

### `print.synthdid_estimate()`

**Description**: Print method for synthdid_estimate objects. Displays a one-line formatted summary.

**Usage**:
```r
## S3 method for class 'synthdid_estimate'
print(x, ...)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `x` | synthdid_estimate | (required) | The estimate to print. |
| `...` | | | Additional arguments (currently ignored). |

**Returns**: Invisibly returns NULL. Prints a formatted string like: `synthdid: -15.604 +- 11.801. Effective N0/N0 = 4.5/38~0.1. Effective T0/T0 = 6.4/19~0.3. N1,T1 = 1,12.`

---

### `format.synthdid_estimate()`

**Description**: Format method for synthdid_estimate objects. Returns a formatted summary string.

**Usage**:
```r
## S3 method for class 'synthdid_estimate'
format(x, ...)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `x` | synthdid_estimate | (required) | The estimate to format. |
| `...` | | | Additional arguments (currently ignored). |

**Returns**: A character string containing the point estimate, 95% CI half-width, effective/total N0 and T0, and N1, T1 dimensions.

---

### Simulation and Placebo Study Functions

These functions support the Monte Carlo simulation studies described in Sections 3 and 5 of Arkhangelsky et al. (2019).

---

### `estimate_dgp()`

**Description**: Estimates the data generating process (DGP) parameters used in placebo studies. Decomposes the observed outcome matrix into fixed effects (F), interactive fixed effects (M), and noise (E) components, then estimates an AR(2) noise covariance and treatment assignment probabilities.

**Usage**:
```r
estimate_dgp(Y, assignment_vector, rank)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `Y` | matrix | (required) | An N x T matrix of outcomes. |
| `assignment_vector` | vector | (required) | An N x 1 binary vector of treatment assignments. |
| `rank` | integer | (required) | The rank of the estimated signal component L = F + M. |

**Returns**: A list with:
- `F`: N x T matrix of additive fixed effects.
- `M`: N x T matrix of interactive fixed effects.
- `Sigma`: T x T noise covariance matrix (AR(2)-based).
- `pi`: N-length vector of treatment assignment probabilities (from logistic regression on unit factors).
- `ar_coef`: 2-length vector of AR(2) coefficients.

**Details**: The method normalizes Y, performs SVD to extract rank-r signal, decomposes it into additive (F) and interactive (M) components, fits an AR(2) model to residuals, and estimates assignment probabilities via logistic regression on the first `rank` left singular vectors.

---

### `simulate_dgp()`

**Description**: Simulates data from the DGP specification estimated by `estimate_dgp()`. Generates panel data with the specified signal and noise structure, randomly assigns treatment, and returns the data in the matrix format expected by synthdid estimators.

**Usage**:
```r
simulate_dgp(parameters, N1, T1)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `parameters` | list | (required) | DGP parameters (F, M, Sigma, pi) as output by `estimate_dgp()`. |
| `N1` | integer | (required) | Cap on the number of treated units. |
| `T1` | integer | (required) | Number of treated (post-treatment) periods. |

**Returns**: A list with:
- `Y`: N x T outcome matrix (control units first, treated units last).
- `N0`: Number of control units.
- `T0`: Number of pre-treatment periods (T - T1).

---

### `randomize_treatment()`

**Description**: Randomly assigns treatment to N units with unit-specific probabilities pi, enforcing a cap N1 on the number of treated units and ensuring at least one unit is treated.

**Usage**:
```r
randomize_treatment(pi, N, N1)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pi` | numeric vector | (required) | Treatment assignment probabilities for each unit. |
| `N` | integer | (required) | Total number of units. |
| `N1` | integer | (required) | Maximum number of treated units. |

**Returns**: A binary vector of length N, with 1 indicating treatment assignment.

---

### `decompose_Y()`

**Description**: Decomposes the outcome matrix Y into additive fixed effects (F), interactive fixed effects (M), and residuals (E) via SVD, as described in Section 3.1.1 of the paper.

**Usage**:
```r
decompose_Y(Y, rank)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `Y` | matrix | (required) | N x T outcome matrix. |
| `rank` | integer | (required) | Assumed rank of the signal component L = F + M. |

**Returns**: A list with:
- `F`: N x T matrix of additive effects (row + column means - grand mean of L).
- `M`: N x T matrix of interactive effects (L - F).
- `E`: N x T residual matrix (Y - L).
- `unit_factors`: N x rank matrix of unit factors (scaled left singular vectors).

---

### `fit_ar2()`

**Description**: Estimates AR(2) coefficients from a matrix of time series (rows are independent series).

**Usage**:
```r
fit_ar2(E)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `E` | matrix | (required) | N x T matrix with independent time series as rows. |

**Returns**: A 2-element numeric vector: `c(lag-1-coefficient, lag-2-coefficient)`.

---

### `ar2_correlation_matrix()`

**Description**: Computes the T x T correlation matrix for a stationary AR(2) process.

**Usage**:
```r
ar2_correlation_matrix(ar_coef, T)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ar_coef` | numeric vector | (required) | AR(2) coefficients: `c(lag-1-coefficient, lag-2-coefficient)`. |
| `T` | integer | (required) | Length of the time series. |

**Returns**: A T x T correlation matrix.

---

### `lindsey_density_estimate()`

**Description**: Computes a nonparametric density estimate by smoothing a histogram using Poisson regression with natural splines. Implementation of "Lindsey's method" from Efron and Hastie (2016).

**Usage**:
```r
lindsey_density_estimate(x, K, deg)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `x` | numeric vector | (required) | One-dimensional data. |
| `K` | integer | (required) | Number of bins in the histogram. |
| `deg` | integer | (required) | Degree of natural splines used in Poisson regression. |

**Returns**: A list with:
- `centers`: K-length vector of bin centers.
- `density`: K-length vector of estimated density values at each bin center.

**Details**: The range is extended 20% beyond the data range on each side. A histogram is computed, then smoothed by fitting a Poisson GLM with natural spline basis on bin centers.

---

### Utility Functions

---

### `sparsify_function()`

**Description**: Default sparsification function used by `synthdid_estimate()`. Zeros out weights that are less than 1/4 of the maximum weight, then re-normalizes to sum to one.

**Usage**:
```r
sparsify_function(v)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `v` | numeric vector | (required) | A weight vector. |

**Returns**: A sparser numeric vector of the same length, summing to one.

**Details**: The function sets `v[v <= max(v)/4] = 0` and returns `v/sum(v)`. This promotes sparsity in the estimated weights by removing small contributions.

---

## Datasets

### `california_prop99`

**Description**: Per-capita cigarette consumption (in packs) for US states from 1970 to 2000. In 1989, California imposed a tobacco tax (Proposition 99). This is the canonical example dataset for the package.

**Format**: A data frame with 1209 rows and 4 variables:

| Variable | Type | Description |
|----------|------|-------------|
| `State` | character | US state name |
| `Year` | integer | Year (1970-2000) |
| `PacksPerCapita` | numeric | Per-capita cigarette consumption |
| `treated` | numeric | Treatment indicator (1 for California after 1988) |

**Source**: Abadie, Diamond, and Hainmueller (2010). "Synthetic control methods for comparative case studies: Estimating the effect of California's tobacco control program." JASA 105(490): 493-505.

**Usage**: `data(california_prop99)`

---

### `CPS`

**Description**: Current Population Survey data used in the placebo simulation studies.

**Format**: A data frame with 2000 rows and 8 variables:

| Variable | Type | Description |
|----------|------|-------------|
| `state` | | State identifier |
| `year` | | Year |
| `log_wage` | | Log wage |
| `hours` | | Hours worked |
| `urate` | | Unemployment rate |
| `min_wage` | | Minimum wage treatment indicator |
| `open_carry` | | Open carry law treatment indicator |
| `abort_ban` | | Abortion ban treatment indicator |

**Usage**: `data(CPS)`

---

### `PENN`

**Description**: Penn World Table data used in the placebo simulation studies.

**Format**: A data frame with 3219 rows and 5 variables:

| Variable | Type | Description |
|----------|------|-------------|
| `country` | | Country identifier |
| `year` | | Year |
| `log_gdp` | | Log GDP |
| `dem` | | Democracy treatment indicator |
| `educ` | | Education treatment indicator |

**Usage**: `data(PENN)`

---

## Internal (Non-Exported) Functions

These functions are used internally but are important for understanding the package's implementation.

### `sc.weight.fw()`
Frank-Wolfe solver for synthetic control weights using exact line search. Minimizes `||Y[,1:T0] %*% lambda - Y[,T0+1]||^2 + zeta^2 * N0 * ||lambda||^2` subject to lambda in the unit simplex.

### `sc.weight.fw.covariates()`
Joint Frank-Wolfe + gradient solver for lambda, omega, and beta when covariates X are present. Uses Frank-Wolfe steps for simplex-constrained weights and (1/t) gradient steps for beta.

### `fw.step()`
A single Frank-Wolfe step with exact line search for minimizing `||Ax - b||^2 + eta * ||x||^2` over the unit simplex.

### `collapsed.form()`
Collapses Y to an (N0+1) x (T0+1) matrix by averaging the treated units (last N1 rows) and post-treatment periods (last T1 columns).

### `contract3()`
Contracts a 3-D array X along its third dimension using coefficient vector v: `sum_k v[k] * X[,,k]`.

### `sum_normalize()`
Normalizes a vector to sum to one. Returns uniform weights if the input sums to zero.

### `pairwise.sum.decreasing()`
Component-wise sum of two decreasing vectors where NA indicates the vector has stopped decreasing.

---

## Workflows and Recipes

### Basic Estimation Workflow

```r
library(synthdid)

# 1. Load and prepare data
data('california_prop99')
setup <- panel.matrices(california_prop99)

# 2. Estimate treatment effect
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

# 3. Get standard error
se <- sqrt(vcov(tau.hat, method = 'placebo'))

# 4. Report results
sprintf('Estimate: %1.2f (SE: %1.2f)', tau.hat, se)
sprintf('95%% CI: (%1.2f, %1.2f)', tau.hat - 1.96*se, tau.hat + 1.96*se)
```

### Comparing All Three Estimators

```r
data('california_prop99')
setup <- panel.matrices(california_prop99)

tau.sdid <- synthdid_estimate(setup$Y, setup$N0, setup$T0)
tau.sc   <- sc_estimate(setup$Y, setup$N0, setup$T0)
tau.did  <- did_estimate(setup$Y, setup$N0, setup$T0)

estimates <- list('Diff-in-Diff' = tau.did,
                  'Synthetic Control' = tau.sc,
                  'Synthetic Diff-in-Diff' = tau.sdid)

# Side-by-side trajectory plots
synthdid_plot(estimates, se.method = 'placebo')

# Unit contribution comparison
synthdid_units_plot(estimates, se.method = 'placebo')

# Weight comparison table
synthdid_controls(estimates, weight.type = 'omega')
synthdid_controls(estimates, weight.type = 'lambda')
```

### Inspecting Weights

```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

# Extract weights directly
weights <- attr(tau.hat, 'weights')
omega <- weights$omega     # unit weights (length N0)
lambda <- weights$lambda   # time weights (length T0)

# Summarize
cat('Top 5 control unit weights:\n')
print(head(sort(omega, decreasing = TRUE), 5))
cat('Number of nonzero unit weights:', sum(omega > 0), '\n')
cat('Effective N0:', round(1/sum(omega^2), 1), '\n')
```

### Effect Curve Over Time

```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

# Get period-by-period effects
effects <- synthdid_effect_curve(tau.hat)
post.years <- as.integer(colnames(setup$Y)[(setup$T0+1):ncol(setup$Y)])
plot(post.years, effects, type = 'b',
     xlab = 'Year', ylab = 'Treatment Effect',
     main = 'Period-by-Period Treatment Effects')
abline(h = 0, lty = 2)
abline(h = c(tau.hat), col = 'red', lty = 2)
```

### Pre-Treatment Placebo Check

```r
data('california_prop99')
setup <- panel.matrices(california_prop99)
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

# Visual placebo check
synthdid_placebo_plot(tau.hat)

# Numeric placebo
placebo <- synthdid_placebo(tau.hat)
cat('Placebo estimate:', c(placebo), '\n')
cat('Actual estimate:', c(tau.hat), '\n')
```

### Using Dates as Timesteps

```r
data(california_prop99)
california_prop99$date <- as.Date(sprintf('%04d/%02d/%02d', california_prop99$Year, 1, 1))
setup <- panel.matrices(california_prop99, time = 'date')
estimate <- synthdid_estimate(setup$Y, setup$N0, setup$T0)
plot(estimate)  # x-axis will display dates correctly
```

### Customizing Plots to Match Paper Style

```r
library(ggplot2)
data('california_prop99')
setup <- panel.matrices(california_prop99)

tau.sdid <- synthdid_estimate(setup$Y, setup$N0, setup$T0)
tau.sc   <- sc_estimate(setup$Y, setup$N0, setup$T0)
tau.did  <- did_estimate(setup$Y, setup$N0, setup$T0)
estimates <- list('Diff-in-Diff' = tau.did,
                  'Synthetic Control' = tau.sc,
                  'Synthetic Diff-in-Diff' = tau.sdid)

# Reproduce Figure 1 from Arkhangelsky et al.
synthdid_plot(estimates, facet.vertical = FALSE,
              control.name = 'control', treated.name = 'california',
              lambda.comparable = TRUE, se.method = 'none',
              trajectory.linetype = 1, line.width = .75, effect.curvature = -.4,
              trajectory.alpha = .7, effect.alpha = .7,
              diagram.alpha = 1, onset.alpha = .7) +
    theme(legend.position = c(.26, .07), legend.direction = 'horizontal',
          legend.key = element_blank(), legend.background = element_blank(),
          strip.background = element_blank(), strip.text.x = element_blank())
```

### De-meaned Synthetic Control (DIFP Estimator)

```r
# Ferman and Pinto / Doudchenko and Imbens variant
data('california_prop99')
setup <- panel.matrices(california_prop99)

# Fix lambda to uniform (like DiD) but estimate omega with infinitesimal regularization
difp_estimate <- synthdid_estimate(setup$Y, setup$N0, setup$T0,
                                    weights = list(lambda = rep(1/setup$T0, setup$T0)),
                                    eta.omega = 1e-6)

# With SDID-style regularization
difp_estimate_reg <- synthdid_estimate(setup$Y, setup$N0, setup$T0,
                                        weights = list(lambda = rep(1/setup$T0, setup$T0)))
```

### Placebo Simulation Study

```r
# Estimate DGP from data
data(CPS)
Y.logwage <- panel.matrices(CPS, treatment = 'min_wage', outcome = 'log_wage', treated.last = FALSE)$Y
w.minwage <- panel.matrices(CPS, treatment = 'min_wage', treated.last = FALSE)$W
w.minwage <- apply(w.minwage, 1, any)

params <- estimate_dgp(Y.logwage, w.minwage, rank = 4)

# Simulate and estimate
sim.data <- simulate_dgp(params, N1 = 10, T1 = 10)
tau.sim <- synthdid_estimate(sim.data$Y, sim.data$N0, sim.data$T0)
```

---

## Common Pitfalls and Tips

### Data Requirements
- **Balanced panel required**: Every unit must be observed at every time period. `panel.matrices()` will throw an error if the panel is unbalanced.
- **Simultaneous treatment adoption**: All treated units must begin treatment at the same time. Staggered adoption is not supported. This is enforced by `panel.matrices()`.
- **Binary treatment**: The treatment variable must contain only 0 and 1. Non-binary values cause an error.
- **No missing values**: `panel.matrices()` does not accept NA values in any column.

### Standard Error Method Selection
- **Single treated unit**: Only `method = 'placebo'` works for a single treated unit (like the California Proposition 99 example). Bootstrap and jackknife return NA.
- **Jackknife not recommended for SC**: The jackknife SE estimator is not recommended for synthetic control estimates (see Section 5 of Arkhangelsky et al.). It works well for SDID and DiD.
- **Bootstrap can be slow**: The bootstrap (`method = 'bootstrap'`) is the default but can be slow on large datasets. Use `method = 'jackknife'` for speed, or pass `fast = TRUE` to `summary()`.
- **Placebo requires more controls than treated**: The placebo SE method requires `N0 > N1` (more control units than treated units).

### Weight Interpretation
- **Effective sample size**: The "effective N0" reported by `print()` and `summary()` is `1/sum(omega^2)`, measuring how concentrated the weights are. A value close to N0 means weights are diffuse; a value close to 1 means one unit dominates.
- **Sparsification**: By default, weights below 1/4 of the maximum are zeroed out via `sparsify_function()`. This promotes interpretability. Set `sparsify = NULL` to disable.
- **Lambda = 0 means SC**: When all lambda weights are zero (as in `sc_estimate()`), the estimator reduces to standard synthetic control. The plotting functions detect this and suppress the parallelogram diagram.

### Performance Tips
- **Large max.iter values**: The default `max.iter = 10000` is conservative. For large panels, you may want to reduce it or increase `min.decrease`.
- **Use synthdid_rmse_plot()** to diagnose convergence of the Frank-Wolfe optimization.
- **CVXR reference solver**: The package includes reference implementations using CVXR (convex optimization) in `reference-solver.R`, but these are not exported. The Frank-Wolfe solver is used by default and is much faster.

### Covariate Support
- Covariates X must be provided as a 3-D array with dimensions matching Y: N x T x C.
- When covariates are present, the solver jointly optimizes omega, lambda, and regression coefficients beta using a combined Frank-Wolfe and gradient descent approach.

### Plotting Requirements
- All plotting functions require `ggplot2` to be installed. They will error with a helpful message if it is not available.
- Plot outputs are standard ggplot objects and can be customized with `+` operators (themes, labels, scales, etc.).
- When comparing multiple estimates, pass a named list to get labeled facets.

---

## Related Packages

| Package | Method | Relationship to synthdid |
|---------|--------|--------------------------|
| **[Synth](https://CRAN.R-project.org/package=Synth)** | Original Synthetic Control (Abadie et al.) | synthdid's `sc_estimate()` implements the same estimator with a different solver (Frank-Wolfe vs. quadratic programming). |
| **[gsynth](https://CRAN.R-project.org/package=gsynth)** | Generalized Synthetic Control (Xu 2017) | Uses factor models for counterfactual estimation; supports staggered adoption unlike synthdid. |
| **[did](https://CRAN.R-project.org/package=did)** | Callaway and Sant'Anna (2021) DiD | Handles staggered treatment with group-time ATTs; synthdid handles only simultaneous adoption. |
| **[did2s](https://CRAN.R-project.org/package=did2s)** | Gardner (2022) Two-Stage DiD | Imputation-based DiD for staggered adoption. |
| **[MCPanel](https://github.com/susanathey/MCPanel)** | Matrix Completion (Athey et al. 2021) | Nuclear norm penalized matrix completion; used in the synthdid paper as a comparison estimator. |
| **[augsynth](https://github.com/ebenmichael/augsynth)** | Augmented Synthetic Control | Ridge-augmented SC with automatic regularization; supports staggered adoption. |
| **[DRDID](https://CRAN.R-project.org/package=DRDID)** | Doubly Robust DiD | Sant'Anna and Zhao (2020); focuses on repeated cross-sections and two-period settings. |

---

## References

- Arkhangelsky, D., Athey, S., Hirshberg, D. A., Imbens, G. W., & Wager, S. (2021). "Synthetic Difference in Differences." *American Economic Review*, 111(12), 4088-4118. arXiv preprint: [arXiv:1812.09970](https://arxiv.org/abs/1812.09970).
- Abadie, A., Diamond, A., & Hainmueller, J. (2010). "Synthetic control methods for comparative case studies: Estimating the effect of California's tobacco control program." *Journal of the American Statistical Association*, 105(490), 493-505.
- Efron, B. & Hastie, T. (2016). *Computer Age Statistical Inference: Algorithms, Evidence, and Data Science*. Cambridge University Press. Chapter 10 (Lindsey's method).
