#!/usr/bin/env Rscript
# Installed package metadata; optional API inspection runs only trusted installed namespaces.
# ## Contents
# - [Metadata](#metadata)
# - [API inspection](#api-inspection)
# - [Command line](#command-line)

# ## Metadata
did_package_metadata <- function(package) {
  path <- tryCatch(find.package(package, quiet = TRUE), error = function(e) character())
  if (!length(path)) return(list(name = package, installed = FALSE))
  path <- normalizePath(path)
  desc <- read.dcf(file.path(path, "DESCRIPTION"))
  field <- function(name) if (name %in% colnames(desc)) unname(desc[1, name]) else NULL
  loaded <- if (package %in% loadedNamespaces()) as.character(getNamespaceVersion(package)) else NULL
  list(name = package, installed = TRUE, version = if (is.null(loaded)) field("Version") else loaded,
       installedVersion = field("Version"), loadedVersion = loaded,
       remoteSha = field("RemoteSha"), library = dirname(path), path = path)
}

did_read_registry <- function(path) {
  if (!requireNamespace("jsonlite", quietly = TRUE))
    stop("Package status requires jsonlite. Package help itself needs only base R.", call. = FALSE)
  registry <- jsonlite::fromJSON(path, simplifyVector = FALSE)
  if (!identical(registry$schemaVersion, 1L) || !is.list(registry$packages))
    stop("Unsupported package registry format", call. = FALSE)
  registry$packages
}

# ## API inspection
did_inspect_api <- function(entry, metadata) {
  functions <- c(unlist(entry$functions), unlist(entry$internalFunctions))
  if (!length(functions) || !isTRUE(metadata$installed)) return(list())
  # Rd lookup needs no namespace; optional formals inspection may execute .onLoad.
  rd <- tryCatch(tools::Rd_db(entry$name, lib.loc = metadata$library),
                 error = function(e) NULL)
  aliases <- if (is.null(rd)) character() else unique(unlist(lapply(rd, function(page) {
    tags <- vapply(page, function(x) identical(attr(x, "Rd_tag"), "\\alias"), logical(1))
    vapply(page[tags], function(x) paste(as.character(x), collapse = ""), "")
  })))
  namespace <- tryCatch(suppressPackageStartupMessages(
    loadNamespace(entry$name, lib.loc = metadata$library)), error = function(e) e)
  result <- lapply(functions, function(name) {
    access <- if (name %in% unlist(entry$internalFunctions)) "internal" else "public"
    if (inherits(namespace, "error")) return(list(status = "unavailable", access = access,
      documented = name %in% aliases, error = conditionMessage(namespace)))
    exported <- name %in% getNamespaceExports(namespace)
    fun <- tryCatch(get(name, envir = namespace, inherits = FALSE), error = function(e) NULL)
    # Documented formula helpers (e.g. sunab) need not be namespace exports.
    if (!is.function(fun)) return(list(status = "missing", access = access,
                                       documented = name %in% aliases, exported = exported))
    list(status = "ok", access = access, documented = name %in% aliases,
         exported = exported, signature = paste(deparse(args(fun), width.cutoff = 500L), collapse = "\n"))
  })
  stats::setNames(result, functions)
}

did_package_inventory <- function(registry_path, api = FALSE) {
  entries <- did_read_registry(registry_path)
  packages <- lapply(entries, function(entry) {
    meta <- tryCatch(did_package_metadata(entry$name), error = function(e)
      list(name = entry$name, installed = FALSE, error = conditionMessage(e)))
    if (api) meta$api <- did_inspect_api(entry, meta)
    meta
  })
  list(schemaVersion = 1L, kind = "observed_environment", rVersion = as.character(getRversion()),
       rHome = R.home(), libraryPaths = as.list(.libPaths()), packages = packages)
}

# ## Command line
if (sys.nframe() == 0L) {
  tryCatch({
    arguments <- commandArgs(trailingOnly = TRUE)
    if (identical(arguments, "--help")) {
      cat("Usage: Rscript package-status.R [--api]\n",
          "JSON observations of installed packages; --api also inspects relevant signatures.\n",
          "Does not install packages or change validation records.\n", sep = "")
    } else {
      if (any(!arguments %in% "--api") || anyDuplicated(arguments))
        stop("Usage: Rscript package-status.R [--api]", call. = FALSE)
      file <- sub("^--file=", "", commandArgs()[grepl("^--file=", commandArgs())])[1]
      file <- gsub("~+~", " ", file, fixed = TRUE) # Rscript encodes spaces in --file.
      registry <- file.path(dirname(normalizePath(file)), "..", "references", "package-registry.json")
      options(rgl.useNULL = TRUE, useFancyQuotes = FALSE)
      result <- did_package_inventory(registry, api = "--api" %in% arguments)
      cat(jsonlite::toJSON(result, auto_unbox = TRUE, null = "null", pretty = TRUE), "\n")
    }
  }, error = function(e) {
    message(conditionMessage(e))
    quit(status = 1L)
  })
}
