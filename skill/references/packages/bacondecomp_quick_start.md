# bacondecomp: Quick Start

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived implementation and testing notes, read `bacondecomp-additional.md`.

## Quick Workflow

1. Run `bacon(...)` on a TWFE-style formula with unit/time identifiers.
2. Summarize forbidden-comparison weight share.
3. Use decomposition as a diagnostic before estimator selection.
4. Use built-in datasets for reproducible demos.

## Layer 5 Source (GitHub)

- **Repo**: [evanjflack/bacondecomp](https://github.com/evanjflack/bacondecomp)
- **Key files**: `R/bacon.R`, `R/data.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R bacondecomp
Rscript scripts/package-doc.R bacondecomp bacon
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [bacondecomp.md](bacondecomp.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example demonstrates the Goodman-Bacon decomposition for a two-way fixed effects model using education reform data. The key diagnostic output is the **weight share by comparison type** — if "Later vs Earlier Treated" comparisons carry substantial weight, the TWFE estimate may be biased.

```r
library(bacondecomp)

# Run the bacon decomposition
df_bacon <- bacon(incearn_ln ~ reform_math,
                  data = bacondecomp::math_reform,
                  id_var = "state",
                  time_var = "class")

# KEY DIAGNOSTIC: Summarize weight share by comparison type
weight_summary <- aggregate(weight ~ type, data = df_bacon, FUN = sum)
weight_summary$pct <- round(100 * weight_summary$weight, 1)
print(weight_summary)
# "Later vs Earlier Treated" = potentially biased comparisons
# "Treated vs Untreated"     = clean comparisons

# Weighted average estimate by type
for (i in seq_len(nrow(weight_summary))) {
  typ <- weight_summary$type[i]
  sub <- df_bacon[df_bacon$type == typ, ]
  wavg <- weighted.mean(sub$estimate, sub$weight)
  cat(sprintf("  %s: estimate = %.4f (weight = %.1f%%)\n",
              typ, wavg, weight_summary$pct[i]))
}

# Overall TWFE estimate (for comparison)
twfe_est <- weighted.mean(df_bacon$estimate, df_bacon$weight)
cat(sprintf("Overall TWFE estimate: %.4f\n", twfe_est))

# Visualize the decomposition
library(ggplot2)
ggplot(df_bacon) +
  aes(x = weight, y = estimate, shape = factor(type)) +
  geom_point() +
  geom_hline(yintercept = 0) +
  theme_minimal() +
  labs(x = "Weight", y = "2x2 DiD Estimate", shape = "Comparison Type",
       title = "Goodman-Bacon Decomposition of TWFE")
```

## Reading Strategy

- Start with `bacon` usage here.
- Use installed help for current arguments; `bacondecomp.md` preserves the historical snapshot.
- Use repo tests to verify decomposition behavior in edge cases.
