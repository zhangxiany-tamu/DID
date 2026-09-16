# did-mcp

MCP server that exposes the `did-analysis` skill's 5-step workflow as agent-callable tools. Claude Code (or any MCP client) can run the workflow end-to-end instead of writing R code for the user to paste.

## Contents

- [Architecture](#architecture)
- [Status](#status)
- [Build](#build)
- [R packages](#r-packages)
- [Register with Claude Code](#register-with-claude-code)
- [Register with Other MCP Clients](#register-with-other-mcp-clients)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Architecture

- **TypeScript** server via `@modelcontextprotocol/sdk`, stdio transport
- **Persistent R subprocess** per session, NDJSON over stdin/stdout (`r/bridge.R`)
- **Object-handle session state** — tools return typed handles (`panel_1`, `estimate_1`, …) that later tools consume
- **Worker pool** with 1 active + 1 standby R process; recycle every 100 calls or 60 minutes; promote standby on crash; persist serializable handles via `saveRDS` across recycle

See `../AGENTS.md` for monorepo conventions; the skill's workflow contracts live in `../skill/references/did-step-{1..5}-*.md`.

## Status

**Phase 1 (shipped)** — scaffolding + smoke test.
- `did_ping` — round-trip through the R bridge
- `did_session` — list/inspect/drop handles, show pool status

**Phase 2 (shipped)** — Step 1 tools: `did_load_panel`, `did_check_panel`, `did_profile_design`, `did_plot_rollout`, `did_recode_never_treated`.

**Phase 3 (shipped)** — Step 3 estimators: `did_estimate` (cs / sa / bjs / did2s / staggered), `did_compare_estimators`, `did_extract_event_study` (with optional `min_e` / `max_e` event-window trimming for downstream power and sensitivity checks).

**Phase 4 (shipped)** — Step 4 power and Step 5 sensitivity: `did_power_analysis` (pretrends::slope_for_power + optional pretrends::pretrends), `did_honest_sensitivity` (HonestDiD relative-magnitudes + smoothness + original CI + breakdown M).

**Phase 5 (shipped)** — Step 2 TWFE diagnostics: `did_diagnose_twfe` (bacondecomp::bacon + TwoWayFEWeights::twowayfeweights, unified severity bands, auto-synthesized post-indicator, bacon skipped on unbalanced / very large panels with a weights-only fallback).

**Phase 6 (shipped)** — polish: `did_plot` (event-study or HonestDiD sensitivity plot), `did_drdid` (standalone doubly-robust DiD for two-period slices), `did_report` (markdown narrative across every step in a session), Parquet loader in `did_load_panel`, minimal vitest coverage of the TS tool wiring.

## Build

Requires Node 22.x and R 4.x.

```bash
cd mcp
nvm use          # picks 22 from .nvmrc if you use nvm
npm install
npm run build
```

## R packages

Install missing packages from the shared [registry](../skill/references/package-registry.json):

```bash
Rscript r/install_packages.R --dry-run
Rscript r/install_packages.R
# Core runtime only:
Rscript r/install_packages.R --required-only
```

Existing versions are retained. Required packages must succeed; optional packages are
best-effort, and manual packages are listed for use when needed. `pretrends` and
`synthdid` install from GitHub. Method priority and installation policy are separate.

`did_ping` returns `bridge.package_provenance` from the actual R worker, including R/library
paths, installed versions, and recorded GitHub SHAs. Estimator responses include the
package used in `metadata.packages`. `version` follows an already-loaded namespace;
`installedVersion` and `loadedVersion` expose differences after an in-session update.
Restart the worker before validating such an environment. Workers use `Rscript --vanilla`; project startup
configuration may differ from a separate R session. See
[package maintenance](../skill/PACKAGE_MAINTENANCE.md) for installed help and API checks.

## Register with Claude Code

Copy the `did-mcp` entry from `mcp-config.example.json` into your `~/.claude/settings.json` under `mcpServers`. Adjust the absolute paths to point at YOUR Node, Rscript, and this repo. Restart Claude Code to load the server.

Verify the wiring:

```
In Claude Code: "Call did_ping and show me the result."
```

You should get back a JSON blob with `pong: true`, the R version, the jsonlite version, and the bridge PID.

## Register with Other MCP Clients

`did-mcp` uses the standard MCP stdio transport. For other agents, configure the
client to launch:

```bash
node /absolute/path/to/DID/mcp/dist/index.js
```

Set `R_PATH` to the absolute path of `Rscript` when it is not already on the
client's `PATH`. The skill itself is markdown-only; agents without a Claude
Code-style skill mechanism can still load `../skill/SKILL.md` and the referenced
guides as normal context, then prefer the `did_*` tools when the MCP server is
registered.

## Development

- One tool per file under `src/tools/`. Each exports a `*_SCHEMA` (JSON Schema for Claude) and an `execute*` function.
- R-side handlers live in `r/bridge.R` as `dispatch_<method>` functions. R handlers should mirror the R function bodies documented in `../skill/references/did-step-*-*.md` so the MCP path and the skill's code-gen fallback produce identical results.
- Build: `npm run dev` (watch mode), `npm run build` (once).
- Tests: `npm test` (vitest). Fixtures: `did::mpdta` and `create_did_example_data()` from `../skill/references/did-step-1-treatment-structure.md` — no external CSVs.
- Smoke tests: `npm run smoke:all` covers the standard server path, all five estimators, and edge cases; `npm run smoke:recycle` forces an R worker recycle before nearly every tool call to verify handle persistence.
- Real-example validation: `npm run validate:real` uses local CSVs from
  `/Users/xianyangzhang/My Drive/DID Examples` by default. Override with
  `DID_EXAMPLES_DIR=/path/to/examples`. The generated report records each
  scenario's validation-panel preparation notes so reviewers can distinguish
  source datasets from the MCP-sized panels loaded during the run.
- DID Examples CSV preparation is shared with the skill fallback audit through
  `../scripts/did-examples-lib.mjs`; update that helper rather than copying
  prep logic into multiple validation scripts.

## Troubleshooting

**`Rscript: command not found`** — set `R_PATH` in the MCP config to the absolute path of your Rscript binary (`which Rscript`).

**`jsonlite is not installed`** — run `Rscript r/install_packages.R`; the bridge requires jsonlite to communicate.

**Server starts but `did_ping` hangs** — R process may be stalled on an interactive prompt. Check stderr in Claude Code's logs. The worker watches for `y/n` prompts and reports stalls.

**Worker pool keeps crashing** — something is killing the R process before it reaches the NDJSON loop. Test the bridge directly:
```bash
echo '{"id":1,"method":"ping","params":{"echo":"hi"}}' | Rscript r/bridge.R
```
Expected output: **two** NDJSON lines.
1. The ready sentinel: `{"id":0,"result":{"ready":true,"pid":...}}` — emitted once after the bridge finishes sourcing its companion files.
2. The ping response: one JSON object with `"pong":true`, `r_version`, `jsonlite_version`, `echo`, and `bridge_pid`.

If you only see line 1, the bridge started fine but your request was malformed. If you see no lines, R failed before reaching the main loop — check stderr.
