# fixest: Quick Start

## Contents

- [How To Use This File](#how-to-use-this-file)
- [Quick Workflow](#quick-workflow)
- [Repository Highlights (From Additional Notes)](#repository-highlights-from-additional-notes)
- [Layer 5 Source (GitHub)](#layer-5-source-github)
- [Installed Help Topics](#installed-help-topics)
- [Common Use Case Example](#common-use-case-example)
- [Reading Strategy](#reading-strategy)

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived implementation tips and caveats, read `fixest-additional.md`.

## Quick Workflow

1. Fit high-dimensional FE models with `feols(...)` / `feglm(...)`.
2. For DiD/event-study, use interaction tools (`sunab`, `i`).
3. Summarize/infer with `summary(...)`, `coeftable(...)`, `vcov_*`.
4. Export and compare models via table/plot utilities.

## Repository Highlights (From Additional Notes)

- 14 DiD-relevant R source files available in the GitHub source repository for deep function inspection.
- Installed `fixest` help is the reference for version-specific function arguments.
- For DiD usage, center workflows on `feols(..., sunab(...))` and post-estimation plotting.

## Layer 5 Source (GitHub)

- **Repo**: [lrberge/fixest](https://github.com/lrberge/fixest)
- **Key files**: `R/did.R` (sunab), `R/estimation.R` (feols), `R/iplot.R`, `R/coefplot.R`, `R/etable.R`, `R/miscfuns.R` (i, did_means), `R/panel.R`, `R/VCOV.R`, `R/methods.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R fixest
Rscript scripts/package-doc.R fixest feols
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [fixest.md](fixest.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example demonstrates the most common fixest DiD workflow: comparing standard TWFE (potentially biased) against the Sun-Abraham heterogeneity-robust estimator, using `etable()` for side-by-side comparison and `iplot()` for event study visualization.

```r
library(fixest)
data(base_stagg)

# Standard TWFE event study (potentially biased under heterogeneous effects)
twfe <- feols(
  y ~ i(time_to_treatment, ref = c(-1, -1000)) | id + year,
  data = base_stagg, cluster = ~id
)

# Sun-Abraham interaction-weighted estimator (heterogeneity-robust)
sa <- feols(
  y ~ sunab(year_treated, year) | id + year,
  data = base_stagg, cluster = ~id
)

# Side-by-side comparison table
etable(twfe, sa, headers = c("TWFE", "Sun-Abraham"))

# Overlaid event study plot — reveals bias in TWFE if present
iplot(list(twfe, sa), sep = 0.2,
      main = "Event Study: TWFE vs Sun-Abraham",
      xlab = "Periods Relative to Treatment",
      ref.line = -0.5)
legend("topleft", col = 1:2, pch = 20, legend = c("TWFE", "Sun-Abraham"))

# Aggregate Sun-Abraham to overall ATT
aggregate(sa, agg = "ATT")
```

## Reading Strategy

- Use this quick-start file to choose the right function first.
- Look up the needed topic using the installed-help commands above.
- Use `-additional.md` for implementation caveats and repository-derived gotchas.
