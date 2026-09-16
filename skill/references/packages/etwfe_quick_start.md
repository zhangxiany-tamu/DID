# etwfe: Quick Start

Read this file first for the workflow and examples. Use installed help for version-specific arguments and available topics.

## How To Use This File

- Start here for package orientation and function selection.
- For current arguments and package examples, use [installed help](#installed-help-topics).
- For repository-derived caveats and workflow notes, read `etwfe-additional.md`.

## Quick Workflow

1. Estimate extended TWFE with `etwfe(...)`.
2. Recover interpretable effects using `emfx(...)`.
3. Visualize dynamic effects with `plot.emfx(...)`.

## Layer 5 Source (GitHub)

- **Repo**: [grantmcdermott/etwfe](https://github.com/grantmcdermott/etwfe)
- **Key files**: `R/etwfe.R`, `R/emfx.R`, `R/plot.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R etwfe
Rscript scripts/package-doc.R etwfe etwfe
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [etwfe.md](etwfe.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example demonstrates extended TWFE estimation and effect extraction using the mpdta dataset from the did package.

```r
library(etwfe)

# Load sample data from did package
data("mpdta", package = "did")

# Basic extended TWFE estimation
mod <- etwfe(
  fml = lemp ~ lpop,           # log employment ~ log population
  tvar = year,                 # time variable
  gvar = first.treat,          # first treatment period
  data = mpdta,                # dataset
  vcov = ~countyreal          # clustered standard errors
)

# View model summary
summary(mod)

# Simple average treatment effect
simple_att <- emfx(mod, type = "simple")
print(simple_att)

# Event study effects
event_effects <- emfx(mod, type = "event")
print(event_effects)

# Group-specific effects
group_effects <- emfx(mod, type = "group")
print(group_effects)
```

## Reading Strategy

- Use this file for rapid estimator selection.
- Use installed help for current arguments; `etwfe.md` preserves the historical snapshot.
- Use source references for FE specification and VCOV behavior checks.
