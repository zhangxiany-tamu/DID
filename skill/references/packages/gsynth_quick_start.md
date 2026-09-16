# gsynth: Quick Start

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived computational notes, read `gsynth-additional.md`.

## Quick Workflow

1. Estimate counterfactuals with `gsynth(...)`.
2. Use `interFE(...)` for direct interactive fixed-effects modeling.
3. Plot and print using built-in S3 methods.
4. Use `cumuEff(...)` for cumulative/subgroup effect summaries.

## Layer 5 Source (GitHub)

- **Repo**: [xuyiqing/gsynth](https://github.com/xuyiqing/gsynth)
- **Key files**: `R/default.R`, `R/core.R`, `R/interFE.R`, `R/plot.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R gsynth
Rscript scripts/package-doc.R gsynth gsynth
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [gsynth.md](gsynth.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example shows how to perform Generalized Synthetic Control estimation with cross-validation for factor selection and bootstrap standard errors using the built-in simulated dataset.

```r
library(gsynth)

# Load sample data (simulated dataset)
data(gsynth)

# Basic GSC estimation
gsc_result <- gsynth(
  formula = Y ~ D + X1 + X2,     # Outcome ~ Treatment + Controls
  data = simdata,                # Panel dataset
  index = c("id", "time"),       # Unit and time identifiers
  force = "two-way",             # Two-way fixed effects
  r = c(0, 5),                   # Test 0 to 5 factors
  CV = TRUE,                     # Cross-validation for r selection
  se = TRUE,                     # Calculate standard errors
  nboots = 500,                  # Bootstrap replications
  seed = 02139
)

# View results
print(gsc_result)
plot(gsc_result)
```

## Reading Strategy

- Use this file to choose `gsynth` vs `interFE` quickly.
- Use installed help for current arguments; `gsynth.md` preserves the historical snapshot.
- Use source references for solver/bootstrapping behavior checks.
