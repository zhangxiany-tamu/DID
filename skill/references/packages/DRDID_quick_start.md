# DRDID: Quick Start

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
- For repository-derived implementation tips and caveats, read `DRDID-additional.md`.

## Quick Workflow

1. Use `drdid(...)` as the primary doubly robust ATT entry point.
2. Choose `panel = TRUE/FALSE` to match data structure.
3. Use bootstrap options when inference assumptions are fragile.
4. Use low-level `*_panel` / `*_rc` functions only for diagnostics.

## Repository Highlights (From Additional Notes)

- The repo separates many low-level estimators (`*_panel`, `*_rc`, `*_imp_*`) from high-level wrappers (`drdid`, `ipwdid`, `ordid`).
- Bootstrap is deeply implemented via dedicated worker functions (`wboot_*`) across panel and repeated-cross-section settings.
- C++ hooks (`RcppExports`) are present for treatment uniqueness checks and preprocessing support.

## Layer 5 Source (GitHub)

- **Repo**: [pedrohcgs/DRDID](https://github.com/pedrohcgs/DRDID)
- **Key files**: `R/drdid.R`, `R/drdid_imp_panel.R`, `R/wboot_drdid_rc.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R DRDID
Rscript scripts/package-doc.R DRDID drdid
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [DRDID.md](DRDID.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

### Example 1: Panel data (matched units observed in both periods)

```r
library(DRDID)
data(nsw_long)

# Create evaluation dataset (treatment group + comparison group)
eval_lalonde_cps <- subset(nsw_long,
                          nsw_long$treated == 0 | nsw_long$sample == 2)

# Doubly robust DiD estimation with panel data
dr_panel <- drdid(
  yname = "re",              # Real earnings outcome
  tname = "year",            # Time variable
  idname = "id",             # Individual identifier
  dname = "experimental",    # Treatment group indicator
  xformla = ~ age + educ + black + married + nodegree + hisp + re74,
  data = eval_lalonde_cps,
  panel = TRUE,              # Panel data structure
  boot = TRUE,               # Bootstrap inference
  nboot = 999
)

summary(dr_panel)
```

### Example 2: Repeated cross-section (different units across periods)

When individuals are not tracked over time, use `panel = FALSE`.

```r
library(DRDID)
data(sim_rc)   # Simulated repeated cross-section data

# Doubly robust DiD with repeated cross-section
dr_rc <- drdid(
  yname = "y",               # Outcome variable
  tname = "post",            # Time indicator (0 = pre, 1 = post)
  idname = "id",             # Unit identifier
  dname = "d",               # Treatment group indicator
  xformla = ~ x1 + x2 + x3 + x4,
  data = sim_rc,
  panel = FALSE              # Repeated cross-section
)

summary(dr_rc)
```

## Reading Strategy

- Use this quick-start file to choose the right function first.
- Look up the needed topic using the installed-help commands above.
- Use `-additional.md` for implementation caveats and repository-derived gotchas.
