#!/usr/bin/env node
// ## Contents
// - [Setup](#setup)
// - [Workflow checks](#workflow-checks)
//
// Smoke test: drive the MCP server via stdio and exercise the full Step 1
// workflow end-to-end. Exits 0 on success, 1 on failure.

// ## Setup
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(__dirname, "..", "dist", "index.js");
const FIXTURE = resolve(__dirname, "..", "test", "fixtures", "mpdta.csv");

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
  console.error("FAIL: overall smoke test timeout (120s)");
  proc.kill("SIGTERM");
  process.exit(1);
}, 120_000);

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
      if (handler) {
        pending.delete(msg.id);
        handler(msg);
      }
    } catch (e) {
      console.error("FAIL: could not parse server line:", line);
    }
  }
});

function send(method, params) {
  const id = nextId++;
  const req = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolveP, rejectP) => {
    const to = setTimeout(() => {
      pending.delete(id);
      rejectP(new Error(`timeout waiting for response to ${method}`));
    }, 60_000);
    pending.set(id, (msg) => {
      clearTimeout(to);
      if (msg.error) rejectP(new Error(msg.error.message || "rpc error"));
      else resolveP(msg.result);
    });
    proc.stdin.write(JSON.stringify(req) + "\n");
  });
}

// ## Workflow checks
(async () => {
  try {
    // MCP handshake
    const init = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.0.0" },
    });
    console.log("OK initialize:", init.serverInfo?.name || "server");

    // Send initialized notification (no response expected)
    proc.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      }) + "\n",
    );

    // List tools
    const listed = await send("tools/list", {});
    const names = listed.tools.map((t) => t.name);
    console.log("OK tools/list:", names.join(", "));
    if (!names.includes("did_ping") || !names.includes("did_session")) {
      throw new Error("expected did_ping and did_session in tool list");
    }

    // Call did_ping
    const pingRes = await send("tools/call", {
      name: "did_ping",
      arguments: { echo: "smoke-test-echo" },
    });
    const pingPayload = JSON.parse(pingRes.content[0].text);
    console.log("OK did_ping:", JSON.stringify(pingPayload.bridge).slice(0, 120));
    if (!pingPayload.pong) throw new Error("did_ping did not return pong:true");
    if (pingPayload.bridge.echo !== "smoke-test-echo")
      throw new Error("echo mismatch");
    if (!pingPayload.bridge.r_version)
      throw new Error("missing r_version in ping response");
    const provenance = pingPayload.bridge.package_provenance;
    if (provenance?.kind !== "observed_environment" || !provenance.rHome || !provenance.libraryPaths?.length)
      throw new Error("missing worker package provenance");
    const jsonlite = provenance.packages?.find(p => p.name === "jsonlite");
    if (!jsonlite?.installed || jsonlite.version !== pingPayload.bridge.jsonlite_version || !jsonlite.path)
      throw new Error("package provenance does not match worker jsonlite");

    // Call did_session status
    const sessRes = await send("tools/call", {
      name: "did_session",
      arguments: { action: "status" },
    });
    const sessPayload = JSON.parse(sessRes.content[0].text);
    console.log("OK did_session status:", JSON.stringify(sessPayload.pool));
    if (!sessPayload.pool?.activeWorkerId)
      throw new Error("no active worker in session status");

    // ---- Step 1 workflow chain ----------------------------------------------
    if (!existsSync(FIXTURE)) {
      throw new Error(
        `fixture not found: ${FIXTURE}. Run: Rscript mcp/scripts/export-fixtures.R`,
      );
    }

    async function callTool(name, args) {
      const res = await send("tools/call", { name, arguments: args });
      if (res.isError) {
        const msg = res.content?.[0]?.text ?? "(no detail)";
        throw new Error(`${name} errored: ${msg}`);
      }
      return JSON.parse(res.content[0].text);
    }

    // 1. Load the panel
    const loadPayload = await callTool("did_load_panel", {
      path: FIXTURE,
      id_var: "countyreal",
      time_var: "year",
      treat_timing_var: "first.treat",
      treat_var: "treat",
      outcome_var: "lemp",
    });
    console.log(
      "OK did_load_panel:",
      `handle=${loadPayload.handle} n_obs=${loadPayload.n_obs} n_units=${loadPayload.n_units}`,
    );
    if (loadPayload.handle !== "panel_1")
      throw new Error(`expected panel_1, got ${loadPayload.handle}`);
    if (loadPayload.n_obs !== 2500)
      throw new Error(`expected 2500 obs, got ${loadPayload.n_obs}`);
    if (loadPayload.n_units !== 500)
      throw new Error(`expected 500 units, got ${loadPayload.n_units}`);

    // 2. Check panel integrity
    const checkPayload = await callTool("did_check_panel", { panel_id: "panel_1" });
    console.log("OK did_check_panel: overall_ok =", checkPayload.overall_ok);
    if (checkPayload.overall_ok !== true)
      throw new Error("expected overall_ok=true for mpdta");

    // 3. Profile the design
    const profilePayload = await callTool("did_profile_design", { panel_id: "panel_1" });
    console.log(
      "OK did_profile_design:",
      `timing=${profilePayload.timing} route=${profilePayload.route} cohorts=${profilePayload.n_cohorts}`,
    );
    if (profilePayload.timing !== "STAGGERED")
      throw new Error(`expected timing=STAGGERED, got ${profilePayload.timing}`);
    if (profilePayload.route !== "STAGGERED")
      throw new Error(`expected route=STAGGERED, got ${profilePayload.route}`);

    // 4. Recode never-treated
    const recodePayload = await callTool("did_recode_never_treated", {
      panel_id: "panel_1",
      target: "zero",
    });
    console.log(
      "OK did_recode_never_treated:",
      `handle=${recodePayload.handle} target=${recodePayload.target} n_never_source=${recodePayload.n_never_source}`,
    );
    if (recodePayload.handle !== "panel_2")
      throw new Error(`expected new handle panel_2, got ${recodePayload.handle}`);

    // 5. Plot rollout + outcome trajectories
    const plotPayload = await callTool("did_plot_rollout", {
      panel_id: "panel_1",
      plot_type: "both",
      outcome_var: "lemp",
    });
    console.log(
      "OK did_plot_rollout:",
      `plots=${plotPayload.plots.map((p) => p.handle).join(",")}`,
    );
    if (plotPayload.plots.length !== 2)
      throw new Error(`expected 2 plots, got ${plotPayload.plots.length}`);
    for (const p of plotPayload.plots) {
      if (!existsSync(p.path))
        throw new Error(`plot file missing on disk: ${p.path}`);
    }

    // 6. Run CS (Callaway-Sant'Anna) estimator
    const csPayload = await callTool("did_estimate", {
      panel_id: "panel_1",
      estimator: "cs",
      outcome_var: "lemp",
    });
    console.log(
      "OK did_estimate (cs):",
      `handle=${csPayload.handle} att=${csPayload.overall?.att?.toFixed(4)} events=${csPayload.event_study?.length}`,
    );
    if (!csPayload.handle || !csPayload.handle.startsWith("estimate_"))
      throw new Error(`expected estimate handle, got ${csPayload.handle}`);
    if (typeof csPayload.overall?.att !== "number" || !isFinite(csPayload.overall.att))
      throw new Error("expected finite overall.att from CS");
    if (!Array.isArray(csPayload.event_study) || csPayload.event_study.length === 0)
      throw new Error("expected non-empty event_study from CS");
    if (csPayload.metadata?.n_units !== 500)
      throw new Error(`expected n_units=500, got ${csPayload.metadata?.n_units}`);

    // 7. Compare CS vs SA
    const cmpPayload = await callTool("did_compare_estimators", {
      panel_id: "panel_1",
      estimators: ["cs", "sa"],
      outcome_var: "lemp",
    });
    console.log(
      "OK did_compare_estimators:",
      `envelopes=${Object.keys(cmpPayload.envelopes || {}).join(",")} table_rows=${cmpPayload.table?.length}`,
    );
    if (!cmpPayload.envelopes?.cs || !cmpPayload.envelopes?.sa)
      throw new Error("expected both cs and sa envelopes");
    if (!Array.isArray(cmpPayload.table) || cmpPayload.table.length === 0)
      throw new Error("expected non-empty comparison table");
    const firstRow = cmpPayload.table[0];
    if (!("cs_est" in firstRow) || !("sa_est" in firstRow))
      throw new Error("comparison table row missing cs_est or sa_est");

    // 8. Extract event study from CS estimate
    const esPayload = await callTool("did_extract_event_study", {
      estimate_id: csPayload.handle,
    });
    console.log(
      "OK did_extract_event_study:",
      `handle=${esPayload.handle} n=${esPayload.n}`,
    );
    if (!esPayload.handle || !esPayload.handle.startsWith("event_study_"))
      throw new Error(`expected event_study handle, got ${esPayload.handle}`);
    if (!Array.isArray(esPayload.betahat) || esPayload.betahat.length !== esPayload.n)
      throw new Error("betahat length mismatch");
    if (!Array.isArray(esPayload.tVec) || esPayload.tVec.length !== esPayload.n)
      throw new Error("tVec length mismatch");
    if (
      !Array.isArray(esPayload.sigma) ||
      esPayload.sigma.length !== esPayload.n ||
      !Array.isArray(esPayload.sigma[0]) ||
      esPayload.sigma[0].length !== esPayload.n
    )
      throw new Error(`sigma must be ${esPayload.n}x${esPayload.n}`);

    // 9. HonestDiD sensitivity on the CS event study
    const honestRes = await callTool("did_honest_sensitivity", {
      event_study_id: "event_study_1",
    });
    console.log(
      "OK did_honest_sensitivity:",
      `handle=${honestRes.handle} n_pre=${honestRes.n_pre} n_post=${honestRes.n_post} breakdown=${honestRes.breakdown_M} robust_rows=${honestRes.robust?.length}`,
    );
    if (!honestRes.handle || !honestRes.handle.startsWith("honest_result_"))
      throw new Error(`expected honest_result handle, got ${honestRes.handle}`);
    if (!Array.isArray(honestRes.robust) || honestRes.robust.length === 0)
      throw new Error("expected non-empty robust CI rows");
    if (typeof honestRes.n_pre !== "number" || honestRes.n_pre === 0)
      throw new Error("expected n_pre > 0");
    if (typeof honestRes.n_post !== "number" || honestRes.n_post === 0)
      throw new Error("expected n_post > 0");

    // 10. Power analysis on the same event study
    const powerRes = await callTool("did_power_analysis", {
      event_study_id: "event_study_1",
    });
    console.log(
      "OK did_power_analysis:",
      `handle=${powerRes.handle} slopes=${powerRes.detectable_slopes?.map((s) => `${s.target_power}:${s.slope?.toFixed?.(4)}`).join(",")}`,
    );
    if (!powerRes.handle || !powerRes.handle.startsWith("power_result_"))
      throw new Error(`expected power_result handle, got ${powerRes.handle}`);
    if (!Array.isArray(powerRes.detectable_slopes) || powerRes.detectable_slopes.length !== 2)
      throw new Error("expected 2 detectable slopes (default 0.5 and 0.8)");
    for (const s of powerRes.detectable_slopes) {
      if (typeof s.slope !== "number" || !isFinite(s.slope))
        throw new Error(`expected finite slope for power ${s.target_power}, got ${s.slope}`);
    }

    // 11. Diagnose TWFE (Step 2) on the original panel
    const diagRes = await callTool("did_diagnose_twfe", {
      panel_id: "panel_1",
      outcome_var: "lemp",
    });
    console.log(
      "OK did_diagnose_twfe:",
      `handle=${diagRes.handle} overall=${diagRes.overall_severity} bacon=${diagRes.bacon?.severity} weights=${diagRes.weights?.severity}`,
    );
    if (!diagRes.handle || !diagRes.handle.startsWith("twfe_diagnostic_"))
      throw new Error(`expected twfe_diagnostic handle, got ${diagRes.handle}`);
    if (!["MINIMAL", "MILD", "MODERATE", "SEVERE", "UNKNOWN"].includes(diagRes.overall_severity))
      throw new Error(`unexpected overall_severity: ${diagRes.overall_severity}`);
    if (!diagRes.bacon && !diagRes.weights)
      throw new Error("expected at least one of bacon/weights result");
    if (typeof diagRes.recommendation !== "string" || diagRes.recommendation.length === 0)
      throw new Error("expected non-empty recommendation string");

    // 12. did_plot on the event study
    const plotEs = await callTool("did_plot", {
      source_id: "event_study_1",
    });
    console.log(
      "OK did_plot (event_study):",
      `handle=${plotEs.handle} kind=${plotEs.kind} path=${plotEs.path}`,
    );
    if (!plotEs.handle || !plotEs.handle.startsWith("plot_"))
      throw new Error(`expected plot handle, got ${plotEs.handle}`);
    if (plotEs.kind !== "event_study")
      throw new Error(`expected kind=event_study, got ${plotEs.kind}`);
    if (!existsSync(plotEs.path))
      throw new Error(`plot file missing on disk: ${plotEs.path}`);

    // 13. did_plot on the honest result
    const plotHr = await callTool("did_plot", {
      source_id: "honest_result_1",
    });
    console.log(
      "OK did_plot (honest_sensitivity):",
      `handle=${plotHr.handle} kind=${plotHr.kind}`,
    );
    if (plotHr.kind !== "honest_sensitivity")
      throw new Error(`expected kind=honest_sensitivity, got ${plotHr.kind}`);
    if (!existsSync(plotHr.path))
      throw new Error(`honest plot file missing on disk: ${plotHr.path}`);

    // 14. did_report covering the full session
    const reportRes = await callTool("did_report", {});
    console.log(
      "OK did_report:",
      `handle=${reportRes.handle} n_handles=${reportRes.n_handles} path=${reportRes.path}`,
    );
    if (!reportRes.handle || !reportRes.handle.startsWith("report_"))
      throw new Error(`expected report handle, got ${reportRes.handle}`);
    if (!existsSync(reportRes.path))
      throw new Error(`report file missing on disk: ${reportRes.path}`);
    if (typeof reportRes.preview !== "string" || reportRes.preview.length === 0)
      throw new Error("expected non-empty report preview");

    // 15. List session handles
    const listRes = await callTool("did_session", { action: "list" });
    console.log("OK did_session list: handleCount =", listRes.handleCount);
    if (listRes.handleCount < 14)
      throw new Error(`expected >=14 handles, got ${listRes.handleCount}`);

    // 10. Drop a handle and verify the R object is actually freed. Re-running
    // the same tool against a dropped panel_id should now error.
    const dropRes = await callTool("did_session", {
      action: "drop",
      id: "panel_2",
    });
    if (dropRes.freedInR !== true || dropRes.droppedInTs !== true)
      throw new Error(
        `did_session drop did not free R or TS: freedInR=${dropRes.freedInR} droppedInTs=${dropRes.droppedInTs}`,
      );
    console.log("OK did_session drop: panel_2 freed in R and TS");
    const reuseRes = await send("tools/call", {
      name: "did_check_panel",
      arguments: { panel_id: "panel_2" },
    });
    if (!reuseRes.isError)
      throw new Error("did_check_panel should fail after panel_2 was dropped");
    console.log("OK post-drop reuse correctly errored");

    console.log("ALL PASS");
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
