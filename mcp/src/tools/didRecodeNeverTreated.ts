// ============================================================================
// did-mcp — did_recode_never_treated tool
// ============================================================================
// Unifies never-treated coding (0 / NA / Inf / max_plus_10) so the panel can
// be passed to the estimator that expects that convention. Returns a new
// `panel` handle; the source panel is unchanged.

import type { WorkerPool } from "../engine/workerPool.js";
import {
  getHandle,
  registerHandle,
  reserveHandleId,
  type SessionStore,
} from "../engine/session.js";
import {
  type DidToolResult,
  successResult,
  errorResult,
} from "../types.js";

export const DID_RECODE_NEVER_TREATED_SCHEMA = {
  type: "object" as const,
  properties: {
    panel_id: {
      type: "string",
      description: "Handle id of a panel (e.g. 'panel_1') from did_load_panel.",
    },
    target: {
      type: "string",
      enum: ["zero", "na", "inf", "max_plus_10"],
      description:
        "Target encoding for never-treated units. zero=CS/BJS; inf=SA (fixest::sunab)/staggered; na=generic missing-value coding. max_plus_10 is a legacy finite sentinel beyond observed time (not needed by BJS); its identity is preserved within MCP handles, not CSV exports.",
    },
  },
  required: ["panel_id", "target"],
};

export type DidRecodeNeverTreatedInput = {
  panel_id: string;
  target: "zero" | "na" | "inf" | "max_plus_10";
};

export async function executeDidRecodeNeverTreated(
  input: DidRecodeNeverTreatedInput,
  workerPool: WorkerPool,
  sessionStore: SessionStore,
): Promise<DidToolResult> {
  try {
    const handle = getHandle(sessionStore, input.panel_id);
    if (!handle) return errorResult(`panel handle '${input.panel_id}' not found`);
    if (handle.type !== "panel") {
      return errorResult(
        `handle '${input.panel_id}' is a ${handle.type}, expected panel`,
      );
    }
    const schema = handle.schema ?? {};
    if (!schema.treat_timing_var) {
      return errorResult(
        `panel '${input.panel_id}' is missing treat_timing_var in its schema.`,
      );
    }

    const newPanelId = reserveHandleId(sessionStore, "panel");

    const response = await workerPool.call("recode_never_treated", {
      panel_id: input.panel_id,
      target: input.target,
      handle_id: newPanelId,
      id_var: schema.id_var ?? "",
      time_var: schema.time_var ?? "",
      treat_timing_var: schema.treat_timing_var,
      treat_var: schema.treat_var ?? "",
      outcome_var: schema.outcome_var ?? "",
    });

    if (response.error) {
      return errorResult(response.error.message, {
        code: response.error.code,
        suggestion: response.error.suggestion,
        traceback: response.error.traceback,
      });
    }

    const workerId = workerPool.activeWorkerId ?? "unknown";
    if (response.objectsCreated) {
      for (const created of response.objectsCreated) {
        registerHandle(sessionStore, created, workerId, "did_recode_never_treated");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_recode_never_treated failed: ${(e as Error).message}`);
  }
}
