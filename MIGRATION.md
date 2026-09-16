# Migration Guide

The repo formerly known as `DID-skills` (flat-layout, v1) is now `DID` (monorepo). The repo originally contained only the skill at the root; it has been restructured into a monorepo so an optional companion `did-mcp` server could be shipped alongside.

Layout evolution:

| Release | Layout | Contents |
|---|---|---|
| `skill-v1.1.0-flat` | Flat (skill at root) | Skill only. |
| `v2.0.0` | Monorepo (`skill/` + empty `mcp/` scaffold) | Skill relocated, MCP planned. |
| Post-v2.0.0 (tip of `main`) | Monorepo | Skill + full `did-mcp` server (16 tools, 5-step workflow, real-data audit). |

Skill content between `skill-v1.1.0-flat` and `v2.0.0` was relocated, not modified. After `v2.0.0` the skill's `references/` guides received targeted fixes (notably `print(panelview(...))` and the Sun-Abraham label parser) alongside the MCP build-out.

## Unreleased package maintenance update

Existing skill and MCP install paths and tool names are unchanged. Keep the whole
`skill/` directory when copying it: `scripts/package-doc.R`, `package-status.R`,
and the registry support installed-version documentation and provenance. The
[maintenance guide](skill/PACKAGE_MAINTENANCE.md) explains the new commands.

Routine workflows now inspect installed packages offline in one task. The
`skipPackageCheck` argument remains available. The `implementation.json`
`packageScan` record now contains `environmentChanges`, `upstreamChecked: false`,
and `checks`; consumers should stop reading `updatesAvailable` and `docsDrifting`.

BJS now normalizes known never-treated units to zero. Generated legacy finite
sentinels are recovered within MCP/RDS handles (the R helper now requires
`time_var` when creating a finite sentinel); CSV exports lose this metadata,
so explicitly restore never-treated identity before re-importing them. did2s
now preserves its matched full covariance matrix, which can change power and
sensitivity results. Re-run affected analyses rather than comparing old and new
inference as though they used the same covariance approximation.

## If you cloned directly into `.claude/skills/did-analysis/`

Old install:

```bash
git clone https://github.com/zhangxiany-tamu/DID-skills ~/.claude/skills/did-analysis
```

That layout is frozen at tag `skill-v1.1.0-flat`. To upgrade to v2:

```bash
# 1. Remove the old skills directory (files are all on the remote; safe to delete)
rm -rf ~/.claude/skills/did-analysis

# 2. Clone the new repo anywhere (not inside .claude/skills)
git clone https://github.com/zhangxiany-tamu/DID.git ~/src/DID
cd ~/src/DID

# 3. Run the installer
./install.sh
```

The installer symlinks `skill/` into `~/.claude/skills/did-analysis/` so the skill still loads from the expected path.

## If you used `git subtree`

Old usage:

```bash
git subtree add --prefix=.claude/skills/did-analysis \
  https://github.com/zhangxiany-tamu/DID-skills.git main --squash
```

For v2, point the subtree at the new repo's `skill/` subfolder. Easiest option is to switch to a plain subrepo or manual copy since `git subtree` does not natively support subdirectory pulls. Alternatively, pull the `skill-v*` tags from the `DID` repo and continue using the subtree pattern.

## If you never manually installed the skill

The GitHub URL `DID-skills` auto-redirects to `DID` (GitHub handles renames transparently). Your Claude Code setup likely unaffected. Just update bookmarks.

## Why the restructure

To add the `did-mcp` server alongside the skill without polluting the skill's install path or complicating downstream workflows. The skill contains Markdown guidance and optional R helpers, and still installs via a single symlink. The MCP is opt-in.

## Tag reference

- `skill-v1.1.0-flat` — last flat-layout tip. Use this if you need the pre-restructure code.
- `v2.0.0` — first monorepo release. Skill content unchanged from `skill-v1.1.0-flat`; only relocated to `skill/`. Includes an empty `mcp/` scaffold; no tools registered yet.
- tip of `main` (post-v2.0.0) — full `did-mcp` server shipped: session/ping, Step 1 (load/check/profile/plot-rollout/recode), Step 2 (twfe diagnose), Step 3 (five estimators + compare + extract), Step 4 (power), Step 5 (HonestDiD), plus `did_plot` / `did_drdid` / `did_report`. Tag `v3.0.0` (or similar) will mark this milestone when cut.
