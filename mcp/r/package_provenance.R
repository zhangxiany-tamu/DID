# Installed package identities from the worker's own R library/loaded namespaces.
PROVENANCE_SKILL <- normalizePath(file.path(BRIDGE_DIR, "..", "..", "skill"), mustWork = FALSE)
PROVENANCE_REGISTRY <- file.path(PROVENANCE_SKILL, "references", "package-registry.json")
PROVENANCE_SCRIPT <- file.path(PROVENANCE_SKILL, "scripts", "package-status.R")
if (file.exists(PROVENANCE_SCRIPT)) source(PROVENANCE_SCRIPT)

did_runtime_provenance <- function() {
  if (!file.exists(PROVENANCE_REGISTRY) || !exists("did_package_inventory", mode = "function")) {
    return(list(status = "unavailable", reason = "Companion skill package registry not found"))
  }
  tryCatch(did_package_inventory(PROVENANCE_REGISTRY), error = function(e) {
    list(status = "unavailable", reason = conditionMessage(e))
  })
}

did_estimator_provenance <- function(estimator) {
  if (!file.exists(PROVENANCE_REGISTRY) || !exists("did_read_registry", mode = "function")) {
    return(list(status = "unavailable", reason = "Companion skill package registry not found"))
  }
  tryCatch({
    entries <- Filter(function(p) estimator %in% unlist(p$estimators), did_read_registry(PROVENANCE_REGISTRY))
    lapply(entries, function(p) did_package_metadata(p$name))
  }, error = function(e) list(status = "unavailable", reason = conditionMessage(e)))
}
