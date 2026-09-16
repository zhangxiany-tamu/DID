# DIDmultiplegtDYN: Quick Start

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived caveats and branch/version notes, read `DIDmultiplegtDYN-additional.md`.

## Quick Workflow

1. Estimate dynamic effects with `did_multiplegt_dyn(...)`.
2. Use design/placebo options before interpreting effects.
3. Summarize and print results with the package S3 helpers.
4. Test scripts quickly with `favara_imbs`.

## Layer 5 Source (GitHub)

- **Repo**: [Credible-Answers/did_multiplegt_dyn](https://github.com/Credible-Answers/did_multiplegt_dyn)
- **Key files**: `R/R/did_multiplegt_dyn.R`, `R/R/did_multiplegt_bootstrap.R`, `R/R/did_multiplegt_dyn_design.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R DIDmultiplegtDYN
Rscript scripts/package-doc.R DIDmultiplegtDYN did_multiplegt_dyn
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [DIDmultiplegtDYN.md](DIDmultiplegtDYN.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example shows dynamic DiD estimation using the Favara and Imbs banking deregulation dataset included in the package.

```r
# NOTE: DIDmultiplegtDYN v2.3.0+ requires the polars package.
# Load polars first to ensure the 'pl' object is on the search path.
library(polars)
library(DIDmultiplegtDYN)

# Load sample data
data(favara_imbs)

# Basic dynamic estimation (a plot is produced automatically unless graph_off = TRUE)
result <- did_multiplegt_dyn(
  df = favara_imbs,
  outcome = "Dl_vloans_b",      # Change in log loan volume
  group = "county",             # County identifier
  time = "year",                # Year
  treatment = "inter_bra",      # Interstate branching deregulation
  effects = 8,                  # Estimate effects up to 8 periods
  placebo = 3,                  # Test 3 pre-treatment periods
  cluster = "state_n"           # Cluster by state
)

# View results
summary(result)
```

## Reading Strategy

- Use this file to pick core options quickly.
- Jump to `DIDmultiplegtDYN.md` for full parameter details.
- Use `DIDmultiplegtDYN-additional.md` when branch/version behavior matters.
