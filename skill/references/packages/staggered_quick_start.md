# staggered: Quick Start

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived implementation notes, read `staggered-additional.md`.

## Quick Workflow

1. Run `balance_checks(...)` before estimating treatment effects.
2. Estimate with `staggered(...)` and compare with `staggered_cs(...)`/`staggered_sa(...)`.
3. Use helper builders when auditing internals or replicating formulas.

## Layer 5 Source (GitHub)

- **Repo**: [jonathandroth/staggered](https://github.com/jonathandroth/staggered)
- **Key files**: `R/balance_checks.R`, `R/compute_efficient_estimator_and_se.R`, `R/create_A0_lists.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R staggered
Rscript scripts/package-doc.R staggered staggered
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [staggered.md](staggered.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example demonstrates the core functionality of the staggered package using the included police training dataset. It shows how to estimate treatment effects and create an event study showing dynamic effects over time.

```r
library(staggered)
library(ggplot2)

# Load sample data (police training dataset)
df <- staggered::pj_officer_level_balanced

# Simple weighted average treatment effect
result_simple <- staggered(
  df = df,
  i = "uid",                    # Officer identifier
  t = "period",                 # Time period
  g = "first_trained",          # First training period
  y = "complaints",             # Outcome: number of complaints
  estimand = "simple"           # Simple weighted average
)

# View results
print(result_simple)

# Event study showing effects over time since treatment
event_results <- staggered(
  df = df,
  i = "uid",
  t = "period",
  g = "first_trained",
  y = "complaints",
  estimand = "eventstudy",
  eventTime = 0:23              # Effects for 24 months post-treatment
)

# Plot event study results
ggplot(event_results, aes(x = eventTime, y = estimate)) +
  geom_pointrange(aes(ymin = estimate - 1.96 * se,
                      ymax = estimate + 1.96 * se)) +
  geom_hline(yintercept = 0, linetype = "dashed") +
  labs(
    title = "Effect of Police Training on Complaints",
    x = "Months Since Training",
    y = "Effect on Number of Complaints"
  ) +
  theme_minimal()
```

## Reading Strategy

- Use this file to select the estimator variant quickly.
- Use installed help for current arguments; `staggered.md` preserves the historical snapshot.
- Use source references for internal matrix/variance debugging.
