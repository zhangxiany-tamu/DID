# Package index

<!-- Generated from package-registry.json; run node scripts/package-maintenance.mjs sync. -->

Method priorities describe reviewed workflows. Installation policy is separate:
`required` supports the core runtime; `optional` is installed best-effort;
`manual` is installed only when needed. This inventory does not pin versions.

| Package | Method priority | Installation | Role | Source |
|---|---|---|---|---|
| [did](packages/did_quick_start.md) | P0 | required | Group-time ATT | [CRAN](https://cran.r-project.org/package=did) |
| [fixest](packages/fixest_quick_start.md) | P0 | required | Sun-Abraham event study | [CRAN](https://cran.r-project.org/package=fixest) |
| [did2s](packages/did2s_quick_start.md) | P0 | required | Two-stage DiD | [CRAN](https://cran.r-project.org/package=did2s) |
| [didimputation](packages/didimputation_quick_start.md) | P0 | required | BJS imputation | [CRAN](https://cran.r-project.org/package=didimputation) |
| [staggered](packages/staggered_quick_start.md) | P0 | required | Random-timing comparison | [CRAN](https://cran.r-project.org/package=staggered) |
| [bacondecomp](packages/bacondecomp_quick_start.md) | P0 | required | TWFE decomposition | [CRAN](https://cran.r-project.org/package=bacondecomp) |
| [TwoWayFEWeights](packages/TwoWayFEWeights_quick_start.md) | P0 | required | TWFE weight diagnostics | [CRAN](https://cran.r-project.org/package=TwoWayFEWeights) |
| [HonestDiD](packages/HonestDiD_quick_start.md) | P0 | required | Sensitivity analysis | [CRAN](https://cran.r-project.org/package=HonestDiD) |
| [pretrends](packages/pretrends_quick_start.md) | P0 | required | Pre-trend power | [GitHub](https://github.com/jonathandroth/pretrends) |
| [panelView](packages/panelView_quick_start.md) | P0 | required | Treatment rollout | [CRAN](https://cran.r-project.org/package=panelView) |
| [DRDID](packages/DRDID_quick_start.md) | P1 | optional | Covariate-aware DiD | [CRAN](https://cran.r-project.org/package=DRDID) |
| [etwfe](packages/etwfe_quick_start.md) | P1 | optional | Extended TWFE | [CRAN](https://cran.r-project.org/package=etwfe) |
| [DIDmultiplegt](packages/DIDmultiplegt_quick_start.md) | P1 | optional | Reversible treatment | [CRAN](https://cran.r-project.org/package=DIDmultiplegt) |
| [DIDmultiplegtDYN](packages/DIDmultiplegtDYN_quick_start.md) | P1 | optional | Dynamic heterogeneous treatment | [CRAN](https://cran.r-project.org/package=DIDmultiplegtDYN) |
| [gsynth](packages/gsynth_quick_start.md) | P1 | optional | Generalized synthetic control | [CRAN](https://cran.r-project.org/package=gsynth) |
| [synthdid](packages/synthdid_quick_start.md) | P1 | optional | Synthetic DiD | [GitHub](https://github.com/synth-inference/synthdid) |
| [YatchewTest](packages/YatchewTest_quick_start.md) | P2 | manual | Functional-form testing | [CRAN](https://cran.r-project.org/package=YatchewTest) |
| `jsonlite` | runtime helper | required | MCP and metadata JSON | [CRAN](https://cran.r-project.org/package=jsonlite) |
| `data.table` | runtime helper | required | Estimator data preparation | [CRAN](https://cran.r-project.org/package=data.table) |
| `ggplot2` | runtime helper | required | Plots | [CRAN](https://cran.r-project.org/package=ggplot2) |
| `arrow` | runtime helper | manual | Optional Parquet input | [CRAN](https://cran.r-project.org/package=arrow) |
| `polars` | runtime helper | manual | DCDH installation support | [r-universe](https://rpolars.r-universe.dev) |

For installed help, run `Rscript skill/scripts/package-doc.R PACKAGE [TOPIC]`
from the repository root, or `Rscript scripts/package-doc.R PACKAGE [TOPIC]`
from the installed skill. See [package maintenance](../PACKAGE_MAINTENANCE.md).
