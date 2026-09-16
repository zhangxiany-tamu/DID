# Project: DID

This is a monorepo for modern Difference-in-Differences workflows in R. It has
three coordinated parts:

- `skill/` — the installable `did-analysis` skill. It contains Markdown guidance and
  optional R helpers for installed package help/API inspection, plus the package
  registry, runtime router, and maintainer docs needed by the skill.
- `mcp/` — the optional companion `did-mcp` server. It exposes the skill's
  core workflow as agent-callable tools backed by a TypeScript MCP server and a
  persistent R subprocess.
- `workflow/` — the `did-analysis` dynamic workflow (`workflow/did-analysis.ts`,
  invoked as `/did-analysis`). A single plain-JS orchestration script that runs
  the full 5-step procedure across many subagents, with statistical + economic +
  artifact-QA review at every step and an audience-tailored report. It prefers
  the `did_*` MCP tools when registered and falls back to the skill's R recipes.

## Contents

- [What This Repo Is](#what-this-repo-is)
- [What This Repo Is Not](#what-this-repo-is-not)
- [Repo Map](#repo-map)
- [Maintainer Read Order](#maintainer-read-order)
- [Editing Rules](#editing-rules)
- [Current State (2026-09-15)](#current-state-2026-09-15)

## What This Repo Is

- A knowledge base for modern Difference-in-Differences workflows in R.
- A root-managed monorepo whose installable skill lives under `skill/`.
- An optional MCP runtime that can execute the same workflow through `did_*`
  tools when registered with an MCP client.

## What This Repo Is Not

- Not an R package.
- Not a dataset repository.
- Not root-installable as a skill; install or symlink `skill/`, not the repo
  root.

## Repo Map

- `skill/SKILL.md` — thin runtime router; keep it concise.
- `skill/references/` — step guides, advanced methods, troubleshooting, and
  package docs.
- `skill/METHOD_MATRIX.md` — method/package priority tiers and MCP coverage.
- `skill/FAILURE_BUCKETS.md` — workflow failure taxonomy.
- `skill/BACKLOG.md` — current queue and maintenance rules.
- `skill/VALIDATION_RUNBOOK.md` — lean real-workflow validation prompts.
- `skill/NEXT_STEPS.md` — shortest maintainer handoff.
- `mcp/` — `did-mcp` TypeScript/R implementation, smoke tests, and MCP config
  example.
- `workflow/did-analysis.ts` — the `did-analysis` dynamic workflow script
  (plain JS, `.ts` extension); `workflow/README.md` documents its args, outputs,
  and agent topology.
- `scripts/did-examples-lib.mjs` — shared DID Examples CSV preparation helpers
  used by MCP and skill validation audits.
- `install.sh` — symlinks `skill/` into `~/.claude/skills/did-analysis/`, links
  `workflow/did-analysis.ts` into `~/.claude/workflows/`, and optionally builds
  `mcp/`.

## Maintainer Read Order

1. `skill/NEXT_STEPS.md`
2. `skill/BACKLOG.md`
3. `skill/METHOD_MATRIX.md`
4. `skill/VALIDATION_RUNBOOK.md`
5. `skill/SKILL.md`
6. Relevant step guides in `skill/references/`
7. `mcp/README.md` when changing MCP behavior

## Editing Rules

- Keep `skill/` self-contained: every path referenced by `skill/SKILL.md` must
  exist under `skill/` after `install.sh` symlinks it.
- Keep `skill/SKILL.md` as a router, not a second full manual.
- Edit package membership in `skill/references/package-registry.json`; run
  `node scripts/package-maintenance.mjs sync` and `check` to keep the package index
  and workflow inventory synchronized. Use installed help for API details.
- The observed API baseline is separate from validation evidence. Refresh it
  explicitly; update the version ledger only after workflow checks pass.
- Put new workflow detail in the relevant step guide, not back into
  `skill/SKILL.md`.
- Keep the MCP tool names in `mcp/src/server.ts` synchronized with the tool map
  in `skill/SKILL.md` and `skill/METHOD_MATRIX.md`.
- Read `*_quick_start.md` before `*.md` when you need package-specific detail.
- Do not add a new package without updating `skill/SKILL.md`, the relevant step
  guide, `skill/METHOD_MATRIX.md`, and the full 3-file package doc set when
  appropriate.
- When a step guide, estimator, never-treated coding, or tracked package changes,
  keep `workflow/did-analysis.ts` in sync — its `STEP_GUIDE` paths, per-estimator
  recodings (in the SHARED block and the Step 3 prompt), and `PACKAGES` list must
  match the skill. Keep `did-analysis.ts` plain-JS-valid (no TypeScript
  annotations; no `Date.now()`/`Math.random()`/filesystem access in the script
  body — only its subagents do I/O).
- Files over 100 lines must have a `## Contents` section with markdown-linked
  anchors.
- Prefer built-in package datasets or standard package examples in docs and
  validation notes.

## Current State (2026-09-15)

### Completed

- One package registry drives the installer and generated index/workflow inventory.
- Installed-help lookup replaces line-number menus. Offline API comparison keeps
  observed baselines separate from validated versions.
- BJS uses zero-coded never-treated units; did2s preserves matched full covariance.
- Audit failures now produce nonzero exit status; portable maintenance/orchestration
  checks and CI supplement the full local validation.

- `skill/` is the installable skill root and contains its `references/` docs.
- `SKILL.md` routes between tool-aware MCP execution and code-generation
  fallback.
- `mcp/` ships the full advertised 5-step workflow surface: session/ping,
  Step 1 loading/checking/profiling/recode/rollout, Step 2 TWFE diagnostics,
  Step 3 estimators/comparison/event-study extraction, Step 4 power analysis,
  Step 5 HonestDiD sensitivity, plus plotting, DRDID, and narrative reports.
- The 2026-09-15 validation pass succeeded for Node 22 build/tests/smokes,
  forced worker recycling, six real-data MCP scenarios, the 16-tool x 6-dataset
  MCP matrix, and the skill R fallback recipe audit.
- `panelView`, `did2s`, `didimputation`, `staggered`, `DRDID`,
  `DIDmultiplegtDYN`, `DIDmultiplegt`, and `polars` are installed locally and
  exercised by either the maintained audits or quick package examples.

### Known Limitations

- `HonestDiD_quick_start.md` still relies on `HonestDiD:::sunab_beta_vcv`.
- `pretrends` and `synthdid` remain GitHub-only packages.
- Some advanced-method workflows remain code-generation only; use MCP tools
  for covered `did_*` workflow steps and fall back to step-guide R code outside
  that surface.
- `etwfe`, `gsynth`, `synthdid`, and `YatchewTest` are installed locally but
  remain outside the defended P0 audit path.

### Next Work

- Keep `skill/METHOD_MATRIX.md`, `skill/SKILL.md`, and MCP tool registration in
  sync whenever a tool is added, renamed, or removed.
- Refresh `skill/references/package-versions.md` only after validation passes.
- Keep `skill/BACKLOG.md` evidence-driven rather than expanding scope
  speculatively.
- Keep `scripts/did-examples-lib.mjs` as the shared source for DID Examples
  validation-panel preparation across MCP and skill fallback audits.
