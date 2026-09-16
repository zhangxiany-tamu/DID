// Shared, offline scoring for the MCP and skill-fallback validation audits.
//
// ## Contents
// - [Estimator coverage](#estimator-coverage)
// - [CS benchmark](#cs-benchmark)
// - [Audit outcome](#audit-outcome)

// ## Estimator coverage

export const AUDIT_ESTIMATORS = ["cs", "sa", "bjs", "did2s", "staggered"];

export function scoreEstimators(dataset, attempts) {
  const estimators = Object.fromEntries(AUDIT_ESTIMATORS.map((estimator) => {
    const matches = attempts.filter((a) => a.estimator === estimator);
    const a = matches[0];
    const finite = a?.ok === true && Number.isFinite(a.att);
    // Existing dataset-specific exception: SA may fail on the bank panel,
    // which has no never-treated units. A missing attempt is never exempt.
    const expected = matches.length === 1 && dataset === "bank-deregulation" &&
      estimator === "sa" && a.ok === false;
    const status = matches.length !== 1 ? "FAIL" : finite ? "PASS" :
      expected ? "EXPECTED_FAILURE" : "FAIL";
    const detail = matches.length !== 1 ? "missing or duplicate attempt" :
      finite ? "finite ATT" : expected ? "known SA limitation: no never-treated units" :
        a.ok === true ? "ATT is missing or nonfinite" : a.error || "estimation failed";
    return [estimator, { status, att: Number.isFinite(a?.att) ? a.att : null, detail }];
  }));
  const values = Object.values(estimators);
  return {
    status: values.some((e) => e.status === "FAIL") ? "FAIL" : "PASS",
    passed: values.filter((e) => e.status === "PASS").length,
    expectedFailures: values.filter((e) => e.status === "EXPECTED_FAILURE").length,
    total: AUDIT_ESTIMATORS.length,
    estimators,
  };
}

// ## CS benchmark

export function scoreCsBenchmark({ att, range = null, ci = null, coversZero = null }) {
  if (!Number.isFinite(att)) return { status: "FAIL", detail: "CS ATT is missing or nonfinite" };
  if (range !== null && !(att >= range[0] && att <= range[1])) {
    return { status: "FAIL", detail: `CS ATT ${att} is outside ${JSON.stringify(range)}` };
  }
  if (coversZero !== null) {
    if (!Array.isArray(ci) || ci.length !== 2 || !ci.every(Number.isFinite) || ci[0] > ci[1]) {
      return { status: "FAIL", detail: "CS confidence interval is missing or invalid" };
    }
    if ((ci[0] <= 0 && ci[1] >= 0) !== coversZero) {
      return { status: "FAIL", detail: `CS confidence interval covers_zero must be ${coversZero}` };
    }
  }
  return { status: "PASS", detail: range === null ? "finite CS ATT" : "CS ATT is within benchmark range" };
}

// ## Audit outcome

export function summarizeAudit({ rows, datasetNames, cellNames, executionErrors = [], allowNa = false }) {
  const failures = executionErrors.map((detail) => ({ kind: "execution", detail }));
  const counts = { PASS: 0, FAIL: 0, "N/A": 0, PENDING: 0, MISSING: 0, UNKNOWN: 0 };
  if (datasetNames.length === 0 || cellNames.length === 0) {
    failures.push({ kind: "coverage", detail: "expected datasets and cells must be nonempty" });
  }
  for (const row of rows) {
    if (!datasetNames.includes(row.name)) {
      failures.push({ kind: "coverage", dataset: row.name, detail: "unexpected dataset" });
    }
  }
  for (const dataset of datasetNames) {
    const matching = rows.filter((r) => r.name === dataset);
    if (matching.length !== 1) {
      failures.push({ kind: "coverage", dataset, detail: "missing or duplicate dataset" });
    }
    for (const cell of cellNames) {
      const result = matching.length === 1 ? matching[0].cells?.[cell] : undefined;
      const status = result === undefined ? "MISSING" :
        Object.hasOwn(counts, result?.status) ? result.status : "UNKNOWN";
      counts[status] += 1;
      if (status !== "PASS" && !(allowNa && status === "N/A")) {
        failures.push({ kind: "cell", dataset, cell, status, detail: result?.detail || status });
      }
    }
  }
  return { status: failures.length === 0 ? "PASS" : "FAIL", counts, failures };
}

export function auditExitCode(outcome) {
  return outcome.status === "PASS" ? 0 : 1;
}
