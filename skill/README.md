# did-analysis

Installable skill for modern Difference-in-Differences causal inference
workflows in R.

This directory is intentionally self-contained. `install.sh` symlinks this
folder into `~/.claude/skills/did-analysis/`, so `SKILL.md`, `references/`,
optional R helpers, maintainer docs, and package docs remain inside `skill/`.

## Execution Modes

- **Code-generation fallback**: when no `did_*` MCP tools are available, the
  skill routes agents to the step guides under `references/` and emits R code
  for users to run locally.
- **Tool-aware path**: when the companion `did-mcp` server is registered, agents
  should use the 16 `did_*` tools for covered workflow steps and fall back to R
  code only for capabilities outside the tool surface.

The skill does not call MCP directly; the MCP client exposes the tools. See
`SKILL.md` for routing rules. MCP setup instructions ship with the companion
server in the monorepo.

## Installed Package Help

The authored guides explain method choice and interpretation. Optional helpers
read package documentation matching your R environment. From this directory:

```bash
Rscript scripts/package-doc.R did
Rscript scripts/package-doc.R did att_gt
Rscript scripts/package-status.R
```

Help lookup needs only base R and the package's installed help. It reports the
version, library path, and recorded Git SHA without loading the package or
running examples. Add `--lib /path/to/R/library` to select a library explicitly.
Package status requires `jsonlite`; `--api` additionally loads installed package
namespaces to inspect relevant signatures.

See the [package index](references/package-index.md) for the supported inventory
and [package maintenance](PACKAGE_MAINTENANCE.md) for the update process. Existing
full manuals are historical snapshots, retained for fallback reference.
