# DIDmultiplegt: Quick Start

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived caveats and branch differences, read `DIDmultiplegt-additional.md`.

## Quick Workflow

1. Start with `did_multiplegt(mode = ...)` and choose `"dyn"`, `"had"`, or `"old"`.
2. Use `mode = "dyn"` for most modern event-study use cases.
3. Use `did_multiplegt_old(...)` only for legacy replication.
4. Use `wagepan_mgt` for quick smoke tests.

## Layer 5 Source (GitHub)

- **Repo**: [Credible-Answers/did_multiplegt](https://github.com/Credible-Answers/did_multiplegt)
- **Key files**: `R/R/did_multiplegt_main.R`, `R/R/did_multiplegt_dyn.R`
- See also: [Credible-Answers/did_multiplegt_dyn](https://github.com/Credible-Answers/did_multiplegt_dyn) (the DYN backend)

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R DIDmultiplegt
Rscript scripts/package-doc.R DIDmultiplegt did_multiplegt
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [DIDmultiplegt.md](DIDmultiplegt.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example demonstrates basic usage with the package's built-in wage panel data, comparing static and dynamic estimators.

```r
# NOTE: DIDmultiplegt v2.0.0+ depends on DIDmultiplegtDYN which requires polars.
# Load polars first to ensure the 'pl' object is on the search path.
library(polars)
library(DIDmultiplegt)

# Load sample data
data("wagepan_mgt", package = "DIDmultiplegt")

# Dynamic/event study estimator via mode = "dyn"
# (a plot is produced automatically unless graph_off = TRUE)
result_dynamic <- did_multiplegt(
  mode = "dyn",
  df = wagepan_mgt,
  outcome = "lwage",        # Outcome variable
  group = "nr",             # Group variable (individual ID)
  time = "year",            # Time variable
  treatment = "union",      # Treatment variable
  effects = 5,              # Number of effects to estimate
  placebo = 2               # Number of placebo tests
)

# View results
summary(result_dynamic)
```

## Reading Strategy

- Pick the estimator mode here first.
- Use installed help for current arguments; `DIDmultiplegt.md` preserves the historical snapshot.
- Use `DIDmultiplegt-additional.md` and source files for implementation differences across branches.
