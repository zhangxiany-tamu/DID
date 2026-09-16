# did-analysis workflow

`did-analysis.ts` is a [dynamic workflow](https://code.claude.com/docs/en/workflows) for
Claude Code: an orchestration script that fans a complete Difference-in-Differences analysis
out across many subagents in one session, with **every step independently reviewed before its
results are used downstream**. It is the orchestration counterpart to this repo's
[`skill/`](../skill) (the 5-step DiD method guides + R recipes) and [`mcp/`](../mcp) (the
`did_*` tool server).

Give it a panel dataset and a column mapping; it runs the
[Roth–Sant'Anna–Bilinski-Poe](../skill/references/did-master-guide.md) 5-step procedure
end-to-end and writes an audience-tailored report you can read, plus a machine-readable
`implementation.json` and every intermediate CSV/figure/table.

> The output is a **reviewed draft analysis**, not a substitute for judgment. The estimates,
> diagnostics, and the report's claims should be checked by a human before use. The workflow is
> built to reduce — not eliminate — the usual failure modes (wrong never-treated coding, TWFE
> bias ignored, implausible magnitudes, malformed outputs the report then cites).

## Contents

- [What it does](#what-it-does)
- [Execution path](#execution-path)
- [Install](#install)
- [Invoke](#invoke)
- [Outputs](#outputs)
- [Agent topology](#agent-topology)
- [Customization](#customization)

## What it does

1. **Package environment (offline, report-only).** One agent checks the actual MCP worker or
   fallback R environment against the observed API baseline and last-validated versions.
   It reports installed versions and source revisions, flags missing required packages,
   and treats missing optional packages as informational. Upstream releases are not checked;
   no files or packages are changed. Exact installed help is available when an argument is needed.
2. **The 5-step procedure, each step triple-reviewed.** A step's executor runs the method, then
   three independent reviewers run in parallel — **statistical** (correctness, assumptions,
   inference), **economic** (sign/magnitude plausibility, mechanism, applied sense), and
   **artifact-QA** (the CSVs/figures/tables exist, parse/render, and match the returned numbers).
   The step finishes only when no reviewer has an open blocking/major issue (capped by
   `maxStepReviewRounds` and a token-budget floor).
   - Step 1 Structure → routes the design (CANONICAL / STAGGERED / ADVANCED / NO_TREATMENT).
   - Step 2 Diagnostics → Goodman-Bacon + negative weights → severity (STAGGERED only).
   - Step 3 Estimation → the robust estimators run in parallel; one reviewed synthesis compares them.
   - Step 4 Power → `pretrends` detectable-trend slopes.
   - Step 5 Sensitivity → HonestDiD relative-magnitudes breakdown M.
3. **Consolidated artifact audit.** Before the report, a gate confirms every output file the report
   will cite is well-formed and mutually consistent (e.g. the event-study CSV matches the figure and
   the comparison table; the primary ATT is identical everywhere).
4. **Audience-tailored report + review.** A writer drafts the report for the chosen `audience`; a
   **correctness** reviewer (claims match the numbers) and an **audience-fit** reviewer (reads well
   for that audience) loop with the writer until both approve. The report ends in one of the skill's
   seven evidence verdicts (`STRONG EVIDENCE | MIXED | FRAGILE | SUGGESTIVE | EVIDENCE OF NULL |
   UNINFORMATIVE | INCONCLUSIVE`).

## Execution path

The workflow script never runs R or touches the filesystem — its subagents do. When the `did_*`
MCP tools are registered, agents prefer them; otherwise (the common case) they run the R recipes
documented in [`skill/references/did-step-*.md`](../skill/references) via `Rscript`. The Preflight
phase detects which path is available and records it so all agents stay consistent. Either way,
cross-step state lives in the run directory's files and the structured results — not in any
in-memory R/MCP handle, which does not survive between isolated subagents.

## Install

```bash
mkdir -p ~/.claude/workflows
ln -sfn "$(pwd)/workflow/did-analysis.ts" ~/.claude/workflows/did-analysis.ts
```

The repo's [`install.sh`](../install.sh) does this for you. After linking, it is invocable as
`/did-analysis` (it appears in `/` autocomplete).

**Requirements:** R 4.x with the required packages (`Rscript mcp/r/install_packages.R`). The MCP server is optional — without it, agents use the R fallback.

## Invoke

From inside Claude Code, include the keyword `workflow`:

```
Run the did-analysis workflow with args: {
  "data": "/abs/path/expansion.csv",
  "idVar": "state", "timeVar": "year", "outcomeVar": "emp",
  "gvar": "first_treat",
  "neverTreatedSourceCoding": "0",
  "audience": "economists"
}
```

or just `/did-analysis` and describe the dataset — the Configure agent will resolve the path and
infer the column mapping (and flag it back so a wrong guess is catchable).

### Args

| Arg | Default | Notes |
|---|---|---|
| `data` | — | Path to a CSV/Parquet panel. If omitted, the Configure agent searches the tree. |
| `idVar`, `timeVar`, `outcomeVar` | — | Unit id, time, outcome columns. |
| `gvar` | — | Treatment-**timing** (cohort) column — the period a unit is first treated, **not** a 0/1 indicator. |
| `covariates` | `[]` | Optional covariates (used by DRDID / covariate-aware paths). |
| `clusterVar` | `idVar` | Cluster at the treatment-**assignment** level (e.g. state, not county). |
| `weightsVar` | — | Optional sampling-weights column; passed to estimators that accept weights. Omit to run unweighted. |
| `neverTreatedSourceCoding` | `unknown` | How the raw data marks never-treated: `0` \| `NA` \| `Inf` \| `sentinel`. Recoded per estimator automatically. |
| `estimators` | `["cs","sa","did2s","bjs","staggered"]` | Robust estimators to run in parallel. BJS is skipped on unbalanced panels. |
| `audience` | `"economists"` | `economists` \| `statisticians` \| `general` \| `applied`. Pass an **array** to emit one report variant per audience. |
| `outputDir` | `"analyses"` | Base dir; a per-run `<slug>/` subfolder is minted under it. |
| `path` | `"auto"` | Force the execution path: `auto` \| `mcp` \| `rfallback`. |
| `skipPackageCheck` | `false` | Skip the local package environment report. |
| `maxStepReviewRounds` | `2` | Cap on per-step executor⇄reviewer revision rounds. |
| `maxReportReviewRounds` | `2` | Cap on report revision rounds. |

## Outputs

Written to `analyses/<slug>/`:

- `packages-report.md` — installed versions, source revisions, and comparison with the recorded environment.
- `config.md` — the resolved column mapping and rationale.
- `01_structure.md` … `05_sensitivity.md` — per-step writeups.
- `tables/`, `figures/` — every generated CSV and plot.
- `artifact-audit.md` — the consolidated integrity check.
- `implementation.json` — machine-readable contract: config, every step result (incl. the
  `{betahat, tVec, sigma}` event-study triples), and verdicts.
- `report.md` (or `report-<audience>.md` per variant) — the final reviewed report.
- `review-log.md` — what every reviewer raised and how many rounds each loop took.

## Agent topology

| Phase | Agents |
|---|---|
| Preflight | 1 |
| Packages | 1 offline environment checker |
| Configure | 1 |
| Each of the 5 steps | 1 executor + 3 reviewers (statistical · economic · artifact-QA) per round |
| Step 3 also | up to 5 estimators run in parallel before the reviewed synthesis |
| Artifact Audit | 1 (+ bounded remediation) |
| Report | 1 writer per audience variant |
| Report Review | 2 reviewers (correctness · audience-fit) per round |
| Compile | one write-agent per output file (parallel) |

Agent usage varies with review rounds and audience variants. Each additional step review
round adds four agents; each report review adds three. Watch progress with `/workflows`.

## Customization

`did-analysis.ts` is a single self-contained file (plain JavaScript despite the `.ts` extension):

- `AUDIENCE_PROFILE` — add or edit an audience's tone/structure guidance.
- [`package-registry.json`](../skill/references/package-registry.json) — the editable package inventory.
  Run `node scripts/package-maintenance.mjs sync` at the repo root to regenerate the embedded
  `PACKAGES` constant and package index. `check` fails if either generated copy is stale.
- `runReviewedStep` and the per-step `criteria` — what each reviewer scrutinizes; tighten or loosen
  the bar there.
- `maxStepReviewRounds` / `maxReportReviewRounds` / the `*_BUDGET_FLOOR` constants — loop depth and
  when to stop on a low token budget.
- `STEP_GUIDE` — the skill guides the executors and reviewers read.

Per-step dependencies are sequential `await`; independent work (estimators, the
three reviewers, file writes) uses `parallel()`.
