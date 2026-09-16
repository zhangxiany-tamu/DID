# etwfe: Extended Two-Way Fixed Effects

> **Historical reference snapshot.** The version recorded here belongs to this
> snapshot and may differ from the installed package or validation ledger. Use
> [installed help](etwfe_quick_start.md#installed-help-topics) for current
> arguments. This file remains available as a historical fallback.

## Contents
- [Package Overview](#package-overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Function Reference](#function-reference)
- [Workflows & Recipes](#workflows--recipes)
- [Common Pitfalls & Tips](#common-pitfalls--tips)
- [References](#references)
- [Related Packages](#related-packages)

## Package Overview
- **Version**: 0.6.0
- **Authors**: Grant McDermott (author, maintainer; gmcd@amazon.com, ORCID: 0000-0001-7883-8573), Frederic Kluser (contributor)
- **License**: MIT
- **Dependencies**:
  - **Imports**: fixest (>= 0.11.2), stats, data.table, Formula, marginaleffects (>= 0.29.0), tinyplot (>= 0.4.2)
  - **Suggests**: did, broom, modelsummary (>= 2.2.0), ggplot2, knitr, rmarkdown, tinytest
- **URL**: https://grantmcdermott.com/etwfe/
- **BugReports**: https://github.com/grantmcdermott/etwfe/issues
- **Purpose**: Provides convenience functions for implementing extended two-way fixed effect (ETWFE) regressions a la Wooldridge (2021, 2023). The standard TWFE formulation can impose strange (negative) weighting conditions, risking estimate bias in the presence of staggered treatment rollouts. Wooldridge's ETWFE solution saturates the model with all possible interactions between treatment and time variables (including treatment cohorts and covariates), drawing equivalence between different types of estimators (pooled OLS, two-way Mundlak regression, etc.). The package automates the tedious and error-prone steps of correctly specifying all interactions, demeaning control variables within groups, and recovering treatment effects via marginal effect aggregation. Estimation is powered by fixest, and post-estimation aggregation is powered by marginaleffects.

## Installation

```r
# From CRAN
install.packages("etwfe")

# Development version from GitHub
# install.packages("remotes")
remotes::install_github("grantmcdermott/etwfe")
```

## Quick Start

The core workflow involves two consecutive function calls: `etwfe()` (estimation) and `emfx()` (aggregation).

```r
library(etwfe)

# Load example data (requires the did package)
# install.packages("did")
data("mpdta", package = "did")

# Step 1: Estimate the ETWFE model
mod = etwfe(
  fml  = lemp ~ lpop, # outcome ~ controls (use 0 or 1 if no controls)
  tvar = year,        # time variable
  gvar = first.treat, # group/cohort variable
  data = mpdta,       # dataset
  vcov = ~countyreal  # clustered standard errors
)

# Step 2: Recover treatment effects of interest
emfx(mod)                          # simple ATT
emfx(mod, type = "event")          # event study (dynamic ATT)
emfx(mod, type = "group")          # ATT by treatment cohort
emfx(mod, type = "calendar")       # ATT by calendar period

# Step 3: Visualize
mod |> emfx("event") |> plot()
```

## Function Reference

### `etwfe()`

**Description**: Estimates an "extended" two-way fixed effects regression with fully saturated interaction effects a la Wooldridge (2021, 2023). This is a convenience function that automates tedious and error-prone preparation steps involving both the data and model formulae. Computation is passed to `fixest::feols()` (linear) or `fixest::feglm()` (nonlinear). Should be paired with the companion `emfx()` function for post-estimation aggregation.

**Usage**:
```r
etwfe(
  fml = NULL,
  tvar = NULL,
  gvar = NULL,
  data = NULL,
  ivar = NULL,
  xvar = NULL,
  tref = NULL,
  gref = NULL,
  cgroup = c("notyet", "never"),
  fe = NULL,
  family = NULL,
  ...
)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fml` | formula | `NULL` (required) | Two-sided formula representing the outcome (LHS) and any control variables (RHS), e.g., `y ~ x1 + x2`. If no controls are required, the RHS must be 0 or 1, e.g., `y ~ 0`. |
| `tvar` | string or expression | `NULL` (required) | Time variable. Can be a string (e.g., `"year"`) or an unquoted expression (e.g., `year`). |
| `gvar` | string or expression | `NULL` (required) | Group variable. Can be a string (e.g., `"first_treated"`) or an expression (e.g., `first_treated`). In staggered treatment settings, this typically denotes the treatment cohort. |
| `data` | data.frame | `NULL` (required) | The data frame to run ETWFE on. |
| `ivar` | string or expression | `NULL` | Optional index (unit-level ID) variable. Leaving as `NULL` (default) uses group-level fixed effects, which is more efficient and necessary for nonlinear models. For linear models, group-level and unit-level FEs yield equivalent treatment effect estimates (per Wooldridge 2021), though standard errors may differ slightly. You may still want to cluster standard errors by the unit variable via `vcov`. |
| `xvar` | string or expression | `NULL` | Optional interacted categorical covariate for estimating heterogeneous treatment effects. Enables recovery of marginal treatment effects for distinct levels of `xvar` (e.g., "child", "teenager", "adult"). The "x" prefix denotes a covariate that is *interacted* with treatment, as opposed to a regular control variable on the formula RHS. |
| `tref` | numeric | `NULL` | Optional reference value for `tvar`. Defaults to its minimum value (first observed time period). |
| `gref` | numeric | `NULL` | Optional reference value for `gvar`. Usually not needed if `gvar` is well-specified. Useful if the desired control group takes an unusual value. Auto-detected: looks for groups that never received treatment (values greater than `max(tvar)` or less than `min(tvar)`). |
| `cgroup` | character | `"notyet"` | Control group for estimating treatment effects. Either `"notyet"` treated (default) or `"never"` treated. The "notyet" option uses not-yet-treated units as controls, which mechanically zeros out pre-treatment effects. The "never" option uses only never-treated units, which allows pre-treatment effects to be non-zero (useful for parallel trends inspection). |
| `fe` | character | `NULL` | Category of fixed effects. One of `"vs"` (varying slopes), `"feo"` (fixed effects only), or `"none"`. If `NULL`: defaults to `"vs"` for linear/Gaussian models (most efficient, limits nuisance parameters); defaults to `"none"` for non-Gaussian families (required because `emfx()` cannot compute standard errors with FEs for nonlinear models). Primary treatment parameters remain unchanged regardless of this choice. |
| `family` | character | `NULL` | Distribution/link family for nonlinear models. If `NULL`, `fixest::feols()` is used. Otherwise passed to `fixest::feglm()`. Valid entries include `"logit"`, `"poisson"`, and `"negbin"`. When non-NULL, `ivar` is automatically set to `NULL`. |
| `...` | | | Additional arguments passed to `fixest::feols()` or `fixest::feglm()`. The most common example is `vcov` for variance-covariance adjustment (e.g., `vcov = ~countyreal` for clustering). |

**Returns**: A `fixest` object (with additional class `"etwfe"`) containing fully saturated interaction effects and additional attributes used by `emfx()` for post-estimation. The object is compatible with all standard fixest methods (`summary()`, `coefplot()`, `etable()`, etc.).

**Details**:

Internally, `etwfe()` performs several key steps:

1. **Treatment dummy construction**: Creates a `.Dtreat` indicator based on whether the current time period is at or after the unit's treatment cohort, with appropriate handling for "notyet" vs. "never" control groups.
2. **Control variable demeaning**: All control variables are demeaned within groups using `fixest::demean()` before being interacted. This is required by the ETWFE methodology.
3. **Formula construction**: Builds a fully saturated interaction formula of the form `.Dtreat : i(gvar, i.tvar, ref = gref, ref2 = tref) / controls_dm`, with appropriate fixed effects in the second part of the fixest formula.
4. **Heterogeneous treatment effects (xvar)**: When `xvar` is specified, the interacted covariate is demeaned using only treated cohorts as weights, then spliced into the interaction formula.
5. **Fixed effects handling**: Under `fe = "vs"` (default for linear models), control variables are absorbed into the fixed effects slot using fixest's varying slopes syntax (`factor_var[numeric_var]`), which is faster and avoids polluting output with nuisance coefficients. Under `fe = "feo"`, controls are explicitly interacted with group and time factors. Under `fe = "none"`, group and time indicators are included as regular regressors.
6. **Reserved names**: The variable name `"group"` is reserved by etwfe and cannot be used in any variable specification.

**Examples**:
```r
data("mpdta", package = "did")

# Basic example with controls and clustered SEs
mod = etwfe(
  fml  = lemp ~ lpop,
  tvar = year,
  gvar = first.treat,
  data = mpdta,
  vcov = ~countyreal
)
mod

# Using "never" treated as control group (enables pre-treatment effects)
mod_never = etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal,
  cgroup = "never"
)

# Heterogeneous treatment effects via xvar
gls = c("IL" = 17, "IN" = 18, "MI" = 26, "MN" = 27,
        "NY" = 36, "OH" = 39, "PA" = 42, "WI" = 55)
mpdta$gls = substr(mpdta$countyreal, 1, 2) %in% gls

hmod = etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal,
  xvar = gls
)

# Nonlinear (Poisson) model
mpdta$emp = exp(mpdta$lemp)
etwfe(
  emp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal,
  family = "poisson"
)

# No controls
etwfe(
  fml  = lemp ~ 0,
  tvar = year,
  gvar = first.treat,
  data = mpdta,
  vcov = ~countyreal
)

# Unit-level fixed effects (linear models only)
etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  ivar = countyreal
)
```

---

### `emfx()`

**Description**: Companion function to `etwfe()`, enabling recovery of aggregate treatment effects along different dimensions of interest (e.g., an event study of dynamic average treatment effects). `emfx()` is a light wrapper around `marginaleffects::slopes()`.

**Usage**:
```r
emfx(
  object,
  type = c("simple", "group", "calendar", "event"),
  by_xvar = "auto",
  compress = "auto",
  collapse = compress,
  predict = c("response", "link"),
  post_only = TRUE,
  window = NULL,
  lean = FALSE,
  ...
)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `object` | etwfe object | (required) | An `etwfe` model object (output from `etwfe()`). |
| `type` | character | `"simple"` | Type of post-estimation aggregation. One of: `"simple"` (overall ATT), `"group"` (ATT by treatment cohort), `"calendar"` (ATT by calendar period), or `"event"` (dynamic ATT / event study, where event time = `tvar - gvar`). |
| `by_xvar` | logical or "auto" | `"auto"` | Should results account for heterogeneous treatment effects? Only relevant if the preceding `etwfe()` call included `xvar`. Default `"auto"` automatically estimates heterogeneous effects for each level of `xvar` if detected. Override with `TRUE` or `FALSE`. |
| `compress` | logical or "auto" | `"auto"` | Compress data by (period x cohort) groups before calculating marginal effects? Trades slight precision loss (~1st-2nd decimal place) for substantial speed improvement on large datasets. Default `"auto"` compresses if original data has > 500,000 rows. Override with `TRUE` or `FALSE`. Only valid when `ivar = NULL` in the preceding `etwfe()` call. |
| `collapse` | logical or "auto" | `compress` | Deprecated alias for `compress` (backwards compatibility). Triggers a message nudging users to use `compress` instead. Ignored if both `compress` and `collapse` are explicitly provided. |
| `predict` | character | `"response"` | Type (scale) of prediction for marginal effects. `"response"` gives output at the level of the response variable, i.e., E(Y|X). `"link"` gives the linear predictor X*beta. Difference only matters for nonlinear models. Named `predict` (rather than `type`) to avoid clash with the top-level `type` argument. |
| `post_only` | logical | `TRUE` | Drop pre-treatment ATTs? Only evaluated when (a) `type = "event"` and (b) the original `etwfe` model used the `"notyet"` control group. Under these conditions, pre-treatment effects are mechanically zero by construction. Default `TRUE` drops these rows. Set `FALSE` to keep them for presentation purposes (e.g., event study plots), but note that the zero pre-treatment effects are purely an artifact of the estimation setup. |
| `lean` | logical | `FALSE` | If `TRUE`, returns a lean data.frame stripped of ancillary attributes. Disables some advanced marginaleffects post-processing features but can dramatically reduce object size. |
| `window` | numeric (length 1 or 2) | `NULL` | Limits temporal window around treatment. `NULL`: all periods. Length 1: symmetric window (e.g., `window = 2` keeps 2 pre- and 2 post-treatment periods). Length 2: asymmetric (e.g., `window = c(5, 2)` keeps 5 pre- and 2 post-treatment periods). Pre-treatment truncation only binding when `cgroup = "never"`. |
| `...` | | | Additional arguments passed to `marginaleffects::slopes()`. Key options: `vcov = FALSE` (dramatically speeds up estimation by skipping SE calculation); `hypothesis = "b1 = b2"` (test equality of heterogeneous treatment effects across xvar levels). |

**Returns**: A `data.frame` with class `c("emfx", "slopes", ...)` containing aggregated treatment effects. Standard columns include:

| Column | Description |
|--------|-------------|
| `term` | The variable name (`.Dtreat`) |
| `contrast` | Description of the contrast |
| `<type>` | Column named after the `type` argument (e.g., `event`, `group`, `calendar`, or `.Dtreat`) |
| `estimate` | Point estimate of the treatment effect |
| `std.error` | Standard error |
| `statistic` | Test statistic (z-value) |
| `p.value` | p-value |
| `s.value` | Shannon information transform of p-value |
| `conf.low` | Lower confidence interval bound |
| `conf.high` | Upper confidence interval bound |

**Details**:

Internally, `emfx()` performs the following:

1. **Data preparation**: Extracts the original data from the etwfe model object, filters rows based on control group type and treatment status.
2. **Event variable creation**: For `type = "event"`, creates an `event` column computed as `tvar - gvar` (time since treatment).
3. **Data compression**: When `compress = TRUE` (or auto-triggered for datasets > 500k rows), collapses data by (gvar, tvar) groups (plus xvar if relevant), computing group means for numeric variables and group counts as weights. This approximation speeds up computation at the cost of slight precision loss.
4. **Marginal effects computation**: Calls `marginaleffects::slopes()` with `.Dtreat` as the variable of interest, appropriate `by` grouping, and weights from the compression step.
5. **Nonlinear model safeguard**: For non-Gaussian families with fixed effects (`fe != "none"`), automatically sets `vcov = FALSE` because standard errors cannot be computed in this configuration (related to a marginaleffects limitation).

**Examples**:
```r
data("mpdta", package = "did")

mod = etwfe(
  fml  = lemp ~ lpop,
  tvar = year,
  gvar = first.treat,
  data = mpdta,
  vcov = ~countyreal
)

# Simple ATT (overall average treatment effect on the treated)
emfx(mod)

# Event study (dynamic treatment effects)
emfx(mod, type = "event")

# ATT by treatment cohort
emfx(mod, type = "group")

# ATT by calendar year
emfx(mod, type = "calendar")

# Event study with never-treated control group (includes pre-treatment)
etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal, cgroup = "never"
) |>
  emfx("event")

# Event study with temporal window
emfx(mod, type = "event", window = 2)         # symmetric: 2 pre, 2 post
emfx(mod, type = "event", window = c(5, 2))   # asymmetric: 5 pre, 2 post

# Skip standard errors for speed
emfx(mod, type = "event", vcov = FALSE)

# Compress data for speed (slight precision trade-off)
emfx(mod, type = "event", compress = TRUE)

# Heterogeneous treatment effects
gls = c("IL" = 17, "IN" = 18, "MI" = 26, "MN" = 27,
        "NY" = 36, "OH" = 39, "PA" = 42, "WI" = 55)
mpdta$gls = substr(mpdta$countyreal, 1, 2) %in% gls

hmod = etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal, xvar = gls
)

emfx(hmod)                            # ATTs by xvar levels
emfx(hmod, hypothesis = "b1 = b2")    # test equality across groups
emfx(hmod, type = "event")            # event study by xvar levels

# Lean return object (smaller memory footprint)
emfx(mod, lean = TRUE)

# Keep pre-treatment zeros for plotting
emfx(mod, type = "event", post_only = FALSE)
```

---

### `plot.emfx()`

**Description**: S3 plot method for `emfx` objects. Visualizes treatment effects with confidence intervals using the tinyplot package as a backend.

**Usage**:
```r
## S3 method for class 'emfx'
plot(x, type = c("pointrange", "errorbar", "ribbon"),
     pch = 16, zero = TRUE, grid = TRUE, ref = -1, ...)
```

**Arguments**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `x` | emfx object | (required) | An `emfx` object (output from `emfx()`). |
| `type` | character | `"pointrange"` | Type of plot display. One of `"pointrange"` (point with vertical CI lines), `"errorbar"` (error bars), or `"ribbon"` (shaded confidence band). Note: `"ribbon"` is not allowed for `emfx(..., type = "simple")` objects and will revert to `"pointrange"`. |
| `pch` | integer or character | `16` | Plotting character/symbol (see `?points`). 16 = small solid circle. Ignored if `type = "ribbon"`. |
| `zero` | logical | `TRUE` | Should a dashed horizontal zero line be drawn? Useful for assessing statistical significance visually. |
| `grid` | logical | `TRUE` | Should a background grid be displayed? |
| `ref` | integer | `-1` | Reference line marker for event-study plots (dashed vertical line). Default is -1 (period immediately before treatment). Set to `NA`, `NULL`, or `FALSE` to remove. Only used when the underlying object was computed with `emfx(..., type = "event")`. |
| `...` | | | Additional arguments passed to `tinyplot::tinyplot()`. Useful for customization: `col` (color), `xlab`, `ylab`, `main` (title), `sub` (subtitle), `xlim`, `ylim`, `file` (save to file), `width`, `height`, etc. |

**Returns**: No return value; called for its side effect of producing a plot.

**Details**:

- The plot automatically adapts based on the `type` of the underlying `emfx` object (simple, group, calendar, or event).
- For event study plots (`type = "event"`): x-axis is "Time since treatment", y-axis is "ATT", and a reference line at -1 is drawn by default.
- For simple ATT plots: x-axis is "Treated?" with a single point.
- When heterogeneous treatment effects are present (`xvar`), the plot automatically creates a legend and dodges overlapping confidence intervals for clarity.
- For ribbon plots with event studies, the confidence interval at the reference period (event = -1) is collapsed to a single point for visual continuity.
- The title defaults to "Effect on {yvar}" where yvar is extracted from the original model.

**Examples**:
```r
data("mpdta", package = "did")

mod = etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal
)

# Basic event study plot
mod_es = emfx(mod, type = "event")
plot(mod_es)

# Customized ribbon plot
mod_es2 = etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal, cgroup = "never"
) |> emfx("event")

plot(
  mod_es2,
  type = "ribbon",
  col  = "darkcyan",
  xlab = "Years post treatment",
  main = "Minimum wage effect on (log) teen employment",
  sub  = "Note: Using never-treated as control group"
)

# Remove reference line
plot(mod_es, ref = NA)

# Error bar style
plot(mod_es, type = "errorbar")

# Plot simple ATT
plot(emfx(mod))

# Plot heterogeneous treatment effects (auto-legend and dodging)
mpdta$gls = substr(mpdta$countyreal, 1, 2) %in%
  c("IL" = 17, "IN" = 18, "MI" = 26, "MN" = 27,
    "NY" = 36, "OH" = 39, "PA" = 42, "WI" = 55)
hmod = etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal, xvar = gls
)
plot(emfx(hmod))
plot(emfx(hmod, type = "event"), type = "ribbon")
```

---

## Workflows & Recipes

### Recipe 1: Basic DiD Event Study

The standard two-step workflow for estimating and visualizing dynamic treatment effects.

```r
library(etwfe)
data("mpdta", package = "did")

# Estimate and aggregate
mod = etwfe(
  fml  = lemp ~ lpop,
  tvar = year,
  gvar = first.treat,
  data = mpdta,
  vcov = ~countyreal
)
mod_es = emfx(mod, type = "event")

# Visualize
plot(mod_es)

# Or with ggplot2
library(ggplot2)
ggplot(mod_es, aes(x = event, y = estimate, ymin = conf.low, ymax = conf.high)) +
  geom_hline(yintercept = 0, lty = 2, col = "grey50") +
  geom_vline(xintercept = -1, lty = 2, col = "grey50") +
  geom_pointrange(col = "darkcyan") +
  labs(x = "Years post treatment", y = "ATT",
       title = "Effect on log teen employment")
```

### Recipe 2: Comparing Control Groups ("notyet" vs. "never")

```r
# Default: not-yet treated control (only post-treatment effects)
mod_notyet = etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal, cgroup = "notyet"
) |> emfx("event")

# Never-treated control (includes pre-treatment effects for parallel trends)
mod_never = etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal, cgroup = "never"
) |> emfx("event")

# Compare in a table
library(modelsummary)
rename_fn = function(old_names) {
  new_names = gsub(".Dtreat", "Years post treatment =", old_names)
  setNames(new_names, old_names)
}
modelsummary(
  list("Not-yet treated" = mod_notyet, "Never treated" = mod_never),
  shape       = term:event:statistic ~ model,
  coef_rename = rename_fn,
  gof_omit    = "Adj|Within|IC|RMSE"
)
```

### Recipe 3: Heterogeneous Treatment Effects with Hypothesis Testing

```r
# Create a grouping variable
mpdta$gls = substr(mpdta$countyreal, 1, 2) %in%
  c("IL" = 17, "IN" = 18, "MI" = 26, "MN" = 27,
    "NY" = 36, "OH" = 39, "PA" = 42, "WI" = 55)

# Estimate with xvar for heterogeneous effects
hmod = etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal, xvar = gls
)

# ATTs by group
emfx(hmod)

# Test equality of treatment effects across groups
emfx(hmod, hypothesis = "b1 = b2")

# Event study by group
hmod |> emfx("event") |> plot(type = "ribbon")

# Table with heterogeneous effects
library(modelsummary)
modelsummary(
  list("GLS county" = emfx(hmod)),
  shape    = term + statistic ~ model + gls,
  coef_map = c(".Dtreat" = "ATT"),
  gof_map  = NA
)
```

### Recipe 4: Nonlinear (Poisson) DiD

```r
# Transform outcome for count data
mpdta$emp = exp(mpdta$lemp)

# Poisson regression
etwfe(
  emp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal,
  family = "poisson"
) |>
  emfx("event")

# Note: ivar is automatically set to NULL for nonlinear models.
# Note: fe defaults to "none" for non-Gaussian families.
```

### Recipe 5: Performance-Conscious Workflow for Large Datasets

```r
# Step 0: Estimate the model
mod = etwfe(lemp ~ lpop, tvar = year, gvar = first.treat,
            data = mpdta, vcov = ~countyreal)

# Step 1: Quick point estimates (no SEs)
emfx(mod, type = "event", vcov = FALSE)

# Step 2: Quick point estimates with compression (no SEs)
emfx(mod, type = "event", vcov = FALSE, compress = TRUE)

# Step 3: Compare steps 1 and 2. If similar, get approximate SEs:
mod_es_fast = emfx(mod, type = "event", compress = TRUE)
```

### Recipe 6: Manual ETWFE Implementation (for understanding)

```r
library(fixest)
library(marginaleffects)

# Manually construct data
mpdta2 = mpdta |>
  transform(
    .Dtreat = year >= first.treat & first.treat != 0,
    lpop_dm = ave(lpop, first.treat, year,
                  FUN = \(x) x - mean(x, na.rm = TRUE))
  )

# Manual ETWFE regression
mod_manual = feols(
  lemp ~ .Dtreat:i(first.treat, i.year, ref = 0, ref2 = 2003) / lpop_dm |
    first.treat[lpop] + year[lpop],
  data = mpdta2, vcov = ~countyreal
)

# Manual marginal effects (simple ATT)
slopes(mod_manual,
       newdata   = subset(mpdta2, .Dtreat),
       variables = ".Dtreat",
       by        = ".Dtreat")

# Manual marginal effects (event study)
slopes(mod_manual,
       newdata   = transform(subset(mpdta2, .Dtreat),
                             event = year - first.treat),
       variables = ".Dtreat",
       by        = "event")
```

### Recipe 7: Presentation with modelsummary

```r
library(modelsummary)

mod_es = etwfe(
  lemp ~ lpop, tvar = year, gvar = first.treat, data = mpdta,
  vcov = ~countyreal
) |> emfx("event")

rename_fn = function(old_names) {
  new_names = gsub(".Dtreat", "Years post treatment =", old_names)
  setNames(new_names, old_names)
}

modelsummary(
  list("Event Study" = mod_es),
  shape       = term:event:statistic ~ model,
  coef_rename = rename_fn,
  gof_omit    = "Adj|Within|IC|RMSE",
  stars       = TRUE,
  title       = "Event study",
  notes       = "Std. errors clustered at county level"
)
```

## Common Pitfalls & Tips

### 1. Reserved Variable Name: "group"
The variable name `"group"` is reserved within etwfe. If your dataset contains a column called "group", you must rename it before using etwfe. The function will throw an error if this name is detected in any variable specification.

### 2. Pre-treatment Effects with "notyet" Control Group
When using the default `cgroup = "notyet"`, all pre-treatment effects are mechanically zero by construction. Do NOT interpret these as evidence of parallel pre-trends. If you need to inspect pre-treatment effects, use `cgroup = "never"` instead.

### 3. The `post_only` Argument is Strictly Performative
Setting `emfx(..., post_only = FALSE)` with `cgroup = "notyet"` will return pre-treatment rows, but they are guaranteed to be zero. This is only useful for visual presentation (e.g., making an event study plot that shows the zero pre-treatment effects).

### 4. Standard Errors for Nonlinear Models with Fixed Effects
For non-Gaussian families (e.g., Poisson) with fixed effects (`fe != "none"`), `emfx()` cannot compute standard errors due to a limitation in the marginaleffects package. The function will automatically set `vcov = FALSE` and issue a warning. To get standard errors, re-estimate the model with `etwfe(..., fe = "none")`.

### 5. The `fe` Argument Does Not Affect Treatment Effect Estimates
Regardless of whether you choose `fe = "vs"`, `fe = "feo"`, or `fe = "none"`, the primary treatment parameters of interest remain unchanged. The choice only affects how nuisance parameters (fixed effects and control variable interactions) are handled in the output.

### 6. Group-Level vs. Unit-Level Fixed Effects
By default, etwfe uses group-level (cohort-level) fixed effects rather than unit-level fixed effects. Per Wooldridge (2021), these are equivalent for linear models. Group-level FEs are faster to estimate and are required for nonlinear models. If you want unit-level FEs for linear models, use the `ivar` argument. Note that standard errors may differ slightly.

### 7. Data Compression Trade-offs
The `compress = TRUE` option in `emfx()` collapses data by period-cohort groups before computing marginal effects. This can dramatically speed up computation for large datasets but introduces a small loss in precision (typically at the 1st or 2nd decimal place). Compression is only valid when the original `etwfe()` call used `ivar = NULL` (the default). For datasets > 500,000 rows, compression is triggered automatically.

### 8. NSE (Non-Standard Evaluation) for Variable Arguments
The `tvar`, `gvar`, `ivar`, and `xvar` arguments all support non-standard evaluation. You can pass either a quoted string (`"year"`) or an unquoted expression (`year`). Both work identically.

### 9. Controls Must Be on the Formula RHS
Control variables go in the formula (e.g., `lemp ~ lpop + x2`). The `xvar` argument is specifically for covariates that should be *interacted* with treatment to estimate heterogeneous effects, not for regular controls.

### 10. Compatibility with fixest Ecosystem
Since `etwfe()` returns a fixest object, you can use all fixest post-estimation tools: `fixest::coefplot()`, `fixest::etable()`, `fixest::summary()`, etc. However, the raw coefficients are complex multiway interactions and are not directly interpretable -- always use `emfx()` to recover meaningful treatment effects.

### 11. `emfx` Objects Are Data Frames
`emfx()` returns a data.frame with additional class attributes. You can manipulate it like any data frame, use it with ggplot2, pass it to modelsummary, subset it, etc.

### 12. Combining Speed Strategies
For maximum performance on large datasets, combine `vcov = FALSE` with `compress = TRUE`. First verify point estimates match between compressed and uncompressed versions, then compute standard errors on the compressed version only.

## References

- Wooldridge, Jeffrey M. (2021). *Two-Way Fixed Effects, the Two-Way Mundlak Regression, and Difference-in-Differences Estimators*. Working paper. Available: http://dx.doi.org/10.2139/ssrn.3906345
- Wooldridge, Jeffrey M. (2023). *Simple Approaches to Nonlinear Difference-in-Differences with Panel Data*. The Econometrics Journal, 26(3), C31-C66. Available: https://doi.org/10.1093/ectj/utad016
- Wong, Jeffrey et al. (2021). *You Only Compress Once: Optimal Data Compression for Estimating Linear Models*. Working paper. Available: https://doi.org/10.48550/arXiv.2102.11297

## Related Packages

| Package | Relationship | Notes |
|---------|-------------|-------|
| **fixest** | Powers estimation | `etwfe()` is a wrapper around `fixest::feols()` / `fixest::feglm()`. Returns fixest objects. |
| **marginaleffects** | Powers post-estimation | `emfx()` is a wrapper around `marginaleffects::slopes()`. |
| **tinyplot** | Powers plotting | `plot.emfx()` uses `tinyplot::tinyplot()` as its backend. |
| **did** | Alternative DiD estimator | Callaway & Sant'Anna (2021) approach. Provides the `mpdta` example dataset. |
| **did2s** | Alternative DiD estimator | Gardner (2022) two-stage DiD approach. |
| **didimputation** | Alternative DiD estimator | Borusyak, Jaravel, & Spiess (2024) imputation approach. |
| **bacondecomp** | Diagnostic tool | Goodman-Bacon decomposition for standard TWFE. |
| **modelsummary** | Presentation | Recommended for creating regression tables from emfx output. |
| **data.table** | Internal dependency | Used for data manipulation in `emfx()`. |
| **Formula** | Internal dependency | Used for formula parsing in `etwfe()`. |
