// did-analysis.ts — a Claude Code dynamic workflow that runs a complete, reviewed
// Difference-in-Differences analysis end-to-end on a panel dataset.
//
// It is the orchestration counterpart to the repo's `skill/` (the 5-step DiD method
// guides + R recipes) and `mcp/` (the did_* tool server). The workflow:
//   1. reports the installed R environment against the observed API baseline and
//      last-validated versions (offline, report-only);
//   2. runs the 5-step Roth et al. procedure, with EACH step gated by three independent
//      reviewers — statistical, economic, and artifact-QA — looping until none has an
//      open blocking issue;
//   3. audits all generated artifacts for cross-consistency, then writes an
//      audience-tailored report that two independent reviewers (correctness + audience
//      fit) sign off on.
//
// Install: copy to `.claude/workflows/did-analysis.ts` in a project, or to
//          `~/.claude/workflows/did-analysis.ts` (what install.sh does) to use it
//          everywhere. Invoke as `/did-analysis` or:
//   Workflow({
//     name: "did-analysis",
//     args: {
//       data: "/abs/path/panel.csv",   // CSV/Parquet panel
//       idVar: "state", timeVar: "year", outcomeVar: "emp",
//       gvar: "first_treat",           // TIMING var (cohort), NOT a 0/1 indicator
//       covariates: ["lpop"],          // optional
//       clusterVar: "state",           // optional; defaults to idVar (set to assignment level!)
//       neverTreatedSourceCoding: "0", // how the raw data marks never-treated: 0 | NA | Inf | sentinel
//       estimators: ["cs","sa","did2s","bjs","staggered"],
//       audience: "economists",        // economists | statisticians | general | applied (or an array)
//       outputDir: "analyses",         // base dir; a per-run subfolder is minted under it
//       path: "auto",                  // auto | mcp | rfallback (force the execution path)
//       skipPackageCheck: false,
//       maxStepReviewRounds: 2,
//       maxReportReviewRounds: 2,
//     },
//   })
//
// The workflow script never touches the filesystem or runs R itself — agents do. When
// the did_* MCP tools are registered they are preferred; otherwise agents run the R
// recipes documented in skill/references/did-step-*.md via Rscript.

// ## Contents
// - [Configuration](#configuration)
// - [Contracts](#contracts)
// - [Execution](#execution)

// ## Configuration
export const meta = {
  name: 'did-analysis',
  description:
    'Run a complete, reviewed Difference-in-Differences analysis on a panel dataset: inspect installed package provenance against the last-validated environment (offline, report-only), then execute the 5-step Roth et al. procedure (treatment structure, TWFE diagnostics, robust estimation, pre-trends power, HonestDiD sensitivity) where EVERY step is gated by three independent reviewers — statistical, economic, and artifact-QA — looping until no blocking issue remains; audit all artifacts for cross-consistency; and write an audience-tailored report that a correctness reviewer and an audience-fit reviewer sign off on.',
  whenToUse:
    'When the user has a panel dataset (state-year, firm-quarter, etc.) with a treatment-timing variable and wants a credible, end-to-end DiD analysis with built-in statistical + economic review at each step, integrity-checked CSV/figure/table outputs, and a written report for a chosen audience.',
  phases: [
    { title: 'Preflight',          detail: 'Check Rscript + P0 packages, dataset readability, MCP-vs-R path' },
    { title: 'Packages',           detail: 'Installed versions + source revisions vs recorded environment (offline, report-only)' },
    { title: 'Configure',          detail: 'Resolve dataset, infer/validate column mapping, mint the run directory' },
    { title: 'Step 1 Structure',   detail: 'Panel integrity + design profile → route; gated by stat/econ/QA reviewers' },
    { title: 'Step 2 Diagnostics', detail: 'Bacon decomposition + negative weights → severity (STAGGERED only)' },
    { title: 'Step 3 Estimation',  detail: 'Robust estimators in parallel + reviewed synthesis/comparison' },
    { title: 'Step 4 Power',       detail: 'pretrends power analysis on the primary event study' },
    { title: 'Step 5 Sensitivity', detail: 'HonestDiD relative-magnitudes breakdown M' },
    { title: 'Artifact Audit',     detail: 'Consolidated integrity gate over every generated CSV/figure/table' },
    { title: 'Report',             detail: 'Audience-tailored write-up with the 7-label evidence verdict' },
    { title: 'Report Review',      detail: 'Correctness + audience-fit reviewers loop until both approve' },
    { title: 'Compile',            detail: 'Write artifacts, implementation.json, report(s), and review log' },
  ],
}

// ---------- args + defaults ----------
// Args may arrive either as a parsed object or as a JSON-encoded string (depending on how
// the workflow is invoked). Normalize so a.data/a.estimators/etc. resolve in both cases.
const a = (() => {
  const raw = args ?? {}
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return {}
    try { const parsed = JSON.parse(s); return parsed && typeof parsed === 'object' ? parsed : {} }
    catch { return {} }
  }
  return typeof raw === 'object' ? raw : {}
})()
const dataPath   = a.data ?? a.dataPath ?? null
const idVar      = a.idVar ?? null
const timeVar    = a.timeVar ?? null
const outcomeVar = a.outcomeVar ?? null
const gvar       = a.gvar ?? a.gVar ?? null            // treatment-TIMING (cohort) variable
const covariates = Array.isArray(a.covariates) ? a.covariates : []
const clusterVar = a.clusterVar ?? idVar
const neverTreatedSourceCoding = String(a.neverTreatedSourceCoding ?? 'unknown')
const weightsVar = a.weightsVar ?? null
const DEFAULT_ESTIMATORS = ['cs', 'sa', 'did2s', 'bjs', 'staggered']
const estimators = (Array.isArray(a.estimators) && a.estimators.length ? a.estimators : DEFAULT_ESTIMATORS)
  .map((e) => String(e).toLowerCase())
const outputDirBase = String(a.outputDir ?? 'analyses')
const skipPackageCheck = a.skipPackageCheck ?? false
const pathMode = String(a.path ?? 'auto').toLowerCase()    // auto | mcp | rfallback
// Coerce to a non-negative integer even when a value arrives as a string (e.g. "2").
const toInt = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : d }
const maxStepReviewRounds   = toInt(a.maxStepReviewRounds, 2)
const maxReportReviewRounds = toInt(a.maxReportReviewRounds, 2)
// Don't start a fresh review round below these remaining-token floors.
const STEP_BUDGET_FLOOR   = 60_000
const REPORT_BUDGET_FLOOR = 50_000

// Audience profiles steer the report writer + audience-fit reviewer. The user may pass a
// single audience or an array (one report variant per audience).
const AUDIENCE_PROFILE = {
  economists:    'Lead with the causal estimand and its economic magnitude/mechanism, then policy relevance. Econometric rigor (identification, robust estimator, sensitivity) is present but in service of the economics. Report effects in interpretable units and benchmark magnitudes against the relevant literature.',
  statisticians: 'Foreground estimator properties, identification assumptions, the TWFE-bias diagnosis, inference (clustering, event-study coefficients), and the HonestDiD/pre-trends sensitivity analysis. Be precise about what is assumed vs. what is tested.',
  general:       'Plain-language and intuition-first, with minimal jargon. Explain what difference-in-differences asks, what the headline effect means in concrete terms, and how much to trust it. Relegate technical detail (estimators, matrices, breakdown M) to an appendix.',
  applied:       'Lead with the decision and the bottom-line effect, then practical caveats and what it implies for policy/practice. Keep technical machinery light; emphasize whether the finding is robust enough to act on.',
}
const SUPPORTED_AUDIENCES = Object.keys(AUDIENCE_PROFILE)
const audiences = (Array.isArray(a.audience) ? a.audience : [a.audience ?? 'economists'])
  .map((x) => String(x).toLowerCase())
  .filter((x) => SUPPORTED_AUDIENCES.includes(x))
const audienceList = [...new Set(audiences.length ? audiences : ['economists'])]

// BEGIN GENERATED PACKAGE INVENTORY
// Source: skill/references/package-registry.json; run node scripts/package-maintenance.mjs sync.
const PACKAGES = [
  {"name":"did","priority":"P0","install":"required","source":"cran","repo":"bcallaway11/did"},
  {"name":"fixest","priority":"P0","install":"required","source":"cran","repo":"lrberge/fixest"},
  {"name":"did2s","priority":"P0","install":"required","source":"cran","repo":"kylebutts/did2s"},
  {"name":"didimputation","priority":"P0","install":"required","source":"cran","repo":"kylebutts/didimputation"},
  {"name":"staggered","priority":"P0","install":"required","source":"cran","repo":"jonathandroth/staggered"},
  {"name":"bacondecomp","priority":"P0","install":"required","source":"cran"},
  {"name":"TwoWayFEWeights","priority":"P0","install":"required","source":"cran"},
  {"name":"HonestDiD","priority":"P0","install":"required","source":"cran","repo":"asheshrambachan/HonestDiD"},
  {"name":"pretrends","priority":"P0","install":"required","source":"github","repo":"jonathandroth/pretrends"},
  {"name":"panelView","priority":"P0","install":"required","source":"cran"},
  {"name":"DRDID","priority":"P1","install":"optional","source":"cran"},
  {"name":"etwfe","priority":"P1","install":"optional","source":"cran"},
  {"name":"DIDmultiplegt","priority":"P1","install":"optional","source":"cran"},
  {"name":"DIDmultiplegtDYN","priority":"P1","install":"optional","source":"cran"},
  {"name":"gsynth","priority":"P1","install":"optional","source":"cran"},
  {"name":"synthdid","priority":"P1","install":"optional","source":"github","repo":"synth-inference/synthdid"},
  {"name":"YatchewTest","priority":"P2","install":"manual","source":"cran"},
  {"name":"jsonlite","priority":null,"install":"required","source":"cran"},
  {"name":"data.table","priority":null,"install":"required","source":"cran"},
  {"name":"ggplot2","priority":null,"install":"required","source":"cran"},
  {"name":"arrow","priority":null,"install":"manual","source":"cran"},
  {"name":"polars","priority":null,"install":"manual","source":"r-universe"},
]
// END GENERATED PACKAGE INVENTORY

// Repo locations agents read recipes / package docs from. The workflow is part of the repo,
// so these resolve relative to the working tree; agents resolve them with Glob/Read if the
// relative path misses (e.g. when the workflow is symlinked into ~/.claude/workflows).
const SKILL = 'skill'
const STEP_GUIDE = {
  structure:   `${SKILL}/references/did-step-1-treatment-structure.md`,
  diagnostics: `${SKILL}/references/did-step-2-diagnostics.md`,
  estimation:  `${SKILL}/references/did-step-3-estimation.md`,
  power:       `${SKILL}/references/did-step-4-power-analysis.md`,
  sensitivity: `${SKILL}/references/did-step-5-sensitivity-inference.md`,
}

// ---------- shared context for every agent ----------
const SHARED = `
You are an agent inside an automated Difference-in-Differences (DiD) analysis workflow.

Dataset:        ${dataPath ?? '(not given — the Configure agent must locate it)'}
Column mapping: id=${idVar ?? '?'}, time=${timeVar ?? '?'}, outcome=${outcomeVar ?? '?'}, gvar(timing)=${gvar ?? '?'}
Covariates:     ${covariates.length ? covariates.join(', ') : '(none)'}
Cluster var:    ${clusterVar ?? '(defaults to id)'}
Weights var:    ${weightsVar ?? '(none — run unweighted)'}
Never-treated raw coding: ${neverTreatedSourceCoding}

Execution path:
- If did_* MCP tools are available to you (search for them with ToolSearch, e.g. "did_estimate"),
  PREFER them and pass handle ids forward WITHIN your own turn only.
- Otherwise (the common case), run the R recipes documented in the repo's skill guides via Rscript
  through the Bash tool. The relevant guide for each step is named in your task.
- Do NOT mix the two paths within one analysis; use whichever the Preflight reported.

Hard rules:
- NEVER fabricate data, results, figures, or numbers. If something cannot be computed, say so plainly.
- 'gvar' is the treatment-TIMING (cohort) variable — the period a unit is first treated — NOT a 0/1
  indicator. Never-treated units are recoded PER ESTIMATOR: Callaway-Sant'Anna (did)=0; Sun-Abraham
  (fixest sunab) and staggered=Inf; BJS (didimputation)=0 and requires a BALANCED panel;
  Gardner (did2s) builds an explicit 0/1 'treat' from gvar.
- Sampling weights: ${weightsVar ? `the weights column is "${weightsVar}" — pass it to estimators that accept weights (e.g. did::att_gt(weightsname="${weightsVar}"), feols(weights=~${weightsVar}), DRDID) and report the weighted estimate; note any estimator that cannot use it.` : 'no weights column was supplied — run unweighted and say so.'}
- Cross-stage state lives ONLY in files under the run directory and in the JSON you return. Earlier
  agents' in-memory R/MCP handles do not survive to you; re-derive from the data + saved artifacts.
- Save every artifact you generate under the run directory: tables/CSVs in <runDir>/tables/, figures in
  <runDir>/figures/. Return a manifest of what you wrote.
- Output Markdown in any prose fields.
`.trim()

// ---------- schemas ----------
const ISSUE = {
  type: 'object',
  required: ['severity', 'issue', 'status'],
  properties: {
    severity:    { type: 'string', enum: ['blocking', 'major', 'minor'] },
    issue:       { type: 'string', description: 'The problem or question, stated concretely.' },
    suggestedFix:{ type: 'string', description: 'A concrete change that would resolve it.' },
    status:      { type: 'string', enum: ['open', 'resolved'], description: 'resolved only if a prior round already addressed it.' },
  },
}
const REVIEW_SCHEMA = {
  type: 'object',
  required: ['verdict', 'summary', 'issues'],
  properties: {
    verdict: { type: 'string', enum: ['approved', 'changes-requested'] },
    summary: { type: 'string', description: 'One-paragraph verdict from this reviewer\'s lens.' },
    issues:  { type: 'array', items: ISSUE },
  },
}

const ARTIFACT = {
  type: 'object',
  required: ['path', 'type', 'role'],
  properties: {
    path:            { type: 'string', description: 'Path under the run directory.' },
    type:            { type: 'string', enum: ['csv', 'figure', 'table', 'json'] },
    role:            { type: 'string', description: 'What this file is (e.g. "event-study coefficients", "rollout plot").' },
    expectedHeaders: { type: 'array', items: { type: 'string' } },
    expectedRows:    { type: 'integer' },
    keyValues:       { type: 'string', description: 'Headline numbers the file should contain, for cross-checking.' },
  },
}
const STEP_BASE_PROPS = {
  summary:   { type: 'string', description: 'What this step found, in prose.' },
  markdown:  { type: 'string', description: 'A self-contained Markdown writeup of this step (for the per-step .md file).' },
  artifacts: { type: 'array', items: ARTIFACT, description: 'Every file this step wrote under the run directory.' },
  rCode:     { type: 'string', description: 'The exact R (or tool calls) that produced these results, for reproducibility.' },
}

const PREFLIGHT_SCHEMA = {
  type: 'object',
  required: ['runnable', 'path', 'rOk', 'datasetOk', 'summary'],
  properties: {
    runnable:    { type: 'boolean', description: 'False if the analysis cannot proceed (missing R/packages/dataset).' },
    path:        { type: 'string', enum: ['mcp', 'rfallback'], description: 'Which execution path downstream agents should use.' },
    rOk:         { type: 'boolean' },
    rscriptPath: { type: 'string' },
    rVersion:    { type: 'string' },
    packagesMissing: { type: 'array', items: { type: 'string' }, description: 'Required packages that are absent or failed a load check; metadata alone does not check loadability.' },
    datasetOk:   { type: 'boolean' },
    columns:     { type: 'array', items: { type: 'string' }, description: 'Detected columns in the dataset.' },
    blockers:    { type: 'array', items: { type: 'string' } },
    summary:     { type: 'string' },
  },
}

const PKG_SUMMARY_SCHEMA = {
  type: 'object',
  required: ['environmentChanges', 'checks', 'markdown'],
  properties: {
    environmentChanges: { type: 'integer' },
    checks: { type: 'array', items: { type: 'object', required: ['package', 'installed', 'status'], properties: {
      package: { type: 'string' }, installed: { type: 'string', description: 'Observed version, missing, or unknown.' },
      validatedVersion: { type: 'string' }, remoteSha: { type: 'string' },
      status: { type: 'string', enum: ['matches', 'changed', 'missing', 'unknown'] },
      notes: { type: 'string' },
    } } },
    headline:         { type: 'string' },
    markdown:         { type: 'string', description: 'Offline package provenance report; never claim an upstream release was checked.' },
  },
}

const CONFIG_SCHEMA = {
  type: 'object',
  required: ['datasetResolved', 'runDir', 'dataPath', 'idVar', 'timeVar', 'outcomeVar', 'gvar', 'mappingRationale'],
  properties: {
    datasetResolved: { type: 'boolean', description: 'False if no real user dataset could be resolved (then the workflow aborts rather than analyzing a stand-in).' },
    abortReason:     { type: 'string', description: 'If datasetResolved is false, the message to show the user.' },
    runDir:        { type: 'string', description: 'The created per-run output directory (absolute or repo-relative).' },
    dataPath:      { type: 'string' },
    idVar:         { type: 'string' },
    timeVar:       { type: 'string' },
    outcomeVar:    { type: 'string' },
    gvar:          { type: 'string', description: 'Treatment-timing/cohort column (confirmed constant within unit and non-binary).' },
    covariates:    { type: 'array', items: { type: 'string' } },
    clusterVar:    { type: 'string' },
    neverTreatedSourceCoding: { type: 'string', enum: ['0', 'NA', 'Inf', 'sentinel', 'unknown'] },
    weightsVar:    { type: 'string' },
    gvarValidated: { type: 'boolean', description: 'True if gvar is constant within unit and not a 0/1 indicator.' },
    warnings:      { type: 'array', items: { type: 'string' } },
    mappingRationale: { type: 'string', description: 'Why these columns were chosen — so a wrong guess is catchable.' },
  },
}

// ## Contracts
const EVENT_STUDY = {
  type: 'object',
  required: ['betahat', 'tVec', 'sigmaIsDiagonalFallback'],
  properties: {
    betahat: { type: 'array', items: { type: 'number' }, description: 'Event-study coefficients in tVec order.' },
    tVec:    { type: 'array', items: { type: 'number' }, description: 'Relative event times (e.g. -3..4), excluding the reference period.' },
    sigma:   {
      type: 'object',
      properties: {
        values: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'VCOV as nested rows.' },
        dim:    { type: 'array', items: { type: 'integer' }, description: '[nrow, ncol].' },
      },
    },
    sigmaIsDiagonalFallback: { type: 'boolean', description: 'True unless a full matched VCOV was extracted (Sun-Abraham and did2s preserve it).' },
  },
}
const ESTIMATE_SCHEMA = {
  type: 'object',
  required: ['estimator', 'ran', 'eventStudy'],
  properties: {
    estimator:  { type: 'string', enum: ['cs', 'sa', 'did2s', 'bjs', 'staggered'] },
    ran:        { type: 'boolean' },
    overallATT: { type: 'number' },
    se:         { type: 'number' },
    ci:         { type: 'array', items: { type: 'number' }, description: '[low, high].' },
    eventStudy: EVENT_STUDY,
    neverTreatedRecode: { type: 'string', description: 'How never-treated was coded for this estimator.' },
    metadata:   { type: 'string', description: 'Clustering, covariates, reference period, package version.' },
    artifacts:  { type: 'array', items: ARTIFACT },
    error:      { type: 'string', description: 'If ran=false, why.' },
  },
}
const ESTIMATION_SUMMARY_SCHEMA = {
  type: 'object',
  required: ['primaryEstimator', 'agree', 'estimates', 'summary', 'markdown', 'artifacts'],
  properties: {
    primaryEstimator: { type: 'string', description: 'The estimator carried forward (default cs).' },
    cv:               { type: 'number', description: 'Coefficient of variation of overall ATT across estimators that ran.' },
    agree:            { type: 'boolean', description: 'True if estimators agree (cv < 0.2 and signs match).' },
    estimates:        { type: 'array', items: ESTIMATE_SCHEMA },
    comparisonTable:  { type: 'string', description: 'Markdown table of estimator vs overall ATT, SE, CI.' },
    summary:          { type: 'string' },
    markdown:         { type: 'string' },
    artifacts:        { type: 'array', items: ARTIFACT },
  },
}

const STRUCTURE_SCHEMA = {
  type: 'object',
  required: ['route', 'isBalanced', 'summary', 'markdown', 'artifacts'],
  properties: {
    route:      { type: 'string', enum: ['CANONICAL', 'STAGGERED', 'ADVANCED', 'NO_TREATMENT'] },
    isBalanced: { type: 'boolean' },
    nUnits:     { type: 'integer' },
    nPeriods:   { type: 'integer' },
    cohorts:    { type: 'string', description: 'Cohort summary (timing dates + sizes).' },
    integrityIssues: { type: 'array', items: { type: 'string' } },
    routeReason: { type: 'string' },
    ...STEP_BASE_PROPS,
  },
}
const TWFE_SCHEMA = {
  type: 'object',
  required: ['severity', 'summary', 'markdown', 'artifacts'],
  properties: {
    forbiddenWeightPct: { type: 'number', description: 'Goodman-Bacon forbidden-comparison (later-vs-earlier) weight share, %.' },
    negWeightPct:       { type: 'number', description: 'TwoWayFEWeights negative-weight share, %.' },
    severity:           { type: 'string', enum: ['MINIMAL', 'MILD', 'MODERATE', 'SEVERE'] },
    recommendation:     { type: 'string' },
    ...STEP_BASE_PROPS,
  },
}
const POWER_SCHEMA = {
  type: 'object',
  required: ['powerQuality', 'biasRatio', 'summary', 'markdown', 'artifacts'],
  properties: {
    detectableSlope50: { type: 'number' },
    detectableSlope80: { type: 'number' },
    pretrendsP:        { type: 'number', description: 'Joint pre-trends test p-value.' },
    biasRatio:         { type: 'number', description: 'Detectable trend relative to the estimated effect (<1 = well powered).' },
    powerQuality:      { type: 'string', enum: ['excellent', 'good', 'moderate', 'poor'] },
    diagonalCaveat:    { type: 'boolean', description: 'True if computed from a diagonal-sigma fallback (conservative).' },
    ...STEP_BASE_PROPS,
  },
}
const SENSITIVITY_SCHEMA = {
  type: 'object',
  required: ['breakdownM', 'summary', 'markdown', 'artifacts'],
  properties: {
    breakdownM:     { type: 'number', description: 'Smallest relative-magnitude M at which the robust CI includes zero (Inf/None if never).' },
    robustCIs:      { type: 'string', description: 'Markdown table of M (Mbar) vs robust CI.' },
    diagonalCaveat: { type: 'boolean' },
    ...STEP_BASE_PROPS,
  },
}

const AUDIT_SCHEMA = {
  type: 'object',
  required: ['allConsistent', 'issues', 'markdown'],
  properties: {
    allConsistent: { type: 'boolean' },
    checked:       { type: 'integer', description: 'Number of artifacts checked.' },
    issues:        { type: 'array', items: ISSUE },
    offendingStep: { type: 'string', description: 'If a single step is responsible for blocking issues, name it; else empty.' },
    markdown:      { type: 'string', description: 'The artifact-audit.md body.' },
  },
}

const REPORT_SCHEMA = {
  type: 'object',
  required: ['markdown', 'verdict'],
  properties: {
    markdown: { type: 'string', description: 'The full report body for this audience.' },
    verdict:  { type: 'string', enum: ['STRONG EVIDENCE', 'MIXED', 'FRAGILE', 'SUGGESTIVE', 'EVIDENCE OF NULL', 'UNINFORMATIVE', 'INCONCLUSIVE'] },
    verdictBooleans: {
      type: 'object',
      properties: {
        attSig:         { type: 'boolean' },
        powered:        { type: 'boolean' },
        pretestPass:    { type: 'boolean' },
        robust:         { type: 'boolean' },
        estimatorsAgree:{ type: 'boolean' },
      },
    },
  },
}

// ---------- helpers ----------
const lbl = (base, it) => (it === 0 ? base : `${base} (round ${it})`)
const openIssues = (reviews) =>
  (reviews ?? [])
    .flatMap((r) => (r && Array.isArray(r.issues) ? r.issues : []))
    .filter((i) => i && i.severity !== 'minor' && i.status !== 'resolved')
const issueBlock = (reviews) =>
  openIssues(reviews)
    .map((i) => `- [${i.severity}] ${i.issue}${i.suggestedFix ? ` — suggested fix: ${i.suggestedFix}` : ''}`)
    .join('\n') || '(none)'

// Render a compact, prompt-safe view of a result object for downstream agents.
const brief = (obj) => {
  try { return JSON.stringify(obj, (k, v) => (k === 'rCode' || k === 'markdown' ? undefined : v)) } catch { return String(obj) }
}

// ---------- the reviewed-step engine ----------
// One executor + three independent reviewers (statistical, economic, artifact-QA) run in
// parallel each round; the step finishes only when no reviewer has an open blocking/major issue.
const runReviewedStep = async ({ title, label, guide, runDir, execSchema, execPrompt, criteria }) => {
  phase(title)
  let result = await agent(execPrompt(null), { label, phase: title, schema: execSchema })

  const review = (res) =>
    parallel([
      () => agent(
        `${SHARED}\n\nYou are the STATISTICAL reviewer for the "${title}" step (independent of the analyst). Read the step guide at ${guide}.\n\nThe analyst returned:\n${brief(res)}\n\nScrutinize statistical correctness: ${criteria.stat}\nRaise concrete blocking/major issues where the method, assumptions, coding, or inference are wrong or unjustified. Approve only if sound. Return JSON.`,
        { label: `${label}:stat`, phase: title, schema: REVIEW_SCHEMA },
      ),
      () => agent(
        `${SHARED}\n\nYou are the ECONOMIC reviewer for the "${title}" step (independent of the analyst). Judge whether the results are economically SENSIBLE in this applied context.\n\nThe analyst returned:\n${brief(res)}\n\nConsider: ${criteria.econ}\nRaise blocking/major issues if signs/magnitudes are implausible, mechanisms are missing, or the framing oversells. Approve if economically reasonable. Return JSON.`,
        { label: `${label}:econ`, phase: title, schema: REVIEW_SCHEMA },
      ),
      () => agent(
        `${SHARED}\n\nYou are the ARTIFACT-QA reviewer for the "${title}" step. The report agent will consume these files later, so verify their integrity using Bash/Read on the run directory ${runDir}.\n\nThe analyst declared these artifacts:\n${brief((res && res.artifacts) || [])}\n\nCheck EACH: file exists and is non-empty; CSVs parse with the expected headers, row counts, and finite values (no stray NA where a number is expected); figures are valid non-empty images (PNG/PDF header, size > 0); tables are well-formed; AND ${criteria.qa}. Cross-check that values in the files match the analyst's returned numbers. Raise blocking issues for anything malformed, missing, or inconsistent. Return JSON.`,
        { label: `${label}:qa`, phase: title, schema: REVIEW_SCHEMA },
      ),
    ])

  let reviews = await review(result)
  let round = 0
  while (openIssues(reviews).length) {
    if (round >= maxStepReviewRounds) { log(`${title}: reached max ${maxStepReviewRounds} review round(s) with open issues — proceeding and flagging them.`); break }
    if (budget.total && budget.remaining() < STEP_BUDGET_FLOOR) { log(`${title}: token budget low — stopping the review loop and flagging open issues.`); break }
    round++
    log(`${title}: revising to address ${openIssues(reviews).length} open issue(s) (round ${round}).`)
    result = await agent(execPrompt(reviews), { label: lbl(label, round), phase: title, schema: execSchema })
    reviews = await review(result)
  }
  return { result, reviews, rounds: round, openIssues: openIssues(reviews) }
}

// =====================================================================================
// ## Execution
// =====================================================================================

// ---- 1. Preflight -------------------------------------------------------------------
phase('Preflight')
const preflight = await agent(
  `${SHARED}\n\nPreflight the environment using read-only Bash. Do NOT install anything or modify files.\n` +
  `1. Confirm Rscript is on PATH (capture its path + version), OR detect that the did_* MCP tools are registered.\n` +
  `2. Probe the registry-required packages: ${PACKAGES.filter(p => p.install === 'required').map(p => p.name).join(', ')} (use Rscript -e 'requireNamespace(...)' with options(rgl.useNULL=TRUE); for MCP use did_ping bridge.package_provenance and state that metadata confirms installation, not namespace loadability); list any that fail. Optional packages should be checked only if the chosen method needs them.\n` +
  `3. Confirm the dataset ${dataPath ?? '(path not supplied — note this; Configure will locate it)'} is readable and list its columns + row count.\n` +
  `4. Decide the execution path: "mcp" only if did_* tools are actually available, else "rfallback". (Requested: ${pathMode}.)\n` +
  `Set runnable=false (with blockers) if R is missing AND MCP is unavailable, or if no dataset can be read. If a P0 package is missing, note that the user should run Rscript mcp/r/install_packages.R — do NOT install it yourself. Return JSON.`,
  { label: 'preflight', phase: 'Preflight', schema: PREFLIGHT_SCHEMA },
)
if (!preflight.runnable) {
  log(`Preflight failed — cannot run the analysis: ${(preflight.blockers ?? []).join('; ') || preflight.summary}`)
  return { aborted: true, stage: 'preflight', blockers: preflight.blockers ?? [], summary: preflight.summary }
}
const execPath = pathMode === 'mcp' || pathMode === 'rfallback' ? pathMode : preflight.path
log(`Preflight OK — execution path: ${execPath}; missing P0 packages: ${(preflight.packagesMissing ?? []).join(', ') || 'none'}.`)

// ---- 2. Packages (offline, report-only) ---------------------------------------------
let pkgSummary = null
let pkgChecks = []
if (!skipPackageCheck) {
  phase('Packages')
  log('Inspecting the installed R environment (offline)...')
  pkgSummary = await agent(
    `${SHARED}\n\nInspect package provenance once, locally. Do not browse upstream, install packages, rewrite a baseline, or read entire package manuals.\n` +
    `Selected execution path: ${execPath}. For MCP, call did_ping and use bridge.package_provenance from the server's actual R environment. For rfallback, run the preflight Rscript (${preflight.rscriptPath || 'Rscript'}) with ${SKILL}/scripts/package-status.R; resolve the installed skill location if needed.\n` +
    `Compare observations with ${SKILL}/references/package-versions.md (last validated, NOT pinned) and ${SKILL}/references/package-api-baseline.json (observed API baseline, NOT a validation certificate). Missing optional/manual packages are informational. Missing required packages or changed versions need explicit notes. A matching version is not a full compatibility test.\n` +
    `Return checks and a packages-report.md table with package, installed version, last-validated version, source SHA and status; count changed installed versions/revisions in environmentChanges. Use unknown if inspection is unavailable. Say upstream releases were not checked. For a needed argument, use ${SKILL}/scripts/package-doc.R PACKAGE TOPIC in the same R environment.`,
    { label: 'pkg:environment', phase: 'Packages', schema: PKG_SUMMARY_SCHEMA },
  )
  pkgChecks = pkgSummary.checks ?? []
  log(`Package environment: ${pkgSummary.environmentChanges} observed change(s).`)
} else {
  log('Skipping package environment report (skipPackageCheck=true).')
}

// ---- 3. Configure -------------------------------------------------------------------
phase('Configure')
const config = await agent(
  `${SHARED}\n\nYou are the configuration agent. Read the step-1 guide at ${STEP_GUIDE.structure} for what a valid DiD design needs.\n` +
  `1. Resolve the dataset:\n` +
  (dataPath
    ? `   A path WAS supplied: "${dataPath}". Use it VERBATIM (quote it when passing to R/Bash — it may contain spaces). Do NOT substitute any other file. If this exact file cannot be read/parsed, set datasetResolved=false with a clear abortReason — do NOT fall back to any other dataset.\n`
    : `   No path was supplied. Search the working tree for a genuine USER panel dataset (CSV/Parquet/DTA), but EXCLUDE these directories entirely: mcp/, test/, tests/, fixtures/, node_modules/, analyses/, .git/, and anything under skill/. A file under any of those (e.g. mcp/test/fixtures/mpdta.csv) is a TEST FIXTURE, not user data — NEVER analyze it. If the only candidates are test fixtures, or nothing plausible is found, set datasetResolved=false with abortReason asking the user to pass an explicit \`data\` path. Never invent or stand in a dataset.\n`) +
  `2. Read the header + a few rows and confirm/infer the column mapping (id, time, outcome, gvar-timing, covariates, cluster, weights). ` +
  `Validate that gvar is the treatment-TIMING variable: it must be constant within unit and NOT a 0/1 indicator. If the supplied gvar looks like a 0/1 treat dummy, flag it loudly in warnings and pick the real timing column if one exists.\n` +
  `3. Only if a real dataset resolved: mint a run directory under "${outputDirBase}/": choose a short slug from the dataset basename (e.g. ${outputDirBase}/<dataset-slug>), create it plus tables/ and figures/ subfolders with Bash (mkdir -p), and return its path as runDir.\n` +
  `Set datasetResolved=true only when a real user dataset was read. State your inferred mapping and the reasoning in mappingRationale so a wrong guess is catchable. Return JSON.`,
  { label: 'configure', phase: 'Configure', schema: CONFIG_SCHEMA },
)
if (config.datasetResolved === false) {
  log(`Configure could not resolve a real dataset — aborting: ${config.abortReason || 'no usable dataset; pass an explicit `data` path.'}`)
  return { aborted: true, stage: 'configure', reason: config.abortReason || 'No usable dataset resolved; pass an explicit `data` path.' }
}
const runDir = config.runDir
log(`Run directory: ${runDir}; mapping: id=${config.idVar}, time=${config.timeVar}, y=${config.outcomeVar}, gvar=${config.gvar}.`)

// A compact context string threaded into each step executor.
const cfgContext =
  `Config: ${brief(config)}\nRun directory: ${runDir} (write tables to ${runDir}/tables, figures to ${runDir}/figures).\nExecution path: ${execPath}.`

const steps = {}            // collected step results
let report = null
const reportVariants = {}   // audience -> {markdown, verdict}

// ---- 4. Step 1: Treatment structure -------------------------------------------------
const step1 = await runReviewedStep({
  title: 'Step 1 Structure',
  label: 'structure',
  guide: STEP_GUIDE.structure,
  runDir,
  execSchema: STRUCTURE_SCHEMA,
  criteria: {
    stat: 'are the six integrity checks (uniqueness, timing consistency, balance, sentinel values, already-treated, future-treatment) actually run? Is the route (CANONICAL/STAGGERED/ADVANCED/NO_TREATMENT) justified by the cohort structure? Is balance correctly determined (it gates BJS later)?',
    econ: 'does the treatment-timing structure match the institutional reality of this setting? Are the cohorts and rollout plausible? Are there obvious confounding adoption patterns worth flagging?',
    qa: 'the rollout/cohort plot renders and the cohort summary table has one row per cohort with sane counts',
  },
  execPrompt: (reviews) =>
    `${SHARED}\n\n${cfgContext}\n\nSTEP 1 — assess treatment structure. Follow ${STEP_GUIDE.structure}.\n` +
    `Run the panel integrity checks and design profiling on the dataset; classify the route; determine if the panel is balanced; summarize cohorts; produce a rollout/cohort plot (save to ${runDir}/figures) and a cohort-summary CSV (save to ${runDir}/tables).\n` +
    (reviews ? `\nReviewers requested changes — address every open issue, regenerate affected artifacts, and mark them resolved:\n${issueBlock(reviews)}\n` : '') +
    `Return JSON including route, isBalanced, the artifact manifest, and a Markdown writeup.`,
})
if (!step1.result) {
  log('Step 1 (structure) produced no result — aborting.')
  return { aborted: true, stage: 'structure', runDir, reason: 'Step 1 (treatment structure) returned no result.' }
}
steps.structure = step1.result
const route = step1.result.route
log(`Step 1 route: ${route} (balanced=${step1.result.isBalanced}).`)

if (route === 'NO_TREATMENT') {
  log('No treatment variation detected — DiD is not applicable. Stopping after Step 1.')
  return { aborted: true, stage: 'structure', route, runDir, reason: 'No treatment variation in the panel — DiD is not applicable.' }
}
const advanced = route === 'ADVANCED'
if (advanced) {
  log('Route is ADVANCED (reversible/continuous/non-binary treatment) — out of scope for the 5-step pipeline. Will report and point to skill/references/did-advanced-methods.md.')
}
const proceed = route === 'CANONICAL' || route === 'STAGGERED'

// ---- 5. Step 2: TWFE diagnostics (STAGGERED only) -----------------------------------
if (proceed && route === 'STAGGERED') {
  const step2 = await runReviewedStep({
    title: 'Step 2 Diagnostics',
    label: 'diagnostics',
    guide: STEP_GUIDE.diagnostics,
    runDir,
    execSchema: TWFE_SCHEMA,
    criteria: {
      stat: 'are both the Goodman-Bacon decomposition and the TwoWayFEWeights negative-weight share computed? Is the severity band (MINIMAL/MILD/MODERATE/SEVERE) consistent with the forbidden/negative weight percentages?',
      econ: 'does the diagnosis lead to a sensible recommendation about trusting TWFE for this policy/setting?',
      qa: 'the Bacon decomposition table parses with finite weights summing sensibly, and any decomposition plot renders',
    },
    execPrompt: (reviews) =>
      `${SHARED}\n\n${cfgContext}\n\nSTEP 2 — diagnose TWFE problems on the staggered design. Follow ${STEP_GUIDE.diagnostics}.\n` +
      `Run the Goodman-Bacon decomposition and TwoWayFEWeights; report the forbidden-comparison weight % and negative-weight %; classify severity and give a recommendation. Save the decomposition table to ${runDir}/tables and any plot to ${runDir}/figures.\n` +
      (reviews ? `\nReviewers requested changes — address every open issue and regenerate affected artifacts:\n${issueBlock(reviews)}\n` : '') +
      `Return JSON with the artifact manifest and a Markdown writeup.`,
  })
  steps.diagnostics = step2.result
  log(`Step 2 severity: ${step2.result.severity} (forbidden ${step2.result.forbiddenWeightPct}%, negative ${step2.result.negWeightPct}%).`)
} else if (proceed) {
  log('Route is CANONICAL (single treatment date) — TWFE diagnostics not required; standard DiD/TWFE is acceptable. Skipping Step 2.')
}

// ---- 6. Step 3: Robust estimation ---------------------------------------------------
if (proceed) {
  phase('Step 3 Estimation')
  const selected = estimators
  log(`Running estimators in parallel: ${selected.join(', ')}${steps.structure.isBalanced ? '' : ' (BJS will be skipped — panel is unbalanced)'}.`)
  const estimateResults = (await parallel(
    selected.map((est) => () =>
      agent(
        `${SHARED}\n\n${cfgContext}\n\nSTEP 3 — estimate with the "${est}" estimator. Follow ${STEP_GUIDE.estimation} (use that estimator's recipe exactly).\n` +
        `Apply the correct never-treated recoding for THIS estimator (cs=0; sa/staggered=Inf; bjs=0 and REQUIRES a balanced panel — if isBalanced is false, set ran=false with that reason; did2s builds an explicit 0/1 treat from gvar). Cluster at ${config.clusterVar || config.idVar}.\n` +
        `Produce: the overall ATT (with SE + 95% CI) and the event-study coefficients. Extract the {betahat, tVec, sigma} triple — for sa use HonestDiD:::sunab_beta_vcv() to get a true matched VCOV (sigmaIsDiagonalFallback=false); for did2s extract the full vcov(model), match rows and columns to event-study coefficient names, sort/trim coefficients and both covariance axes together, and set sigmaIsDiagonalFallback=false; fail explicitly on missing/duplicate names or invalid covariance; for cs, bjs, and staggered build sigma = diag(se^2) after filtering finite positive SEs (sigmaIsDiagonalFallback=true). Save the event-study coefficients CSV to ${runDir}/tables/event_study_${est}.csv and an event-study plot to ${runDir}/figures/event_study_${est}.png.\n` +
        `Return JSON for this single estimator (set ran=false + error if it cannot run). Do NOT fabricate numbers.`,
        { label: `estimate:${est}`, phase: 'Step 3 Estimation', schema: ESTIMATE_SCHEMA },
      ),
    ),
  )).filter(Boolean)

  const step3 = await runReviewedStep({
    title: 'Step 3 Estimation',
    label: 'estimation',
    guide: STEP_GUIDE.estimation,
    runDir,
    execSchema: ESTIMATION_SUMMARY_SCHEMA,
    criteria: {
      stat: 'is each estimator\'s never-treated recoding correct? Is BJS correctly skipped on an unbalanced panel? Are the {betahat,tVec,sigma} triples valid (right length, finite, reference period excluded, sigmaIsDiagonalFallback set honestly)? Is the chosen primary estimator appropriate?',
      econ: 'do the estimators broadly agree, and is the headline ATT economically plausible in sign and magnitude for this policy? Are disagreements between estimators explained rather than hidden?',
      qa: 'each event_study_<est>.csv parses with finite coefficients/SEs and matches the returned triple, and each event-study figure renders',
    },
    execPrompt: (reviews) =>
      `${SHARED}\n\n${cfgContext}\n\nSTEP 3 SYNTHESIS — you are the estimation lead. The per-estimator runs returned:\n${brief(estimateResults)}\n\n` +
      `Assemble the comparison: a Markdown table of estimator vs overall ATT/SE/CI; compute the coefficient of variation across estimators that ran; set agree=true if cv<0.2 and signs match; choose the primary estimator (default cs unless it failed). Carry forward the primary estimator's event-study triple. Save a comparison table CSV to ${runDir}/tables/estimator_comparison.csv.\n` +
      `If a reviewer flags a specific estimator as miscoded, RE-RUN that one estimator's recipe via Rscript, fix it, and update the synthesis (regenerate its CSV/figure too).\n` +
      (reviews ? `\nOpen review issues to resolve:\n${issueBlock(reviews)}\n` : '') +
      `Return JSON: include the full per-estimator estimates array, the comparison, the artifact manifest, and a Markdown writeup.`,
  })
  steps.estimation = step3.result
  log(`Step 3 primary: ${step3.result.primaryEstimator}; estimators agree=${step3.result.agree} (cv=${step3.result.cv}).`)

  // ---- 7. Step 4: Power analysis ----------------------------------------------------
  const step4 = await runReviewedStep({
    title: 'Step 4 Power',
    label: 'power',
    guide: STEP_GUIDE.power,
    runDir,
    execSchema: POWER_SCHEMA,
    criteria: {
      stat: 'is slope_for_power applied to the PRIMARY estimator\'s event-study triple at 50% and 80% power with the correct reference period? Is the diagonal-sigma caveat surfaced when the primary triple lacks a true VCOV? Is the non-significant-pretest-vs-underpowered distinction made?',
      econ: 'is the detectable trend interpreted in economically meaningful terms (could a plausible pre-trend masquerade as the effect)?',
      qa: 'the power/detectable-trend plot renders and any power table parses',
    },
    execPrompt: (reviews) =>
      `${SHARED}\n\n${cfgContext}\n\nSTEP 4 — pre-trends power analysis. Follow ${STEP_GUIDE.power}.\n` +
      `Read the primary estimator's event-study from ${runDir}/tables (primary = ${steps.estimation.primaryEstimator}) or reconstruct its {betahat,tVec,sigma} triple. Use pretrends::slope_for_power to get detectable linear-trend slopes at 50% and 80% power; report the joint pre-trends test p-value and the bias ratio; classify power quality. Surface the diagonal-sigma caveat if applicable (conservative bound). Save a power plot to ${runDir}/figures and a power table to ${runDir}/tables.\n` +
      (reviews ? `\nOpen review issues to resolve:\n${issueBlock(reviews)}\n` : '') +
      `Return JSON with the artifact manifest and a Markdown writeup.`,
  })
  steps.power = step4.result
  log(`Step 4 power quality: ${step4.result.powerQuality} (bias ratio ${step4.result.biasRatio}).`)

  // ---- 8. Step 5: Sensitivity -------------------------------------------------------
  const step5 = await runReviewedStep({
    title: 'Step 5 Sensitivity',
    label: 'sensitivity',
    guide: STEP_GUIDE.sensitivity,
    runDir,
    execSchema: SENSITIVITY_SCHEMA,
    criteria: {
      stat: 'is HonestDiD relative-magnitudes run on the primary triple with the event window sliced to about [-5,5] (reference period t=-1 excluded) and Mbarvec = seq(0.5,2,0.5)? Is the breakdown M correctly identified (smallest M whose robust CI includes zero)? Is the diagonal-sigma caveat carried?',
      econ: 'is the breakdown M interpreted in plain terms — how large a violation of parallel trends would overturn the result, and is that plausible here?',
      qa: 'the HonestDiD sensitivity plot renders and the robust-CI table parses with one row per Mbar',
    },
    execPrompt: (reviews) =>
      `${SHARED}\n\n${cfgContext}\n\nSTEP 5 — HonestDiD sensitivity. Follow ${STEP_GUIDE.sensitivity}.\n` +
      `Read the primary estimator's event-study triple (primary = ${steps.estimation.primaryEstimator}). Run HonestDiD::createSensitivityResults_relativeMagnitudes with Mbarvec = seq(0.5,2,0.5); slice the window to about [-5,5] and drop the reference period (t=-1) before the call. Report the robust CIs per Mbar and the breakdown M. Save the sensitivity plot to ${runDir}/figures and the robust-CI table to ${runDir}/tables.\n` +
      (reviews ? `\nOpen review issues to resolve:\n${issueBlock(reviews)}\n` : '') +
      `Return JSON with the artifact manifest and a Markdown writeup.`,
  })
  steps.sensitivity = step5.result
  log(`Step 5 breakdown M: ${step5.result.breakdownM}.`)

  // ---- 9. Artifact Audit ------------------------------------------------------------
  phase('Artifact Audit')
  const allArtifacts = Object.values(steps).flatMap((s) => (s && s.artifacts) || [])
  let audit = await agent(
    `${SHARED}\n\n${cfgContext}\n\nCONSOLIDATED ARTIFACT AUDIT — the report agent depends on these files. Using Bash/Read on ${runDir}, verify EVERY artifact across all steps:\n${brief(allArtifacts)}\n\n` +
    `Each file exists, is non-empty, and parses/renders; CSVs have expected headers and finite values; figures are valid non-empty images. CRITICALLY, check MUTUAL CONSISTENCY across steps and against the step results: the event-study CSV must match the event-study figure and the comparison table; the primary estimator's ATT must be identical wherever it appears; the power and sensitivity inputs must match the primary event study.\n` +
    `Return JSON: allConsistent, the issues list (blocking for any malformed/missing/inconsistent file), and an artifact-audit.md body. If one step is responsible for blocking issues, name it in offendingStep.`,
    { label: 'artifact-audit', phase: 'Artifact Audit', schema: AUDIT_SCHEMA },
  )
  // Bounded remediation: one targeted re-run of an offending step's executor, then re-audit.
  if (!audit.allConsistent && audit.offendingStep && (!budget.total || budget.remaining() > STEP_BUDGET_FLOOR)) {
    log(`Artifact audit found blocking issues in ${audit.offendingStep} — one remediation pass.`)
    await agent(
      `${SHARED}\n\n${cfgContext}\n\nThe artifact audit found these blocking issues attributed to the "${audit.offendingStep}" step:\n${issueBlock([audit])}\n\n` +
      `Re-run the relevant part of that step via Rscript and regenerate the offending file(s) under ${runDir} so they are correct and consistent with the step result. Return a short JSON note of what you fixed.`,
      { label: 'artifact-remediate', phase: 'Artifact Audit', schema: { type: 'object', required: ['fixed'], properties: { fixed: { type: 'string' } } } },
    )
    audit = await agent(
      `${SHARED}\n\n${cfgContext}\n\nRe-audit the run directory ${runDir} after remediation. Verify all artifacts now parse/render and are mutually consistent. Return JSON (allConsistent, residual issues, artifact-audit.md body).`,
      { label: 'artifact-audit (round 1)', phase: 'Artifact Audit', schema: AUDIT_SCHEMA },
    )
  }
  steps._audit = audit
  log(`Artifact audit: ${audit.allConsistent ? 'all consistent' : `${openIssues([audit]).length} open issue(s) flagged for the report`}.`)
}

// ---- 10/11. Report + Report Review (per audience) -----------------------------------
const analysisContext =
  `${cfgContext}\n\nStep results (summaries; full artifacts are under ${runDir}):\n` +
  `- package environment: ${pkgSummary ? brief({ environmentChanges: pkgSummary.environmentChanges, upstreamChecked: false, checks: pkgChecks }) : 'inspection skipped'}\n` +
  `- structure: ${brief({ route, isBalanced: steps.structure?.isBalanced, cohorts: steps.structure?.cohorts, summary: steps.structure?.summary })}\n` +
  (steps.diagnostics ? `- diagnostics: ${brief({ severity: steps.diagnostics.severity, forbiddenWeightPct: steps.diagnostics.forbiddenWeightPct, negWeightPct: steps.diagnostics.negWeightPct })}\n` : '- diagnostics: (skipped — canonical or advanced)\n') +
  (steps.estimation ? `- estimation: ${brief({ primary: steps.estimation.primaryEstimator, agree: steps.estimation.agree, cv: steps.estimation.cv, table: steps.estimation.comparisonTable })}\n` : '') +
  (steps.power ? `- power: ${brief(steps.power)}\n` : '') +
  (steps.sensitivity ? `- sensitivity: ${brief(steps.sensitivity)}\n` : '') +
  (steps._audit ? `- artifact audit: ${steps._audit.allConsistent ? 'all consistent' : 'issues flagged: ' + issueBlock([steps._audit])}\n` : '') +
  (advanced ? `\nNOTE: route is ADVANCED — the 5-step pipeline does not apply; the report must say so and point to ${SKILL}/references/did-advanced-methods.md.\n` : '') +
  (route === 'NO_TREATMENT' ? `\nNOTE: no treatment variation — DiD is not applicable; the report must say so.\n` : '')

if (!proceed) {
  // ADVANCED route (NO_TREATMENT already returned). No ATT/power/sensitivity exists, so write a
  // routing report instead of forcing the 5-boolean evidence verdict, and skip the review loop.
  phase('Report')
  const aud0 = audienceList[0]
  log('Route is ADVANCED — writing a routing report (the 5-step verdict does not apply).')
  const note = await agent(
    `${SHARED}\n\n${analysisContext}\n\nThe treatment design is ADVANCED (reversible / continuous / non-binary), so the standard 5-step staggered DiD pipeline does NOT apply and no ATT / power / sensitivity was computed. Write a concise report for a ${aud0.toUpperCase()} audience that summarizes the Step-1 treatment-structure findings (route, cohorts, balance), explains why the heterogeneity-robust staggered estimators are not valid for this design, and points the reader to ${SKILL}/references/did-advanced-methods.md for the appropriate methods (de Chaisemartin-D'Haultfoeuille, continuous-treatment, synthetic-control). Do NOT fabricate an effect or a five-boolean verdict. Return JSON with markdown and verdict="INCONCLUSIVE".`,
    { label: 'report:routing', phase: 'Report', schema: REPORT_SCHEMA },
  )
  reportVariants[aud0] = { markdown: note.markdown, verdict: note.verdict || 'INCONCLUSIVE', reviewRounds: 0 }
  report = reportVariants[aud0]
} else {
for (const audience of audienceList) {
  phase('Report')
  const variantSuffix = audienceList.length > 1 ? `-${audience}` : ''
  log(`Drafting report for audience: ${audience}.`)
  let draft = await agent(
    `${SHARED}\n\n${analysisContext}\n\nWrite the overall DiD analysis report for a ${audience.toUpperCase()} audience.\n` +
    `Audience profile: ${AUDIENCE_PROFILE[audience]}\n` +
    `Structure (following ${SKILL}/paper.md): Data & design → package status (1-2 lines from the local environment report) → TWFE diagnostics → estimation & comparison → pre-trends & power → sensitivity → VERDICT & caveats. Reference the figures/tables in ${runDir} by path. Use ONLY numbers present in the step results/artifacts — never invent.\n` +
    `Compute the evidence VERDICT from five booleans — attSig (primary ATT significant), powered (bias ratio < 1), pretestPass (pre-trends p > 0.05), robust (breakdown M >= 1 or None), estimatorsAgree (cv < 0.2) — and map to one of: STRONG EVIDENCE | MIXED | FRAGILE | SUGGESTIVE | EVIDENCE OF NULL | UNINFORMATIVE | INCONCLUSIVE (see final_evidence_assessment in ${STEP_GUIDE.sensitivity}). Return JSON.`,
    { label: `report${variantSuffix}`, phase: 'Report', schema: REPORT_SCHEMA },
  )

  phase('Report Review')
  const reviewReport = (d) =>
    parallel([
      () => agent(
        `${SHARED}\n\n${analysisContext}\n\nYou are the CORRECTNESS reviewer for this report draft (independent of the writer). Verify that EVERY quantitative claim matches the step results/artifacts (spot-check files in ${runDir} with Read), that nothing is overstated, that the diagonal-sigma and power caveats are present, and that the verdict follows from its five booleans.\n\nDraft:\n${d.markdown}\n\nRaise blocking/major issues for any unsupported claim or wrong verdict. Return JSON.`,
        { label: `report-review:correctness${variantSuffix}`, phase: 'Report Review', schema: REVIEW_SCHEMA },
      ),
      () => agent(
        `${SHARED}\n\nYou are the AUDIENCE-FIT reviewer for a ${audience.toUpperCase()} audience. Profile: ${AUDIENCE_PROFILE[audience]}\n\nJudge whether the report reads well for this audience: right tone and jargon level, well-structured, the headline is clear, and technical depth is appropriate (not too much, not too little).\n\nDraft:\n${d.markdown}\n\nRaise blocking/major issues where it misfits the audience or reads poorly. Return JSON.`,
        { label: `report-review:audience${variantSuffix}`, phase: 'Report Review', schema: REVIEW_SCHEMA },
      ),
    ])

  let reviews = await reviewReport(draft)
  let rRound = 0
  while (openIssues(reviews).length) {
    if (rRound >= maxReportReviewRounds) { log(`Report (${audience}): reached max ${maxReportReviewRounds} review round(s) with open issues — proceeding.`); break }
    if (budget.total && budget.remaining() < REPORT_BUDGET_FLOOR) { log(`Report (${audience}): token budget low — stopping report review.`); break }
    rRound++
    log(`Report (${audience}): revising to address ${openIssues(reviews).length} open issue(s) (round ${rRound}).`)
    draft = await agent(
      `${SHARED}\n\n${analysisContext}\n\nRevise the ${audience.toUpperCase()}-audience report to address the reviewers' open issues. Do NOT fabricate claims/numbers; concede anything unsupported as an honest limitation. Keep the verdict consistent with its booleans.\n\nCurrent draft:\n${draft.markdown}\n\nOpen issues:\n${issueBlock(reviews)}\n\nReturn JSON.`,
      { label: lbl(`report${variantSuffix}`, rRound), phase: 'Report Review', schema: REPORT_SCHEMA },
    )
    reviews = await reviewReport(draft)
  }
  reportVariants[audience] = { markdown: draft.markdown, verdict: draft.verdict, reviewRounds: rRound }
  if (!report) report = reportVariants[audience]
}
}

// ---- 12. Compile --------------------------------------------------------------------
phase('Compile')
const stepMd = (n, title, s) => (s ? [`${n}_${title}.md`, `# ${title}\n\n${s.markdown ?? s.summary ?? ''}`] : null)
const reviewLog =
  `# Review log\n\n` +
  `Each analysis step that ran was gated by three independent reviewers (statistical · economic · artifact-QA), and the report by correctness + audience-fit reviewers, looping until no blocking/major issue remained. Steps executed: ${Object.keys(steps).filter((k) => !k.startsWith('_')).join(', ') || '(none)'}.\n\n` +
  Object.entries(steps)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, s]) => `## ${k}\n\n${s?.summary ?? ''}`)
    .join('\n\n') +
  `\n\n## Report review rounds\n\n` +
  Object.entries(reportVariants).map(([aud, v]) => `- ${aud}: ${v.reviewRounds} revision round(s) → ${v.verdict}`).join('\n')

const implementation = {
  runDir,
  executionPath: execPath,
  config,
  route,
  packageScan: pkgSummary ? { environmentChanges: pkgSummary.environmentChanges, upstreamChecked: false, checks: pkgChecks } : null,
  structure: steps.structure ?? null,
  diagnostics: steps.diagnostics ?? null,
  estimation: steps.estimation ?? null,
  power: steps.power ?? null,
  sensitivity: steps.sensitivity ?? null,
  artifactAudit: steps._audit ?? null,
  reports: Object.fromEntries(Object.entries(reportVariants).map(([aud, v]) => [aud, { verdict: v.verdict }])),
}

const fileList = [
  pkgSummary && ['packages-report.md', pkgSummary.markdown],
  ['config.md', `# Configuration\n\n${config.mappingRationale}\n\n\`\`\`json\n${brief(config)}\n\`\`\``],
  stepMd('01', 'Structure', steps.structure),
  stepMd('02', 'Diagnostics', steps.diagnostics),
  stepMd('03', 'Estimation', steps.estimation),
  stepMd('04', 'Power', steps.power),
  stepMd('05', 'Sensitivity', steps.sensitivity),
  steps._audit && ['artifact-audit.md', steps._audit.markdown],
  ['implementation.json', JSON.stringify(implementation, null, 2)],
  ['review-log.md', reviewLog],
  ...Object.entries(reportVariants).map(([aud, v]) => [
    audienceList.length > 1 ? `report-${aud}.md` : 'report.md',
    `# DiD Analysis Report${audienceList.length > 1 ? ` (${aud})` : ''}\n\n_Evidence verdict: **${v.verdict}**_\n\n${v.markdown}`,
  ]),
].filter(Boolean)

// Headline ATT: prefer the primary estimator, but only if it ran with a finite ATT; else the first
// estimator that did (a named-but-failed primary must not null out a real result).
const estList = steps.estimation?.estimates ?? []
const hasAtt = (e) => e && e.ran && typeof e.overallATT === 'number'
const headlineATT = (estList.find((e) => e.estimator === steps.estimation?.primaryEstimator && hasAtt(e)) ?? estList.find(hasAtt))?.overallATT ?? null

log(`Writing ${fileList.length} files to ${runDir}/`)
await parallel(
  fileList.map(([fname, body]) => () =>
    agent(
      `Use the Write tool to create the file at exactly this path: ${runDir}/${fname}\n` +
      `Create parent directories if needed. Write the file with EXACTLY the following content (do not edit, summarize, or reformat it):\n\n` +
      `<<<FILE_CONTENT_START>>>\n${body}\n<<<FILE_CONTENT_END>>>\n\n` +
      `Return the literal string "ok" when done.`,
      { label: `write:${fname}`, phase: 'Compile' },
    ),
  ),
)

return {
  runDir,
  executionPath: execPath,
  route,
  primaryEstimator: steps.estimation?.primaryEstimator ?? null,
  estimatorsAgree: steps.estimation?.agree ?? null,
  overallATT: headlineATT,
  twfeSeverity: steps.diagnostics?.severity ?? (route === 'CANONICAL' ? 'N/A (canonical)' : route === 'ADVANCED' ? 'N/A (advanced)' : null),
  powerQuality: steps.power?.powerQuality ?? null,
  breakdownM: steps.sensitivity?.breakdownM ?? null,
  verdicts: Object.fromEntries(Object.entries(reportVariants).map(([aud, v]) => [aud, v.verdict])),
  audiences: audienceList,
  packageScan: pkgSummary ? { environmentChanges: pkgSummary.environmentChanges, upstreamChecked: false } : 'skipped',
  artifactAuditConsistent: steps._audit?.allConsistent ?? null,
  files: fileList.map(([f]) => `${runDir}/${f}`),
}
