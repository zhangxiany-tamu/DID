# did-analysis Validation Runbook

## Contents
- [How To Use This Runbook](#how-to-use-this-runbook)
- [Workflow 1: Canonical Staggered Binary Absorbing Route](#workflow-1-canonical-staggered-binary-absorbing-route)
- [Workflow 2: TWFE Diagnostics Route](#workflow-2-twfe-diagnostics-route)
- [Workflow 3: Event Study to pretrends to HonestDiD](#workflow-3-event-study-to-pretrends-to-honestdid)
- [Workflow 4: Multilevel Treatment Route](#workflow-4-multilevel-treatment-route)
- [Workflow 5: Non-Binary or Reversible Treatment Route](#workflow-5-non-binary-or-reversible-treatment-route)
- [Package maintenance checks](#package-maintenance-checks)
- [After Each Validation Pass](#after-each-validation-pass)

Use this file to validate the skill through real prompts, not by skimming docs in isolation.

## How To Use This Runbook

- Run these workflows through an actual agent session with the installed skill.
- Prefer built-in package datasets or standard package examples where possible.
- Judge success by routing quality and qualitative conclusions, not by brittle exact numeric equality.
- If a workflow fails, assign a bucket from `FAILURE_BUCKETS.md` and log the follow-up in `BACKLOG.md`.

## Workflow 1: Canonical Staggered Binary Absorbing Route

**Dataset**: `did::mpdta`

**Prompt**:

```text
Use the did-analysis skill to analyze a staggered-adoption DiD design with did::mpdta. First profile the treatment structure, then recommend a primary heterogeneity-robust estimator and one comparison estimator. Explain why the design should stay on the core binary absorbing workflow.
```

**Intended route**:

- Step 1
- Step 3
- Step 4 and Step 5 only if the agent chooses an event-study follow-up

**Expected package family**:

- `panelView`
- `did`
- one comparison path such as `fixest`, `did2s`, or `staggered`

**Expected qualitative outcome**:

- The agent identifies staggered, binary, absorbing treatment.
- The agent stays on the core workflow rather than routing to `did-advanced-methods.md`.
- The agent prefers a robust estimator rather than presenting naive TWFE as the main answer.

**Update first if it fails**:

- `references/did-step-1-treatment-structure.md`
- `references/did-step-3-estimation.md`
- `BACKLOG.md`

## Workflow 2: TWFE Diagnostics Route

**Dataset**: `bacondecomp::castle`

**Prompt**:

```text
Use the did-analysis skill to diagnose whether TWFE is risky on bacondecomp::castle. Run the workflow logic for Bacon decomposition and negative weights, then explain whether TWFE should be abandoned, treated cautiously, or used only as a comparison.
```

**Intended route**:

- Step 1
- Step 2
- Step 3 only after diagnostics establish the need for robust alternatives

**Expected package family**:

- `bacondecomp`
- `TwoWayFEWeights`
- likely `did` or `fixest` as the follow-up recommendation

**Expected qualitative outcome**:

- The agent runs both major TWFE diagnostics, not just one.
- The agent interprets forbidden-comparison weight and negative-weight share using the repo’s severity language.
- The response clearly distinguishes diagnostics from final estimation.

**Update first if it fails**:

- `references/did-step-2-diagnostics.md`
- `references/did-troubleshooting.md`
- `BACKLOG.md`

## Workflow 3: Event Study to pretrends to HonestDiD

**Dataset**: `fixest::base_stagg`

**Prompt**:

```text
Use the did-analysis skill on fixest::base_stagg. Fit a Sun-Abraham event study, explain how to extract conformable event-study objects, then continue to pretrends power analysis and HonestDiD sensitivity analysis. Report the qualitative interpretation of power and robustness, not just code.
```

**Intended route**:

- Step 1
- Step 3
- Step 4
- Step 5

**Expected package family**:

- `fixest`
- `pretrends`
- `HonestDiD`

**Expected qualitative outcome**:

- The agent uses the `sunab()` path correctly.
- The agent handles coefficient extraction through the repo’s documented Step 4/5 pattern.
- The answer includes both a power interpretation and an HonestDiD-style robustness interpretation.

**Update first if it fails**:

- `references/did-step-4-power-analysis.md`
- `references/did-step-5-sensitivity-inference.md`
- `references/did-troubleshooting.md`

## Workflow 4: Multilevel Treatment Route

**Dataset**: the Medicaid mortality panel previously used in repo development, or another state-treatment / county-outcome panel if that dataset is unavailable

**Prompt**:

```text
Use the did-analysis skill on a panel where treatment is assigned at the state level but outcomes are measured at the county-year level. Determine whether the treatment structure is valid for DiD, explain how treatment timing should be propagated, and describe how clustering and interpretation should change.
```

**Intended route**:

- Step 1
- Step 3
- Step 5 only if the workflow reaches event-study inference

**Expected package family**:

- Step 1 treatment profiling logic
- core robust estimators only after the treatment/unit relationship is clarified

**Expected qualitative outcome**:

- The agent explicitly recognizes the multilevel structure instead of silently treating the panel as unit-level treatment.
- The answer discusses treatment propagation and clustering at the treatment-assignment level.
- The answer warns when the design description is incomplete.

**Update first if it fails**:

- `references/did-step-1-treatment-structure.md`
- `references/did-step-3-estimation.md`
- `BACKLOG.md`

## Workflow 5: Non-Binary or Reversible Treatment Route

**Dataset**: `DIDmultiplegt::wagepan` or `DIDmultiplegtDYN::favara_imbs`

**Prompt**:

```text
Use the did-analysis skill on a non-binary or reversible treatment example from the DIDmultiplegt family. Show why the core staggered binary absorbing workflow is not appropriate, then route the analysis to the de Chaisemartin-D'Haultfoeuille family and explain the preferred package choice.
```

**Intended route**:

- Step 1
- `references/did-advanced-methods.md`

**Expected package family**:

- `DIDmultiplegt`
- `DIDmultiplegtDYN`

**Expected qualitative outcome**:

- The agent routes away from the core staggered binary workflow.
- The answer explains why `did`, `fixest`, `did2s`, and `didimputation` are not the right defaults here.
- The answer mentions the `polars` / Rust caveat when it becomes relevant.

**Environment note**:

- In headless macOS environments, loading the DCDH-family packages may require `options(rgl.useNULL = TRUE)` before `library(DIDmultiplegt)` or `library(DIDmultiplegtDYN)`. See `references/did-troubleshooting.md`.

**Update first if it fails**:

- `references/did-step-1-treatment-structure.md`
- `references/did-advanced-methods.md`
- `references/did-troubleshooting.md`

## Package maintenance checks

Use Node 22 and the analysis R environment. From the repo root:

```bash
node scripts/package-maintenance.mjs check
node scripts/package-maintenance.mjs status --api
cd mcp
npm run test:maintenance
npm run build
npm test
npm run smoke:all
npm run smoke:recycle
npm run validate:real
node scripts/audit-mcp-matrix.mjs
node ../skill/scripts/audit-skill-recipes.mjs
```

A nonzero status command means inspect the reported drift or failure, not upgrade
packages automatically. Full API inspection loads installed namespaces. Use
`did_ping` provenance for an MCP worker's actual R environment. See
[package maintenance](PACKAGE_MAINTENANCE.md) for library selection and explicit
baseline refresh.

Both full audits write their reports before failing on missing, incomplete, or
failed coverage. Every maintained estimator must return a finite ATT; the bank
panel's explicit SA failure remains a documented design exception. A missing CS
result cannot bypass benchmark checks. The fallback audit exercises maintained
R implementations, not every literal Markdown code block.

The portable CI checks the build, unit tests, offline maintenance logic, and
base-R help fixtures. Heavy audits need the external DID Examples datasets.
`npm run smoke:all` includes direct-package BJS/covariance contract tests.

## After Each Validation Pass

1. Record failures in `BACKLOG.md`.
2. Assign a primary bucket from `FAILURE_BUCKETS.md`.
3. Update the first affected step guide or troubleshooting doc.
4. Refresh `references/package-versions.md` only if the validation pass confirmed the newer versioned behavior.
