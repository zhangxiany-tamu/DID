# HonestDiD: Quick Start

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
- For repository-derived implementation tips and caveats, read `HonestDiD-additional.md`.

## Quick Workflow

1. Prepare event-study `betahat`, `sigma`, and pre/post period counts.
2. Run `createSensitivityResults_relativeMagnitudes(...)` over a grid of M values.
3. Compare with `constructOriginalCS(...)` baseline intervals.
4. Report breakdown M and robust intervals in final inference.

## Repository Highlights (From Additional Notes)

- The repo implements multiple restriction families (RM/RMB/RMM/SD/SDM/SDRM/SDRMB/SDRMM) as separate computational paths.
- There is explicit support code for `fixest::sunab` objects (`sunab_beta_vcv`) in addition to AGGTE workflows.
- Sensitivity plotting and CI construction are centralized in `sensitivityresults.R` with reusable helpers.

## Layer 5 Source (GitHub)

- **Repo**: [asheshrambachan/HonestDiD](https://github.com/asheshrambachan/HonestDiD)
- **Key files**: `R/sensitivityresults.R`, `R/honest_sunab.R` (sunab_beta_vcv), `R/honest_did.R`, `R/flci.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R HonestDiD
Rscript scripts/package-doc.R HonestDiD constructOriginalCS
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [HonestDiD.md](HonestDiD.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

### Example 1: Sensitivity analysis with built-in data

This demonstrates the core HonestDiD workflow: compute sensitivity results over a grid of Mbar values, compare with original (conventional) confidence set, and produce the sensitivity plot that is the main reporting deliverable.

```r
library(HonestDiD)

# Load built-in event study data (Lovenheim & Willen 2019)
data(LWdata_EventStudy)

betahat <- LWdata_EventStudy$betahat
sigma   <- LWdata_EventStudy$sigma

# Identify pre/post periods from the data object
numPrePeriods  <- length(LWdata_EventStudy$prePeriodIndices)   # = 9
numPostPeriods <- length(LWdata_EventStudy$postPeriodIndices)  # = 23

# Sensitivity analysis: how do conclusions change as we allow
# post-treatment violations up to Mbar × max pre-treatment violation?
delta_rm_results <- createSensitivityResults_relativeMagnitudes(
  betahat = betahat,
  sigma = sigma,
  numPrePeriods = numPrePeriods,
  numPostPeriods = numPostPeriods,
  Mbarvec = seq(0.5, 2, by = 0.5)
)

# Original (conventional) confidence set for comparison baseline
original_cs <- constructOriginalCS(
  betahat = betahat,
  sigma = sigma,
  numPrePeriods = numPrePeriods,
  numPostPeriods = numPostPeriods
)

# KEY OUTPUT: Sensitivity plot showing CI widening as Mbar increases
# The "breakdown" Mbar is where CI first includes zero
createSensitivityPlot_relativeMagnitudes(delta_rm_results, original_cs)
```

### Example 2: Extracting betahat/sigma from fixest::sunab

In practice, you start from an event-study model, not pre-packaged data. Here's how to extract the inputs HonestDiD needs from a `fixest::sunab` model.

```r
library(fixest)
library(HonestDiD)

# Fit a Sun-Abraham event study
data(base_stagg)
sa <- feols(y ~ sunab(year_treated, year) | id + year,
            data = base_stagg, cluster = ~id)

# Extract aggregated betahat and vcov using HonestDiD's helper
# (sunab_beta_vcv handles the cohort-to-period aggregation internally)
# NOTE: sunab_beta_vcv is not exported; ::: is required. No public alternative exists.
# This may break if HonestDiD changes internals in a future version.
sa_extract <- HonestDiD:::sunab_beta_vcv(sa)
betahat <- as.numeric(sa_extract$beta)   # convert Nx1 matrix to vector
sigma   <- sa_extract$sigma
cohorts <- sa_extract$cohorts            # relative time periods

numPrePeriods  <- sum(cohorts < 0)
numPostPeriods <- sum(cohorts >= 0)

# Run sensitivity analysis
sens <- createSensitivityResults_relativeMagnitudes(
  betahat = betahat, sigma = sigma,
  numPrePeriods = numPrePeriods,
  numPostPeriods = numPostPeriods,
  Mbarvec = seq(0.5, 2, by = 0.5)
)

orig <- constructOriginalCS(
  betahat = betahat, sigma = sigma,
  numPrePeriods = numPrePeriods,
  numPostPeriods = numPostPeriods
)

createSensitivityPlot_relativeMagnitudes(sens, orig)
```

## Reading Strategy

- Use this quick-start file to choose the right function first.
- Look up the needed topic using the installed-help commands above.
- Use `-additional.md` for implementation caveats and repository-derived gotchas.
