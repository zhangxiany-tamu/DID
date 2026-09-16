# synthdid: Quick Start

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
- For repository-derived implementation tips and caveats, read `synthdid-additional.md`.

## Quick Workflow

1. Build `Y`, `N0`, `T0` via `panel.matrices(...)` for balanced panel input.
2. Estimate with `synthdid_estimate(...)` (or `sc_estimate(...)` / `did_estimate(...)`).
3. Compute uncertainty with `vcov(...)` / `synthdid_se(...)`.
4. Diagnose fit and weights with plotting and control-weight functions.

## Repository Highlights (From Additional Notes)

- The repo includes extensive experimental scripts and benchmark checks in addition to package code.
- Inference methods are explicit in `vcov.R` (placebo, bootstrap, jackknife), useful for sensitivity to SE method choice.
- Plotting support is rich (`synthdid_plot`, `synthdid_units_plot`, placebo plots) and can be standardized for reporting.

## Layer 5 Source (GitHub)

- **Repo**: [synth-inference/synthdid](https://github.com/synth-inference/synthdid)
- **Key files**: `R/synthdid.R`, `R/vcov.R`, `R/plot.R`, `R/solver.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R synthdid
Rscript scripts/package-doc.R synthdid synthdid_estimate
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [synthdid.md](synthdid.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example demonstrates the core functionality of the synthdid package using the built-in California Proposition 99 dataset, which analyzes the effect of California's tobacco tax on cigarette consumption.

```r
library(synthdid)

# Load built-in dataset (California cigarette consumption)
data('california_prop99')

# Prepare data matrices
setup <- panel.matrices(california_prop99)

# Estimate treatment effect
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

# Calculate standard errors using placebo method
se <- sqrt(vcov(tau.hat, method='placebo'))

# Display results
sprintf('Point estimate: %1.2f', tau.hat)
sprintf('95%% CI: (%1.2f, %1.2f)',
        tau.hat - 1.96 * se,
        tau.hat + 1.96 * se)

# Plot results
plot(tau.hat)
```

## Reading Strategy

- Use this quick-start file to choose the right function first.
- Look up the needed topic using the installed-help commands above.
- Use `-additional.md` for implementation caveats and repository-derived gotchas.
