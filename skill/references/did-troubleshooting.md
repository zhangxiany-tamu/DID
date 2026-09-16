# DiD Troubleshooting Guide

## Contents
- [1. did (Callaway-Sant'Anna)](#1-did-callaway-santanna)
- [2. fixest (Sun-Abraham)](#2-fixest-sun-abraham)
- [3. didimputation (BJS)](#3-didimputation-bjs)
- [4. did2s (Gardner)](#4-did2s-gardner)
- [5. HonestDiD](#5-honestdid)
- [6. staggered](#6-staggered)
- [7. bacondecomp](#7-bacondecomp)
- [8. Cross-Package Version Incompatibilities](#8-cross-package-version-incompatibilities)
- [9. General Defensive Wrapper](#9-general-defensive-wrapper)
- [10. Installation Failures](#10-installation-failures)

Common runtime errors and their fixes, organized by package. Check here when an estimator throws an error or produces unexpected results.

---

## 1. did (Callaway-Sant'Anna)

### "singular matrix due to not enough control units"

```
Error: An unexpected error occurred, normally associated with a singular matrix
due to not enough control units.
```

**Cause**: A treatment cohort has too few comparison units in some time period (often when using `control_group = "nevertreated"` with few never-treated units).

**Fixes**:
```r
# Fix 1: Switch to not-yet-treated as control group
cs_out <- att_gt(..., control_group = "notyettreated")

# Fix 2: Use a simpler estimation method (regression instead of doubly robust)
cs_out <- att_gt(..., est_method = "reg")

# Fix 3: Remove covariates that may cause collinearity
cs_out <- att_gt(..., xformla = NULL)
```

### "never treated group is too small"

```
Error: never treated group is too small, try setting control_group="notyettreated"
```

**Cause**: Too few never-treated units to serve as a comparison group.

**Fix**: Exactly what the message says:
```r
cs_out <- att_gt(..., control_group = "notyettreated")
```

### "data[, tname] must be numeric" / "data[, gname] must be numeric"

**Cause**: Time or group variable is character or factor instead of numeric.

**Fix**:
```r
df$year <- as.numeric(df$year)
df$first_treat <- as.numeric(as.character(df$first_treat))  # as.character first if factor
```

### "No valid groups"

```
Error: No valid groups. The variable in 'gname' should be expressed as the time
a unit is first treated (0 if never-treated).
```

**Cause**: The `gname` variable doesn't contain valid treatment timing values, or never-treated units are coded as `NA`/`Inf` instead of `0`.

**Fix**:
```r
df$first_treat[is.na(df$first_treat)] <- 0
df$first_treat[is.infinite(df$first_treat)] <- 0
```

### "All observations dropped" (balanced panel conversion)

```
Error: All observations dropped to converted data to balanced panel.
Consider setting `panel = FALSE' and/or revisit 'idname'.
```

**Cause**: The `idname` doesn't uniquely identify units, or extreme missingness makes balancing impossible.

**Fixes**:
```r
# Check: does idname uniquely identify units?
any(duplicated(df[, c("unit_id", "year")]))  # should be FALSE

# Fix 1: Use repeated cross-section mode
cs_out <- att_gt(..., panel = FALSE)

# Fix 2: Manually balance the panel first
library(tidyr)
df_balanced <- df %>% complete(unit_id, year)
```

### Missing values in att_gt results

`att_gt()` returns `NA` for group-time cells where estimation failed (e.g., insufficient observations). These propagate to `aggte()`.

**Fix**:
```r
cs_agg <- aggte(cs_out, type = "dynamic", na.rm = TRUE)
```

### Singular covariance matrix in downstream analysis

```
Not returning pre-test Wald statistic due to singular covariance matrix
```

**Cause**: Some cohort-time cells produce zero or NA standard errors (usually from singleton cohorts), making `diag(se^2)` singular. This affects pretrends power analysis and HonestDiD sensitivity.

**Diagnosis**:
```r
cs_es <- aggte(cs_out, type = "dynamic")
# Check for zero/NA SEs
cat("Zero SEs:", sum(cs_es$se == 0, na.rm = TRUE), "\n")
cat("NA SEs:", sum(is.na(cs_es$se)), "\n")
```

**Fix**: Filter to valid periods before constructing the covariance matrix:
```r
valid <- !is.na(cs_es$se) & cs_es$se > 0
betahat <- cs_es$att.egt[valid]
tVec <- as.numeric(cs_es$egt[valid])
sigma <- diag(cs_es$se[valid]^2)
```

If many periods are dropped, consider merging small treatment cohorts before estimation.

---

## 2. fixest (Sun-Abraham)

### sunab() silently drops cohorts

`sunab()` will silently drop cohorts that have no variation or insufficient observations. You may get fewer coefficients than expected.

**Diagnosis**:
```r
sa_out <- feols(y ~ sunab(cohort, period) | id + time, data = df, cluster = ~id)

# Check which cohorts were used
cat("Coefficients returned:", length(coef(sa_out)), "\n")
cat("Expected cohorts:", length(unique(df$cohort[df$cohort > 0])), "\n")

# Check for notes about dropped observations
summary(sa_out)  # look for "NOTE:" lines in output
```

**Fix**: Ensure each cohort has enough treated and pre-treatment observations. Merge small cohorts if needed:
```r
# Merge cohorts with < 10 units into neighboring cohort
cohort_sizes <- table(df$cohort[df$cohort > 0])
small_cohorts <- as.numeric(names(cohort_sizes[cohort_sizes < 10]))
for (sc in small_cohorts) {
  nearest <- as.numeric(names(cohort_sizes))[which.min(abs(as.numeric(names(cohort_sizes)) - sc))]
  if (nearest != sc) df$cohort[df$cohort == sc] <- nearest
}
```

### "sunab" not found

```
Error in sunab(cohort, period) : could not find function "sunab"
```

**Cause**: Old version of fixest that predates `sunab()`.

**Fix**:
```r
install.packages("fixest")  # update to latest CRAN version
# Verify:
packageVersion("fixest")  # should be >= 0.10.0
```

### feols() drops observations ("NOTE: x observations removed because of NA values")

```
NOTE: x observations removed because of NA values.
```

**Most common cause with sunab()**: Never-treated units coded as `NA` in the cohort variable. `sunab()` drops all rows where the cohort variable is `NA`, silently losing all never-treated observations.

**Fix**: Convert never-treated units to `Inf` before calling `feols()`:
```r
df$cohort[is.na(df$cohort)] <- Inf
sa_out <- feols(y ~ sunab(cohort, period) | id + time, data = df, cluster = ~id)
```

**Other causes**: `NA` values in the outcome variable or other regressors. Check with:
```r
sum(is.na(df$outcome))  # NAs in outcome
sum(is.na(df$cohort))   # NAs in cohort (should be 0 after Inf conversion)
```

### feols() convergence warnings

Fixed-effects convergence issues with large datasets.

**Diagnosis and fix**:
```r
# Check convergence
check_conv_feols(sa_out)

# If convergence is poor, increase iterations
sa_out <- feols(..., demeaning_algo = demeaning_algo(iter = 10000))
```

### VCOV not positive semi-definite

```
The VCOV matrix is not positive semi-definite and was 'fixed' (see ?vcov)
```

**Cause**: Small or singleton treatment cohorts produce near-collinear regressors. fixest replaces negative eigenvalues with zero, but this "fix" means some SEs may be exactly 0.000 and the covariance matrix is unreliable for downstream analysis (HonestDiD, pretrends).

**Diagnosis**:
```r
# Check cohort sizes
cohort_sizes <- table(df$cohort[!duplicated(df$unit_id) & df$cohort > 0])
print(cohort_sizes)  # look for cohorts with < 5 units
```

**Fixes**:
```r
# Fix 1: Merge small cohorts into neighboring ones
small <- as.numeric(names(cohort_sizes[cohort_sizes < 5]))
for (sc in small) {
  nearest <- as.numeric(names(cohort_sizes))[which.min(abs(as.numeric(names(cohort_sizes)) - sc))]
  if (nearest != sc) df$cohort[df$cohort == sc] <- nearest
}

# Fix 2: Restrict event window to reduce rank deficiency
iplot(sa_out, xlim = c(-10, 15))

# Fix 3: Use heteroskedasticity-robust instead of cluster-robust SEs
vcov(sa_out, "hetero")

# Fix 4: Switch to CS (did) — handles small cohorts more gracefully
cs_out <- att_gt(yname = "y", tname = "t", idname = "id",
                 gname = "g", data = df, control_group = "notyettreated")
```

---

## 3. didimputation (BJS)

### "data must be a data.table"

**Cause**: Passed a data.frame instead of data.table.

**Fix**:
```r
library(data.table)
dt <- as.data.table(df)
bjs_out <- did_imputation(data = dt, ...)
```

### Silent wrong results from unbalanced panel

`didimputation` does NOT error on unbalanced panels — it produces incorrect estimates silently.

**Diagnosis**:
```r
# Check balance BEFORE running BJS
obs_per_unit <- table(dt[[idname]])
n_periods <- length(unique(dt[[tname]]))
if (any(obs_per_unit != n_periods)) {
  warning(sprintf("%d of %d units are not fully observed. BJS requires balanced panels.",
                  sum(obs_per_unit != n_periods), length(obs_per_unit)))
}
```

**Fix**: Balance the panel first (see Step 3 `prepare_bjs_data()` helper).

### Never-treated coding issues

Use zero for BJS never-treated units; the package also documents NA. A finite future value creates artificial event times and can mark never-treated units as treated if the sample extends past that value. Normalize only units known to be never-treated; do not guess from an arbitrary future cohort.

**Fix**:
```r
g <- dt$first_treat
g[is.na(g) | g == 0 | is.infinite(g)] <- 0
dt$first_treat <- g
```

### "Pretrends not found in event_time"

**Cause**: The `pretrends` argument specifies periods that don't exist in the data's relative-time variable.

**Fix**: Check available event times before specifying pretrends:
```r
# Check what relative times exist
ever_treated <- !is.na(dt$first_treat) & is.finite(dt$first_treat) & dt$first_treat > 0
dt$rel_time <- ifelse(ever_treated, dt$year - dt$first_treat, -Inf)
table(dt$rel_time[ever_treated])

# Use only periods that exist
bjs_es <- did_imputation(..., horizon = TRUE, pretrends = -3:-1)  # adjust range to match data
```

---

## 4. did2s (Gardner)

### Missing treatment indicator

`did2s()` requires an explicit binary 0/1 `treat` column — it does NOT derive it from a timing variable.

```
Error in did2s(...) : object 'treat' not found
```

**Fix**:
```r
df$treat <- ifelse(!is.na(df$first_treat) & df$first_treat > 0 &
                   df$year >= df$first_treat, 1, 0)
```

### First stage uses wrong fixed effects

Using cluster-level instead of unit-level FE in the first stage is a common mistake that produces wrong estimates without an error.

**Wrong**:
```r
did2s(..., first_stage = ~ 0 | state + year)  # state is cluster, not unit
```

**Correct**:
```r
did2s(..., first_stage = ~ 0 | unit + year)   # unit is the panel identifier
```

---

## 5. HonestDiD

### "matrix sigma not numerically positive semi-definite"

```
Warning: matrix sigma not numerically positive semi-definite
(smallest eigenvalue was -1.23e-15)
```

**Cause**: Floating-point imprecision in the covariance matrix, especially when extracted from bootstrapped standard errors.

**Fixes**:
```r
# Fix 1: Force symmetry and positive semi-definiteness
sigma_sym <- (sigma + t(sigma)) / 2
eig <- eigen(sigma_sym)
eig$values[eig$values < 0] <- 0
sigma_fixed <- eig$vectors %*% diag(eig$values) %*% t(eig$vectors)

# Fix 2: If using CS (did package), use diagonal approx from SEs
sigma_diag <- diag(es$se^2)
```

### "Solver did not find an optimum"

**Cause**: The optimization problem is infeasible for the given `Mbar` value — typically when `Mbar` is very small and the covariance matrix is poorly conditioned.

**Fixes**:
```r
# Fix 1: Use a coarser grid of Mbar values
results <- createSensitivityResults_relativeMagnitudes(
  ..., Mbarvec = seq(0.5, 2, by = 0.5))  # avoid very small values like 0.01

# Fix 2: Reduce the number of post periods (analyze one at a time)
results <- createSensitivityResults_relativeMagnitudes(
  ..., numPostPeriods = 1, l_vec = basisVector(1, numPostPeriods))
```

### "betahat and sigma were non-conformable"

```
Error: betahat (5 by 1) and sigma (7 by 7) were non-conformable
```

**Cause**: The coefficient vector and covariance matrix have different dimensions — usually because the base period (-1) wasn't excluded, or pre/post counts are wrong.

**Fix**: Use the extraction helper from Step 5:
```r
# Exclude the base period (t = -1) from both betahat and sigma
keep <- which(tVec != -1)  # remove base period
beta_sub <- betahat[keep]
sigma_sub <- sigma[keep, keep]

numPrePeriods <- sum(tVec[keep] < 0)
numPostPeriods <- sum(tVec[keep] >= 0)
```

### "betahat and pre + post periods were non-conformable"

**Cause**: `numPrePeriods + numPostPeriods` doesn't equal `length(betahat)`.

**Fix**: Double-check your period counts:
```r
cat(sprintf("betahat length: %d\n", length(beta_sub)))
cat(sprintf("numPrePeriods: %d, numPostPeriods: %d, sum: %d\n",
            numPrePeriods, numPostPeriods, numPrePeriods + numPostPeriods))
# These must be equal
```

### "CI is open at one of the endpoints; CI length may not be accurate"

```
Warning: CI is open at one of the endpoints; CI length may not be accurate
```

**Cause**: HonestDiD's optimization solver did not converge to a finite confidence interval endpoint. This typically occurs when:
- The covariance matrix is diagonal (from CS `diag(se^2)` approximation) and poorly conditioned
- `Mbar` values are very small, making the feasible set tight
- Large pre-treatment violations make the optimization problem difficult

**Diagnosis**: Check which `Mbar` values produce the warning:
```r
# Run with finer grid and inspect which entries have Inf endpoints
results <- createSensitivityResults_relativeMagnitudes(
  betahat = beta_sub, sigma = sigma_sub,
  numPrePeriods = numPre, numPostPeriods = numPost,
  Mbarvec = seq(0.5, 2, by = 0.5))
print(results)
# Look for rows where lb = -Inf or ub = Inf
```

**Fixes**:
```r
# Fix 1: Use a coarser Mbar grid (skip very small values)
results <- createSensitivityResults_relativeMagnitudes(
  ..., Mbarvec = seq(0.5, 2, by = 0.5))

# Fix 2: Restrict to near pre-periods (reduces max violation baseline)
# See "Pre-Period Selection for HonestDiD" in did-step-5-sensitivity-inference.md

# Fix 3: Use SA or did2s with its full, matched event-study covariance
# Full covariance preserves cross-period dependence; still check conditioning

# Fix 4: Regularize sigma (add small diagonal perturbation)
sigma_reg <- sigma_sub + diag(1e-6, nrow(sigma_sub))
```

**Interpretation**: When the warning appears, the reported CI length is a **lower bound** — the true robust CI may be wider. Focus on `Mbar` values that produce finite endpoints. If all entries have open endpoints, the data may not support meaningful sensitivity bounds; report this limitation explicitly.

**Local validation note (2026-04-09)**: This warning was reproduced on the `fixest::base_stagg` workflow with `HonestDiD` 0.2.6. The function still returned finite results for the tested `Mbar` values, but no package-version-specific fix was confirmed in this pass.

---

## 6. staggered

### Never-treated coding

```r
# Wrong: staggered will error or give wrong results with 0 or NA
df$first_treat[is.na(df$first_treat)] <- 0  # WRONG for staggered

# Correct: staggered requires Inf for never-treated
df$first_treat[is.na(df$first_treat) | df$first_treat == 0] <- Inf
```

---

## 7. bacondecomp

### Treatment variable is not binary

`bacon()` requires a binary 0/1 treatment indicator, not a timing variable.

**Wrong**:
```r
bacon(outcome ~ first_treat, ...)  # first_treat is timing (e.g., 2004, 2006)
```

**Correct**:
```r
df$post <- ifelse(!is.na(df$first_treat) & df$first_treat > 0 &
                  df$year >= df$first_treat, 1, 0)
bacon(outcome ~ post, data = df, id_var = "unit_id", time_var = "year")
```

### Treatment reversals

`bacondecomp` is designed for absorbing treatment only. If units revert, use the monotonicity check from Step 1 (`profile_did_design()`) to detect reversals and route to DIDmultiplegt instead.

---

## 8. Cross-Package Version Incompatibilities

### fixest version required by did2s / didimputation

Both `did2s` and `didimputation` depend on `fixest` internally. If `fixest` is too old, they may fail with obscure errors.

**Fix**:
```r
install.packages("fixest")  # always update fixest first
packageVersion("fixest")    # verify >= 0.10.0
```

### HonestDiD dependency on OSQP/ROI

HonestDiD uses optimization solvers that may fail to install on some systems.

**Fix**:
```r
install.packages("osqp")     # quadratic programming solver
install.packages("ROI")      # optimization infrastructure
install.packages("ROI.plugin.osqp")
# Then install HonestDiD (now on CRAN)
install.packages("HonestDiD")
```

---

## 9. General Defensive Wrapper

Use this wrapper to run any estimator with error capture:

```r
safe_did_estimate <- function(expr, method_name) {
  result <- tryCatch(
    expr,
    error = function(e) {
      message(sprintf("[%s] ERROR: %s", method_name, e$message))
      NULL
    },
    warning = function(w) {
      message(sprintf("[%s] WARNING: %s", method_name, w$message))
      suppressWarnings(expr)
    }
  )
  result
}

# Usage:
cs_out <- safe_did_estimate(
  att_gt(yname = "y", tname = "t", idname = "id", gname = "g",
         data = df, control_group = "notyettreated"),
  "Callaway-Sant'Anna"
)
```

---

## 10. Installation Failures

These cover package installation and loading problems, especially on macOS with Homebrew R (Apple Silicon). For runtime errors, see Sections 1–9 above.

### 10.1 macOS Homebrew R: C++ compilation failures

**Symptom**: Installing packages with C++ code (e.g., `sass`, `rgl`, `RcppArmadillo` dependents) fails with:

```
fatal error: 'vector' file not found
```

or similar missing standard library header errors.

**Cause**: `~/.R/Makevars` sets `CXX=g++-15` (or another GCC version). GCC on macOS cannot find the `libc++` headers that R was built against.

**Fix**: Set C++ compilers to `clang++` in `~/.R/Makevars`. A working template for Apple Silicon Homebrew R:

```makefile
# ~/.R/Makevars for Homebrew R on Apple Silicon
# Use clang++ for C++ (required for libc++ compatibility)
CXX    = clang++
CXX11  = clang++
CXX14  = clang++
CXX17  = clang++
CXX20  = clang++

# Use gfortran for Fortran (from gcc formula)
FC     = /opt/homebrew/bin/gfortran
F77    = /opt/homebrew/bin/gfortran
FLIBS  = -L/opt/homebrew/lib/gcc/current -lgfortran -lquadmath -lm
```

After editing, restart R and retry the install.

### 10.2 macOS Homebrew R: `libc++.1.dylib` not found at runtime

**Symptom**: A package installs successfully but fails when loaded:

```
Error: package or namespace load failed for 'rgl':
 .onLoad failed, ...
 dlopen(...rgl.so...): Library not loaded: @rpath/libc++.1.dylib
```

**Cause**: The compiled `.so` file references `@rpath/libc++.1.dylib`, but R's lib directory doesn't contain it. This affects `rgl` and any package linked against `libc++`.

**Fix**: Symlink LLVM's `libc++` into R's lib directory:

```bash
# Find your R lib directory
R_LIB=$(Rscript -e "cat(R.home('lib'))")
# Find your LLVM libc++ (adjust version as needed)
LLVM_LIBCXX=$(find /opt/homebrew/Cellar/llvm -name "libc++.1.dylib" | head -1)
# Create the symlink
ln -sf "$LLVM_LIBCXX" "$R_LIB/libc++.1.dylib"
```

Verify: `library(rgl)` should load without errors.

### 10.3 DIDmultiplegtDYN: polars/Rust dependency

**Symptom**: Installing `DIDmultiplegtDYN` (v2.3.0+) fails with:

```
ERROR: dependency 'polars' is not available
```

or `polars` install fails with:

```
error: could not find `Cargo.toml`
```

**Cause**: DIDmultiplegtDYN v2.3.0 depends on `polars`, a Rust-based data frame library. `polars` requires the Rust toolchain to compile and is not on CRAN.

**Fix** (in order):

```bash
# Step 1: Install Rust (if not already installed)
brew install rust
# Verify: rustc --version && cargo --version
```

```r
# Step 2: Install polars from r-universe
install.packages("polars", repos = "https://community.r-multiverse.org")

# Step 3: Install DIDmultiplegtDYN
install.packages("DIDmultiplegtDYN")
```

### 10.4 DIDmultiplegtDYN: `pl` not found namespace bug

**Symptom**: `DIDmultiplegtDYN` loads but calling `did_multiplegt_dyn()` errors with:

```
Error in ... : object 'pl' not found
```

**Cause**: DIDmultiplegtDYN v2.3.0 references the `pl` object (polars global constructor) in lazy-evaluation contexts without properly importing it into its namespace. The `pl` object only exists in the search path after `library(polars)` is called.

**Fix**: Always load `polars` before loading `DIDmultiplegtDYN` or `DIDmultiplegt`:

```r
library(polars)           # makes `pl` available in the search path
library(DIDmultiplegtDYN) # now finds `pl` during lazy evaluation

# Same applies to the wrapper package
library(polars)
library(DIDmultiplegt)
```

This is a known upstream bug. Check future releases of DIDmultiplegtDYN to see if it has been fixed.

### 10.5 General: identifying missing system dependencies

When `install.packages()` fails, the error is often buried in verbose output. To diagnose:

```r
# Re-run the install and capture the full log
install.packages("pkgname", type = "source", INSTALL_opts = "--no-multiarch")
# Then scroll up to find the FIRST error (not the last "installation failed" line)
```

**Common macOS system dependencies** (install via Homebrew):

| Dependency | Needed by | Install |
|------------|-----------|---------|
| Rust/cargo | polars | `brew install rust` |
| LLVM/clang | C++ packages | `brew install llvm` |
| gfortran | Fortran packages | `brew install gcc` |
| cmake | some compiled packages | `brew install cmake` |

**Tip**: If the error mentions a missing `-l<library>` flag (e.g., `-lgsl`), search Homebrew: `brew search gsl` then `brew install gsl`.

### 10.6 macOS Homebrew R: Xcode Command Line Tools / SDK not found

**Symptom**: Package compilation fails with errors such as:

```
xcrun: error: invalid active developer path
clang++: error: SDK "macosx" cannot be located
fatal error: 'cmath' file not found
```

**Cause**: The Xcode Command Line Tools are missing, broken, or out of sync after a macOS update. Homebrew R can find `clang++`, but the compiler cannot find the macOS SDK headers.

**Fix**:

```bash
# Install or repair the command line tools
xcode-select --install

# If tools are already installed but broken, point xcode-select at them
sudo xcode-select --switch /Library/Developer/CommandLineTools
```

Then verify:

```bash
xcrun --show-sdk-path
clang++ --version
```

If `xcrun --show-sdk-path` fails, fix this before retrying any R package install.

### 10.7 Homebrew tools installed in shell but not visible inside R

**Symptom**: `cargo`, `pkg-config`, `clang++`, or `gfortran` work in Terminal, but R still says they are missing during `install.packages()`.

**Cause**: R may be launched from an environment with a shorter `PATH` than your interactive shell. This is common when RStudio or another GUI app does not inherit your shell startup files.

**Diagnosis**:

```r
Sys.which(c("cargo", "pkg-config", "clang++", "gfortran"))
Sys.getenv("PATH")
```

If these return empty strings even though the tools work in Terminal, R cannot see your Homebrew binaries.

**Fix**: Add Homebrew tool locations to `~/.Renviron` so R sees them consistently:

```sh
PATH=/opt/homebrew/bin:/opt/homebrew/opt/llvm/bin:${PATH}
```

Then restart R and verify with `Sys.which(...)` again before retrying `polars`, `DIDmultiplegtDYN`, or other compiled packages.

### 10.8 DCDH packages fail to load because `rgl` wants OpenGL

**Symptom**: `library(DIDmultiplegt)` or `library(DIDmultiplegtDYN)` fails during load with messages such as:

```r
package or namespace load failed for 'DIDmultiplegtDYN':
 .onLoad failed in loadNamespace() for 'rgl', details:
  call: rgl.init(initValue, onlyNULL)
  error: OpenGL is not available in this build
```

or:

```r
Library not loaded: /opt/X11/lib/libGLU.1.dylib
```

**Cause**: The package imports `rgl`, and in headless or partially configured macOS environments `rgl` tries to initialize an OpenGL device during load. If no display/OpenGL stack is available, the package can fail before you ever reach the DiD function itself.

**Fast workaround**: Force `rgl` to use a NULL device before loading the package:

```r
options(rgl.useNULL = TRUE)
library(DIDmultiplegt)
# or
library(DIDmultiplegtDYN)
```

This was sufficient in the 2026-04-09 local validation pass.

**If you actually need interactive 3D support**: install the missing X11/OpenGL stack, typically via XQuartz on macOS. But for DiD estimation workflows, the NULL-device workaround is usually enough.
