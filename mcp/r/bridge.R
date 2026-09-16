# ## Contents
# - [Initialization](#initialization)
# - [Response helpers](#response-helpers)
# - [Dispatch](#dispatch)
# - [Main loop](#main-loop)
#
# ## Initialization
# ============================================================================
# did-mcp — R Bridge
# ============================================================================
# Persistent R subprocess. Reads NDJSON from stdin, dispatches RPC calls,
# writes NDJSON to stdout. One JSON object per line.
#
# Phases 1-6 shipped.
#   Phase 1: did_ping + did_session scaffolding + persist/restore.
#   Phase 2: Step 1 tools (load_panel, check_panel, profile_design,
#            recode_never_treated, plot_rollout).
#   Phase 3: Step 3 estimators (estimate, compare_estimators,
#            extract_event_study) for cs/sa/bjs/did2s/staggered.
#   Phase 4: power analysis.
#   Phase 5: HonestDiD sensitivity.
#   Phase 6: plotting, DRDID, and narrative reports.
# ============================================================================

suppressPackageStartupMessages({
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    cat('{"id":0,"error":{"code":99,"message":"jsonlite is not installed. Run mcp/r/install_packages.R first."}}', "\n", sep = "")
    flush(stdout())
    quit(status = 1)
  }
  library(jsonlite)
})

# NULL-coalesce helper
`%||%` <- function(a, b) if (is.null(a)) b else a

# ---- Companion-file loader --------------------------------------------------
# RWorker.ts sets DID_MCP_BRIDGE_DIR so bridge.R can find sibling modules.
# Fall back to the directory of this script if the env var is missing (e.g.
# when bridge.R is sourced interactively from an R REPL for debugging).

BRIDGE_DIR <- Sys.getenv("DID_MCP_BRIDGE_DIR", unset = "")
if (!nzchar(BRIDGE_DIR)) {
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- sub("^--file=", "", args[grepl("^--file=", args)])
  if (length(file_arg) > 0) {
    BRIDGE_DIR <- dirname(normalizePath(file_arg[1], mustWork = FALSE))
  } else {
    BRIDGE_DIR <- getwd()
  }
}

source(file.path(BRIDGE_DIR, "package_provenance.R"))
source(file.path(BRIDGE_DIR, "object_store.R"))
source(file.path(BRIDGE_DIR, "step1_load_panel.R"))
source(file.path(BRIDGE_DIR, "step1_checks.R"))
source(file.path(BRIDGE_DIR, "step1_profile.R"))
source(file.path(BRIDGE_DIR, "step1_recode.R"))
source(file.path(BRIDGE_DIR, "step1_plots.R"))
source(file.path(BRIDGE_DIR, "step3_common.R"))
source(file.path(BRIDGE_DIR, "step3_estimators.R"))
source(file.path(BRIDGE_DIR, "step3_extractors.R"))
source(file.path(BRIDGE_DIR, "step3_dispatch.R"))
source(file.path(BRIDGE_DIR, "step4_power.R"))
source(file.path(BRIDGE_DIR, "step5_sensitivity.R"))
source(file.path(BRIDGE_DIR, "step45_dispatch.R"))
source(file.path(BRIDGE_DIR, "step2_twfe.R"))
source(file.path(BRIDGE_DIR, "step2_dispatch.R"))
source(file.path(BRIDGE_DIR, "step6_plot.R"))
source(file.path(BRIDGE_DIR, "step6_drdid.R"))
source(file.path(BRIDGE_DIR, "step6_report.R"))

# ## Response helpers

send_response <- function(resp) {
  tryCatch({
    json <- toJSON(resp, auto_unbox = TRUE, null = "null", na = "string",
                   force = TRUE, pretty = FALSE)
    cat(json, "\n", sep = "")
    flush(stdout())
  }, error = function(e) {
    # Fallback: send minimal error envelope if toJSON fails. Build via
    # toJSON() again (on a much simpler structure) so the fallback cannot
    # itself emit corrupt JSON via unescaped newlines / backslashes in the
    # original conditionMessage. If this fallback also fails, we print a
    # static last-resort envelope with no dynamic content.
    tryCatch({
      fallback <- list(
        id = resp$id %||% -1L,
        error = list(
          code = 98L,
          message = paste0("toJSON failed: ", conditionMessage(e))
        )
      )
      cat(toJSON(fallback, auto_unbox = TRUE, null = "null", na = "string",
                 force = TRUE, pretty = FALSE), "\n", sep = "")
      flush(stdout())
    }, error = function(e2) {
      cat('{"id":-1,"error":{"code":99,"message":"toJSON fallback also failed"}}',
          "\n", sep = "")
      flush(stdout())
    })
  })
}

error_response <- function(id, code, message, suggestion = NULL, traceback = NULL) {
  resp <- list(id = id, error = list(code = code, message = message))
  if (!is.null(suggestion)) resp$error$suggestion <- suggestion
  if (!is.null(traceback)) resp$error$traceback <- traceback
  resp
}

limited_traceback <- function() {
  tb <- .traceback(max.lines = 1)
  if (is.null(tb) || length(tb) == 0) return(character())
  unlist(tb)
}

# ---- Dispatch-handler skeleton ---------------------------------------------
# Shared by every Phase-2 dispatch function. Captures cat() stdout and
# warnings into the RpcResponse envelope; the outer tryCatch in `dispatch()`
# converts uncaught R errors into error_response(). `body` is a quosure-free
# expression passed in via expr = bquote(...) — or more simply, a function.

run_with_capture <- function(id, body_fn, warning_filter = NULL) {
  warns <- character()
  result_holder <- NULL
  created_holder <- list()
  stdo <- character()

  # warning_filter: optional character vector of regexes. Warnings that match
  # ANY regex are suppressed (not surfaced in the response). Use for noise
  # that is not actionable, e.g. upstream-package deprecations.
  is_suppressed <- if (is.null(warning_filter) || length(warning_filter) == 0) {
    function(msg) FALSE
  } else {
    function(msg) any(vapply(warning_filter, function(pat) grepl(pat, msg, perl = TRUE),
                             logical(1)))
  }

  stdo <- utils::capture.output(
    withCallingHandlers(
      {
        out <- body_fn()
        result_holder  <- out$result
        created_holder <- out$objectsCreated %||% list()
      },
      warning = function(w) {
        msg <- conditionMessage(w)
        if (!is_suppressed(msg)) warns <<- c(warns, msg)
        invokeRestart("muffleWarning")
      }
    ),
    type = "output"
  )

  list(
    id             = id,
    result         = result_holder,
    objectsCreated = created_holder,
    warnings       = as.list(warns),
    stdout         = as.list(stdo)
  )
}

# ## Dispatch

dispatch <- function(req) {
  id <- req$id %||% -1L
  method <- req$method %||% ""
  params <- req$params %||% list()

  tryCatch(
    switch(method,
      "ping"                  = dispatch_ping(id, params),
      "persist"               = dispatch_persist(id, params),
      "restore"               = dispatch_restore(id, params),
      "list_objects"          = dispatch_list_objects(id, params),
      "drop_object"           = dispatch_drop_object(id, params),
      "load_panel"            = dispatch_load_panel(id, params),
      "check_panel"           = dispatch_check_panel(id, params),
      "profile_design"        = dispatch_profile_design(id, params),
      "plot_rollout"          = dispatch_plot_rollout(id, params),
      "recode_never_treated"  = dispatch_recode_never_treated(id, params),
      "estimate"              = dispatch_estimate(id, params),
      "compare_estimators"    = dispatch_compare_estimators(id, params),
      "extract_event_study"   = dispatch_extract_event_study(id, params),
      "honest_sensitivity"    = dispatch_honest_sensitivity(id, params),
      "power_analysis"        = dispatch_power_analysis(id, params),
      "diagnose_twfe"         = dispatch_diagnose_twfe(id, params),
      "plot"                  = dispatch_plot(id, params),
      "drdid"                 = dispatch_drdid(id, params),
      "report"                = dispatch_report(id, params),
      error_response(id, -1L, paste0("Unknown method: ", method))
    ),
    error = function(e) {
      error_response(id, 1L, conditionMessage(e),
                     traceback = paste(limited_traceback(), collapse = "\n"))
    }
  )
}

# ---- Method: ping -----------------------------------------------------------

dispatch_ping <- function(id, params) {
  echo <- params$echo %||% ""
  list(
    id = id,
    result = list(
      pong = TRUE,
      r_version = paste(R.version$major, R.version$minor, sep = "."),
      r_platform = R.version$platform,
      package_provenance = did_runtime_provenance(),
      jsonlite_version = as.character(packageVersion("jsonlite")),
      echo = echo,
      bridge_pid = Sys.getpid()
    )
  )
}

# ---- Method: persist / restore / list_objects -------------------------------
# Called by the TypeScript worker pool during recycle (persist on old worker,
# restore on the promoted standby). Each object is saved to
# <session_dir>/<handle_id>.rds; session_dir is created by WorkerPool.

dispatch_persist <- function(id, params) {
  session_dir <- params$session_dir
  if (is.null(session_dir)) {
    return(error_response(id, 10L, "persist: session_dir is required"))
  }
  if (!dir.exists(session_dir)) {
    dir.create(session_dir, recursive = TRUE, showWarnings = FALSE)
  }

  handles <- unlist(params$handles %||% list())
  persisted <- character()
  failed <- character()

  for (h in handles) {
    path <- file.path(session_dir, paste0(h, ".rds"))
    ok <- tryCatch({
      if (!has_object(h)) stop(sprintf("handle '%s' not in store", h), call. = FALSE)
      saveRDS(get_object(h), file = path)
      TRUE
    }, error = function(e) {
      FALSE
    })
    if (isTRUE(ok)) persisted <- c(persisted, h) else failed <- c(failed, h)
  }

  list(
    id = id,
    result = list(persisted = as.list(persisted), count = length(persisted)),
    persistFailed = as.list(failed)
  )
}

dispatch_restore <- function(id, params) {
  session_dir <- params$session_dir
  if (is.null(session_dir)) {
    return(error_response(id, 10L, "restore: session_dir is required"))
  }
  if (!dir.exists(session_dir)) {
    return(list(id = id, result = list(restored = list(), count = 0L)))
  }

  files <- list.files(session_dir, pattern = "\\.rds$", full.names = TRUE)
  restored <- character()
  removed_broken <- character()

  for (path in files) {
    handle_id <- sub("\\.rds$", "", basename(path))
    ok <- tryCatch({
      obj <- readRDS(path)
      store_object(handle_id, obj)
      TRUE
    }, error = function(e) FALSE)
    if (isTRUE(ok)) {
      restored <- c(restored, handle_id)
    } else {
      # A corrupt or unreadable .rds would otherwise re-fail on every future
      # recycle/restore cycle, keeping the zombie around indefinitely and
      # (via markHandlesLost) accumulating orphan handles across recoveries.
      # Remove the file now so the next restore skips it.
      if (file.exists(path)) try(file.remove(path), silent = TRUE)
      removed_broken <- c(removed_broken, handle_id)
    }
  }

  list(
    id = id,
    result = list(
      restored       = as.list(restored),
      count          = length(restored),
      removed_broken = as.list(removed_broken)
    )
  )
}

dispatch_list_objects <- function(id, params) {
  ids <- list_object_ids()
  list(
    id = id,
    result = list(objects = as.list(ids), count = length(ids))
  )
}

# ---- Method: drop_object -----------------------------------------------------
# Frees the R-side object behind a handle. Also deletes any persisted .rds so
# the next recycle/restore cycle does not resurrect it.

dispatch_drop_object <- function(id, params) {
  handle <- params$handle
  if (is.null(handle) || !nzchar(handle)) {
    return(error_response(id, 11L, "drop_object: `handle` is required"))
  }
  freed <- drop_object(handle)

  session_dir <- params$session_dir
  if (!is.null(session_dir) && nzchar(session_dir)) {
    path <- file.path(session_dir, paste0(handle, ".rds"))
    if (file.exists(path)) try(file.remove(path), silent = TRUE)
  }

  list(id = id, result = list(handle = handle, freed = isTRUE(freed)))
}

# ## Main loop

# Emit the ready sentinel so RWorker.ts knows sourcing finished and the main
# loop is about to accept stdin. id=0 is reserved for this handshake; tools
# never send id=0 over the wire.
send_response(list(id = 0L, result = list(ready = TRUE, pid = Sys.getpid())))

repeat {
  line <- tryCatch(readLines(con = "stdin", n = 1, warn = FALSE),
                   error = function(e) character(0))
  if (length(line) == 0) break  # stdin closed → exit cleanly
  if (nchar(line) == 0) next

  req <- tryCatch(
    fromJSON(line, simplifyVector = FALSE),
    error = function(e) NULL
  )

  if (is.null(req)) {
    send_response(error_response(-1L, 97L,
      paste0("Invalid JSON on stdin: ", substr(line, 1, 200))))
    next
  }

  resp <- dispatch(req)
  send_response(resp)
}
