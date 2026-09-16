#!/usr/bin/env Rscript

# Installed R help, without loading package namespaces or running documentation.
# ## Contents
# - [Package provenance](#package-provenance)
# - [Help topics](#help-topics)
# - [Command line](#command-line)

# ## Package provenance
did_package_location <- function(package, lib.loc = NULL) {
  if (length(package) != 1L || is.na(package) ||
      !grepl("^[A-Za-z][A-Za-z0-9.]*$", package)) {
    stop("PACKAGE must be one R package name.", call. = FALSE)
  }
  path <- tryCatch(find.package(package, lib.loc = lib.loc, quiet = TRUE),
                   error = function(e) character())
  if (length(path) != 1L) {
    where <- if (is.null(lib.loc)) "the active R libraries" else
      paste(lib.loc, collapse = ", ")
    stop(sprintf("Package '%s' is not installed in %s.", package, where),
         call. = FALSE)
  }
  path <- normalizePath(path, mustWork = TRUE)
  description <- tryCatch(read.dcf(file.path(path, "DESCRIPTION")),
    error = function(e) stop(sprintf("Cannot read DESCRIPTION for '%s': %s",
                                     package, conditionMessage(e)), call. = FALSE))
  field <- function(key) {
    if (key %in% colnames(description)) unname(description[1L, key]) else NA_character_
  }
  if (!identical(field("Package"), package) || is.na(field("Version"))) {
    stop(sprintf("Invalid DESCRIPTION for '%s' in %s.", package, path), call. = FALSE)
  }
  list(package = package, version = field("Version"),
       library = dirname(path), packagePath = path, remoteSha = field("RemoteSha"),
       remoteType = field("RemoteType"), remoteRepo = field("RemoteRepo"),
       remoteRef = field("RemoteRef"), repository = field("Repository"),
       built = field("Built"))
}

# ## Help topics
did_rd_aliases <- function(rd) {
  aliases <- Filter(function(x) identical(attr(x, "Rd_tag"), "\\alias"), rd)
  unique(vapply(aliases, function(x) trimws(paste(unlist(x), collapse = "")), ""))
}

did_rd_text <- function(x) {
  if (identical(attr(x, "Rd_tag"), "\\Sexpr")) return("[dynamic Rd expression]")
  if (is.list(x)) return(paste(vapply(x, did_rd_text, ""), collapse = ""))
  paste(x, collapse = "")
}

did_rd_field <- function(rd, tag) {
  fields <- Filter(function(x) identical(attr(x, "Rd_tag"), tag), rd)
  trimws(gsub("[[:space:]]+", " ", paste(vapply(fields, did_rd_text, ""), collapse = " ")))
}

did_package_rd <- function(location) {
  tryCatch(tools::Rd_db(location$package, lib.loc = location$library),
    error = function(e) stop(sprintf(
      "Cannot read installed help for '%s' %s in %s: %s",
      location$package, location$version, location$packagePath, conditionMessage(e)),
      call. = FALSE))
}

did_rd_topic <- function(db, topic) {
  matches <- which(vapply(db, function(rd) {
    topic %in% c(did_rd_aliases(rd), did_rd_field(rd, "\\name"))
  }, logical(1)))
  if (!length(matches)) {
    stop(sprintf("Help topic '%s' was not found; omit TOPIC to list available topics.",
                 topic), call. = FALSE)
  }
  if (length(matches) > 1L) {
    stop(sprintf("Help topic '%s' is ambiguous: %s.", topic,
                 paste(names(db)[matches], collapse = ", ")), call. = FALSE)
  }
  db[[matches]]
}

did_render_rd <- function(rd, package = "") {
  # Empty stages leave all remaining Sexpr macros as text. Rd2txt prints
  # examples; it does not run them. No package namespace is needed here.
  capture.output(tools::Rd2txt(rd, package = package, stages = character(),
                              options = list(underline_titles = FALSE)))
}

did_package_doc <- function(package, topic = NULL, lib.loc = NULL) {
  location <- did_package_location(package, lib.loc)
  db <- did_package_rd(location)
  value <- function(x) if (is.na(x) || !nzchar(x)) "not recorded" else x
  provenance <- c(sprintf("Package: %s", location$package),
                  sprintf("Version: %s", location$version),
                  sprintf("Library: %s", location$library),
                  sprintf("Package path: %s", location$packagePath),
                  sprintf("Remote SHA: %s", value(location$remoteSha)),
                  "Source: installed R documentation", "")
  if (!is.null(topic)) {
    return(c(provenance, did_render_rd(did_rd_topic(db, topic), package)))
  }
  entries <- vapply(db, function(rd) {
    sprintf("%s\t%s\t%s", did_rd_field(rd, "\\name"),
            paste(did_rd_aliases(rd), collapse = ", "), did_rd_field(rd, "\\title"))
  }, "")
  c(provenance, "Help topics (topic\taliases\ttitle):", sort(unname(entries)))
}

# ## Command line
did_package_doc_args <- function(args) {
  if (identical(args, "--help")) return(list(help = TRUE))
  positional <- character()
  library <- NULL
  i <- 1L
  while (i <= length(args)) {
    arg <- args[[i]]
    if (arg == "--lib") {
      if (!is.null(library) || i == length(args) || startsWith(args[[i + 1L]], "--")) {
        stop("--lib requires one PATH and may appear only once.", call. = FALSE)
      }
      library <- args[[i + 1L]]
      if (!dir.exists(library)) stop(sprintf("Library does not exist: %s", library), call. = FALSE)
      i <- i + 2L
    } else if (startsWith(arg, "-")) {
      stop(sprintf("Unknown or misplaced option: %s. Use --help.", arg), call. = FALSE)
    } else {
      positional <- c(positional, arg)
      i <- i + 1L
    }
  }
  if (!length(positional) || length(positional) > 2L || any(!nzchar(positional))) {
    stop("Usage: Rscript package-doc.R PACKAGE [TOPIC] [--lib PATH]", call. = FALSE)
  }
  list(package = positional[[1L]], topic = if (length(positional) == 2L) positional[[2L]],
       lib.loc = library)
}

did_package_doc_main <- function(args = commandArgs(trailingOnly = TRUE)) {
  parsed <- did_package_doc_args(args)
  if (isTRUE(parsed$help)) {
    cat("Usage: Rscript package-doc.R PACKAGE [TOPIC] [--lib PATH]\n",
        "Omit TOPIC to list installed help topics. --lib selects one R library.\n",
        "Reads local help with version/path/SHA provenance; does not load the\n",
        "package, run examples, evaluate Rd expressions, or access the network.\n", sep = "")
  } else {
    writeLines(do.call(did_package_doc, parsed))
  }
  invisible(NULL)
}

if (sys.nframe() == 0L) {
  tryCatch(did_package_doc_main(), error = function(e) {
    cat("Error: ", conditionMessage(e), "\n", sep = "", file = stderr())
    quit(status = 1L)
  })
}
