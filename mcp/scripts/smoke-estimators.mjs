#!/usr/bin/env node
// ## Contents
// - [Setup](#setup)
// - [Estimator checks](#estimator-checks)
//
// Broader smoke: run did_estimate with each of the five estimators on the
// mpdta fixture and assert each produces a finite overall ATT + non-empty
// event study. Complements scripts/smoke-test.mjs which only exercises CS.
// Exits 0 on success, 1 on any failure.

// ## Setup
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(__dirname, "..", "dist", "index.js");
const FIXTURE = resolve(__dirname, "..", "test", "fixtures", "mpdta.csv");

if (!existsSync(SERVER)) {
  console.error("FAIL: dist/index.js missing — run `npm run build` first");
  process.exit(1);
}
if (!existsSync(FIXTURE)) {
  console.error("FAIL: fixture missing:", FIXTURE);
  process.exit(1);
}

const proc = spawn("node", [SERVER], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, R_PATH: process.env.R_PATH || "Rscript" },
});

let buffer = "";
const pending = new Map();
let nextId = 1;
let timedOut = false;

const overall = setTimeout(() => {
  timedOut = true;
  console.error("FAIL: overall timeout (240s)");
  proc.kill("SIGTERM");
  process.exit(1);
}, 240_000);

proc.stdout.setEncoding("utf-8");
proc.stdout.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      const handler = pending.get(msg.id);
      if (handler) { pending.delete(msg.id); handler(msg); }
    } catch (e) {
      console.error("FAIL: parse error on line:", line);
    }
  }
});

function send(method, params) {
  const id = nextId++;
  return new Promise((resolveP, rejectP) => {
    const to = setTimeout(() => {
      pending.delete(id);
      rejectP(new Error(`timeout waiting for ${method}`));
    }, 90_000);
    pending.set(id, (msg) => {
      clearTimeout(to);
      if (msg.error) rejectP(new Error(msg.error.message));
      else resolveP(msg.result);
    });
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

async function callTool(name, args) {
  const res = await send("tools/call", { name, arguments: args });
  if (res.isError) {
    const msg = res.content?.[0]?.text ?? "(no detail)";
    throw new Error(`${name} errored: ${msg}`);
  }
  return JSON.parse(res.content[0].text);
}

// ## Estimator checks
(async () => {
  try {
    await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke-estimators", version: "0.0.0" },
    });
    proc.stdin.write(JSON.stringify({
      jsonrpc: "2.0", method: "notifications/initialized", params: {},
    }) + "\n");

    const load = await callTool("did_load_panel", {
      path: FIXTURE,
      id_var: "countyreal",
      time_var: "year",
      treat_timing_var: "first.treat",
      treat_var: "treat",
      outcome_var: "lemp",
    });
    if (load.handle !== "panel_1") {
      throw new Error(`expected panel_1, got ${load.handle}`);
    }

    const estimators = ["cs", "sa", "bjs", "did2s", "staggered"];
    const results = [];

    for (const est of estimators) {
      const payload = await callTool("did_estimate", {
        panel_id: "panel_1",
        estimator: est,
        outcome_var: "lemp",
      });
      const att = payload.overall?.att;
      const n_events = payload.event_study?.length ?? 0;
      const n_warnings = Array.isArray(payload.warnings) ? payload.warnings.length : 0;
      console.log(
        `OK ${est.padEnd(9)} ATT=${att?.toFixed(4) ?? "NA"} events=${n_events} warnings=${n_warnings} handle=${payload.handle}`,
      );

      if (typeof att !== "number" || !isFinite(att)) {
        throw new Error(`${est}: overall.att is not finite (got ${att})`);
      }
      // staggered's overall ATT is the "simple" estimand; event study may be
      // empty if the panel's natural event range was degenerate. All OTHER
      // estimators must produce a non-empty event study on mpdta.
      if (est !== "staggered" && n_events === 0) {
        throw new Error(`${est}: expected non-empty event study, got 0 entries`);
      }
      if (!payload.handle || !payload.handle.startsWith("estimate_")) {
        throw new Error(`${est}: expected estimate_* handle, got ${payload.handle}`);
      }
      const packageName = { cs: "did", sa: "fixest", bjs: "didimputation", did2s: "did2s", staggered: "staggered" }[est];
      const provenance = payload.metadata?.packages?.find(p => p.name === packageName);
      if (!provenance?.installed || !provenance.version || !provenance.library || !provenance.path) {
        throw new Error(`${est}: missing actual estimator package provenance`);
      }

      // Extract event study and confirm the fallback flag is set correctly.
      const es = await callTool("did_extract_event_study", { estimate_id: payload.handle });
      const expected_fallback = !["sa", "did2s"].includes(est);
      if (Boolean(es.sigma_is_diagonal_fallback) !== expected_fallback) {
        throw new Error(
          `${est}: sigma_is_diagonal_fallback=${es.sigma_is_diagonal_fallback}, expected ${expected_fallback}`,
        );
      }
      if (est === "did2s") {
        const power = await callTool("did_power_analysis", {
          event_study_id: es.handle, target_powers: [0.5, 0.8],
        });
        if (!Array.isArray(power.detectable_slopes) || power.detectable_slopes.length !== 2 ||
            power.detectable_slopes.some(row => !Number.isFinite(row.slope))) {
          throw new Error("did2s: downstream power did not return both finite slopes");
        }
        const honest = await callTool("did_honest_sensitivity", {
          event_study_id: es.handle, Mbarvec: [0.5], max_pre_periods: 2, max_post_periods: 2,
        });
        if (!Array.isArray(honest.robust) || honest.robust.length === 0 ||
            honest.robust.some(row => !Number.isFinite(row.lb) || !Number.isFinite(row.ub) || row.lb > row.ub)) {
          throw new Error("did2s: downstream HonestDiD did not return finite ordered CI bounds");
        }
        const warnings = [...(power.warnings || []), ...(honest.warnings || [])];
        if (warnings.some(warning => /diagonal.fallback|ignor.{0,20}off.diagonal/i.test(String(warning)))) {
          throw new Error("did2s: downstream inference incorrectly reported diagonal covariance fallback");
        }
        console.log(`OK did2s downstream: slopes=${power.detectable_slopes.map(row => `${row.target_power}:${row.slope.toFixed(4)}`).join(",")} finite_CIs=${honest.robust.length}`);
      }
      results.push({ est, att, n_events, handle: payload.handle, es_handle: es.handle });
    }

    console.log("\nSummary of ATTs across estimators on mpdta:");
    for (const r of results) {
      console.log(`  ${r.est.padEnd(9)} ${r.att.toFixed(4)}`);
    }

    console.log("\nALL 5 ESTIMATORS PASS");
    clearTimeout(overall);
    proc.kill("SIGTERM");
    process.exit(0);
  } catch (e) {
    if (!timedOut) {
      console.error("FAIL:", e.message);
      clearTimeout(overall);
      proc.kill("SIGTERM");
      process.exit(1);
    }
  }
})();
