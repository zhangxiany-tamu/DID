#!/usr/bin/env Rscript

# Offline tests; temporary fixture packages need only base R.
# ## Contents
# - [Test harness](#test-harness)
# - [Fixture packages](#fixture-packages)
# - [Lookup and provenance](#lookup-and-provenance)
# - [No evaluation or namespace loading](#no-evaluation-or-namespace-loading)
# - [Command line and failure cases](#command-line-and-failure-cases)

# ## Test harness
script_arg <- grep("^--file=", commandArgs(), value = TRUE)
script_path <- normalizePath(sub("^--file=", "", script_arg[[1L]]))
helper <- file.path(dirname(dirname(script_path)), "package-doc.R")
stopifnot(length(capture.output(source(helper))) == 0L)

expect_error <- function(expr, pattern) {
  message <- tryCatch({ force(expr); NULL }, error = conditionMessage)
  if (is.null(message) || !grepl(pattern, message, fixed = TRUE)) {
    stop(sprintf("Expected error containing '%s'; got: %s", pattern, message))
  }
}
contains <- function(lines, text) any(grepl(text, lines, fixed = TRUE))

run_tests <- function() {
  root <- tempfile("package doc tests ")
  dir.create(root)
  on.exit(unlink(root, recursive = TRUE), add = TRUE)
  old_libs <- .libPaths()
  on.exit(.libPaths(old_libs), add = TRUE)
  old_sentinel <- Sys.getenv("DID_PACKAGE_DOC_SENTINEL", unset = NA_character_)
  on.exit(if (is.na(old_sentinel)) Sys.unsetenv("DID_PACKAGE_DOC_SENTINEL") else
    Sys.setenv(DID_PACKAGE_DOC_SENTINEL = old_sentinel), add = TRUE)
  sentinel <- file.path(root, "documentation-was-executed")
  Sys.setenv(DID_PACKAGE_DOC_SENTINEL = sentinel)

  # ## Fixture packages
  package <- "didDocFixture"
  build_fixture <- function(version, sha, directory) {
    library <- file.path(root, directory)
    source_dir <- file.path(root, paste0("source-", version), package)
    dir.create(library)
    dir.create(file.path(source_dir, "R"), recursive = TRUE)
    dir.create(file.path(source_dir, "man"))
    writeLines(c(paste("Package:", package), paste("Version:", version),
      "Title: Documentation Lookup Test Fixture",
      "Description: Small offline fixture for help lookup tests.",
      "Authors@R: person('Test', 'Author', email='test@example.com', role=c('aut','cre'))",
      "License: MIT", "Encoding: UTF-8", paste("RemoteSha:", sha),
      "RemoteType: github", "RemoteRepo: fixture"), file.path(source_dir, "DESCRIPTION"))
    writeLines("export(probe)", file.path(source_dir, "NAMESPACE"))
    writeLines(c("probe <- function(x = 1) x", ".onLoad <- function(libname, pkgname) {",
      "  marker <- Sys.getenv('DID_PACKAGE_DOC_SENTINEL')",
      "  if (nzchar(marker)) writeLines('namespace loaded', marker)",
      "}"), file.path(source_dir, "R", "probe.R"))
    writeLines(c("\\name{probe}", "\\alias{probe}", "\\alias{probe_alias}",
      paste0("\\title{Probe fixture version ", version, "}"),
      "\\description{Version-specific text. Dynamic content stays literal:",
      "\\Sexpr[stage=render]{writeLines('render expression ran', Sys.getenv('DID_PACKAGE_DOC_SENTINEL'))}}",
      "\\usage{probe(x = 1)}", "\\arguments{\\item{x}{A test value.}}",
      "\\examples{writeLines('example ran', Sys.getenv('DID_PACKAGE_DOC_SENTINEL'))}"),
      file.path(source_dir, "man", "probe.Rd"))
    writeLines(c("\\name{example_data}", "\\alias{example_data}", "\\docType{data}",
      "\\title{Example dataset}", "\\description{A dataset help topic.}"),
      file.path(source_dir, "man", "example_data.Rd"))
    log <- file.path(root, paste0("install-", version, ".log"))
    status <- system2(file.path(R.home("bin"), "R"),
      c("CMD", "INSTALL", "--no-test-load", "--no-byte-compile",
        shQuote(paste0("--library=", library)), shQuote(source_dir)), stdout = log, stderr = log)
    if (status != 0L) stop(paste(readLines(log), collapse = "\n"))
    library
  }
  lib_a <- build_fixture("1.0.0", "aaaaaaaa", "library A")
  lib_b <- build_fixture("2.0.0", "bbbbbbbb", "library B")
  stopifnot(!file.exists(sentinel))

  # ## Lookup and provenance
  .libPaths(c(lib_a, lib_b, old_libs))
  location <- did_package_location(package)
  stopifnot(identical(location$version, "1.0.0"),
            identical(location$remoteSha, "aaaaaaaa"),
            identical(location$library, normalizePath(lib_a)),
            identical(location$packagePath, normalizePath(file.path(lib_a, package))))
  alternate <- did_package_location(package, lib_b)
  stopifnot(identical(alternate$version, "2.0.0"),
            identical(alternate$remoteSha, "bbbbbbbb"))
  .libPaths(c(lib_b, lib_a, old_libs))
  stopifnot(identical(did_package_location(package)$version, "2.0.0"))
  listed <- did_package_doc(package, lib.loc = lib_a)
  stopifnot(contains(listed, "probe_alias"), contains(listed, "example_data"),
            contains(listed, "Remote SHA: aaaaaaaa"), contains(listed, "Version: 1.0.0"))
  canonical <- did_package_doc(package, "probe", lib_a)
  alias <- did_package_doc(package, "probe_alias", lib_a)
  stopifnot(identical(canonical, alias), contains(canonical, "Probe fixture version 1.0.0"),
            !contains(canonical, "\b"))
  alternate_doc <- did_package_doc(package, "probe", lib_b)
  stopifnot(contains(alternate_doc, "Version: 2.0.0"),
            contains(alternate_doc, "Probe fixture version 2.0.0"),
            contains(alternate_doc, "Remote SHA: bbbbbbbb"))
  expect_error(did_package_doc(package, "absent", lib_a), "was not found")
  db <- did_package_rd(location)
  stopifnot(identical(did_rd_aliases(db[["probe.Rd"]]), c("probe", "probe_alias")))
  duplicate <- list(first.Rd = db[["probe.Rd"]], second.Rd = db[["probe.Rd"]])
  expect_error(did_rd_topic(duplicate, "probe_alias"), "is ambiguous")

  # ## No evaluation or namespace loading
  stopifnot(contains(canonical, "writeLines('render expression ran'"),
            contains(canonical, "writeLines('example ran'"),
            !file.exists(sentinel), !package %in% loadedNamespaces())
  # Loading it deliberately afterward proves the sentinel fixture works.
  ns <- loadNamespace(package, lib.loc = lib_a)
  stopifnot(file.exists(sentinel))
  unlink(sentinel)
  # An explicit library must override even an already-loaded different version.
  stopifnot(identical(did_package_location(package)$version, "1.0.0"),
            identical(did_package_location(package, lib_b)$version, "2.0.0"),
            contains(did_package_doc(package, "probe", lib_b), "Probe fixture version 2.0.0"),
            !file.exists(sentinel))
  unloadNamespace(package)
  rm(ns)

  # ## Command line and failure cases
  cli <- function(args) {
    stdout <- tempfile(tmpdir = root)
    stderr <- tempfile(tmpdir = root)
    status <- suppressWarnings(system2(file.path(R.home("bin"), "Rscript"),
      c("--vanilla", shQuote(helper), vapply(args, shQuote, "")),
      stdout = stdout, stderr = stderr))
    list(status = status, output = readLines(stdout, warn = FALSE),
         error = readLines(stderr, warn = FALSE))
  }
  success <- cli(c(package, "probe_alias", "--lib", lib_b))
  stopifnot(success$status == 0L, contains(success$output, "Version: 2.0.0"),
            !file.exists(sentinel))
  stopifnot(cli("--help")$status == 0L)
  stopifnot(cli(c(package, "--lib", lib_a))$status == 0L)
  for (args in list(character(), c(package, "--unknown"), c(package, "--lib"),
                   c(package, "--lib", lib_a, "--lib", lib_b),
                   c(package, "a", "b"), c(package, "--lib", file.path(root, "missing")))) {
    stopifnot(cli(args)$status != 0L)
  }
  absent <- cli(c(package, "absent", "--lib", lib_a))
  stopifnot(absent$status != 0L, contains(absent$error, "was not found"))
  expect_error(did_package_location("../didDocFixture"), "one R package name")
  empty_lib <- file.path(root, "empty library")
  dir.create(empty_lib)
  missing <- cli(c(package, "--lib", empty_lib))
  stopifnot(missing$status != 0L, contains(missing$error, "is not installed"))
  # Damaged help in the selected library must not fall back to library B.
  help_file <- file.path(lib_a, package, "help", paste0(package, ".rdx"))
  writeLines("not an R serialization", help_file)
  corrupt <- cli(c(package, "probe", "--lib", lib_a))
  stopifnot(corrupt$status != 0L, contains(corrupt$error, "Cannot read installed help"),
            !contains(corrupt$output, "Version: 2.0.0"))
  unlink(help_file)
  missing_help <- cli(c(package, "probe", "--lib", lib_a))
  stopifnot(missing_help$status != 0L, contains(missing_help$error, "Cannot read installed help"))
  stopifnot(!file.exists(sentinel))
  cat("package-doc tests passed: aliases, provenance, library selection, no execution, CLI, and damaged help.\n")
}

run_tests()
