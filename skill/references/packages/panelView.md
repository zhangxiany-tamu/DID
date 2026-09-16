# panelView: Full API Documentation

> **Historical reference snapshot.** The version recorded here belongs to this
> snapshot and may differ from the installed package or validation ledger. Use
> [installed help](panelView_quick_start.md#installed-help-topics) for current
> arguments. This file remains available as a historical fallback.

## Contents
- [Package Overview](#package-overview)
- [panelview()](#panelview)
  - [Arguments](#arguments)
  - [Type: Treatment Status ("treat")](#type-treatment-status-treat)
  - [Type: Outcome Trajectories ("outcome")](#type-outcome-trajectories-outcome)
  - [Type: Missing Data ("miss")](#type-missing-data-miss)
- [Display Customization](#display-customization)
- [Working with Large Panels](#working-with-large-panels)
- [Integration with DiD Workflow](#integration-with-did-workflow)

---

## Package Overview

**panelView** visualizes panel data in three modes: treatment status heatmaps, outcome trajectory plots, and missing data patterns. It is designed as a pre-estimation diagnostic — run it before profiling or estimation to understand the treatment design visually.

- **Package name**: `panelView` (uppercase V)
- **Main function**: `panelview()` (lowercase v)
- **CRAN**: [cran.r-project.org/package=panelView](https://cran.r-project.org/package=panelView)
- **GitHub**: [xuyiqing/panelView](https://github.com/xuyiqing/panelView)

Install:
```r
install.packages("panelView")
```

---

## panelview()

```
panelview(formula, data, index, type = "treat", ...)
```

Visualize panel data structure including treatment rollout, outcome trajectories, and missing data patterns.

### Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `formula` | formula | `outcome ~ treatment` (e.g., `y ~ treat`). For `type = "treat"`, the outcome is optional but the treatment variable is required on the RHS. |
| `data` | data.frame | Panel dataset |
| `index` | character(2) | Unit and time identifiers: `c("unit_id", "time_var")` |
| `type` | character | Plot type: `"treat"` (treatment status heatmap), `"outcome"` (outcome trajectories), or `"miss"` (missing data pattern) |
| `by.timing` | logical | Group units by treatment timing (cohort). Default: `FALSE`. Highly recommended for staggered designs — set to `TRUE`. |
| `by.group` | logical | Separate treated/control in outcome plots. Default: `FALSE` |
| `by.cohort` | logical | Plot outcome trajectories separately for each cohort. Default: `FALSE` |
| `main` | character | Plot title |
| `xlab` | character | X-axis label |
| `ylab` | character | Y-axis label |
| `theme.bw` | logical | Use black-and-white theme. Default: `TRUE` |
| `color` | character | Custom color vector for treatment status levels |
| `display.all` | logical | Display all units including never-treated in outcome plots. Default: `FALSE` |
| `leave.gap` | logical | Leave gaps between treatment timing groups. Default: `FALSE` |
| `pre.post` | logical | Shade pre/post periods differently in outcome plots. Default: `TRUE` |
| `gridOff` | logical | Turn off grid lines. Default: `FALSE` |
| `legendOff` | logical | Turn off the legend. Default: `FALSE` |
| `cex.main` | numeric | Title text size multiplier |
| `cex.axis` | numeric | Axis text size multiplier |
| `cex.lab` | numeric | Axis label text size multiplier |
| `axis.adjust` | logical | Adjust axis labels to avoid overlap. Default: `FALSE` |
| `id` | character vector | Subset of unit IDs to display |
| `show.id` | character vector | Unit IDs to label on the plot |
| `outcome.type` | character | For `type = "outcome"`: `"line"` or `"bar"`. Default: `"line"` |
| `lwd` | numeric | Line width for outcome trajectories. Default: `0.2` |
| `legend.labs` | character vector | Custom legend labels |

---

### Type: Treatment Status ("treat")

Creates a heatmap showing treatment status (0/1) for each unit across time periods. Units are optionally grouped by treatment timing (cohort).

```r
library(panelView)
library(did)

data(mpdta)
mpdta$treat <- ifelse(mpdta$first.treat > 0 & mpdta$year >= mpdta$first.treat, 1, 0)

# Basic treatment heatmap
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "treat",
          main = "Treatment Status Heatmap")

# Grouped by treatment timing (recommended for staggered designs)
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "treat", by.timing = TRUE,
          main = "Treatment Rollout by Cohort")

# With gap between cohort groups
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "treat", by.timing = TRUE, leave.gap = TRUE,
          main = "Treatment Rollout (with cohort gaps)")
```

**Interpretation**: Each row is a unit, each column is a time period. Shaded cells indicate treatment. With `by.timing = TRUE`, units are sorted by their treatment start date, making the staggered adoption pattern visible.

---

### Type: Outcome Trajectories ("outcome")

Plots the outcome variable over time, with options to separate by treatment status or cohort.

```r
library(panelView)
library(did)

data(mpdta)
mpdta$treat <- ifelse(mpdta$first.treat > 0 & mpdta$year >= mpdta$first.treat, 1, 0)

# Outcome trajectories colored by treatment status
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "outcome",
          main = "Log Employment Over Time")

# Separate treated vs control
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "outcome", by.group = TRUE,
          main = "Employment Trajectories: Treated vs Control")

# By cohort (each treatment timing group separately)
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "outcome", by.cohort = TRUE,
          main = "Employment Trajectories by Treatment Cohort")
```

**Interpretation**: Look for parallel pre-treatment trends between treated and control groups. Divergence before treatment onset suggests potential parallel trends violations.

---

### Type: Missing Data ("miss")

Displays the pattern of missing observations across the panel.

```r
library(panelView)
library(did)

data(mpdta)
mpdta$treat <- ifelse(mpdta$first.treat > 0 & mpdta$year >= mpdta$first.treat, 1, 0)

# Missing data diagnostic
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "miss",
          main = "Missing Data Pattern")
```

**Interpretation**: Systematic missing data (e.g., all post-treatment periods missing for some units) can bias DiD estimates. Random missingness is less concerning but may reduce power.

---

## Display Customization

```r
# Publication-ready plot
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "treat", by.timing = TRUE,
          main = "Figure 1: Treatment Rollout",
          xlab = "Year", ylab = "County",
          theme.bw = TRUE, gridOff = TRUE,
          cex.main = 1.2, cex.axis = 0.8, cex.lab = 1.0,
          color = c("white", "steelblue"))

# Custom colors for multi-level treatment
panelview(y ~ D, data = df,
          index = c("id", "time"),
          type = "treat",
          color = c("white", "lightblue", "steelblue", "darkblue"),
          main = "Multi-Level Treatment Status")
```

---

## Working with Large Panels

For panels with many units (>500), the treatment heatmap can become hard to read. Strategies:

```r
# 1. Sample units for display
set.seed(42)
sample_ids <- sample(unique(mpdta$countyreal), 100)
panelview(lemp ~ treat, data = mpdta[mpdta$countyreal %in% sample_ids, ],
          index = c("countyreal", "year"),
          type = "treat", by.timing = TRUE,
          main = "Treatment Rollout (100-unit sample)")

# 2. Use by.timing to compress display
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "treat", by.timing = TRUE, leave.gap = TRUE,
          main = "Treatment Rollout (grouped by timing)")

# 3. Outcome trajectories with thinner lines
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "outcome", lwd = 0.1,
          main = "Outcome Trajectories (large panel)")
```

---

## Integration with DiD Workflow

panelView should be the **first visualization step** before running `profile_did_design()` or any estimator:

```r
library(panelView)
library(did)

data(mpdta)
mpdta$treat <- ifelse(mpdta$first.treat > 0 & mpdta$year >= mpdta$first.treat, 1, 0)

# Step 0a: Treatment rollout (before Step 1 profiling)
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "treat", by.timing = TRUE,
          main = "Step 0a: Treatment Rollout")

# Step 0b: Outcome trajectories (visual parallel trends check)
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "outcome", by.group = TRUE,
          main = "Step 0b: Pre-Treatment Outcome Trends")

# Step 0c: Missing data check
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "miss",
          main = "Step 0c: Missing Data Pattern")

# Then proceed to:
# profile_did_design(mpdta, "countyreal", "year", "first.treat")
```
