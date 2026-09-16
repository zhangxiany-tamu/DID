#!/usr/bin/env node
// ## Contents
// - [Registry](#registry)
// - [Generated files](#generated-files)
// - [Environment comparison](#environment-comparison)
// - [Commands](#commands)

import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REGISTRY = join(ROOT, 'skill/references/package-registry.json');
export const BASELINE = join(ROOT, 'skill/references/package-api-baseline.json');
const START = '// BEGIN GENERATED PACKAGE INVENTORY';
const END = '// END GENERATED PACKAGE INVENTORY';

// ## Registry
export function validateRegistry(registry, root = ROOT) {
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.packages)) throw new Error('Unsupported package registry');
  const names = new Set(), estimators = new Set();
  for (const p of registry.packages) {
    if (typeof p.name !== 'string' || !/^[A-Za-z][A-Za-z0-9.]*$/.test(p.name) || names.has(p.name)) throw new Error(`Invalid/duplicate package: ${p.name}`);
    names.add(p.name);
    if (![null, 'P0', 'P1', 'P2'].includes(p.priority)) throw new Error(`Invalid priority: ${p.name}`);
    if (!['required', 'optional', 'manual'].includes(p.install)) throw new Error(`Invalid installation policy: ${p.name}`);
    if (!['cran', 'github', 'r-universe'].includes(p.source)) throw new Error(`Invalid source: ${p.name}`);
    if (p.repo !== undefined && (typeof p.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(p.repo) || p.repo.split('/').some(s => s === '.' || s === '..'))) throw new Error(`Invalid repository: ${p.name}`);
    if (p.source === 'github' && !p.repo) throw new Error(`Missing GitHub repository: ${p.name}`);
    if (p.source === 'r-universe' && !/^https:\/\/[\w.-]+\.r-universe\.dev$/.test(p.repository || '')) throw new Error(`Invalid r-universe: ${p.name}`);
    if (typeof p.docs !== 'boolean' || typeof p.role !== 'string') throw new Error(`Missing role/docs: ${p.name}`);
    if (!Array.isArray(p.functions) || !Array.isArray(p.estimators)) throw new Error(`Missing function/estimator list: ${p.name}`);
    if (p.internalFunctions !== undefined && !Array.isArray(p.internalFunctions)) throw new Error(`Invalid internal function list: ${p.name}`);
    const functions = [...p.functions, ...(p.internalFunctions || [])];
    if (functions.some(f => typeof f !== 'string' || !/^[A-Za-z.][A-Za-z0-9._]*$/.test(f)) || new Set(functions).size !== functions.length)
      throw new Error(`Invalid/duplicate function: ${p.name}`);
    for (const id of p.estimators) {
      if (!['cs', 'sa', 'did2s', 'bjs', 'staggered', 'drdid'].includes(id) || estimators.has(id)) throw new Error(`Invalid/duplicate estimator: ${id}`);
      estimators.add(id);
      const adapterPackages = { cs: 'did', sa: 'fixest', did2s: 'did2s', bjs: 'didimputation', staggered: 'staggered', drdid: 'DRDID' };
      if (adapterPackages[id] !== p.name) throw new Error(`Estimator ${id} must use ${adapterPackages[id]}`);
    }
    if (p.docs) for (const suffix of ['.md', '_quick_start.md', '-additional.md']) {
      if (!existsSync(join(root, 'skill/references/packages', p.name + suffix))) throw new Error(`Missing package reference: ${p.name}${suffix}`);
    }
  }
  if (estimators.size !== 6) throw new Error('Registry must map all six maintained estimator adapters');
  return registry.packages;
}

export function readRegistry() {
  return validateRegistry(JSON.parse(readFileSync(REGISTRY, 'utf8')));
}

// ## Generated files
export function workflowInventory(packages) {
  const entries = packages.map(({ name, priority, install, source, repo }) => ({ name, priority, install, source, ...(repo ? { repo } : {}) }));
  return `${START}\n// Source: skill/references/package-registry.json; run node scripts/package-maintenance.mjs sync.\nconst PACKAGES = [\n${entries.map(p => `  ${JSON.stringify(p)},`).join('\n')}\n]\n${END}`;
}

export function packageIndex(packages) {
  const rows = packages.map(p => {
    const name = p.docs ? `[${p.name}](packages/${p.name}_quick_start.md)` : `\`${p.name}\``;
    const source = p.source === 'github' ? `[GitHub](https://github.com/${p.repo})` :
      p.source === 'cran' ? `[CRAN](https://cran.r-project.org/package=${p.name})` : `[r-universe](${p.repository})`;
    return `| ${name} | ${p.priority ?? 'runtime helper'} | ${p.install} | ${p.role} | ${source} |`;
  });
  return ['# Package index', '', '<!-- Generated from package-registry.json; run node scripts/package-maintenance.mjs sync. -->', '',
    'Method priorities describe reviewed workflows. Installation policy is separate:',
    '`required` supports the core runtime; `optional` is installed best-effort;',
    '`manual` is installed only when needed. This inventory does not pin versions.', '',
    '| Package | Method priority | Installation | Role | Source |', '|---|---|---|---|---|', ...rows, '',
    'For installed help, run `Rscript skill/scripts/package-doc.R PACKAGE [TOPIC]`',
    'from the repository root, or `Rscript scripts/package-doc.R PACKAGE [TOPIC]`',
    'from the installed skill. See [package maintenance](../PACKAGE_MAINTENANCE.md).', ''].join('\n');
}

export function syncGenerated(packages, check = false) {
  const workflowPath = join(ROOT, 'workflow/did-analysis.ts');
  const current = readFileSync(workflowPath, 'utf8');
  const start = current.indexOf(START), end = current.indexOf(END);
  if (start < 0 || end < start) throw new Error('Workflow is missing package inventory markers');
  const next = current.slice(0, start) + workflowInventory(packages) + current.slice(end + END.length);
  const indexPath = join(ROOT, 'skill/references/package-index.md');
  const index = packageIndex(packages);
  const stale = [];
  if (current !== next) stale.push('workflow/did-analysis.ts');
  if (!existsSync(indexPath) || readFileSync(indexPath, 'utf8') !== index) stale.push('skill/references/package-index.md');
  if (check && stale.length) throw new Error(`Generated inventory is stale: ${stale.join(', ')}. Run: node scripts/package-maintenance.mjs sync`);
  if (!check) { if (current !== next) writeFileSync(workflowPath, next); writeFileSync(indexPath, index); }
  return stale;
}

// ## Environment comparison
export function comparePackage(current, baseline, api = false, expectedFunctions = []) {
  const changes = [];
  if (current.error) return [`inspection failed: ${current.error}`];
  if (!baseline) return ['no recorded API baseline'];
  if (current.installed !== baseline.installed) changes.push(current.installed ? 'new installation' : 'package missing');
  if (!current.installed) return changes;
  if (current.loadedVersion && current.installedVersion && current.loadedVersion !== current.installedVersion)
    changes.push('loaded namespace differs from installed files; restart R before validation');
  if (current.version !== baseline.version) changes.push(`version ${baseline.version ?? 'unknown'} -> ${current.version}`);
  if ((current.remoteSha || null) !== (baseline.remoteSha || null)) changes.push('GitHub commit changed');
  if (api) {
    for (const name of new Set([...expectedFunctions, ...Object.keys(baseline.api || {}), ...Object.keys(current.api || {})])) {
      const before = baseline.api?.[name], after = current.api?.[name];
      if (!after) changes.push(`${name}: missing inspection`);
      else if (after.status !== 'ok') changes.push(`${name}: ${after.status}`);
      else if (!before) changes.push(`${name}: newly tracked function`);
      else if (['status', 'signature', 'exported', 'documented', 'access'].some(key => before[key] !== after[key])) changes.push(`${name}: API changed`);
    }
  }
  return changes;
}

export function inspectEnvironment(api = false) {
  const proc = spawnSync(process.env.R_PATH || 'Rscript', [join(ROOT, 'skill/scripts/package-status.R'), ...(api ? ['--api'] : [])],
    { encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  if (proc.error || proc.status !== 0) throw new Error(`Package inspection failed: ${proc.error?.message || proc.stderr.trim() || `exit ${proc.status}`}`);
  if (proc.stderr.trim()) process.stderr.write(proc.stderr);
  return JSON.parse(proc.stdout);
}

export function validatedVersions() {
  const ledger = readFileSync(join(ROOT, 'skill/references/package-versions.md'), 'utf8');
  return Object.fromEntries([...ledger.matchAll(/^\| ([A-Za-z][A-Za-z0-9.]*) \| ([^|]+) \|/gm)].map(m => [m[1], m[2].trim()]));
}

export function validateObservations(packages, environment, api = false) {
  if (!Array.isArray(environment?.packages)) throw new Error('Missing package observations');
  const names = environment.packages.map(p => p.name);
  if (new Set(names).size !== names.length) throw new Error('Duplicate package observations');
  if (names.some(name => !packages.some(p => p.name === name))) throw new Error('Unexpected package observation');
  for (const p of packages) {
    const current = environment.packages.find(item => item.name === p.name);
    if (!current || typeof current.installed !== 'boolean') throw new Error(`Missing/invalid observation: ${p.name}`);
    if (current.installed && typeof current.version !== 'string') throw new Error(`Missing installed version: ${p.name}`);
    if (api && current.installed) for (const name of [...p.functions, ...(p.internalFunctions || [])]) {
      if (!current.api?.[name]) throw new Error(`Missing function inspection: ${p.name}::${name}`);
    }
  }
}

export function statusReport(packages, environment, baseline, validated, api) {
  const observed = new Map(environment.packages.map(p => [p.name, p]));
  const recorded = new Map((baseline?.packages || []).map(p => [p.name, p]));
  return { ...environment, kind: 'package_status', apiInspected: api, upstream: 'not checked (offline)',
    packages: packages.map(p => {
      const current = observed.get(p.name) || { name: p.name, installed: false };
      const validatedVersion = validated[p.name] || null;
      return { ...current, install: p.install, validatedVersion,
        matchesValidatedVersion: current.installed && validatedVersion ? current.version === validatedVersion : null,
        changes: observed.has(p.name) ? comparePackage(current, recorded.get(p.name), api, [...p.functions, ...(p.internalFunctions || [])]) : ['inspection missing'] };
    }) };
}

export function writeBaseline(environment) {
  // Portable observations omit machine-specific paths and transient timestamps.
  const packages = environment.packages.map(({ name, installed, version, remoteSha, api }) =>
    ({ name, installed, ...(installed ? { version, remoteSha: remoteSha || null } : {}), api: api || {} }));
  writeFileSync(BASELINE, `{"schemaVersion":1,"kind":"observed_api_baseline","rVersion":${JSON.stringify(environment.rVersion)},"packages":[\n${packages.map(p => JSON.stringify(p)).join(',\n')}\n]}\n`);
}

// ## Commands
export function main(args = process.argv.slice(2)) {
  const [command = 'status', ...flags] = args;
  if (['help', '--help'].includes(command)) {
    console.log('Usage: node scripts/package-maintenance.mjs [status [--api] | snapshot | sync | check]\nOffline status returns 1 for drift or missing required packages. --api loads installed namespaces to inspect signatures.\nSnapshot explicitly records observed APIs; it never changes last-validated versions. No packages are installed.');
    return 0;
  }
  if (!['status', 'snapshot', 'sync', 'check'].includes(command) || flags.some(f => f !== '--api') || flags.length > 1 || (command !== 'status' && flags.length))
    throw new Error('Invalid arguments; use --help');
  const packages = readRegistry();
  if (command === 'check' || command === 'sync') {
    syncGenerated(packages, command === 'check');
    console.log(`Package registry and generated inventories ${command === 'check' ? 'match' : 'synchronized'}.`);
    return 0;
  }
  const api = command === 'snapshot' || flags.includes('--api');
  const environment = inspectEnvironment(api);
  validateObservations(packages, environment, api);
  if (command === 'snapshot') {
    const bad = environment.packages.filter(p => p.error || (p.loadedVersion && p.installedVersion && p.loadedVersion !== p.installedVersion) ||
      (packages.find(e => e.name === p.name).install === 'required' && !p.installed) ||
      (p.installed && Object.values(p.api || {}).some(f => f.status !== 'ok')));
    if (bad.length) throw new Error(`Cannot record incomplete API baseline: ${bad.map(p => p.name).join(', ')}`);
    writeBaseline(environment);
    console.log('Recorded observed API baseline. Validation ledger unchanged; run workflow checks before promoting versions.');
    return 0;
  }
  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
  const report = statusReport(packages, environment, baseline, validatedVersions(), api);
  console.log(JSON.stringify(report, null, 2));
  return report.packages.some(p => p.changes.length || (p.install === 'required' && !p.installed) || p.matchesValidatedVersion === false) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { process.exitCode = main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
