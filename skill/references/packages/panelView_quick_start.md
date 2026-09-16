# panelView: Quick Start

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived implementation and testing notes, read `panelView-additional.md`.

## Quick Workflow

1. Load panel data and create a binary treatment indicator (0/1 per unit-time).
2. Run `panelview(type = "treat")` to visualize the treatment rollout heatmap.
3. Run `panelview(type = "outcome")` to plot outcome trajectories by cohort.
4. Check for data issues (missing periods, tiny cohorts, irregular timing).
5. Proceed to Step 1 profiling and Step 2 diagnostics.

## Layer 5 Source (GitHub)

- **Repo**: [xuyiqing/panelView](https://github.com/xuyiqing/panelView)
- **Key files**: `R/panelview.R`
- **Documentation site**: [yiqingxu.org/packages/panelView/](https://yiqingxu.org/packages/panelView/)

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R panelView
Rscript scripts/package-doc.R panelView panelview
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [panelView.md](panelView.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

**Note**: The function name is lowercase (`panelview`) while the package name is uppercase (`panelView`).

## Common Use Case Example

This example demonstrates treatment rollout visualization and outcome trajectory plots using the `did::mpdta` dataset (minimum wage employment data).

```r
library(panelView)
library(did)

data(mpdta)

# Create binary treatment indicator from timing variable
mpdta$treat <- ifelse(mpdta$first.treat > 0 & mpdta$year >= mpdta$first.treat, 1, 0)

# 1. Treatment rollout heatmap (Item 1 of Sant'Anna's checklist)
#    Shows which units are treated in which periods
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "treat", by.timing = TRUE,
          main = "Treatment Rollout: Minimum Wage Policy")

# 2. Outcome trajectories by treatment cohort (Item 3)
#    Shows pre-treatment parallel trends visually
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "outcome",
          main = "Log Employment Trajectories by Treatment Status")
```

### What To Look For

**In the treatment heatmap:**
- Are cohorts cleanly separated (staggered adoption)?
- Are there any units that switch treatment on and off (reversals)?
- Are any cohorts extremely small (may cause estimation problems)?

**In the outcome trajectories:**
- Do treated and control groups trend similarly before treatment?
- Is there a visible shift at treatment onset?
- Are there outlier units driving the results?

## Reading Strategy

- Start with `panelview(type = "treat")` to understand the treatment design.
- Use installed help for current arguments; `panelView.md` preserves the historical snapshot.
- Use repo vignettes for publication-ready plot customization.
