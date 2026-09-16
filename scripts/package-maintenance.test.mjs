import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import {
  REGISTRY, ROOT, comparePackage, packageIndex, statusReport,
  validateObservations, validateRegistry, workflowInventory,
} from './package-maintenance.mjs';

// ## Contents
// - [Registry validation](#registry-validation)
// - [Observed API comparison](#observed-api-comparison)
// - [Status semantics](#status-semantics)
// - [Observation completeness](#observation-completeness)
// - [Installed R inspection](#installed-r-inspection)

const registry = () => JSON.parse(readFileSync(REGISTRY, 'utf8'));
const entry = () => ({ name: 'did', install: 'required', functions: ['att_gt'], internalFunctions: [] });
const api = () => ({ status: 'ok', signature: 'function (yname, tname) NULL',
  exported: true, documented: true, access: 'public' });
const observed = () => ({ name: 'did', installed: true, version: '2.3.0', remoteSha: null,
  api: { att_gt: api() }, library: '/fixture/R/library', path: '/fixture/R/library/did' });
const environment = (packages) => ({ schemaVersion: 1, kind: 'observed_environment', rVersion: '4.5.2', packages });
const baseline = (packages) => ({ schemaVersion: 1, kind: 'observed_api_baseline', rVersion: '4.5.2', packages });

// ## Registry validation

test('current registry validates and generates deterministic inventories without version pinning', () => {
  const packages = validateRegistry(registry());
  assert.ok(packages.length > 6);
  assert.equal(workflowInventory(packages), workflowInventory(structuredClone(packages)));
  assert.equal(packageIndex(packages), packageIndex(structuredClone(packages)));
  assert.ok(packageIndex(packages).includes('This inventory does not pin versions.'));
  assert.ok(workflowInventory(packages).includes('BEGIN GENERATED PACKAGE INVENTORY'));
});

test('registry rejects duplicate names, unsafe path-like names, and missing package references', () => {
  const duplicate = registry();
  duplicate.packages.push(structuredClone(duplicate.packages[0]));
  assert.throws(() => validateRegistry(duplicate));
  for (const name of ['../did', '/tmp/did', 'did/../../SKILL', 'did\\..\\SKILL']) {
    const input = registry();
    input.packages.find(p => p.name === 'jsonlite').name = name;
    assert.throws(() => validateRegistry(input), name);
  }
  const missing = registry();
  missing.packages.find(p => p.name === 'jsonlite').docs = true;
  assert.throws(() => validateRegistry(missing), /reference|docs/i);
});

test('registry validates field types, not coercible names or iterable strings', () => {
  for (const name of [undefined, null, 42]) {
    const input = registry();
    input.packages.find(p => p.name === 'jsonlite').name = name;
    assert.throws(() => validateRegistry(input), String(name));
  }
  const internal = registry();
  internal.packages[0].internalFunctions = 'x';
  assert.throws(() => validateRegistry(internal));
});

test('registry rejects malformed policies, sources, repos, functions, and estimator coverage', () => {
  for (const mutation of [
    p => { p.priority = 'P9'; }, p => { p.install = 'always'; },
    p => { p.source = 'untrusted'; }, p => { p.repo = '../outside'; },
    p => { p.source = 'github'; delete p.repo; },
    p => { p.functions.push(p.functions[0]); }, p => { p.functions = ['f();system()']; },
    p => { p.estimators = ['unknown']; }, p => { p.estimators = []; },
  ]) {
    const input = registry();
    mutation(input.packages[0]);
    assert.throws(() => validateRegistry(input));
  }
  const universe = registry();
  universe.packages.find(p => p.source === 'r-universe').repository = 'http://untrusted.example';
  assert.throws(() => validateRegistry(universe));
});

test('registry mappings must match the actual maintained estimator adapters', () => {
  const input = registry();
  input.packages.find(p => p.name === 'did').estimators = ['sa'];
  input.packages.find(p => p.name === 'fixest').estimators = ['cs'];
  assert.throws(() => validateRegistry(input), /estimator|adapter|mapping/i);
});

test('CLI help executes when the script is invoked through a symlink', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'did-maintenance-link-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const link = join(root, 'maintenance.mjs');
  symlinkSync(join(ROOT, 'scripts/package-maintenance.mjs'), link);
  const proc = spawnSync(process.execPath, [link, '--help'],
    { encoding: 'utf8', timeout: 30_000 });
  assert.equal(proc.status, 0, proc.stderr);
  assert.match(proc.stdout, /Usage: node scripts\/package-maintenance\.mjs/);
});

// ## Observed API comparison

test('unchanged versions and APIs remain clean despite machine-specific paths', () => {
  const before = observed(), after = observed();
  after.library = '/another/library';
  after.path = '/another/library/did';
  assert.deepEqual(comparePackage(after, before, true), []);
  before.remoteSha = undefined;
  assert.deepEqual(comparePackage(after, before, true), []);
});

test('same package version at a different GitHub commit is drift', () => {
  const before = observed(), after = observed();
  before.remoteSha = 'aaa111';
  after.remoteSha = 'bbb222';
  assert.ok(comparePackage(after, before, true).some(change => /commit/i.test(change)));
});

test('loaded and installed versions must agree even when the loaded version matches baseline', () => {
  const current = { ...observed(), loadedVersion: '2.3.0', installedVersion: '2.4.0' };
  assert.ok(comparePackage(current, observed()).some(change => /loaded namespace.*restart R/.test(change)));
  current.installedVersion = current.loadedVersion;
  assert.deepEqual(comparePackage(current, observed()), []);
});

test('version changes, missing packages, new installations, and absent baseline are distinct', () => {
  const before = observed(), after = observed();
  after.version = '2.4.0';
  assert.ok(comparePackage(after, before).some(change => /version/.test(change)));
  assert.deepEqual(comparePackage({ name: 'did', installed: false }, before), ['package missing']);
  assert.ok(comparePackage(after, { name: 'did', installed: false }).includes('new installation'));
  assert.deepEqual(comparePackage({ name: 'did', installed: false }, { name: 'did', installed: false }), []);
  assert.ok(comparePackage(after, undefined).some(change => /baseline/i.test(change)));
});

test('API checks detect signature/access/export/documentation changes only when requested', () => {
  for (const [key, value] of [['signature', 'function (newarg) NULL'], ['access', 'internal'],
    ['exported', false], ['documented', false]]) {
    const before = observed(), after = observed();
    after.api.att_gt[key] = value;
    assert.deepEqual(comparePackage(after, before, false), []);
    assert.ok(comparePackage(after, before, true).some(change => /att_gt.*API changed/.test(change)));
  }
});

test('API missing and unavailable observations cannot look current', () => {
  for (const status of ['missing', 'unavailable']) {
    const before = observed(), after = observed();
    after.api.att_gt = { status, error: 'load or lookup failed' };
    assert.ok(comparePackage(after, before, true).some(change => change.includes(`att_gt: ${status}`)));
    assert.ok(comparePackage(after, structuredClone(after), true).length > 0);
  }
  const before = observed(), after = observed();
  delete after.api.att_gt;
  assert.ok(comparePackage(after, before, true).some(change => /att_gt.*missing inspection/.test(change)));
});

test('metadata inspection errors cannot look like unchanged optional-package absence', () => {
  const current = { name: 'DRDID', installed: false, error: 'cannot read DESCRIPTION' };
  const absent = { name: 'DRDID', installed: false };
  for (const before of [absent, undefined, structuredClone(current)]) {
    assert.ok(comparePackage(current, before).some(change => /inspection failed.*DESCRIPTION/.test(change)));
  }
  const report = statusReport([{ name: 'DRDID', install: 'optional', functions: [] }],
    environment([current]), baseline([absent]), {}, false);
  assert.ok(report.packages[0].changes.some(change => /inspection failed/.test(change)));
});

for (const [label, invalid] of [
  ['optional-package metadata errors', { installed: false, error: 'cannot read DESCRIPTION', api: {} }],
  ['loaded/installed version mismatches', { loadedVersion: '1.0.0', installedVersion: '2.0.0' }],
]) test(`snapshot rejects ${label} without replacing the baseline`, (t) => {
  // Run the real command in an isolated repository; never write the real baseline.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'did-metadata-error-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'skill', 'scripts'), { recursive: true });
  mkdirSync(join(root, 'skill', 'references'), { recursive: true });
  const input = registry();
  input.packages.forEach(p => { p.docs = false; });
  const observations = input.packages.map(p => ({
    name: p.name, installed: true, version: '1.0.0',
    api: Object.fromEntries([...p.functions, ...(p.internalFunctions || [])].map(name => [name, api()])),
  }));
  Object.assign(observations.find(p => p.name === 'DRDID'), invalid);
  writeFileSync(join(root, 'scripts/package-maintenance.mjs'),
    readFileSync(join(ROOT, 'scripts/package-maintenance.mjs')));
  writeFileSync(join(root, 'skill/references/package-registry.json'), JSON.stringify(input));
  // R_PATH=Node runs this fixture instead of R; the production command still
  // performs observation validation and the snapshot gate unchanged.
  writeFileSync(join(root, 'skill/scripts/package-status.R'),
    `process.stdout.write(${JSON.stringify(JSON.stringify(environment(observations)))});\n`);
  const baselinePath = join(root, 'skill/references/package-api-baseline.json');
  const previous = '{"sentinel":"baseline must remain unchanged"}\n';
  writeFileSync(baselinePath, previous);
  const proc = spawnSync(process.execPath, [join(root, 'scripts/package-maintenance.mjs'), 'snapshot'],
    { encoding: 'utf8', env: { ...process.env, R_PATH: process.execPath }, timeout: 30_000 });
  assert.equal(proc.status, 1, `${proc.stdout}\n${proc.stderr}`);
  assert.match(proc.stderr, /Cannot record incomplete API baseline: DRDID/);
  assert.equal(readFileSync(baselinePath, 'utf8'), previous);
});

// ## Status semantics

test('observed baseline equality does not imply the installed version was validated', () => {
  const current = observed();
  current.version = '2.4.0';
  const env = environment([current]), recorded = baseline([structuredClone(current)]);
  const validated = { did: '2.3.0' };
  const inputCopies = structuredClone({ env, recorded, validated });
  const report = statusReport([entry()], env, recorded, validated, true);
  assert.equal(report.kind, 'package_status');
  assert.equal(report.upstream, 'not checked (offline)');
  assert.equal(report.packages[0].version, '2.4.0');
  assert.equal(report.packages[0].validatedVersion, '2.3.0');
  assert.equal(report.packages[0].matchesValidatedVersion, false);
  assert.deepEqual(report.packages[0].changes, []);
  assert.deepEqual({ env, recorded, validated }, inputCopies);
});

test('missing validation and absent package observations are explicit rather than inferred current', () => {
  const current = observed();
  const unknown = statusReport([entry()], environment([current]), baseline([current]), {}, false).packages[0];
  assert.equal(unknown.validatedVersion, null);
  assert.equal(unknown.matchesValidatedVersion, null);
  const absent = statusReport([entry()], environment([]), baseline([current]), { did: '2.3.0' }, false).packages[0];
  assert.equal(absent.installed, false);
  assert.equal(absent.matchesValidatedVersion, null);
  assert.ok(absent.changes.some(change => /inspection missing/i.test(change)));
});

test('API status checks require every registry-tracked function even if both observations omit it', () => {
  const current = observed();
  current.api = {};
  const result = statusReport([entry()], environment([current]), baseline([structuredClone(current)]), {}, true);
  assert.ok(result.packages[0].changes.some(change => /att_gt.*missing inspection/i.test(change)));
});

test('newly tracked internal function needs an explicit observation', () => {
  const tracked = entry();
  tracked.internalFunctions = ['private_helper'];
  const current = observed();
  const result = statusReport([tracked], environment([current]), baseline([structuredClone(current)]), {}, true);
  assert.ok(result.packages[0].changes.some(change => /private_helper.*missing inspection/i.test(change)));
});

// ## Observation completeness

test('environment validation rejects missing and duplicate package observations', () => {
  const current = observed();
  assert.doesNotThrow(() => validateObservations([entry()], environment([current]), true));
  assert.throws(() => validateObservations([entry()], environment([]), true));
  assert.throws(() => validateObservations([entry()], environment([current, structuredClone(current)]), true));
});

test('API inspection completeness is independent of baseline existence', () => {
  const current = observed();
  current.api = {};
  assert.doesNotThrow(() => validateObservations([entry()], environment([current]), false));
  assert.throws(() => validateObservations([entry()], environment([current]), true));
  assert.ok(comparePackage(current, structuredClone(current), true, ['att_gt'])
    .some(change => /att_gt.*missing inspection/i.test(change)));
});

test('explicit package absence and unavailable APIs are observations, not missing inspections', () => {
  assert.doesNotThrow(() => validateObservations([entry()], environment([{ name: 'did', installed: false }]), true));
  const current = observed();
  current.api.att_gt = { status: 'unavailable', error: 'namespace load failed' };
  assert.doesNotThrow(() => validateObservations([entry()], environment([current]), true));
  const report = statusReport([entry()], environment([current]), baseline([observed()]), {}, true);
  assert.ok(report.packages[0].changes.some(change => /unavailable/.test(change)));
});

// ## Installed R inspection

test('Node inspection honors the same startup-library precedence as direct Rscript', (t) => {
  const r = process.env.R_PATH || 'Rscript';
  const probe = spawnSync(r, ['--vanilla', '-e',
    'quit(status = if (requireNamespace("jsonlite", quietly = TRUE)) 0L else 43L)'],
  { encoding: 'utf8', timeout: 30_000 });
  if (probe.error?.code === 'ENOENT' || probe.status === 43)
    return t.skip('Rscript with jsonlite is needed for the startup-library integration test');
  assert.equal(probe.status, 0, probe.stderr);
  const root = mkdtempSync(join(tmpdir(), 'did-r-startup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const library = join(root, 'project-library');
  mkdirSync(library);
  const profile = join(root, '.Rprofile');
  writeFileSync(profile, `.libPaths(c(${JSON.stringify(library)}, .libPaths()))\n`);
  const env = { ...process.env, R_PATH: r, R_PROFILE_USER: profile };
  const direct = spawnSync(r, [join(ROOT, 'skill/scripts/package-status.R')],
    { cwd: root, env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(direct.status, 0, `${direct.stderr}\n${direct.stdout}`);
  const code = `import { inspectEnvironment } from ${JSON.stringify(pathToFileURL(join(ROOT, 'scripts/package-maintenance.mjs')).href)};
    process.stdout.write(JSON.stringify(inspectEnvironment()));`;
  const node = spawnSync(process.execPath, ['--input-type=module', '-e', code],
    { cwd: root, env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(node.status, 0, `${node.stderr}\n${node.stdout}`);
  const expected = JSON.parse(direct.stdout), actual = JSON.parse(node.stdout);
  assert.equal(actual.libraryPaths[0], realpathSync(library));
  assert.deepEqual(actual.libraryPaths, expected.libraryPaths);
  assert.deepEqual(actual.packages, expected.packages);
});

test('base R metadata and API inspection distinguish missing functions and unavailable namespaces', (t) => {
  const r = process.env.R_PATH || 'Rscript';
  const probe = spawnSync(r, ['--version'], { encoding: 'utf8' });
  if (probe.error?.code === 'ENOENT') return t.skip('Rscript unavailable; JS fixtures cover status semantics');
  assert.equal(probe.status, 0, probe.stderr);
  const source = join(ROOT, 'skill/scripts/package-status.R');
  const script = `source(${JSON.stringify(source)})
    invisible(loadNamespace('stats'))
    meta <- did_package_metadata('stats')
    stopifnot(isTRUE(meta$installed), nzchar(meta$version), nzchar(meta$library))
    stopifnot(identical(meta$loadedVersion, as.character(getNamespaceVersion('stats'))),
      identical(meta$version, meta$loadedVersion), identical(meta$installedVersion, meta$loadedVersion))
    absent <- did_package_metadata('codex.fixture.package.does.not.exist')
    stopifnot(identical(absent$installed, FALSE))
    api <- did_inspect_api(list(name='stats', functions=c('median', 'codex_missing_function')), meta)
    stopifnot(identical(api$median$status, 'ok'), nzchar(api$median$signature),
      identical(api$codex_missing_function$status, 'missing'))
    unavailable <- did_inspect_api(list(name='codex.fixture.package.does.not.exist', functions='f'), meta)
    stopifnot(identical(unavailable$f$status, 'unavailable'))
    stopifnot(length(did_inspect_api(list(name='stats', functions='median'), absent)) == 0L)
    cat('R metadata/API regression passed\\n')`;
  const proc = spawnSync(r, ['--vanilla', '-e', script], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(proc.status, 0, `${proc.stderr}\n${proc.stdout}`);
});
