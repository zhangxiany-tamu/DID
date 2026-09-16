# DID

**Modern Difference-in-Differences, agent-driven.** A Claude Code skill, a companion MCP server, and a multi-agent workflow that guide an AI agent through the Roth–Sant'Anna–Bilinski-Poe 5-step DiD workflow on your data — treatment-structure profiling, TWFE diagnostics, heterogeneity-robust estimation, pre-trends power, and HonestDiD sensitivity. See the [package index](skill/references/package-index.md) for the supported R packages.

## Contents

- [What's in the repo](#whats-in-the-repo)
- [Install](#install)
- [Quick start](#quick-start)
- [Run the full analysis as a workflow](#run-the-full-analysis-as-a-workflow)
- [MCP tool surface](#mcp-tool-surface)
- [Use with other agents](#use-with-other-agents)
- [How the skill and MCP interact](#how-the-skill-and-mcp-interact)
- [Package documentation and maintenance](#package-documentation-and-maintenance)
- [Validation](#validation)
- [Requirements](#requirements)
- [Migration from `DID-skills`](#migration-from-did-skills)
- [License](#license)

## What's in the repo

| Path | What it is |
|---|---|
| `skill/` | Installable `did-analysis` skill: Markdown workflow guides, curated package recipes, and optional R helpers for installed help and API inspection. Includes the package registry, failure taxonomy, and validation runbook. |
| `mcp/` | Optional companion `did-mcp` server — TypeScript MCP server + persistent R subprocess. Exposes 16 `did_*` tools that execute the skill's workflow end-to-end. |
| `workflow/` | The `did-analysis` [dynamic workflow](https://code.claude.com/docs/en/workflows) — a single script that orchestrates the full 5-step analysis across many subagents, with statistical + economic + artifact-QA review at every step and an audience-tailored report. Invoked as `/did-analysis`. See [`workflow/README.md`](workflow/README.md). |
| `scripts/did-examples-lib.mjs` | Shared validation-panel preparation helpers for MCP and skill fallback audits. |
| `scripts/package-maintenance.mjs` | Offline package status, observed API baselines, and generated inventory consistency. |
| `AGENTS.md` | Monorepo conventions and maintainer read order. |
| `install.sh` | Symlinks `skill/` into `~/.claude/skills/did-analysis/` and optionally builds the MCP. |
| `MIGRATION.md` | Upgrade notes for users coming from the flat-layout `DID-skills` v1. |

The parts work independently or together:

- **Skill only**: install `skill/`; the agent reads the docs and writes R code for you to run.
- **Skill + MCP**: install both; the agent calls `did_*` tools to execute the workflow and returns interpreted results, event-study plots, and a narrative markdown report.
- **Workflow**: install `workflow/`; run `/did-analysis` to drive the whole 5-step procedure as a reviewed, multi-agent pipeline that writes its outputs and a report to disk. It uses the `did_*` tools when the MCP is registered and falls back to the skill's R recipes otherwise.

## Install

```bash
git clone https://github.com/zhangxiany-tamu/DID.git
cd DID
./install.sh
```

The installer symlinks `skill/` into `~/.claude/skills/did-analysis/`, links `workflow/did-analysis.ts` into `~/.claude/workflows/` (invocable as `/did-analysis`), and, if you say yes, runs `npm install && npm run build` inside `mcp/`.

**Skill-only install (no MCP):**

```bash
ln -s "$(pwd)/skill" ~/.claude/skills/did-analysis
```

**Register the MCP with Claude Code** — copy the `did-mcp` block from `mcp/mcp-config.example.json` into your `~/.claude/settings.json` (`mcpServers` key), adjust the absolute paths to your Node and `Rscript` binaries, then restart Claude Code.

## Quick start

In a Claude Code session inside your project directory:

```
I have a state-year panel at data/expansion.csv with columns state, year, treatment_year, outcome.
Run the did-analysis workflow end-to-end — profile the treatment structure, check TWFE bias,
estimate ATT with a heterogeneity-robust method, test pre-trends power, and report HonestDiD
sensitivity bounds. Flag any estimator disagreement.
```

With the MCP registered, Claude will call `did_ping` → `did_load_panel` → `did_check_panel` → `did_profile_design` → `did_recode_never_treated` / `did_plot_rollout` as needed → `did_diagnose_twfe` → `did_estimate` / `did_compare_estimators` → `did_extract_event_study` → `did_power_analysis` → `did_honest_sensitivity` → `did_plot` → `did_report`, returning a markdown narrative with ATTs, event-study coefficients, breakdown M̄, and a flagged estimator-agreement table.

Without the MCP, Claude reads `skill/SKILL.md` + the step guides and produces runnable R code for the same pipeline.

## Run the full analysis as a workflow

For a hands-off, reviewed run, use the `did-analysis` [dynamic workflow](https://code.claude.com/docs/en/workflows) instead of a conversational request:

```
Run the did-analysis workflow with args: {
  "data": "data/expansion.csv",
  "idVar": "state", "timeVar": "year", "outcomeVar": "emp",
  "gvar": "treatment_year", "neverTreatedSourceCoding": "0",
  "audience": "economists"
}
```

It inspects the installed R package environment offline, runs all 5 steps with three independent reviewers per step (statistical, economic, artifact-QA) looping until no blocking issue remains, audits every generated CSV/figure/table for consistency, then writes an audience-tailored `report.md` (plus `implementation.json` and all intermediates) under `analyses/<slug>/`. Watch progress with `/workflows`. Full details, args, and outputs are in [`workflow/README.md`](workflow/README.md).

## MCP tool surface

The registered MCP server exposes 16 tools:

`did_ping`, `did_session`, `did_load_panel`, `did_check_panel`, `did_profile_design`, `did_recode_never_treated`, `did_plot_rollout`, `did_diagnose_twfe`, `did_estimate`, `did_compare_estimators`, `did_extract_event_study`, `did_power_analysis`, `did_honest_sensitivity`, `did_plot`, `did_drdid`, and `did_report`.

The skill's `METHOD_MATRIX.md` and `SKILL.md` are the source of truth for which workflow each tool covers.

## Use with other agents

The MCP server is not Claude-specific. Any client that can launch a stdio MCP server can register `did-mcp` by running:

```bash
node /absolute/path/to/DID/mcp/dist/index.js
```

with `R_PATH` pointing at your `Rscript` binary. Tool schemas are standard MCP JSON Schema.

The skill is portable as context: agents without a Claude-style skill mechanism can load `skill/SKILL.md` and the `references/` guides as normal prompt context and prefer `did_*` tools when the MCP is registered. Native skill-install formats are client-specific; the bundled installer currently targets Claude Code's `~/.claude/skills/did-analysis/` layout.

## How the skill and MCP interact

The skill does not call the MCP directly — the MCP client does. When `did-mcp` is registered, tools named `did_*` appear in the client's tool list. `SKILL.md` instructs the agent to prefer those tools when available and to fall back to R code generation when they are not. The two execution paths are contract-identical: R backends under `mcp/r/` mirror the R bodies documented in `skill/references/did-step-*.md`, so the MCP-driven and code-gen paths produce the same results.

See `skill/SKILL.md` for the routing logic and `mcp/README.md` for MCP build, configuration, and development details.

## Package documentation and maintenance

The curated guides explain which methods fit a design. For function arguments,
read the help installed with the R package used by the analysis:

```bash
Rscript skill/scripts/package-doc.R did
Rscript skill/scripts/package-doc.R did att_gt
```

The first command lists available help topics; the second reads one topic with
its version, library path, and recorded Git SHA. Help lookup needs only base R
and works without MCP or network access. Add `--lib /path/to/R/library` to select
a library explicitly. Existing full manuals remain labeled historical snapshots.

One [registry](skill/references/package-registry.json) controls package inventory
and installation policy. From the repository root:

```bash
node scripts/package-maintenance.mjs status        # offline metadata comparison
node scripts/package-maintenance.mjs status --api  # also inspect relevant APIs
node scripts/package-maintenance.mjs check         # check generated inventories
node scripts/package-maintenance.mjs sync          # regenerate after registry edits
node scripts/package-maintenance.mjs snapshot      # explicitly replace observed baseline
```

Status returns exit code 1 when it finds drift or missing required packages.
API inspection loads installed namespaces; documentation lookup does not.
The observed baseline is separate from the last-validated version ledger and
never promotes an update to validated status. See the
[maintenance guide](skill/PACKAGE_MAINTENANCE.md) for the review and validation
process, including the standalone skill's JSON status command.

## Validation

The MCP's verification suite covers unit tests, smoke tests, estimator smokes, edge cases, and a six-scenario real-data audit covering every tool × dataset combination. From `mcp/`:

```bash
npm test                 # vitest unit tests
npm run build            # TypeScript build
npm run smoke:all        # statistical contracts + core/estimator/edge smokes
npm run smoke:recycle    # same core smoke path with forced R worker recycling
npm run validate:real    # 6 real datasets × 16 tools, emits a markdown matrix
```

`npm run validate:real` writes ignored reports under `mcp/validation-output/`. See `mcp/REAL_DATA_VALIDATION.md` for scenario details.

An additional harness validates the skill's R code-gen fallback recipes:

```bash
cd skill && node scripts/audit-skill-recipes.mjs
```

Both audit scripts pass on all 6 DID Examples datasets (96/96 MCP cells, 30/30 skill cells as of 2026-09-15).

The offline package-documentation checks run without downloading packages:

```bash
npm --prefix mcp run test:maintenance
node scripts/package-maintenance.mjs status --api
```

## Requirements

- **R** 4.x with the packages appropriate to the workflow. The [package index](skill/references/package-index.md) distinguishes required, optional, and manually installed packages. Run `Rscript mcp/r/install_packages.R` for the core installation and best-effort optional packages. Installed-help lookup uses base R; JSON status also requires `jsonlite`.
- **Node** 22.x (see `mcp/.nvmrc`) — required for the MCP server and repository maintenance CLI.
- **Claude Code** or any MCP-compatible client — required only to use the skill interactively.

## Migration from `DID-skills`

This repo was previously `github.com/zhangxiany-tamu/DID-skills` with all skill files at the repo root. The skill is now under `skill/` and the MCP lives under `mcp/`. The flat-layout v1 is frozen at tag `skill-v1.1.0-flat`. See `MIGRATION.md` for upgrade steps.

## License

MIT — see `LICENSE`.
