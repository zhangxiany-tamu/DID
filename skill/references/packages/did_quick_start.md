# did: Quick Start

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
- For repository-derived implementation tips and caveats, read `did-additional.md`.

## Quick Workflow

1. Estimate ATT(g,t) with `att_gt(...)`.
2. Aggregate with `aggte(...)` (`dynamic`, `group`, `calendar`, `simple`).
3. Plot/report with `ggdid(...)` and summary helpers.
4. For robustness, pair with pretests and sensitivity workflows.

## Repository Highlights (From Additional Notes)

- The repo includes an internal `R/honest_did/` bridge (`honest_did.AGGTEobj`) for direct sensitivity workflows after `aggte`.
- There is an explicit pretest pipeline (`conditional_did_pretest`, multiplier bootstrap helpers) beyond core ATT estimation.
- Test suite is broad: point estimates, inference, pretest behavior, simulation consistency, and user bug regressions.

## Layer 5 Source (GitHub)

- **Repo**: [bcallaway11/did](https://github.com/bcallaway11/did)
- **Key files**: `R/att_gt.R`, `R/aggte.R`, `R/conditional_did_pretest.R`, `R/honest_did/honest_did.R`

## Installed Help Topics

From the installed skill directory (the `skill/` directory in this repository):

```bash
Rscript scripts/package-doc.R did
Rscript scripts/package-doc.R did att_gt
```

The first command lists help topics and aliases from your installed version.
The second reads one topic with its version, library path, and recorded Git SHA.
Use `--lib /path/to/R/library` to select a library explicitly.

If R or the package is unavailable, [did.md](did.md) remains a historical
reference snapshot; its version may differ from the analysis environment.
See the [package index](../package-index.md) for the supported inventory and
[package maintenance guide](../../PACKAGE_MAINTENANCE.md) for version checks.

## Common Use Case Example

This example estimates group-time average treatment effects using county-level teen employment data with staggered minimum wage adoption, then aggregates to an event study and an overall ATT. Uses `control_group = "notyettreated"` (the recommended default when there are few never-treated units) and doubly robust estimation.

```r
library(did)
data(mpdta)

# Estimate group-time ATTs
out <- att_gt(
  yname = "lemp",
  gname = "first.treat",
  idname = "countyreal",
  tname = "year",
  xformla = ~1,
  data = mpdta,
  est_method = "dr",                       # doubly robust (default)
  control_group = "notyettreated"          # recommended over "nevertreated"
)

# View group-time ATT estimates
summary(out)

# Plot group-time effects
ggdid(out, ylim = c(-.25, .1))

# Aggregate to event study (most common reporting format)
es <- aggte(out, type = "dynamic")
summary(es)
ggdid(es)

# Simple weighted ATT (single number summary)
simple <- aggte(out, type = "simple")
cat(sprintf("Overall ATT: %.4f (SE: %.4f)\n", simple$overall.att, simple$overall.se))

# Group-specific effects
group_effects <- aggte(out, type = "group")
summary(group_effects)
```

## Reading Strategy

- Use this quick-start file to choose the right function first.
- Look up the needed topic using the installed-help commands above.
- Use `-additional.md` for implementation caveats and repository-derived gotchas.
