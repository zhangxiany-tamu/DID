# Package maintenance implementation plan

Date: 2026-09-15. Builds on [the repository review](package-review.md).
Fable collaboration: public-repository review, plan critique, and a final review
of the implementation summary. Findings and decisions are recorded below.

## Contents

- [Outcome](#outcome)
- [Design decisions](#design-decisions)
- [Implementation sequence](#implementation-sequence)
- [Acceptance criteria](#acceptance-criteria)
- [Validation](#validation)
- [Completion record](#completion-record)

## Outcome

Agents can obtain documentation matching the R package they actually execute.
Maintainers update one package inventory and review changes to the functions the
workflow uses. Ordinary analyses do not launch an internet-research agent for
every package. Installation, optional-package behavior, and the MCP tool surface
remain explicit and easy to understand.

## Design decisions

- Keep methodological choices, short recipes, and caveats authored and reviewed.
- Put the registry and optional R helpers inside `skill/` so copying the skill
  directory remains sufficient for documentation lookup.
- Separate curated package metadata, observed API snapshots, and evidence of
  validation. Observing a version never promotes it to a validated version.
- Start with a base-R help helper without a cache: five complete lookups took
  about 0.16 seconds for `did` and 0.90 seconds for `fixest` locally. A persistent
  cache would add invalidation and corruption handling without a demonstrated
  need. Installed help is already an offline documentation store.
- Inspect relevant functions only. A changed signature is a review signal;
  an unchanged one is not proof that statistical behavior is unchanged.
- Keep this first implementation offline. Fable recommended cutting upstream
  polling, and local lookup timings did not justify a cache. Record package source
  and installed GitHub revisions without claiming to know the newest release.
- Keep all workflow I/O in its agents, not in the orchestration script body.
- Retain existing manuals as labeled historical snapshots during migration.
  Replace fragile line pointers with installed help-topic lookup. Do not create
  another full manual generator or automatically rewrite statistical prose.
- Preserve every existing `did_*` tool name. No generic R execution tool, vector
  database, additional service, package upgrades, or automatic publishing.

## Implementation sequence

### 1. Package help and one inventory

Create `skill/references/package-registry.json` with names, method priorities,
installation policies, sources, relevant function topics, private dependencies,
and documented-reference membership. Include explicit runtime helpers separately
from methodological priorities. Validate uniqueness, paths, and source fields.

Add `skill/scripts/package-doc.R` with help-topic listing and exact alias lookup,
an explicit library option, version/library/SHA provenance, clean text output,
and useful nonzero errors. Do not load package namespaces, run examples, or
evaluate render-time Rd expressions. Base R is sufficient.

### 2. Deterministic maintenance

Add a small inspection command that reads the registry, reports installed
metadata, and compares relevant function signatures with an explicit observed
baseline. Keep this baseline distinct from the validation ledger. Default status
reads metadata only; explicit `--api` loads installed namespaces to inspect
signatures. It runs no examples and downloads no code.

Generate a compact package index and check any generated workflow constants.
Use the registry for installer membership and installation summaries. Bootstrap
the existing `jsonlite` dependency only if needed to read JSON.

### 3. Agent and documentation integration

Replace the workflow's 17 package researchers and summarizer with a single
local-inspection task. Preserve `skipPackageCheck`; omit upstream polling. Read the same R environment used for the selected execution
path. Add actual package provenance to MCP health/estimate responses.

Update the thin skill router, quick-start lookup sections, package snapshot
banners, and a concise maintenance guide. Keep authored examples. Document the
exact commands in the root README and update the workflow's arguments/topology.
Keep review/plan records together under `docs/maintenance/`.

### 4. Statistical corrections, separately tested

Normalize BJS never-treated values to documented zero coding. Keep legacy finite
sentinel recoding available but place it beyond observed time and preserve its
identity through MCP/RDS handles. Synchronize the workflow and skill recipes.

For did2s, align the full covariance matrix by coefficient names and preserve it
when selecting event times. Reject invalid alignment instead of fabricating a
matrix. Leave other estimators' covariance behavior unchanged. Test these
changes against direct package calls, not fixed output numbers.

### 5. Trustworthy validation gates

Make both audit scripts exit nonzero on failed, missing, or incomplete cells and
on failed R execution. Record per-estimator results and require successful CS
benchmark evaluation. Retain only explicitly justified dataset exceptions.

Add focused tests for the help helper, registry consistency, drift detection,
audit outcomes, BJS treatment coding, and did2s covariance. Add portable CI for
offline consistency and the Node build/unit suite. Keep heavy real-data audits
as release validation rather than requiring private datasets for ordinary CI.

## Acceptance criteria

1. A copied `skill/` directory can list and render installed help with base R;
   canonical topics and aliases match, including multiple R libraries.
2. Help output cannot execute examples or render-time expressions and reports
   missing/ambiguous topics and damaged help databases clearly.
3. Installer/workflow inventories agree with one registry; no manual package
   list has to be edited merely because an upstream package version changes.
4. Normal analysis performs no online package scan. Observed and validated
   identities remain distinct; upstream releases are explicitly not checked.
5. Drift tests distinguish unchanged metadata, changed signatures, missing
   functions, and same-version/different-SHA installations; inspection errors
   remain explicit and block snapshots. Baseline replacement requires an explicit command.
6. Long panels retain genuinely never-treated units; finite recoding round-trips
   through handles/RDS. BJS agrees with a direct zero-coded package call.
7. did2s event-study covariance equals the appropriately named subset of the
   fitted model's covariance, including reordered matrices and trimmed windows.
8. Failed/incomplete audits produce a failing process status; full maintained
   validation completes successfully before recording a new validation pass.

## Validation

Run focused tests first, then the project's declared checks under Node 22:

```sh
cd mcp
npm run build
npm test
npm run smoke:all
npm run smoke:recycle
npm run validate:real
node scripts/audit-mcp-matrix.mjs
node ../skill/scripts/audit-skill-recipes.mjs
```

Also exercise help for all 17 documented packages, a copied standalone skill,
installation dry runs, offline and failed-inspection cases, generated-data consistency,
and the workflow's plain-JavaScript syntax. Validate the edited skill router and
check Markdown links. Inspect the final diff and exclude scratch outputs.

## Completion record

Implemented and validated locally on 2026-09-15, using Node 22.18.0 and R 4.5.2.
No R packages were upgraded. These results describe the local validation before
the release-candidate PR; GitHub CI results belong to that PR.

| Area | Delivered and verified |
|---|---|
| Inventory | 22 packages; 17 curated package guides; 27 tracked functions. The installer reads the registry, and `sync`/`check` own the generated index and workflow constant. |
| Installed help | Base-R alias lookup and provenance. All 17 package lookups passed; a standalone skill copy works in a directory with spaces. Fixtures cover multiple libraries, missing/ambiguous topics, damaged help, and no namespace/example/Rd-expression execution. |
| Maintenance | Offline metadata by default; explicit `--api` signature inspection; explicit observed snapshots. Drift/error tests cover versions, SHAs, missing functions, metadata failures, startup-library precedence, loaded-versus-installed versions, and symlinked invocation. |
| MCP provenance | Health and all estimator envelopes include actual package identities from the R worker. Smoke assertions verify the fields. |
| Workflow | One local package agent; `skipPackageCheck` preserved. Package observations reach report writers and reviewers. Eight mocked paths validate schemas, routing, and output JSON. |
| Statistical contracts | Long-panel recoding and RDS identity tests, direct-package BJS parity, did2s named covariance alignment and joint trimming, plus real downstream power/HonestDiD calls. |
| Audit gates | Failure fixtures prove missing/failed cells and abnormal R execution return nonzero after writing reports. All five estimators succeeded on all six datasets in both full audits. |
| Portable CI | Node 22 build/tests, offline maintenance/orchestration checks, jsonlite metadata checks, base-R help fixtures. Heavy external-data audits remain a separate local validation. |

Commands completed successfully:

- MCP build and 15 unit tests.
- 42 audit/maintenance/orchestration tests, with no skips; installed-help fixture suite.
- `smoke:all`, including direct statistical contracts; `smoke:recycle`.
- Extended did2s smoke through power analysis and HonestDiD.
- `validate:real`: six scenarios.
- MCP matrix: **96/96 cells**; skill fallback: **30/30 cells**.
- Installer dry runs (normal and required-only), generated consistency, installed
  API status, skill-creator validation, relative links/Contents, and whitespace checks.

The did2s fixture illustrates why the covariance fix matters: detectable slopes
at 50%/80% power were about 0.00386/0.00582 with full covariance versus
0.00397/0.00609 with the prior diagonal approximation. These are illustrative
observations, not fixed test expectations or a general claim about direction.

Fable reviewed the public repository, challenged the plan, and gave a final
bounded review of the implementation summary through the browser. Its strongest
recommendations were adopted: local-only v1, explicit signature inspection,
strict audit gates, zero-coded BJS, covariance preservation, and a validation
ledger separate from observations. We retained build-time generation plus a
consistency check to avoid duplicate inventory edits; no workflow-body I/O was
introduced. Measurements did not justify its suggested documentation cache.
Legacy finite recodes cannot leak into BJS through the MCP path: their preserved
identity is normalized to zero before estimation. CSV export loses that identity,
which is documented in the migration guide.

Before the release-candidate PR, a fresh source copy with no `node_modules` or
build output also passed `npm ci`, build, all 15 unit tests, all 42 maintenance/
orchestration tests, and the full smoke suite. This check reused the validated
R 4.5.2 package environment; it did not install newer CRAN releases.

Validation reports remain ignored local artifacts, identified in
[`skill/BACKLOG.md`](../../skill/BACKLOG.md). The version ledger was refreshed only
after both full audits passed and checked against fresh JSON observations.

Remaining scope limits are explicit: the local pass did not include remote CI; the
live dynamic workflow host was checked with mocks rather than launched for a
complete agent analysis, and the fallback audit does not execute every literal
Markdown snippet. Historical manuals remain labeled fallbacks. Upstream polling,
a persistent cache, broader method support, and an upstream-manual retirement
migration are deferred.
