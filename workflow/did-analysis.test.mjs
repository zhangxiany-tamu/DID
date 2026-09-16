import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// ## Contents
// - [Runtime and schema checks](#runtime-and-schema-checks)
// - [Mock agents](#mock-agents)
// - [Orchestration regressions](#orchestration-regressions)

// ## Runtime and schema checks
// The workflow host extracts metadata and wraps the remaining plain JS in an
// async function. All agent calls and file writes below stay in memory.
const source = readFileSync(new URL('./did-analysis.ts', import.meta.url), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'budget',
  source.replace(/export const meta =/, 'const meta ='));

function checkSchema(value, schema, path) {
  if (!schema) return;
  if (schema.type === 'object') {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), path);
    for (const key of schema.required || []) assert.ok(Object.hasOwn(value, key), `${path}.${key} missing`);
    for (const [key, v] of Object.entries(value)) checkSchema(v, schema.properties?.[key], `${path}.${key}`);
  } else if (schema.type === 'array') {
    assert.ok(Array.isArray(value), path);
    value.forEach((v, i) => checkSchema(v, schema.items, `${path}[${i}]`));
  } else if (schema.type === 'integer') assert.ok(Number.isInteger(value), path);
  else if (schema.type === 'number') assert.ok(Number.isFinite(value), path);
  else assert.equal(typeof value, schema.type, path);
  if (schema.enum) assert.ok(schema.enum.includes(value), `${path}: ${value}`);
}

// ## Mock agents
async function runScenario(scenario) {
  const calls = [], writes = new Map(), estimates = [];
  const base = { summary: 'Fixture step', markdown: 'Fixture step', artifacts: [] };
  const packageSummary = {
    environmentChanges: 2,
    checks: [{ package: 'did', installed: '2.4.0', validatedVersion: '2.3.0',
      status: 'changed', notes: 'PACKAGE_DRIFT_SENTINEL' }],
    markdown: 'PACKAGE_DRIFT_SENTINEL — Upstream not checked.',
  };
  const responses = {
    preflight: { runnable: scenario.abort !== 'preflight', path: scenario.path,
      rOk: true, datasetOk: true, rscriptPath: '/fixture/Rscript', packagesMissing: [], summary: 'Fixture' },
    'pkg:environment': packageSummary,
    configure: { datasetResolved: scenario.abort !== 'configure', runDir: '/fixture/run',
      dataPath: '/fixture/panel.csv', idVar: 'id', timeVar: 'time', outcomeVar: 'y', gvar: 'g',
      mappingRationale: 'Fixture mapping', clusterVar: 'id' },
    structure: { ...base, route: scenario.route, isBalanced: true, cohorts: 'Two cohorts' },
    diagnostics: { ...base, severity: 'MILD', forbiddenWeightPct: 10, negWeightPct: 1 },
    estimation: { ...base, primaryEstimator: 'cs', agree: true, cv: 0.1, estimates, comparisonTable: 'Fixture table' },
    power: { ...base, powerQuality: 'good', biasRatio: 0.5 },
    sensitivity: { ...base, breakdownM: 1.5 },
    'artifact-audit': { allConsistent: true, issues: [], markdown: 'Fixture audit' },
  };
  const agent = async (prompt, options) => {
    const label = options.label;
    calls.push({ prompt, ...options });
    let result = responses[label];
    if (label.startsWith('estimate:')) {
      result = { estimator: label.split(':')[1], ran: true, overallATT: 0.1, se: 0.02,
        ci: [0.06, 0.14], eventStudy: { betahat: [0, 0.1], tVec: [-2, 0],
          sigmaIsDiagonalFallback: false, sigma: { values: [[0.01, 0], [0, 0.01]], dim: [2, 2] } }, artifacts: [] };
      estimates.push(result);
    } else if (/:(stat|econ|qa)$/.test(label) || label.startsWith('report-review:')) {
      result = { verdict: 'approved', summary: 'Fixture approval', issues: [] };
    } else if (label.startsWith('report')) {
      result = { markdown: 'Fixture report', verdict: 'INCONCLUSIVE' };
    } else if (label.startsWith('write:')) {
      const body = prompt.match(/<<<FILE_CONTENT_START>>>\n([\s\S]*)\n<<<FILE_CONTENT_END>>>/);
      assert.ok(body, `Missing file envelope for ${label}`);
      writes.set(label.slice(6), body[1]);
      return 'ok';
    }
    assert.ok(result, `Unexpected agent call: ${label}`);
    checkSchema(result, options.schema, label);
    return result;
  };
  const args = { data: '/fixture/panel.csv', idVar: 'id', timeVar: 'time', outcomeVar: 'y', gvar: 'g',
    path: scenario.path, skipPackageCheck: scenario.skipPackageCheck || false,
    audience: scenario.audience || 'economists' };
  const result = await execute(scenario.asString ? JSON.stringify(args) : args, agent,
    jobs => Promise.all(jobs.map(job => job())), () => {}, () => {},
    { total: 1_000_000, remaining: () => 1_000_000 });
  return { result, calls, writes, packageSummary };
}

// ## Orchestration regressions
const scenarios = [
  { route: 'STAGGERED', path: 'mcp' },
  { route: 'CANONICAL', path: 'rfallback' },
  { route: 'STAGGERED', path: 'rfallback', skipPackageCheck: true, asString: true },
  { route: 'STAGGERED', path: 'rfallback', audience: ['economists', 'general'] },
  { route: 'ADVANCED', path: 'rfallback' },
  { route: 'NO_TREATMENT', path: 'rfallback' },
  { abort: 'preflight', path: 'rfallback' },
  { abort: 'configure', path: 'rfallback' },
];

for (const scenario of scenarios) {
  test(`workflow orchestration: ${JSON.stringify(scenario)}`, async () => {
    const { result, calls, writes, packageSummary } = await runScenario(scenario);
    const packageCalls = calls.filter(call => call.label.startsWith('pkg:'));
    assert.equal(packageCalls.length, scenario.abort === 'preflight' || scenario.skipPackageCheck ? 0 : 1);
    if (result.aborted) {
      assert.ok(scenario.abort || scenario.route === 'NO_TREATMENT');
      assert.equal(result.stage, scenario.abort || 'structure');
      assert.equal(writes.size, 0);
      return;
    }
    assert.equal(result.route, scenario.route);
    const implementation = JSON.parse(writes.get('implementation.json'));
    if (scenario.skipPackageCheck) {
      assert.equal(result.packageScan, 'skipped');
      assert.equal(implementation.packageScan, null);
      assert.equal(writes.has('packages-report.md'), false);
    } else {
      assert.deepEqual(result.packageScan, { environmentChanges: 2, upstreamChecked: false });
      assert.deepEqual(implementation.packageScan,
        { environmentChanges: 2, upstreamChecked: false, checks: packageSummary.checks });
      assert.equal(writes.get('packages-report.md'), packageSummary.markdown);
      assert.ok(packageCalls[0].prompt.includes('skill/references/package-api-baseline.json'));
      if (scenario.path === 'mcp') assert.ok(packageCalls[0].prompt.includes('bridge.package_provenance'));
      // Writers and correctness reviewers need the actual package observations.
      // Audience-fit reviewers evaluate the resulting draft, not source evidence.
      const reports = calls.filter(call => call.label.startsWith('report') &&
        !call.label.startsWith('report-review:audience'));
      assert.ok(reports.length > 0);
      for (const call of reports) assert.ok(call.prompt.includes('PACKAGE_DRIFT_SENTINEL'), call.label);
    }
    assert.doesNotMatch(JSON.stringify(implementation), /updatesAvailable|docsDrifting|latestCran|latestGithub/);
    if (scenario.route === 'CANONICAL') assert.equal(calls.some(call => call.label === 'diagnostics'), false);
    if (scenario.route === 'ADVANCED') assert.equal(calls.some(call => call.label.startsWith('estimate:')), false);
    if (scenario.audience) for (const audience of scenario.audience) assert.ok(writes.has(`report-${audience}.md`));
  });
}
