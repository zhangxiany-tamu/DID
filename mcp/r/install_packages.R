#!/usr/bin/env Rscript
# Installs missing packages using the shared registry. Existing versions are retained.
args <- commandArgs(trailingOnly = TRUE)
if ("--help" %in% args) {
  cat("Usage: Rscript mcp/r/install_packages.R [--dry-run] [--required-only]\n")
  quit(status = 0L)
}
if (any(!args %in% c("--dry-run", "--required-only")) || anyDuplicated(args)) {
  stop("Invalid arguments; use --help", call. = FALSE)
}
dry_run <- "--dry-run" %in% args
script <- sub("^--file=", "", grep("^--file=", commandArgs(), value = TRUE)[1L])
script <- gsub("~+~", " ", script, fixed = TRUE)
skill <- normalizePath(file.path(dirname(script), "..", "..", "skill"), mustWork = TRUE)
source(file.path(skill, "scripts", "package-status.R"))
options(rgl.useNULL = TRUE)
cran <- "https://cloud.r-project.org/"
if (!requireNamespace("jsonlite", quietly = TRUE)) {
  if (dry_run) stop("Install jsonlite to read the registry; dry-run installed nothing", call. = FALSE)
  install.packages("jsonlite", repos = cran)
}
packages <- did_read_registry(file.path(skill, "references", "package-registry.json"))
selected <- Filter(function(p) p$install == "required" ||
  (p$install == "optional" && !"--required-only" %in% args), packages)

install_one <- function(p) {
  if (requireNamespace(p$name, quietly = TRUE)) {
    cat(sprintf("[OK]   %-22s v%s\n", p$name, did_package_metadata(p$name)$version))
    return(TRUE)
  }
  if (dry_run) {
    cat(sprintf("[PLAN] %-22s %s (%s)\n", p$name, p$source, p$install))
    return(FALSE)
  }
  cat(sprintf("[INST] %-22s %s (%s)\n", p$name, p$source, p$install))
  tryCatch({
    if (p$source == "github") {
      if (!requireNamespace("remotes", quietly = TRUE)) install.packages("remotes", repos = cran)
      remotes::install_github(p$repo, quiet = TRUE, upgrade = "never", dependencies = NA)
    } else {
      repos <- if (p$source == "r-universe") c(p$repository, cran) else cran
      install.packages(p$name, repos = repos, quiet = TRUE,
                       dependencies = c("Depends", "Imports", "LinkingTo"))
    }
    ok <- requireNamespace(p$name, quietly = TRUE)
    if (!ok) cat(sprintf("[FAIL] %s is unavailable after installation\n", p$name))
    ok
  }, error = function(e) {
    cat(sprintf("[FAIL] %s: %s\n", p$name, conditionMessage(e)))
    FALSE
  })
}
cat(if (dry_run) "Package installation plan (no installations)\n" else "Install missing DID packages\n")
installed <- vapply(selected, install_one, logical(1))
required <- vapply(selected, function(p) p$install == "required", logical(1))
cat(sprintf("Required: %d / %d available\n", sum(installed[required]), sum(required)))
cat(sprintf("Optional: %d / %d available\n", sum(installed[!required]), sum(!required)))
manual <- vapply(Filter(function(p) p$install == "manual", packages), function(p) p$name, "")
cat(sprintf("Install only when needed: %s\n", paste(manual, collapse = ", ")))
if (!dry_run && any(!installed[required])) quit(status = 1L)
