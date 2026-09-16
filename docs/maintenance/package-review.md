# Package maintenance review

Review date: 2026-09-15. Local baseline: `bff9830`.

This records the initial review of `bff9830`; findings describe that baseline.
The subsequent [implementation plan](implementation-plan.md) records the final
scope and verification. Upstream polling and caching were deferred after Fable's
plan critique. No runtime behavior was changed during this initial review.

## Contents

- [Recommendation](#recommendation)
- [Verified maintenance findings](#verified-maintenance-findings)
- [Proposed design](#proposed-design)
- [Smallest useful first change](#smallest-useful-first-change)
- [Migration and validation](#migration-and-validation)
- [Other improvements found](#other-improvements-found)
- [Checks performed](#checks-performed)
- [Fable review](#fable-review)
- [Sources](#sources)

## Recommendation

Maintain the statistical guidance; obtain mechanical API details from R itself.
Use one curated package registry for inventories, installed-version help lookup
for arguments and examples, and a separate cached maintenance check for upstream
changes. Package releases should trigger targeted review, not manual rewriting
of three documents per package or a new internet research task for every analysis.

This addresses both possible meanings of “menu”: lists of supported packages
and the function maps/manuals maintained for those packages. The existing P0/P1
boundary, explicit estimator adapters, and validated recipes remain valuable.

## Verified maintenance findings

| Finding | Evidence | Consequence |
|---|---|---|
| Substantial duplicated reference material | `skill/references/packages/` has 51 Markdown files, 17 three-file sets, and 21,203 lines; `fixest.md` alone has 9,429 lines. | Much of the maintenance concerns reference information already shipped by upstream packages. |
| Manuals lag the validation ledger | Seven manual headers describe older versions: `did`, `fixest`, `did2s`, `didimputation`, `DIDmultiplegtDYN`, `DRDID`, and `gsynth`. | Passing workflow tests does not establish that the bundled manuals match the tested environment. |
| Confirmed argument drift | [did.md](../../skill/references/packages/did.md) describes 2.1.2 and omits `faster_mode`; installed `did` 2.3.0 exposes `faster_mode = TRUE` in both its help and runtime formals. | An agent can receive an obsolete signature despite using a validated installed version. |
| Fragile function pointers | [did_quick_start.md](../../skill/references/packages/did_quick_start.md) points `aggte` to `did.md:947`, which is an argument of the MP constructor. The `aggte` topic begins at line 55. | Source line numbers are unsuitable identifiers for help topics. |
| Repeated package inventories | [workflow/did-analysis.ts](../../workflow/did-analysis.ts) has `PACKAGES` and a separate preflight list; [install_packages.R](../../mcp/r/install_packages.R) repeats install calls and summary membership. | Changes must be synchronized manually. DRDID is called P0 in workflow preflight but P1 in the method matrix and installer. |
| Repeated online review | The default workflow launches 17 package-check agents and one summarizer before analysis. | Routine metadata discovery consumes repeated agent work without a durable machine-readable baseline. |
| Validation is described as pinning | The workflow calls ledger entries “pinned,” but [package-versions.md](../../skill/references/package-versions.md) records last-local-validation versions. The installer accepts existing versions or installs available releases. | Installed, validated, documented, and latest-upstream versions can differ. |

The installed packages currently match the ledger. The problem demonstrated here
is drift between reference documents and that environment, not evidence that all
installed packages need upgrading.

## Proposed design

### 1. One curated inventory

Add a small machine-readable registry under `skill/`, such as
`skill/references/package-registry.json`. Store package name, source/repository,
method priority, workflow role, relevant help topics, and maintained adapter IDs.
Store validation evidence separately from automatically observed metadata.

Generate mechanical package lists from the registry, or let ordinary scripts
read it directly. Generate the workflow's constant data at maintenance/build
time, or let its preflight subagent read the registry; keep filesystem access
out of the orchestration script body. A check should detect generated-file drift.

Generate inventory sections rather than overwriting curated methodological
explanations. Treat supported estimators as explicit adapters: discovering an
upstream export does not establish that this project supports it.

### 2. Local-first, version-aware help

An optional helper under `skill/scripts/` should accept a package and help topic,
read metadata from the same R library used by the analysis, resolve Rd aliases,
and render just the requested help topic. It should report package version,
resolved library, topic, R version, and GitHub commit SHA when available.

The core mechanism was verified locally:

```r
description <- utils::packageDescription("did")
rd <- tools::Rd_db("did")
tools::Rd2txt(
  rd[["att_gt.Rd"]], package = "did", stages = character(),
  options = list(underline_titles = FALSE)
)
```

Production lookup must resolve aliases instead of assuming every topic has a
matching filename. Handle datasets, package-level help, and S3/S4 method topics;
report absent or ambiguous topics explicitly. Reading formals is an optional
additional check, not a replacement for argument descriptions and vignettes.

Help conversion should not run examples or render-time Rd expressions. Namespace
inspection can load package code, so isolate optional live-formal inspection in a
bounded subprocess. Keep the small Rd converter behind a tested wrapper because
R documents that its conversion interfaces can change.

### 3. Provenance-aware fallback and maintenance

Use installed help for execution. If R or the package is unavailable, use an
explicitly versioned cached snapshot or an upstream source tied to a release or
commit, and label the mismatch. Latest online help must not silently stand in for
the installed version.

Cache identity should include package version, GitHub SHA where available, and
a content/build identity for local modifications; record the resolved library
and R version. Library precedence and multiple installations matter. A version
string alone does not distinguish development builds with the same version.

Batch CRAN release metadata checks and inspect known GitHub repositories by
commit, distinguishing released CRAN versions from development GitHub HEAD.
Compare relevant entry points, signatures, help/NEWS changes, and the
maintained recipes they affect. An unavailable upstream is “unknown,” not “up to
date.” Perform deep agent review only for meaningful changes. Do not install an
upstream release simply to inspect its documentation.

Focus comparisons on functions used by maintained recipes, including private
dependencies such as `HonestDiD:::sunab_beta_vcv`. A matching signature does not
establish unchanged statistical behavior; the existing workflow validations
remain necessary. Method-specific arguments may not appear in a generic's
formals, and some documented helpers are not exported functions.

Preserve upstream attribution and applicable license notices for redistributed
snapshots. Do not assume the repository's MIT license automatically covers copied
package manuals. This is a provenance requirement to check during migration.

## Smallest useful first change

Start with the optional local help helper and a short routing instruction in
`SKILL.md`: read curated quick starts for workflow advice, then resolve exact API
details from the installed package when available. Keep existing snapshots as
labeled fallbacks. This yields a benefit before changing all inventories.

Next centralize the inventory and replace the repeated package scan with a
deterministic report. Avoid an initial rewrite of every manual, a new vector
database, or automatically generated statistical advice.

## Migration and validation

1. Introduce the optional helper without removing reference files. Check alias
   lookup, missing packages/topics, clean text rendering, offline operation,
   multiple libraries, and provenance. Try core and GitHub-only packages.
2. Add the registry and consistency checks. Preserve existing estimator IDs,
   tool schemas, tier decisions, and skill-relative paths. Generate or check
   package inventories; do not automatically expand support.
3. Separate analysis preflight from maintenance. A normal analysis checks its
   installed environment and records provenance. An explicit maintenance command
   checks upstream and produces a concise report of affected recipes.
4. Replace brittle line pointers with topic identifiers or stable generated
   anchors. Gradually retire duplicated full manuals only after the fallback
   route works for users without R/MCP. Keep authored quick starts and caveats.
5. Before promoting new validated versions, run the applicable estimator smoke
   tests and the existing P0 real-data/fallback audits. Require each changed
   adapter to pass an applicable fixture and retain dataset-specific caveats.

Portable CI can use built-in examples (`did::mpdta`, `fixest::base_stagg`) for
routine checks. Keep the six external DID Examples datasets for broader release
validation. A reproducible maintainer R environment can be added separately;
users need not be forced into one installation layout.

## Other improvements found

- **Make audit failures machine-detectable before automated promotion.** Both
  [audit-mcp-matrix.mjs](../../mcp/scripts/audit-mcp-matrix.mjs) and
  [audit-skill-recipes.mjs](../../skill/scripts/audit-skill-recipes.mjs) normally finish
  with exit status zero even when their result cells contain FAIL. Their fatal
  exception handlers do not cover those ordinary failed results. The fallback
  Step 3 also allows three of five estimators to pass and can skip the CS
  benchmark when CS fails. Report per-adapter coverage explicitly.
- **Correct the BJS sentinel contract.** The workflow specifies `max(time)+10`,
  whereas [step3_common.R](../../mcp/r/step3_common.R) and
  [step1_recode.R](../../mcp/r/step1_recode.R) use `max(cohort)+10`. A balanced synthetic
  panel spanning 1980–2020 with a treated cohort in 1981 maps never-treated units
  to 1991, inside the observation window. Installed `didimputation` help actually
  documents zero or NA for never-treated units; reconsider the finite-sentinel
  convention itself rather than merely increasing it. Preserve never-treated
  identity and synchronize runtime and recipes with a targeted regression test.
- **Revisit did2s covariance extraction.** Its wrapper has a full covariance
  matrix, but `extract_sunab_vcov()` deliberately replaces it with `diag(se^2)`.
  The repository fixture produced a nonzero off-diagonal covariance under
  did2s 1.2.0. Correctly matching and preserving that matrix could improve power
  and sensitivity calculations; fresh documentation alone cannot establish the
  necessary coefficient ordering and statistical contract.
- **Record run provenance.** Include actual package versions and available
  GitHub SHAs with analysis outputs. Keep compatibility observations separate
  from the last validated baseline and an optional upstream-release report.
- **Test the actual documented recipes.** The fallback R audit reimplements
  recipes in its own functions rather than extracting the Markdown code. Its
  success therefore does not prove that the displayed snippets still run.
  Share tested recipe sources or add a focused executable-doc check for the
  maintained runnable examples.

## Checks performed

- Inspected the skill router, maintainer guides, package reference structure,
  MCP/installer/adapter code, workflow orchestration, and validation scripts.
- Confirmed the public GitHub repository's corresponding architecture.
- Read installed help databases successfully for all 17 documented packages.
- Rendered `did::att_gt` help and compared it with actual runtime formals and
  the checked-in manual.
- Confirmed all 18 installed ledger package versions match the recorded ledger;
  GitHub SHAs are available for `pretrends` and `synthdid`.
- Ran MCP build and unit tests under Node 22.18.0: 6 test files, 15 tests passed.
- Reproduced the sentinel and did2s covariance observations with local R 4.5.2.
- Did not update packages, rerun the full real-data matrix, or certify any new
  package release. No implementation has been pushed to GitHub.

## Fable review

Completed with Fable 5.1 through the signed-in Claude browser interface.
The review findings are summarized here; the private conversation is not a
public source artifact.
The request supplied only the public repository and proposed architecture.

Fable independently confirmed the seven stale manual versions, incorrect
function pointers, repeated inventories, repeated online package scans, and
missing runtime package provenance. It agreed with the proposed separation
between curated methodological guidance and installed-package API lookup.

Its most useful refinements were:

- Track the functions actually called by the maintained recipes, rather than
  reviewing every change throughout every package.
- Distinguish CRAN releases from development GitHub HEAD.
- Let the preflight agent return the registry through its result schema to
  avoid filesystem access in the workflow body.
- Eventually replace large vendored manuals with compact generated API cards
  plus authored notes; retrieve full help at runtime.
- Recognize that the fallback audit tests its own recipe implementations,
  not the literal Markdown snippets.

I retain existing snapshots only as a transition until replacement offline
cards are adequate. I also retain semantic regression tests: signature and help
diffs alone cannot establish correct treatment coding or inference. Cache
provenance should use the package's actual resolved library, not assume it is
always the first `.libPaths()` entry.

Fable did not run R or validate the local environment. It reported unavailable
CRAN-current-version checks, private example datasets, and uninspected MCP
TypeScript tool/engine directories. The local checks above supplement its
public-source review. Its reported development-version observations were not
used to promote any validation baseline.

## Sources

- [Public DID repository](https://github.com/zhangxiany-tamu/DID).
- R: [packageDescription and packageVersion](https://stat.ethz.ch/R-manual/R-devel/library/utils/html/packageDescription.html).
- R: [Rd database utilities](https://stat.ethz.ch/R-manual/R-devel/library/tools/html/Rdutils.html).
- R: [Rd converters and evaluation stages](https://stat.ethz.ch/R-manual/R-devel/library/tools/html/Rd2HTML.html).
