# ## Contents
# - [Dispatch handler](#dispatch-handler)
#
# ============================================================================
# did-mcp — Step 1: did_plot_rollout
# ============================================================================
# Uses panelView to render (a) a treatment-rollout heatmap and (b) outcome
# trajectories by treatment status. Both panelview() call forms are
# byte-aligned with skill/references/did-step-1-treatment-structure.md:537-
# 540 and 554-558. The only wrapper code is the png()/dev.off() bracket that
# diverts panelView's graphics output to a file on disk.
# ============================================================================

plot_rollout_heatmap <- function(df, id_col, time_col, treat_col, outcome_col, plot_title) {
  # Byte-aligned panelview call — see skill lines 537-540.
  # Formula shape is `outcome ~ treat`; type="treat" ignores the LHS but the
  # LHS column must exist. For the rollout heatmap we only need any numeric
  # column on the LHS, so we use the outcome column when available.
  fml <- stats::as.formula(sprintf("%s ~ %s", outcome_col, treat_col))
  panelView::panelview(fml, data = df,
                       index = c(id_col, time_col),
                       type = "treat", by.timing = TRUE,
                       main = plot_title)
}

plot_outcome_trajectories <- function(df, id_col, time_col, treat_col, outcome_col, plot_title) {
  # Byte-aligned panelview call — see skill lines 554-558.
  fml <- stats::as.formula(sprintf("%s ~ %s", outcome_col, treat_col))
  panelView::panelview(fml, data = df,
                       index = c(id_col, time_col),
                       type = "outcome", by.group = TRUE,
                       main = plot_title)
}

# ---- Dispatch handler -------------------------------------------------------

# ## Dispatch handler
dispatch_plot_rollout <- function(id, params) {
  # Upstream panelView still uses deprecated ggplot2 APIs (size→linewidth,
  # element_rect size=, bare margin(t=...) length, unused position="identity").
  # These fire on every call and are not actionable by the user. Filter them
  # out of the surfaced warnings list — the deprecation is on panelView's side.
  panelview_noise <- c(
    "Using `size` aesthetic.*deprecated",
    "`size` argument of `element_rect\\(\\)`.*deprecated",
    "Arguments in `\\.\\.\\.` must be used\\.",
    "Problematic argument",
    "position = \"identity\"",
    "`t` should have length 1, not length",
    "Did you misspell an argument name",
    "The deprecated feature was likely used in the panelView package"
  )
  run_with_capture(id, function() {
    panel_id <- params$panel_id
    if (is.null(panel_id)) stop("plot_rollout: `panel_id` is required", call. = FALSE)

    plot_type <- params$plot_type %||% "both"
    if (!plot_type %in% c("rollout", "outcome", "both")) {
      stop(sprintf("plot_rollout: plot_type must be rollout/outcome/both (got '%s')", plot_type),
           call. = FALSE)
    }

    id_var           <- params$id_var
    time_var         <- params$time_var
    treat_timing_var <- params$treat_timing_var
    outcome_var      <- params$outcome_var
    if (is.null(id_var) || is.null(time_var) || is.null(treat_timing_var)) {
      stop("plot_rollout: id_var / time_var / treat_timing_var are required (read from panel handle's schema).",
           call. = FALSE)
    }
    if (plot_type != "rollout" && (is.null(outcome_var) || !nzchar(outcome_var))) {
      stop("plot_rollout: outcome_var is required for plot_type='outcome' or 'both'", call. = FALSE)
    }

    if (!requireNamespace("panelView", quietly = TRUE)) {
      stop("plot_rollout: panelView is not installed. Run mcp/r/install_packages.R.", call. = FALSE)
    }

    df <- get_object(panel_id)

    # Derive a binary treatment indicator from timing (skill line 534 recipe)
    # Coerce g to numeric so the comparison works whether it's stored as int/num.
    g <- suppressWarnings(as.numeric(df[[treat_timing_var]]))
    g[generated_never_treated_rows(df, treat_timing_var)] <- 0
    t_col <- suppressWarnings(as.numeric(df[[time_var]]))
    df$.did_treat <- ifelse(!is.na(g) & g > 0 & t_col >= g, 1L, 0L)
    treat_col <- ".did_treat"

    # For the rollout plot, we need any numeric column on the LHS of the formula.
    # Prefer the user's outcome_var; if absent, use the derived treat column.
    lhs_col <- if (!is.null(outcome_var) && nzchar(outcome_var)) outcome_var else treat_col

    width  <- params$width  %||% 10
    height <- params$height %||% 6
    base_title <- params$title %||% ""

    plots_dir <- file.path(tempdir(), "did-mcp-plots")
    if (!dir.exists(plots_dir)) dir.create(plots_dir, recursive = TRUE, showWarnings = FALSE)

    created <- list()
    result_plots <- list()

    render <- function(kind, handle_id, plot_title, fn) {
      path <- file.path(plots_dir, paste0(handle_id, ".png"))
      grDevices::png(filename = path, width = width, height = height,
                     units = "in", res = 150)
      ok <- tryCatch({
        p <- fn(df, id_var, time_var, treat_col, lhs_col, plot_title)
        if (inherits(p, "ggplot") || inherits(p, "gg")) print(p)
        TRUE
      }, error = function(e) {
        grDevices::dev.off()
        stop(sprintf("plot_rollout (%s): %s", kind, conditionMessage(e)), call. = FALSE)
      })
      grDevices::dev.off()

      sz <- if (file.exists(path)) as.numeric(file.info(path)$size) else 0

      # Register the handle in R's object_store so it survives persist/restore
      # across worker recycles. The stored value is a small metadata list, NOT
      # the bitmap (the PNG lives on disk and its path is what downstream tools
      # need). Without this, recycle's persist step would fail on "handle not
      # in store" and markHandlesLost would drop the TS handle too, silently
      # losing the plot reference.
      plot_info <- list(
        path      = path,
        kind      = kind,
        panel     = panel_id,
        created_at = Sys.time()
      )
      class(plot_info) <- c("plot_file", "list")
      store_object(handle_id, plot_info)

      list(
        handle_id = handle_id,
        path      = path,
        kind      = kind,
        sizeBytes = sz
      )
    }

    if (plot_type %in% c("rollout", "both")) {
      hid <- params$handle_id_rollout %||% stop("plot_rollout: handle_id_rollout is required for plot_type in {rollout, both}", call. = FALSE)
      rollout_title <- if (nzchar(base_title)) base_title else "Treatment Rollout"
      r <- render("rollout", hid, rollout_title, plot_rollout_heatmap)
      result_plots[[length(result_plots) + 1]] <- list(handle = r$handle_id, kind = r$kind, path = r$path)
      created[[length(created) + 1]] <- list(
        id        = r$handle_id,
        type      = "plot",
        rClass    = "plot_file",
        summary   = sprintf("plot (rollout heatmap, panel=%s): %s", panel_id, r$path),
        sizeBytes = r$sizeBytes,
        schema    = list(path = r$path, plot_kind = "rollout", panel = panel_id)
      )
    }

    if (plot_type %in% c("outcome", "both")) {
      hid <- params$handle_id_outcome %||% stop("plot_rollout: handle_id_outcome is required for plot_type in {outcome, both}", call. = FALSE)
      outcome_title <- if (nzchar(base_title)) base_title else "Outcome Trajectories: Treated vs Control"
      r <- render("outcome", hid, outcome_title, plot_outcome_trajectories)
      result_plots[[length(result_plots) + 1]] <- list(handle = r$handle_id, kind = r$kind, path = r$path)
      created[[length(created) + 1]] <- list(
        id        = r$handle_id,
        type      = "plot",
        rClass    = "plot_file",
        summary   = sprintf("plot (outcome trajectories, panel=%s): %s", panel_id, r$path),
        sizeBytes = r$sizeBytes,
        schema    = list(path = r$path, plot_kind = "outcome", panel = panel_id)
      )
    }

    list(
      result = list(
        panel     = panel_id,
        plot_type = plot_type,
        plots     = result_plots,
        plots_dir = plots_dir
      ),
      objectsCreated = created
    )
  }, warning_filter = panelview_noise)
}
