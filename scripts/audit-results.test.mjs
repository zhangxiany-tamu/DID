import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  AUDIT_ESTIMATORS,
  scoreEstimators,
  scoreCsBenchmark,
  summarizeAudit,
} from "./audit-results.mjs";

// ## Contents
// - [Estimator coverage](#estimator-coverage)
// - [CS benchmark](#cs-benchmark)
// - [Audit outcome and process status](#audit-outcome-and-process-status)
// - [Fallback driver regression](#fallback-driver-regression)

const allAttempts = () => AUDIT_ESTIMATORS.map((estimator) => ({ estimator, ok: true, att: 0.07 }));
const passingAudit = () => ({
  rows: [{ name: "fixture", cells: { estimate: { status: "PASS" }, power: { status: "PASS" } } }],
  datasetNames: ["fixture"],
  cellNames: ["estimate", "power"],
});

// ## Estimator coverage

test("all five estimators must have finite ATT values", () => {
  assert.equal(scoreEstimators("fixture", allAttempts()).status, "PASS");
  const attempts = allAttempts();
  attempts[0] = { estimator: "cs", ok: false, error: "API mismatch" };
  attempts[1] = { estimator: "sa", ok: false, error: "API mismatch" };
  const result = scoreEstimators("fixture", attempts);
  assert.equal(result.passed, 3);
  assert.equal(result.status, "FAIL");
  assert.equal(result.estimators.cs.status, "FAIL");
});

test("a successful RPC with missing or nonfinite ATT cannot count as coverage", () => {
  for (const att of [undefined, null, NaN, Infinity, "0.07"]) {
    const attempts = allAttempts();
    attempts[0].att = att;
    assert.equal(scoreEstimators("fixture", attempts).status, "FAIL");
  }
});

test("bank SA failure is explicit and cannot exempt another estimator or dataset", () => {
  const attempts = allAttempts();
  attempts[1] = { estimator: "sa", ok: false, error: "rank deficient" };
  const bank = scoreEstimators("bank-deregulation", attempts);
  assert.equal(bank.status, "PASS");
  assert.equal(bank.passed, 4);
  assert.equal(bank.estimators.sa.status, "EXPECTED_FAILURE");
  assert.equal(scoreEstimators("medicaid-insurance", attempts).status, "FAIL");
  attempts[2] = { estimator: "bjs", ok: false };
  assert.equal(scoreEstimators("bank-deregulation", attempts).status, "FAIL");
});

test("bank exception does not hide an unexecuted, duplicate, or nonfinite successful SA attempt", () => {
  const withoutSa = allAttempts().filter((a) => a.estimator !== "sa");
  assert.equal(scoreEstimators("bank-deregulation", withoutSa).status, "FAIL");
  assert.equal(scoreEstimators("fixture", [...allAttempts(), allAttempts()[0]]).status, "FAIL");
  const attempts = allAttempts();
  attempts[1].att = NaN;
  assert.equal(scoreEstimators("bank-deregulation", attempts).status, "FAIL");
});

// ## CS benchmark

test("missing CS cannot skip the benchmark even when no numeric range is specified", () => {
  for (const att of [undefined, null, NaN, Infinity]) {
    assert.equal(scoreCsBenchmark({ att }).status, "FAIL");
  }
  assert.equal(scoreCsBenchmark({ att: 0.07 }).status, "PASS");
});

test("CS range and confidence interval expectations stay enforceable", () => {
  assert.equal(scoreCsBenchmark({ att: 0.07, range: [0.04, 0.1] }).status, "PASS");
  assert.equal(scoreCsBenchmark({ att: 0.2, range: [0.04, 0.1] }).status, "FAIL");
  assert.equal(scoreCsBenchmark({ att: 0.07, ci: [0.01, 0.13], coversZero: false }).status, "PASS");
  assert.equal(scoreCsBenchmark({ att: 0.07, ci: [-0.01, 0.15], coversZero: false }).status, "FAIL");
  assert.equal(scoreCsBenchmark({ att: 0.07, ci: [undefined, undefined], coversZero: false }).status, "FAIL");
  assert.equal(scoreCsBenchmark({ att: 0.07, ci: [0.1, -0.1], coversZero: true }).status, "FAIL");
});

// ## Audit outcome and process status

test("failed, pending, unknown, missing and duplicate cells/datasets fail the audit", () => {
  assert.equal(summarizeAudit(passingAudit()).status, "PASS");
  for (const status of ["FAIL", "PENDING", "unexpected", undefined]) {
    const input = passingAudit();
    input.rows[0].cells.estimate.status = status;
    assert.equal(summarizeAudit(input).status, "FAIL");
  }
  const missingCell = passingAudit();
  delete missingCell.rows[0].cells.estimate;
  assert.equal(summarizeAudit(missingCell).status, "FAIL");
  const missingDataset = passingAudit();
  missingDataset.rows = [];
  assert.equal(summarizeAudit(missingDataset).status, "FAIL");
  const duplicate = passingAudit();
  duplicate.rows.push(duplicate.rows[0]);
  assert.equal(summarizeAudit(duplicate).status, "FAIL");
});

test("N/A requires explicit opt-in and failed R execution defeats passing cells", () => {
  const input = passingAudit();
  input.rows[0].cells.estimate.status = "N/A";
  assert.equal(summarizeAudit(input).status, "FAIL");
  assert.equal(summarizeAudit({ ...input, allowNa: true }).status, "PASS");
  for (const error of ["Rscript not found", "Rscript exited 1", "Rscript timed out", "R output missing"]) {
    const result = summarizeAudit({ ...passingAudit(), executionErrors: [error] });
    assert.equal(result.status, "FAIL");
    assert.equal(result.failures[0].kind, "execution");
  }
});

test("audit outcome produces an actual nonzero child exit after output is written", () => {
  const moduleUrl = new URL("./audit-results.mjs", import.meta.url).href;
  const failing = passingAudit();
  failing.rows[0].cells.estimate.status = "FAIL";
  for (const [input, expected] of [[passingAudit(), 0], [failing, 1],
    [{ ...passingAudit(), executionErrors: ["R failed after partial output"] }, 1]]) {
    const script = `import { summarizeAudit, auditExitCode } from ${JSON.stringify(moduleUrl)};
      const outcome = summarizeAudit(JSON.parse(process.argv[1]));
      console.log(JSON.stringify(outcome));
      process.exitCode = auditExitCode(outcome);`;
    const proc = spawnSync(process.execPath, ["--input-type=module", "-e", script, JSON.stringify(input)], { encoding: "utf8" });
    assert.equal(proc.status, expected, proc.stderr);
    assert.equal(JSON.parse(proc.stdout).status, expected === 0 ? "PASS" : "FAIL");
  }
});

// ## Fallback driver regression

test("fallback CLI writes reports and fails for failed cells, R failure, and absent or invalid output", () => {
  const fixture = mkdtempSync(join(tmpdir(), "did-audit-gates-"));
  const examples = join(fixture, "examples");
  const fakeR = join(fixture, "fake-r.mjs");
  const driver = fileURLToPath(new URL("../skill/scripts/audit-skill-recipes.mjs", import.meta.url));
  // Empty CSVs suffice: this exercises preparation and driver/report wiring,
  // while the fake R process supplies deterministic recipe results.
  for (const relative of [
    "medicaid-insurance/ehec_data.csv", "medicaid-mortality/county_mortality_data.csv",
    "teacher-bargaining/paglayan_dataset.csv", "divorce-laws/divorce_data.csv",
    "sentencing-laws/sentencing_data.csv", "bank-deregulation/bank_deregulation_data.csv",
  ]) {
    const path = join(examples, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "fixture_header\n");
  }
  writeFileSync(fakeR, `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
const mode = process.env.DID_TEST_R_MODE;
const output = process.argv[4];
if (mode === 'missing-output') process.exit(0);
if (mode === 'malformed-output') { writeFileSync(output, '{'); process.exit(0); }
const configs = JSON.parse(readFileSync(process.argv[3], 'utf8')).datasets;
const block = value => ({ ok: true, value });
const results = Object.fromEntries(configs.map(cfg => [cfg.name, {
  step1: { balanced: block({ n_units: 2, n_times: 2, n_rows: 4, balanced: true }),
    cohorts: block({ cohorts: { 2014: 1 } }), panelview: block({ plot_ok: true }) },
  step2: { bacon: block({}), bacon_summary: { weights_sum: 1 }, weights: block({}) },
  step3: Object.fromEntries(['cs', 'sa', 'bjs', 'did2s', 'staggered'].map(est => [est,
    mode === 'failed-cell' && est === 'cs' ? { ok: false, error: 'broken API' } :
      block({ att: 0.07, att_dynamic: 0.07 })])),
  step4: block({ slope_50: 0.1, slope_80: 0.2 }),
  step5: block({ robust: [{ lb: 0, ub: 0.1 }], n_pre: 2, n_post: 2 }),
}]));
writeFileSync(output, JSON.stringify({ results }));
process.exitCode = mode === 'failed-r' ? 7 : 0;
`);
  chmodSync(fakeR, 0o755);
  try {
    for (const mode of ["pass", "failed-cell", "failed-r", "missing-r", "missing-output", "malformed-output"]) {
      const output = join(fixture, mode);
      const proc = spawnSync(process.execPath, [driver], {
        encoding: "utf8",
        timeout: 10_000,
        env: {
          ...process.env,
          PATH: `${dirname(process.execPath)}:${process.env.PATH || ""}`,
          DID_EXAMPLES_DIR: examples,
          DID_SKILL_VALIDATION_OUTPUT_DIR: output,
          DID_TEST_R_MODE: mode,
          R_PATH: mode === "missing-r" ? join(fixture, "not-an-executable") : fakeR,
        },
      });
      assert.equal(proc.status, mode === "pass" ? 0 : 1, `${mode}: ${proc.stderr}`);
      const reports = readdirSync(output);
      assert.ok(reports.some((name) => name.endsWith(".md")), mode);
      const report = JSON.parse(readFileSync(join(output, reports.find((name) => name.endsWith(".json"))), "utf8"));
      try {
        assert.equal(report.outcome.status, mode === "pass" ? "PASS" : "FAIL", mode);
        if (mode === "failed-r") {
          assert.equal(report.outcome.counts.PASS, 30);
          assert.ok(report.outcome.failures.some((failure) => failure.kind === "execution"));
        }
        if (mode === "failed-cell") {
          assert.equal(report.scored["medicaid-insurance"].s3.coverage.estimators.cs.status, "FAIL");
        }
      } finally {
        rmSync(report.tmp_dir, { recursive: true, force: true });
      }
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
