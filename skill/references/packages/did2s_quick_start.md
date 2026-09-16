# did2s: Quick Start

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived caveats and HonestDiD integration notes, read `did2s-additional.md`.

## Quick Workflow

1. Estimate treatment effects using `did2s(...)`.
2. Build event-study summaries with `event_study(...)` when needed.
3. Use `gen_data(...)` and bundled datasets for smoke tests.
4. For sensitivity analysis, align event-study coefficients with the matching rows and columns of `vcov(es)`; retain off-diagonal covariances.

## Layer 5 Source (GitHub)

- **Repo**: [kylebutts/did2s](https://github.com/kylebutts/did2s)
- **Key files**: `R/did2s.R`, `R/event_study.R`, `R/gen_data.R`, `R/honest_did.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R did2s
Rscript scripts/package-doc.R did2s did2s
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [did2s.md](did2s.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example demonstrates the two-stage difference-in-differences estimator for both static and event-study specifications using simulated heterogeneous treatment effect data.

```r
library(did2s)
data("df_het", package = "did2s")

# Static treatment effect estimate
static <- did2s(
  df_het,
  yname = "dep_var",
  first_stage = ~ 0 | unit + year,
  second_stage = ~ i(treat, ref = FALSE),
  treatment = "treat",
  cluster_var = "state"
)

fixest::etable(static)

# Event study specification
es <- did2s(
  df_het,
  yname = "dep_var",
  first_stage = ~ 0 | unit + year,
  second_stage = ~ i(rel_year, ref = c(-1, Inf)),
  treatment = "treat",
  cluster_var = "state"
)

# Plot event study results
fixest::iplot(es,
  main = "Event study: Staggered treatment",
  xlab = "Relative time to treatment",
  col = "steelblue",
  ref.line = -0.5,
  drop = "Inf"
)
```

## Reading Strategy

- Use this file to choose the function quickly.
- Use installed help for current arguments; `did2s.md` preserves the historical snapshot.
- Use `did2s-additional.md` and source files for implementation-level debugging.
