# Package Version Tracking

Documents the package versions observed during the **last local validation pass** of this skill. Check these against installed versions when troubleshooting API mismatches.

Last updated: 2026-09-15

Validation context: maintenance validation completed on 2026-09-15 (local date;
report timestamps are 2026-09-16 UTC) under R 4.5.2 on
`aarch64-apple-darwin24.4.0` and Node 22.18.0. Build/unit tests, maintenance and
orchestration tests, all smokes, worker recycling, six real-data scenarios, the
96-cell MCP audit, and the 30-cell fallback audit passed. Versions below were
checked against fresh machine-readable installed observations; no packages were
upgraded. DCDH quick-example validation remains from 2026-05-21. Refresh this
ledger only after workflow validation and notes in [`../BACKLOG.md`](../BACKLOG.md).
The [observed API baseline](package-api-baseline.json) is separate evidence of
installed signatures, not a validation certificate.

## Documented Package Versions

| Package | Version | Validation status | Source | Primary CRAN/GitHub |
|---------|---------|-------------------|--------|---------------------|
| bacondecomp | 0.1.1 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=bacondecomp) |
| did | 2.3.0 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=did) |
| did2s | 1.2.0 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=did2s) |
| didimputation | 0.5.0 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=didimputation) |
| DIDmultiplegt | 2.0.0 | `quick_example_validated_with_polars` | CRAN | [CRAN](https://cran.r-project.org/package=DIDmultiplegt) |
| DIDmultiplegtDYN | 2.3.0 | `quick_example_validated_with_polars` | CRAN | [CRAN](https://cran.r-project.org/package=DIDmultiplegtDYN) |
| DRDID | 1.2.3 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=DRDID) |
| etwfe | 0.6.0 | `installed_not_exercised` | CRAN | [CRAN](https://cran.r-project.org/package=etwfe) |
| fixest | 0.13.2 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=fixest) |
| gsynth | 1.3.1 | `installed_not_exercised` | CRAN | [CRAN](https://cran.r-project.org/package=gsynth) |
| HonestDiD | 0.2.6 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=HonestDiD) |
| panelView | 1.1.18 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=panelView) |
| polars | 1.8.0.9000 | `validated_local_for_dcdh` | r-universe | [r-universe](https://rpolars.r-universe.dev) |
| pretrends | 0.1.0 | `validated_local` | GitHub | [GitHub](https://github.com/jonathandroth/pretrends) |
| staggered | 1.2.2 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=staggered) |
| synthdid | 0.0.9 | `installed_not_exercised` | GitHub | [GitHub](https://github.com/synth-inference/synthdid) |
| TwoWayFEWeights | 2.0.4 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=TwoWayFEWeights) |
| YatchewTest | 1.1.1 | `installed_not_exercised` | CRAN | [CRAN](https://cran.r-project.org/package=YatchewTest) |

## Notes

- BJS now uses documented zero coding for known never-treated units. Generated
  legacy finite sentinels preserve identity in MCP/RDS and are normalized before
  estimation; exported CSVs require an explicit recode.
- did2s now preserves its full covariance matrix matched by coefficient names.
  Power and HonestDiD results can differ from earlier diagonal approximations;
  direct covariance/trim checks and downstream inference smokes passed.
- Package help now comes from installed R documentation. Historical manuals are
  labeled fallbacks and need not match these validated versions.

- The 2026-09-15 pass revalidated the P0 MCP and skill fallback workflows directly on six DID Examples datasets: Medicaid insurance, Medicaid mortality, teacher collective bargaining, unilateral divorce laws, sentencing enhancements, and bank deregulation.
- `did2s`, `didimputation`, `staggered`, `DRDID`, and `panelView` are now directly exercised by the maintained audits.
- `DIDmultiplegtDYN` 2.3.0 and `DIDmultiplegt` 2.0.0 both completed package quick examples with `polars` loaded. Keep `options(rgl.useNULL = TRUE)` documented for headless environments because it remains a low-cost workaround.
- `etwfe`, `gsynth`, `synthdid`, and `YatchewTest` are installed locally but still outside the defended P0 audit path.
- HonestDiD still emits open-endpoint CI warnings on some real examples; the MCP audit now treats those as expected numerical warnings unless they coincide with failed estimates or missing robust rows.

## Validation Loop

When a workflow is revalidated:

1. Run the relevant prompt from [`../VALIDATION_RUNBOOK.md`](../VALIDATION_RUNBOOK.md).
2. If the workflow fails, classify it with [`../FAILURE_BUCKETS.md`](../FAILURE_BUCKETS.md) and log follow-up work in [`../BACKLOG.md`](../BACKLOG.md).
3. Only after the workflow is judged correct should you update the version ledger below.
4. If the workflow exposed environment-specific issues, update `did-troubleshooting.md` in the same pass.

## Update Checklist

When a relevant installed package changes:

1. Run `node scripts/package-maintenance.mjs status --api` from the repo root.
2. Read installed help and relevant release/source notes for the affected calls.
3. Update authored recipes/adapters only when behavior requires it; run the
   relevant workflows in `../VALIDATION_RUNBOOK.md` and the maintained audits.
4. Record the validation scope and failures in `../BACKLOG.md`.
5. Copy observed versions into this ledger only after validation succeeds.
6. Explicitly refresh the API baseline with `node scripts/package-maintenance.mjs snapshot`.
7. For inventory changes, edit the registry and run `sync` followed by `check`.

See [package maintenance](../PACKAGE_MAINTENANCE.md). Full manual regeneration is
not part of the normal update loop.
