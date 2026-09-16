# did-analysis Next Steps

This is the shortest maintainer handoff for the repo.

## Read These Files In Order

1. `BACKLOG.md`
2. `METHOD_MATRIX.md`
3. `VALIDATION_RUNBOOK.md`
4. `references/package-versions.md`
5. `PACKAGE_MAINTENANCE.md`
6. `references/did-troubleshooting.md`

## Current Goal

Keep the P0 workflow validation repeatable while keeping the repo skill-first.

## Immediate Priorities

1. Run `node scripts/package-maintenance.mjs check` at the repo root after inventory changes; `sync` regenerates the workflow inventory and package index. Read installed help instead of regenerating manual menus.
2. Run the Node 22 MCP checks after code changes: `npm run build`, `npm test`, `npm run smoke:all`, and `npm run smoke:recycle`.
3. Run the full validation audits after workflow or package-doc changes: `npm run validate:real`, `node scripts/audit-mcp-matrix.mjs`, and `node ../skill/scripts/audit-skill-recipes.mjs`.
4. Keep shared DID Examples preparation logic in `scripts/did-examples-lib.mjs` synchronized with both MCP and skill fallback audits.
5. Keep HonestDiD open-endpoint warnings visible, but treat recurring small-cohort / singular-VCOV / rank-deficiency warnings as expected data-design warnings unless they cause failed estimates.
6. Keep the `rgl.useNULL` workaround documented for DCDH-family packages unless a cleaner headless-runtime fix is confirmed.
7. Keep `SKILL.md` thin; move new detail into step guides, not back into the entry point.

## Required Working Style

- prefer the smallest documentation change that unlocks or restores a real workflow
- update `BACKLOG.md` when a workflow fails or priorities change
- use `FAILURE_BUCKETS.md` before deciding what to edit
- treat `METHOD_MATRIX.md` as the priority boundary
- do not expand into broader package coverage unless repeated use justifies it

## Done Means

- the `P0` workflows in `VALIDATION_RUNBOOK.md` route correctly through the skill
- any failures are bucketed and documented
- version-tracking notes match the last validated cycle
- MCP tool maps in `SKILL.md`, `METHOD_MATRIX.md`, root `README.md`, and `mcp/README.md` remain synchronized
- `SKILL.md` remains a routing layer, not a second full manual
