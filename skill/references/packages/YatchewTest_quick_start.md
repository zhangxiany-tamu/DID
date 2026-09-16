# YatchewTest: Quick Start

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived implementation insights, read `YatchewTest-additional.md`.

## Quick Workflow

1. Use `yatchew_test(...)` to test linearity in treatment-response relationships.
2. Use the `data.frame` method when working with tabular inputs.
3. Treat results as functional-form diagnostics, not identification tests.

## Layer 5 Source (GitHub)

- **Repo**: [Credible-Answers/yatchew_test](https://github.com/Credible-Answers/yatchew_test)
- **Key files**: `R/yatchew_test.R`, `R/nearest_neighbor_sort.R`, `R/path_plot.R`, `R/print.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R YatchewTest
Rscript scripts/package-doc.R YatchewTest yatchew_test
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [YatchewTest.md](YatchewTest.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example demonstrates the core functionality of the YatchewTest package by testing whether a relationship between variables is linear, which is useful for validating functional form assumptions in regression models.

```r
library(YatchewTest)

# Generate sample data with nonlinear relationship
set.seed(123)
n <- 1000
x <- rnorm(n, 0, 1)
y <- 2 + 0.5 * x + 0.3 * x^2 + rnorm(n, 0, 1)  # Quadratic relationship
data <- data.frame(x = x, y = y)

# Test for linearity
linear_test <- yatchew_test(
  data = data,
  Y = "y",              # Dependent variable
  D = "x",              # Independent variable
  het_robust = TRUE     # Robust to heteroskedasticity
)

# View results
print(linear_test)
```

## Reading Strategy

- Use this file to pick the right test entry point.
- Use `YatchewTest.md` for argument-level details.
- For deep function internals, consult the GitHub source linked in Layer 5 above.
