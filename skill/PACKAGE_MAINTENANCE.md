# Package documentation and maintenance

Maintain workflow decisions and tested recipes here; read version-specific API
details from the package installed in the analysis environment. The
[package index](references/package-index.md) links to the authored quick starts.

## Contents

- [Read installed help](#read-installed-help)
- [Inspect the analysis environment](#inspect-the-analysis-environment)
- [Maintain the registry and baseline](#maintain-the-registry-and-baseline)
- [Review a package change](#review-a-package-change)

## Read installed help

From the installed skill directory (`skill/` in the repository):

```bash
Rscript scripts/package-doc.R did
Rscript scripts/package-doc.R did att_gt
Rscript scripts/package-doc.R did att_gt --lib /path/to/R/library
```

Omitting the topic lists help topics and aliases. Looking up a topic prints its
installed documentation with the package version, exact library path, and
`RemoteSha` when recorded. The helper uses base R, works offline, and does not
load the target namespace, run examples, or evaluate Rd expressions. Missing
packages/topics and damaged help databases produce a nonzero exit status.

Use the same R executable and library as the analysis. If the MCP runs under a
different R installation, run lookup there or choose its library explicitly.
When R or the package is unavailable, the full manuals under
`references/packages/` remain historical snapshots. Their version labels describe
the snapshot, not the installed environment or the latest validated workflow.

## Inspect the analysis environment

From the installed skill directory:

```bash
Rscript scripts/package-status.R
Rscript scripts/package-status.R --api
```

These commands emit JSON observations and require `jsonlite`. The default reads
installed metadata. `--api` also loads installed package namespaces and inspects
the signatures and documentation coverage of the relevant functions recorded in
the registry. It does not run estimators or install packages.

Installed help can contain upstream inconsistencies. When help text and function
formals disagree about a declared default, use the formals from the installed
namespace used by the analysis. Interpret behavior using version-matched
documentation and workflow tests.

From the repository root, compare those observations with the recorded baseline:

```bash
node scripts/package-maintenance.mjs status
node scripts/package-maintenance.mjs status --api
```

Status is offline and returns exit code 1 for drift or missing required packages.
Use `R_PATH=/absolute/path/to/Rscript` with the Node command when the analysis uses
a different R executable. The Node and direct R commands honor the current project's
R startup files and library configuration. MCP workers start with `--vanilla`;
use `did_ping` → `bridge.package_provenance` for their actual environment rather
than assuming a separate R process uses the same libraries. Upstream releases
are not polled and no cache is kept.

## Maintain the registry and baseline

The [registry](references/package-registry.json) owns package membership, source,
relevant functions, method priority, and installation policy. Method priority and
installation policy are distinct: runtime helpers have no methodological tier;
optional or manual packages are not promoted merely because they are installed.

From the repository root:

```bash
node scripts/package-maintenance.mjs check
node scripts/package-maintenance.mjs sync
node scripts/package-maintenance.mjs snapshot
```

`check` validates the registry and its generated workflow inventory/package index.
After an intentional registry edit, `sync` regenerates those two outputs.
`snapshot` explicitly replaces the observed API baseline after inspection. It
records installed versions, Git SHAs, and relevant APIs; it never updates the
[validation ledger](references/package-versions.md).

An observed baseline records what was found. The validation ledger records the
last workflow checks and their scope. A matching version or unchanged signature
does not establish that statistical behavior is unchanged.

## Review a package change

1. Inspect the affected installed help, release notes, and source at the relevant
   version or commit. A newer upstream release alone does not require a local
   manual rewrite or an analysis-environment upgrade.
2. Update the affected quick start, step guide, or adapter when the documented
   workflow needs a change. Preserve curated assumptions and interpretation.
3. Run the relevant checks in [the validation runbook](VALIDATION_RUNBOOK.md) and
   the maintained audits. Record failures and follow-up work in
   [the backlog](BACKLOG.md).
4. Review and refresh the observed API baseline explicitly. Update the validation
   ledger only after the corresponding workflow validation succeeds.

Add or remove packages through the registry, then update their authored guides
and method coverage together. Keep copied manuals as labeled snapshots instead
of regenerating complete function menus whenever an upstream package changes.
