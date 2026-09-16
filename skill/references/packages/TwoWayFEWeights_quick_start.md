# TwoWayFEWeights: Quick Start

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived caveats and internal pipeline notes, read `TwoWayFEWeights-additional.md`.

## Quick Workflow

1. Run `twowayfeweights(...)` on your TWFE specification.
2. Choose `type` (`feTR`, `feS`, `fdTR`, `fdS`) to match design assumptions.
3. Inspect negative weights and summary measures as diagnostics.
4. Use the print method for standardized reporting.

## Layer 5 Source (GitHub)

- **Repo**: [Credible-Answers/twowayfeweights](https://github.com/Credible-Answers/twowayfeweights)
- **Key files**: `R/TwoWayFEWeights.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R TwoWayFEWeights
Rscript scripts/package-doc.R TwoWayFEWeights twowayfeweights
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [TwoWayFEWeights.md](TwoWayFEWeights.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example demonstrates how to diagnose TWFE bias using the de Chaisemartin-D'Haultfoeuille weight decomposition. The key output is whether **negative weights** exist and how large they are — negative weights mean the TWFE estimate can be of opposite sign to every individual treatment effect.

```r
library(TwoWayFEWeights)
library(haven)

# Load wage panel data
url <- "https://raw.githubusercontent.com/Credible-Answers/twowayfeweights/main/wagepan_twfeweights.dta"
wagepan <- haven::read_dta(url)

# TWFE weight decomposition
weights_result <- twowayfeweights(
  wagepan,
  Y = "lwage",              # Log wage outcome
  G = "nr",                 # Individual identifier
  T = "year",               # Time variable
  D = "union",              # Union membership treatment
  type = "feTR",            # Fixed effects, time-varying treatment
  summary_measures = TRUE   # Show sensitivity measures
)

# View formatted summary (prints diagnostics automatically)
print(weights_result)

# KEY DIAGNOSTIC: Interpret the weight decomposition
cat(sprintf("TWFE beta: %.4f\n", weights_result$beta))
cat(sprintf("Positive weights: %d (sum = %.4f)\n",
            weights_result$nr_plus, weights_result$sum_plus))
cat(sprintf("Negative weights: %d (sum = %.4f)\n",
            weights_result$nr_minus, weights_result$sum_minus))

# If negative weights exist, check sensitivity:
# sensibility = minimum treatment effect heterogeneity needed
# for TWFE to be of opposite sign to the true average effect
if (weights_result$nr_minus > 0) {
  cat(sprintf("\nSensitivity: TWFE and true ATT could have opposite signs if\n"))
  cat(sprintf("  treatment effect std dev >= %.4f (sigma_fe)\n",
              weights_result$sensibility))
}
```

## Reading Strategy

- Use this file to select `type` and diagnostics workflow.
- Use installed help for current arguments; `TwoWayFEWeights.md` preserves the historical snapshot.
- Use source file references when debugging edge-case input handling.
