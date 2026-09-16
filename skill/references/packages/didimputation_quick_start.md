# didimputation: Quick Start

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived implementation tips, read `didimputation-additional.md`.

## Quick Workflow

1. Estimate ATT/event-study effects with `did_imputation(...)`.
2. Confirm balanced panel structure and code never-treated cohorts as `0`.
3. Use simulated datasets for initial checks before production runs.

## Layer 5 Source (GitHub)

- **Repo**: [kylebutts/didimputation](https://github.com/kylebutts/didimputation)
- **Key files**: `R/did_imputation.R`, `R/data.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R didimputation
Rscript scripts/package-doc.R didimputation did_imputation
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [didimputation.md](didimputation.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example demonstrates DID imputation estimation for both static and event-study specifications using simulated heterogeneous treatment effect data.

```r
library(didimputation)
library(fixest)

# Load example data
data("df_het", package = "didimputation")

# Static treatment effect estimate
static <- did_imputation(
  data = df_het,
  yname = "dep_var",
  gname = "g",
  tname = "year",
  idname = "unit"
)
static

# Event study with pretrends and dynamic effects
es <- did_imputation(
  data = df_het,
  yname = "dep_var",
  gname = "g",
  tname = "year",
  idname = "unit",
  horizon = TRUE,
  pretrends = -5:-1
)
es

# Plot event study results (manual visualization)
library(ggplot2)
pts <- as.data.frame(es)
pts$rel_year <- as.numeric(pts$term)
pts$ci_lower <- pts$estimate - 1.96 * pts$std.error
pts$ci_upper <- pts$estimate + 1.96 * pts$std.error

ggplot(pts, aes(x = rel_year, y = estimate)) +
  geom_hline(yintercept = 0, linetype = "dashed") +
  geom_vline(xintercept = -0.5, linetype = "dashed") +
  geom_linerange(aes(ymin = ci_lower, ymax = ci_upper), color = "grey30") +
  geom_point(color = "steelblue", size = 2) +
  labs(x = "Relative Time", y = "Estimate") +
  theme_minimal()
```

## Reading Strategy

- Start here to confirm the right estimator entry point.
- Use installed help for current arguments; `didimputation.md` preserves the historical snapshot.
- Use source references for edge-case debugging of preprocessing and SE handling.
