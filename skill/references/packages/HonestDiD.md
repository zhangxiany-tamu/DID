## Package 'HonestDiD'

> **Historical reference snapshot.** The version recorded here belongs to this
> snapshot and may differ from the installed package or validation ledger. Use
> [installed help](HonestDiD_quick_start.md#installed-help-topics) for current
> arguments. This file remains available as a historical fallback.

July 21, 2025
Type Package
Title Robust Inference in Difference-in-Differences and Event Study
Designs
Version 0.2.6
Depends R (>= 3.6.0)
Imports stats, rlang, foreach ( $>=$ 1.4.7), matrixStats ( $>=0.63 .0$ ),
CVXR ( $>=0.99-6$ ), latex2exp ( $>=0.4 .0$ ), lpSolveAPI ( $>=$
5.5.2.0-17), Matrix ( $>=1.2-17$ ), pracma ( $>=2.2 .5$ ), purrr ( $>=$
0.3.4), tibble ( $>=1.3 .4$ ), dplyr ( $>=0.7 .4$ ), ggplot2 ( $>=$
2.2.1), Rglpk ( $>=0.6-4$ ), mvtnorm ( $>=1.1-3$ ), TruncatedNormal
( $>=1.0$ )
Suggests knitr, testthat, haven, lfe, rmarkdown
Description Provides functions to conduct robust inference in difference-indifferences and event study designs by implementing the methods developed in Rambachan \& Roth (2023) [doi:10.1093/restud/rdad018](doi:10.1093/restud/rdad018), ``A More Credible Approach to Parallel Trends" [Previously titled ``An Honest Approach..."]. Inference is conducted under a weaker version of the parallel trends assumption. Uniformly valid confidence sets are constructed based upon conditional confidence sets, fixed-length confidence sets and hybridized confidence sets.

Encoding UTF-8
LazyData true
License MIT + file LICENSE
NeedsCompilation no
Author Ashesh Rambachan [aut, cph, cre], Jonathan Roth [aut, cph]

Maintainer Ashesh Rambachan [ashesh.a.rambachan@gmail.com](mailto:ashesh.a.rambachan@gmail.com)
Repository CRAN
Date/Publication 2024-07-14 11:40:02 UTC

## Contents

- [basisVector](#basisvector)
- [BCdata_EventStudy](#bcdata_eventstudy)
- [computeConditionalCS_DeltaRM](#computeconditionalcs_deltarm)
- [computeConditionalCS_DeltaRMB](#computeconditionalcs_deltarmb)
- [computeConditionalCS_DeltaRMM](#computeconditionalcs_deltarmm)
- [computeConditionalCS_DeltaSD](#computeconditionalcs_deltasd)
- [computeConditionalCS_DeltaSDB](#computeconditionalcs_deltasdb)
- [computeConditionalCS_DeltaSDM](#computeconditionalcs_deltasdm)
- [computeConditionalCS_DeltaSDRM](#computeconditionalcs_deltasdrm)
- [computeConditionalCS_DeltaSDRMB](#computeconditionalcs_deltasdrmb)
- [computeConditionalCS_DeltaSDRMM](#computeconditionalcs_deltasdrmm)
- [constructOriginalCS](#constructoriginalcs)
- [createEventStudyPlot](#createeventstudyplot)
- [createSensitivityPlot](#createsensitivityplot)
- [createSensitivityPlot_relativeMagnitudes](#createsensitivityplot_relativemagnitudes)
- [createSensitivityResults](#createsensitivityresults)
- [createSensitivityResults_relativeMagnitudes](#createsensitivityresults_relativemagnitudes)
- [DeltaSD_lowerBound_Mpre](#deltasd_lowerbound_mpre)
- [DeltaSD_upperBound_Mpre](#deltasd_upperbound_mpre)
- [findOptimalFLCI](#findoptimalflci)
- [LWdata_EventStudy](#lwdata_eventstudy)
basisVector Creates a standard basis vector.

## Description

Creates a basis vector of length size with a 1 in the index position.

## Usage

\# Create the index basis vector in R^size
basisVector(index, size)

## Arguments

| index | The index at which there should be a one. Default equals one. |
| :--- | :--- |
| size | The length of the vector. Default equals one. |

## Value

Returns a basis vector of length size with a 1 in the index position.

## Examples

```
# Create the first basis vector in R^2
basisVector(index = 1, size = 2)
# Create the third basis vector in R^6
basisVector(index = 3, size = 6)
```

BCdata_EventStudy
Event study estimates from baseline event study specification on profits in Benzarti \& Carloni (2019). See discussion in Section 6.1 of Rambachan \& Roth (2021).

## Description

This list contains the event study estimates from baseline event study specification on profits in Benzarti \& Carloni (2019). See discussion in Section 6.1 of Rambachan \& Roth (2021).

## Format

A list, containing 7 objects:
Vector of estimated event study coefficients.
betahghna Estimated variance-covariance matrix.
timeVec Vector that contains the time periods associated with the event study coefficients.
referencePeriod Reference period that is normalized to zero.
prePeriodIndices Vector containing elements of timeVec that correspond to the pre-periods.
postPeriodIndices Vector containing elements of timeVec that correspond to the post-periods.
computeConditionalCS_DeltaRM
Computes conditional and hybridized confidence set for $\Delta=$ $\Delta^{\wedge} R M($ Mbar $)$.

## Description

Computes the conditional confidence set and hybridized confidence set for $\Delta=\Delta^{R M}($ Mbar $)$.

## Usage

```
computeConditionalCS_DeltaRM(betahat, sigma, numPrePeriods, numPostPeriods,
    l_vec = .basisVector(index = 1, size = numPostPeriods), Mbar = 0,
        alpha = 0.05, hybrid_flag = "LF", hybrid_kappa = alpha/10,
            returnLength = FALSE, postPeriodMomentsOnly = TRUE,
            gridPoints=10^3, grid.ub = NA, grid.lb = NA, seed = 0)
```

[^0]
## Value

If returnLength equals TRUE, function returns a scalar that equals the length of the confidence interval. If returnLength equals FALSE, function returns a dataframe with columns
grid Vector of grid values used to construct the confidence interval by test inversion.
accept Vector of zeros-ones associated with grid values, where one denotes a grid value that falls within the confidence interval and zero denotes a grid value that falls outside the confidence interval.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.
computeConditionalCS_DeltaRMB
Computes conditional and hybridized confidence set for Delta $=$ Delta^RMB (Mbar).

## Description

Computes the conditional confidence set and hybridized confidence set for Delta $=$ Delta $^{\text {RMB }}$ (Mbar). The set Delta ${ }^{\text {RMB }}$ (Mbar) adds an additional sign restriction to Delta ${ }^{\text {RM }}$ (Mbar) that restricts the sign of the bias to be either positive (delta $\geq 0$ ) or negative (delta $\leq 0$ ).

## Usage

```
computeConditionalCS_DeltaRMB(betahat, sigma, numPrePeriods, numPostPeriods,
        l_vec = .basisVector(index = 1,
            size = numPostPeriods),
        Mbar = 0, alpha = 0.05, hybrid_flag = "LF",
        hybrid_kappa = alpha/10, returnLength = FALSE,
    biasDirection = "positive", postPeriodMomentsOnly = TRUE,
        gridPoints=10^3, grid.ub = NA, grid.lb = NA, seed = 0)
```


## Arguments

| betahat | Vector of estimated event study coefficients. |
| :--- | :--- |
| sigma | Covariance matrix of event study coefficients. |
| numPrePeriods | Number of pre-periods. |
| numPostPeriods | Number of post-periods. |
| l_vec | Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=1 \_$vec'tau. Default equals to first basis vector, $(1,0, \ldots, 0)$ |

Mbar Tuning parameter Mbar for $\Delta^{R M}(M b a r)$ that governs how different the maximal pre-period violation of parallel trends may be from the post-period differential trend. Default sets Mbar = 0. See Section 2.3.2 of Rambachan \& Roth (2021) for more details.
alpha Desired level of the confidence set. Default equals 0.05 (corresponding to $95 \%$ confidence interval)
hybrid_flag Flag for whether user wishes to compute a hybridized confidence set. "ARP" specifies the conditional confidence set "LF" specifies the conditional leastfavorable confidence set. The conditional FLCI hybrid confidence set is not available for $\Delta^{R M B}$ (Mbar) since the FLCI is infinite length for this choice of $\Delta$. See Section 3.3 and Section 5.3 of Rambachan \& Roth (2021) for details. Default equals "LF".
hybrid_kappa Desired first-stage size of hybridized confidence set. Only specify this value if the user wishes to compute a hybridized confidence set. Default equals alpha/10. If user specifies hybrid_flag = "ARP", set this value to NULL.
returnLength Logical value. If TRUE, function only returns the length of the robust confidence. If FALSE, function returns dataframe that contains a grid of possible parameter values and a vector of zeros and ones associated with each value in the grid (one denotes that the grid value lies in the confidence set and zero denotes that the grid value does not fall within the confidence set.) Default equals FALSE.
biasDirection Specifies direction of bias restriction. If "positive", bias is restricted to be positive, $\delta \geq 0$. If "negative", bias is restricted to be negative, $\delta \leq 0$. Default equals "positive".
postPeriodMomentsOnly
Logical value. If TRUE, function excludes moments for $\Delta^{R M B}$ (Mbar) that only include pre-period coefficients. Default equals TRUE.
gridPoints Number of grid points used in test inversion step. Default equals 1000.
grid.ub Upper bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA and sets grid upper bound to equal the upper bound of the identified set under parallel trends plus 20*standard deviation of the point estimate, l_vec'betahat.
grid.lb Lower bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA sets grid lower bound to equal the lower bound of the identified set under parallel trends minus 20*standard deviation of the point estimate, 1_vec'betahat.
seed Random seed for internal computations; included for reproducibility.

## Value

If returnLength equals TRUE, function returns a scalar that equals the length of the confidence interval. If returnLength equals FALSE, function returns a dataframe with columns
grid Vector of grid values used to construct the confidence interval by test inversion.
accept Vector of zeros-ones associated with grid values, where one denotes a grid value that falls within the confidence interval and zero denotes a grid value that falls outside the confidence interval.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.
computeConditionalCS_DeltaRMM
Computes conditional and hybridized confidence set for $\Delta=$ $\Delta^{\wedge} R M M(M b a r)$.

## Description

Computes the conditional confidence set and hybridized confidence set for $\Delta=\Delta^{R M M}(M b a r)$. The set $\Delta^{R M M}$ (Mbar) adds an additional shape restriction to $\Delta^{R M}$ (Mbar) that restricts the underlying trend to be monotone. It may either be increasing ( $\delta_{t} \geq \delta_{t-1}$ ) or decreasing ( $\delta_{t} \leq \delta_{t-1}$ ).

## Usage

```
computeConditionalCS_DeltaRMM(betahat, sigma, numPrePeriods, numPostPeriods,
        l_vec = .basisVector(index = 1,
            size = numPostPeriods),
            Mbar = 0,
    alpha = 0.05, hybrid_flag = "LF", hybrid_kappa = alpha/10,
        returnLength = FALSE, postPeriodMomentsOnly = TRUE,
        monotonicityDirection = "increasing",
        gridPoints=10^3, grid.ub = NA, grid.lb = NA, seed = 0)
```


## Arguments

| betahat | Vector of estimated event study coefficients. |
| :--- | :--- |
| sigma | Covariance matrix of event study coefficients. |
| numPrePeriods | Number of pre-periods. |
| numPostPeriods | Number of post-periods. |
| l_vec | Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=1 \_$vec'tau. Default equals to first basis vector, ( $1,0, \ldots, 0$ ) |
| Mbar | Tuning parameter Mbar for $\Delta^{R M}$ ( Mbar ) that governs how different the maximal pre-period violation of parallel trends may be from the post-period differential trend. Default sets Mbar = 0. See Section 2.3.2 of Rambachan \& Roth (2021) for more details. |
| alpha | Desired level of the confidence set. Default equals 0.05 (corresponding to $95 \%$ confidence interval) |

hybrid_flag Flag for whether user wishes to compute a hybridized confidence set. "ARP" specifies the conditional confidence set "LF" specifies the conditional leastfavorable confidence set. The conditional FLCI hybrid confidence set is not available for $\Delta^{R M}$ (Mbar) since the FLCI is infinite length for this choice of $\Delta$. See Section 3.3 and Section 5.3 of Rambachan \& Roth (2021) for details. Default equals "LF".
hybrid_kappa Desired first-stage size of hybridized confidence set. Only specify this value if the user wishes to compute a hybridized confidence set. Default equals alpha/10. If user specifies hybrid_flag = "ARP", set this value to NULL.
returnLength Logical value. If TRUE, function only returns the length of the robust confidence. If FALSE, function returns dataframe that contains a grid of possible parameter values and a vector of zeros and ones associated with each value in the grid (one denotes that the grid value lies in the confidence set and zero denotes that the grid value does not fall within the confidence set.) Default equals FALSE.
postPeriodMomentsOnly
Logical value. If TRUE, function excludes moments for $\Delta^{R M}(M b a r)$ that only include pre-period coefficients. Default equals TRUE.
monotonicityDirection
Specifies direction of monotonicity restriction. If "increasing", underlying trend specified to be increasing, $\delta_{t} \geq \delta_{t-1}$. If "decreasing", underlying trend specified to be decreasing $\delta_{t} \leq \delta_{t-1}$. Default equals "increasing."
gridPoints Number of grid points used in test inversion step. Default equals 1000.
grid.ub Upper bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA and sets grid upper bound to equal the upper bound of the identified set under parallel trends plus 20*standard deviation of the point estimate, l_vec'betahat.
grid.lb Lower bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA sets grid lower bound to equal the lower bound of the identified set under parallel trends minus 20*standard deviation of the point estimate, 1_vec'betahat.
seed Random seed for internal computations; included for reproducibility.

## Value

If returnLength equals TRUE, function returns a scalar that equals the length of the confidence interval. If returnLength equals FALSE, function returns a dataframe with columns
grid Vector of grid values used to construct the confidence interval by test inversion.
accept Vector of zeros-ones associated with grid values, where one denotes a grid value that falls within the confidence interval and zero denotes a grid value that falls outside the confidence interval.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.

```
computeConditionalCS_DeltaSD
    Computes conditional and hybridized confidence set for }\Delta
    -^SD(M).
```


## Description

Computes the conditional confidence set and hybridized confidence set for $\Delta=\Delta^{S D}(M)$.

## Usage

```
computeConditionalCS_DeltaSD(betahat, sigma, numPrePeriods, numPostPeriods,
    l_vec = .basisVector(index = 1, size = numPostPeriods),
        M = 0, alpha = 0.05, hybrid_flag = "FLCI",
        hybrid_kappa = alpha/10, returnLength = FALSE,
        postPeriodMomentsOnly = TRUE,
    gridPoints =10^3, grid.ub = NA, grid.lb = NA, seed = 0)
```


## Arguments

| betahat | Vector of estimated event study coefficients. |
| :--- | :--- |
| sigma | Covariance matrix of event study coefficients. |
| numPrePeriods | Number of pre-periods. |
| numPostPeriods | Number of post-periods. |
| l_vec | Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=1 \_$vec'tau. Default equals to first basis vector, $(1,0, \ldots, 0)$ |
| M | Tuning parameter for $\Delta^{S D}(M)$ that governs the degree of non-linearity allowed in the violation of parallel trends. Default equals 0 |
| alpha | Desired size of the confidence set. Default equals 0.05 (corresponding to $95 \%$ confidence interval) |
| hybrid_flag | Flag for whether user wishes to compute a hybridized confidence set. "ARP" specifies the conditional confidence set, "FLCI" specifies the conditional FLCI confidence set and "LF" specifies the conditional least-favorable confidence set. Default equals "FLCI". |
| hybrid_kappa | Desired first-stage size of hybridized confidence set. Only specify this value if the user wishes to compute a hybridized confidence set. Default equals alpha/10. If user specifies hybrid_flag = "ARP", set this value to NULL. |
| returnLength | Logical value. If TRUE, function only returns the length of the robust confidence. If FALSE, function returns dataframe that contains a grid of possible parameter values and a vector of zeros and ones associated with each value in the grid (one denotes that the grid value lies in the confidence set and zero denotes that the grid value does not fall within the confidence set. Default equals FALSE.) |


| postPeriodMomentsOnly |  |
| :--- | :--- |
|  | Logical value. If TRUE, function excludes moments for $\Delta^{S D}(M)$ that only include pre-period coefficients. Default equals TRUE. |
| gridPoints | Number of grid points used in test inversion step. Default equals 1000. |
| grid.ub | Upper bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA and sets grid upper bound to equal the upper bound of the identified set under parallel trends plus 20*standard deviation of the point estimate, l_vec'betahat. |
| grid.lb | Lower bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA sets grid lower bound to equal the lower bound of the identified set under parallel trends minus 20*standard deviation of the point estimate, 1_vec'betahat. |
| seed | Random seed for internal computations; included for reproducibility. |

## Value

If returnLength equals TRUE, function returns a scalar that equals the length of the confidence interval. If returnLength equals FALSE, function returns a dataframe with columns
grid Vector of grid values used to construct the confidence interval by test inversion.
accept Vector of zeros-ones associated with grid values, where one denotes a grid value that falls within the confidence interval and zero denotes a grid value that falls outside the confidence interval.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.
computeConditionalCS_DeltaSDB
Computes conditional and hybridized confidence set for $\Delta=$ $\Delta^{\wedge} S D B(M)$.

## Description

Computes the conditional confidence set and hybridized confidence set for $\Delta=\Delta^{S D B}(M)$. The set $\Delta^{S D B}(M)$ adds an additional sign restriction to $\Delta^{S D}(M)$ that restricts the sign of the bias to be either positive ( $\delta \geq 0$ ) or negative ( $\delta \leq 0$ ).

## Usage

```
computeConditionalCS_DeltaSDB(betahat, sigma, numPrePeriods, numPostPeriods,
    $M=0$, l_vec = .basisVector(index = 1, size=numPostPeriods),
    alpha $=0.05$, hybrid_flag $=$ "FLCI", hybrid_kappa = alpha/10,
            returnLength = FALSE, biasDirection = "positive",
            postPeriodMomentsOnly = TRUE,
        gridPoints $=10^{\wedge} 3$, grid. $\mathrm{lb}=$ NA, grid.ub $=$ NA, seed $=0$ )
```


## Arguments

betahat Vector of estimated event study coefficients.
sigma Covariance matrix of event study coefficients.
numPrePeriods Number of pre-periods.
numPostPeriods Number of post-periods.
l_vec Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=$ l_vec'tau. Default equals to first basis vector, $(1,0, \ldots, 0)$
M Tuning parameter for $\Delta^{S D}(M)$ that governs the degree of non-linearity allowed in the violation of parallel trends. Default equals 0
alpha Desired size of the confidence set. Default equals 0.05 (corresponding to $95 \%$ confidence interval)
hybrid_flag Flag for whether user wishes to compute a hybridized confidence set. "ARP" specifies the conditional confidence set, "FLCI" specifies the conditional FLCI confidence set and "LF" specifies the conditional least-favorable confidence set. Default equals "FLCI".
hybrid_kappa Desired first-stage size of hybridized confidence set. Only specify this value if the user wishes to compute a hybridized confidence set. Default equals alpha/10. If user specifies hybrid_flag = "ARP", set this value to NULL.
returnLength Logical value. If TRUE, function only returns the length of the robust confidence. If FALSE, function returns dataframe that contains a grid of possible parameter values and a vector of zeros and ones associated with each value in the grid (one denotes that the grid value lies in the confidence set and zero denotes that the grid value does not fall within the confidence set.) Default equals FALSE.
biasDirection Specifies direction of bias restriction. If "positive", bias is restricted to be positive, $\delta \geq 0$. If "negative", bias is restricted to be negative, $\delta \leq 0$. Default equals "positive".
postPeriodMomentsOnly
Logical value. If TRUE, function excludes moments for $\Delta^{S D}(M)$ that only include pre-period coefficients. Default equals TRUE.
gridPoints Number of grid points used in test inversion step. Default equals 1000.
grid.ub Upper bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA and sets grid upper bound to equal the upper bound of the identified set under parallel trends plus 20*standard deviation of the point estimate, l_vec'betahat.
grid.lb Lower bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA sets grid lower bound to equal the lower bound of the identified set under parallel trends minus 20*standard deviation of the point estimate, l_vec'betahat.
seed Random seed for internal computations; included for reproducibility.

## Value

If returnLength equals TRUE, function returns a scalar that equals the length of the confidence interval. If returnLength equals FALSE, function returns a dataframe with columns
grid Vector of grid values used to construct the confidence interval by test inversion.
accept Vector of zeros-ones associated with grid values, where one denotes a grid value that falls within the confidence interval and zero denotes a grid value that falls outside the confidence interval.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.
computeConditionalCS_DeltaSDM
Computes conditional and hybridized confidence set for $\Delta=$ $\Delta^{\wedge} S D M(M)$.

## Description

Computes the conditional confidence set and hybridized confidence set for $\Delta=\Delta^{S D M}(M)$. The set $\Delta^{S D B}(M)$ adds an additional shape restriction to $\Delta^{S D}(M)$ that restricts the underlying trend to be monotone. It may either be increasing ( $\delta_{t} \geq \delta_{t-1}$ ) or decreasing ( $\delta_{t} \leq \delta_{t-1}$ ).

## Usage

```
computeConditionalCS_DeltaSDM(betahat, sigma, numPrePeriods, numPostPeriods,
    M = 0, l_vec = .basisVector(index = 1, size=numPostPeriods),
        alpha = 0.05, monotonicityDirection = "increasing",
            hybrid_flag = "FLCI", hybrid_kappa = alpha/10,
            returnLength = FALSE, postPeriodMomentsOnly = TRUE,
        gridPoints = 10^3, grid.lb = NA, grid.ub = NA, seed = 0)
```


## Arguments

betahat Vector of estimated event study coefficients.
sigma Covariance matrix of event study coefficients.
numPrePeriods Number of pre-periods.
numPostPeriods Number of post-periods.
l_vec Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=1 \_$vec'tau. Default equals to first basis vector, $(1,0, \ldots, 0)$
M Tuning parameter for $\Delta^{S D}(M)$ that governs the degree of non-linearity allowed in the violation of parallel trends. Default equals 0
alpha Desired size of the confidence set. Default equals 0.05 (corresponding to $95 \%$ confidence interval)
hybrid_flag Flag for whether user wishes to compute a hybridized confidence set. "ARP" specifies the conditional confidence set, "FLCI" specifies the conditional FLCI confidence set and "LF" specifies the conditional least-favorable confidence set. Default equals "FLCI".
hybrid_kappa Desired first-stage size of hybridized confidence set. Only specify this value if the user wishes to compute a hybridized confidence set. Default equals alpha/10. If user specifies hybrid_flag = "ARP", set this value to NULL.
returnLength Logical value. If TRUE, function only returns the length of the robust confidence. If FALSE, function returns dataframe that contains a grid of possible parameter values and a vector of zeros and ones associated with each value in the grid (one denotes that the grid value lies in the confidence set and zero denotes that the grid value does not fall within the confidence set.) Default equals FALSE.
monotonicityDirection
Specifies direction of monotonicity restriction. If "increasing", underlying trend specified to be increasing, $\delta_{t} \geq \delta_{t-1}$. If "decreasing", underlying trend specified to be decreasing $\delta_{t} \leq \delta_{t-1}$. Default equals "increasing."
postPeriodMomentsOnly
Logical value. If TRUE, function excludes moments for $\Delta^{S D}(M)$ that only include pre-period coefficients. Default equals TRUE.
gridPoints Number of grid points used in test inversion step. Default equals 1000.
grid.ub Upper bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA and sets grid upper bound to equal the upper bound of the identified set under parallel trends plus 20*standard deviation of the point estimate, 1_vec'betahat.
grid.lb Lower bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA sets grid lower bound to equal the lower bound of the identified set under parallel trends minus 20*standard deviation of the point estimate, l_vec'betahat.
seed Random seed for internal computations; included for reproducibility.

## Value

If returnLength equals TRUE, function returns a scalar that equals the length of the confidence interval. If returnLength equals FALSE, function returns a dataframe with columns
grid Vector of grid values used to construct the confidence interval by test inversion.
accept Vector of zeros-ones associated with grid values, where one denotes a grid value that falls within the confidence interval and zero denotes a grid value that falls outside the confidence interval.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.
computeConditionalCS_DeltaSDRM
Computes conditional and hybridized confidence set for $\Delta=$ $\Delta^{\wedge} S D R M($ Mbar $)$.

## Description

Computes the conditional confidence set and hybridized confidence set for $\Delta=\Delta^{S D R M}($ Mbar $)$.

## Usage

computeConditionalCS_DeltaSDRM(betahat, sigma, numPrePeriods, numPostPeriods, l_vec $=$.basisVector (index = 1, size = numPostPeriods), Mbar = 0, alpha $=0.05$, hybrid_flag $=$ "LF", hybrid_kappa $=$ alpha/10, returnLength = FALSE, postPeriodMomentsOnly = TRUE, gridPoints=10^3, grid.ub = NA, grid.lb = NA, seed = 0)

## Arguments

| betahat | Vector of estimated event study coefficients. |
| :--- | :--- |
| sigma | Covariance matrix of event study coefficients. |
| numPrePeriods | Number of pre-periods. For this function, numPrePeriods must be greater than one. See details for further explanation. |
| numPostPeriods | Number of post-periods. |
| l_vec | Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=1 \_$vec'tau. Default equals to first basis vector, $(1,0, \ldots, 0)$ |


| Mbar | Tuning parameter Mbar for $\Delta^{S D R M}(M b a r)$ that governs how different the maximal pre-period deviation from a linear trend may be from the maximal deviation from a linear trend in the post-treatment period the post-treatment period. Default sets Mbar = 0. See Section 2.3.2 of Rambachan \& Roth (2021) for more details. |
| :--- | :--- |
| alpha | Desired level of the confidence set. Default equals 0.05 (corresponding to $95 \%$ confidence interval) |
| hybrid_flag | Flag for whether user wishes to compute a hybridized confidence set. "ARP" specifies the conditional confidence set "LF" specifies the conditional leastfavorable confidence set. The conditional FLCI hybrid confidence set is not available for $\Delta^{S D R M}$ (Mbar) since the FLCI is infinite length for this choice of $\Delta$. See Section 3.3 and Section 5.3 of Rambachan \& Roth (2021) for details. Default equals "LF". |
| hybrid_kappa | Desired first-stage size of hybridized confidence set. Only specify this value if the user wishes to compute a hybridized confidence set. Default equals alpha/10. If user specifies hybrid_flag = "ARP", set this value to NULL. |
| returnLength | Logical value. If TRUE, function only returns the length of the robust confidence. If FALSE, function returns dataframe that contains a grid of possible parameter values and a vector of zeros and ones associated with each value in the grid (one denotes that the grid value lies in the confidence set and zero denotes that the grid value does not fall within the confidence set.) Default equals FALSE. |
| postPeriodMomentsOnly |  |
|  | Logical value. If TRUE, function excludes moments for $\Delta^{S D R M}$ (Mbar) that only include pre-period coefficients. Default equals TRUE. |
| gridPoints | Number of grid points used in test inversion step. Default equals 1000. |
| grid.ub | Upper bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA and sets grid upper bound to equal the upper bound of the identified set under parallel trends plus 20*standard deviation of the point estimate, l_vec'betahat. |
| grid.lb | Lower bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA sets grid lower bound to equal the lower bound of the identified set under parallel trends minus 20*standard deviation of the point estimate, 1_vec'betahat. |
| seed | Random seed for internal computations; included for reproducibility. |

## Details

For the choice $\Delta^{S D R M}$, numPrePeriods must be greater than one. As discussed in Section 2.3.2 of Rambachan \& Roth (2021), $\Delta^{S D R M}$ uses observed non-linearities in the pre-treatment difference in trends to bound the possible non-linearities in the post-treatment difference in trends. This is only possible if there are multiple pre-treatment periods (i.e., numPrePeriods $>1$ ).

## Value

If returnLength equals TRUE, function returns a scalar that equals the length of the confidence interval. If returnLength equals FALSE, function returns a dataframe with columns
grid Vector of grid values used to construct the confidence interval by test inversion.
accept Vector of zeros-ones associated with grid values, where one denotes a grid value that falls within the confidence interval and zero denotes a grid value that falls outside the confidence interval.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.

```
computeConditionalCS_DeltaSDRMB
```

Computes conditional and hybridized confidence set for $\Delta=$ $\Delta^{\wedge} S D R M B($ Mbar $)$.

## Description

Computes the conditional confidence set and hybridized confidence set for $\Delta=\Delta^{S D R M B}$ (Mbar). The set $\Delta^{S D R M B}$ (Mbar) adds an additional sign restriction to $\Delta^{S D R M}$ (Mbar) that restricts the sign of the bias to be either positive ( $\delta \geq 0$ ) or negative ( $\delta \leq 0$ ).

## Usage

```
computeConditionalCS_DeltaSDRMB(betahat, sigma, numPrePeriods, numPostPeriods,
    l_vec = .basisVector(index = 1, size = numPostPeriods),
            Mbar = 0, alpha = 0.05, hybrid_flag = "LF",
            hybrid_kappa = alpha/10, returnLength = FALSE,
    postPeriodMomentsOnly = TRUE, biasDirection = "positive",
        gridPoints=10^3, grid.ub = NA, grid.lb = NA, seed = 0)
```


## Arguments

| betahat | Vector of estimated event study coefficients. |
| :--- | :--- |
| sigma | Covariance matrix of event study coefficients. |
| numPrePeriods | Number of pre-periods. For this function, numPrePeriods must be greater than one. See details for further explanation. |
| numPostPeriods | Number of post-periods. |
| l_vec | Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=1 \_$vec'tau. Default equals to first basis vector, $(1,0, \ldots, 0)$ |
| Mbar | Tuning parameter Mbar for $\Delta^{S D R M}(M b a r)$ that governs how different the maximal pre-period deviation from a linear trend may be from the maximal deviation from a linear trend in the post-treatment period the post-treatment period. Default sets Mbar = 0. See Section 2.3.2 of Rambachan \& Roth (2021) for more details. |


| alpha | Desired level of the confidence set. Default equals 0.05 (corresponding to $95 \%$ confidence interval) |
| :--- | :--- |
| hybrid_flag | Flag for whether user wishes to compute a hybridized confidence set. "ARP" specifies the conditional confidence set "LF" specifies the conditional leastfavorable confidence set. The conditional FLCI hybrid confidence set is not available for $\Delta^{S D R M B}$ (Mbar) since the FLCI is infinite length for this choice of $\Delta$. See Section 3.3 and Section 5.3 of Rambachan \& Roth (2021) for details. Default equals "LF". |
| hybrid_kappa | Desired first-stage size of hybridized confidence set. Only specify this value if the user wishes to compute a hybridized confidence set. Default equals alpha/10. If user specifies hybrid_flag = "ARP", set this value to NULL. |
| returnLength | Logical value. If TRUE, function only returns the length of the robust confidence. If FALSE, function returns dataframe that contains a grid of possible parameter values and a vector of zeros and ones associated with each value in the grid (one denotes that the grid value lies in the confidence set and zero denotes that the grid value does not fall within the confidence set.) Default equals FALSE. |
| biasDirection | Specifies direction of bias restriction. If "positive", bias is restricted to be positive, $\delta \geq 0$. If "negative", bias is restricted to be negative, $\delta \leq 0$. Default equals "positive". |
| postPeriodMomentsOnly |  |
|  | Logical value. If TRUE, function excludes moments for $\Delta^{S D R M B}$ (Mbar) that only include pre-period coefficients. Default equals TRUE. |
| gridPoints | Number of grid points used in test inversion step. Default equals 1000. |
| grid.ub | Upper bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA and sets grid upper bound to equal the upper bound of the identified set under parallel trends plus 20*standard deviation of the point estimate, l_vec'betahat. |
| grid.lb | Lower bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA sets grid lower bound to equal the lower bound of the identified set under parallel trends minus 20*standard deviation of the point estimate, 1_vec'betahat. |
| seed | Random seed for internal computations; included for reproducibility. |

## Details

The choice $\Delta^{S D R M B}$ adds an additional sign restriction to $\Delta^{S D R M}$ ( Mbar ) that restricts the sign of the bias to be either positive ( $\delta \geq 0$ ) or negative ( $\delta \leq 0$ ). For this choice $\Delta^{S D R M B}$, numPrePeriods must be greater than one. As discussed in Section 2.3.2 of Rambachan \& Roth (2021), $\Delta^{S D R M}$ uses observed non-linearities in the pre-treatment difference in trends to bound the possible nonlinearities in the post-treatment difference in trends. This is only possible if there are multiple pre-treatment periods (i.e., numPrePeriods > 1).

## Value

If returnLength equals TRUE, function returns a scalar that equals the length of the confidence interval. If returnLength equals FALSE, function returns a dataframe with columns
grid Vector of grid values used to construct the confidence interval by test inversion.
accept Vector of zeros-ones associated with grid values, where one denotes a grid value that falls within the confidence interval and zero denotes a grid value that falls outside the confidence interval.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.
computeConditionalCS_DeltaSDRMM
Computes conditional and hybridized confidence set for $\Delta=$ $\Delta^{\wedge} S D R M M(M b a r)$.

## Description

Computes the conditional confidence set and hybridized confidence set for $\Delta=\Delta^{S D R M M}$ (Mbar). The set $\Delta^{S D R M M}$ (Mbar) adds an additional shape restriction to $\Delta^{S D R M}$ (Mbar) that restricts the underlying trend to be monotone. It may either be increasing ( $\delta_{t} \geq \delta_{t-1}$ ) or decreasing ( $\delta_{t} \leq \delta_{t-1}$ ).

## Usage

```
computeConditionalCS_DeltaSDRMM(betahat, sigma, numPrePeriods, numPostPeriods,
    l_vec = .basisVector(index = 1, size = numPostPeriods),
    Mbar = 0, alpha = 0.05, hybrid_flag = "LF",
    hybrid_kappa = alpha/10, returnLength = FALSE,
    postPeriodMomentsOnly = TRUE,
    monotonicityDirection = "increasing",
    gridPoints=10^3, grid.ub = NA, grid.lb = NA, seed = 0)
```


## Arguments

| betahat | Vector of estimated event study coefficients. |
| :--- | :--- |
| sigma | Covariance matrix of event study coefficients. |
| numPrePeriods | Number of pre-periods. For this function, numPrePeriods must be greater than one. See details for further explanation. |
| numPostPeriods | Number of post-periods. |
| l_vec | Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=1 \_$vec'tau. Default equals to first basis vector, $(1,0, \ldots, 0)$ |


| Mbar | Tuning parameter Mbar for $\Delta^{S D R M}$ ( Mbar ) that governs how different the maximal pre-period deviation from a linear trend may be from the maximal deviation from a linear trend in the post-treatment period the post-treatment period. Default sets Mbar = 0. See Section 2.3.2 of Rambachan \& Roth (2021) for more details. |
| :--- | :--- |
| alpha | Desired level of the confidence set. Default equals 0.05 (corresponding to $95 \%$ confidence interval) |
| hybrid_flag | Flag for whether user wishes to compute a hybridized confidence set. "ARP" specifies the conditional confidence set "LF" specifies the conditional leastfavorable confidence set. The conditional FLCI hybrid confidence set is not available for $\Delta^{S D R M}$ (Mbar) since the FLCI is infinite length for this choice of $\Delta$. See Section 3.3 and Section 5.3 of Rambachan \& Roth (2021) for details. Default equals "LF". |
| hybrid_kappa | Desired first-stage size of hybridized confidence set. Only specify this value if the user wishes to compute a hybridized confidence set. Default equals alpha/10. If user specifies hybrid_flag = "ARP", set this value to NULL. |
| returnLength | Logical value. If TRUE, function only returns the length of the robust confidence. If FALSE, function returns dataframe that contains a grid of possible parameter values and a vector of zeros and ones associated with each value in the grid (one denotes that the grid value lies in the confidence set and zero denotes that the grid value does not fall within the confidence set.) Default equals FALSE. |
| postPeriodMomentsOnly |  |
|  | Logical value. If TRUE, function excludes moments for $\Delta^{S D R M}$ (Mbar) that only include pre-period coefficients. Default equals TRUE. |
| monotonicityDirection |  |
|  | Specifies direction of monotonicity restriction. If "increasing", underlying trend specified to be increasing, $\delta_{t} \geq \delta_{t-1}$. If "decreasing", underlying trend specified to be decreasing $\delta_{t} \leq \delta_{t-1}$. Default equals "increasing." |
| gridPoints | Number of grid points used in test inversion step. Default equals 1000. |
| grid.ub | Upper bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA and sets grid upper bound to equal the upper bound of the identified set under parallel trends plus 20*standard deviation of the point estimate, l_vec'betahat. |
| grid.lb | Lower bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA sets grid lower bound to equal the lower bound of the identified set under parallel trends minus 20*standard deviation of the point estimate, l_vec'betahat. |
| seed | Random seed for internal computations; included for reproducibility. |

## Details

The choice $\Delta^{S D R M M}$ adds an additional shape restriction to $\Delta^{S D R M}(M b a r)$ that restricts the underlying trend to be monotone. For this choice $\Delta^{S D R M M}$, numPrePeriods must be greater than one. As discussed in Section 2.3.2 of Rambachan \& Roth (2021), $\Delta^{S D R M}$ uses observed non-linearities in the pre-treatment difference in trends to bound the possible non-linearities in the
post-treatment difference in trends. This is only possible if there are multiple pre-treatment periods (i.e., numPrePeriods $>1$ ).

## Value

If returnLength equals TRUE, function returns a scalar that equals the length of the confidence interval. If returnLength equals FALSE, function returns a dataframe with columns
grid Vector of grid values used to construct the confidence interval by test inversion.
accept Vector of zeros-ones associated with grid values, where one denotes a grid value that falls within the confidence interval and zero denotes a grid value that falls outside the confidence interval.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.
constructOriginalCS Constructs original confidence interval for parameter of interest, theta = l_vec'tau.

## Description

Constructs original confidence interval for parameter of interest, theta $=1 \_$vec'tau using the userspecified estimated event study coefficients and variance-covariance matrix.

## Usage

```
constructOriginalCS(betahat, sigma,
    numPrePeriods, numPostPeriods,
    l_vec = .basisVector(index = 1, size = numPostPeriods),
    alpha = 0.05)
```


## Arguments

| betahat | Vector of estimated event study coefficients. |
| :--- | :--- |
| sigma | Covariance matrix of event study coefficients. |
| numPrePeriods | Number of pre-periods. |
| numPostPeriods | Number of post-periods. |
| l_vec | Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=1 \_$vec'tau. Default equals to first basis vector, $(1,0, \ldots, 0)$ |
| alpha | Desired size of the robust confidence sets. Default equals 0.05 (corresponding to 95\% confidence interval) |

## Value

Returns a dataframe with columns

| lb | Lower bound of original confidence set (based on asymptotic normality). |
| :--- | :--- |
| ub | Upper bound of original confidence set (based on asymptotic normality). |
| method | Method for constructing confidence set; set to "Original". |
| Delta | The set Delta that was specified; set to NA. |

## Examples

```
# Simple use case; for more detailed examples,
# see <https://github.com/asheshrambachan/HonestDiD#honestdid>
constructOriginalCS(betahat = BCdata_EventStudy$betahat,
    sigma = BCdata_EventStudy$sigma,
    numPrePeriods = length(BCdata_EventStudy$prePeriodIndices),
    numPostPeriods = length(BCdata_EventStudy$postPeriodIndices),
    alpha = 0.05)
```

createEventStudyPlot Constructs event study plot

## Description

Constructs event study plot using the estimated event study coefficients and standard errors.

## Usage

```
createEventStudyPlot(betahat, stdErrors = NULL, sigma = NULL,
    numPrePeriods, numPostPeriods, alpha = 0.05, timeVec,
    referencePeriod, useRelativeEventTime = FALSE)
```


## Arguments

| betahat | Vector of estimated event study coefficients. |
| :--- | :--- |
| stdErrors | Vector of standard errors associated with the estimated event study coefficients. Default equals NULL. Either stdErrors or sigma must be specified by the user. If stdErrors is not specified but sigma is, the stdErrors are set to equal the square root of the diagonal elements of sigma. |
| sigma | Covariance matrix of event study coefficients. Default equals NULL. Either stdErrors or sigma must be specified by the user. |
| numPrePeriods | Number of pre-periods. |
| numPostPeriods | Number of post-periods. |
| alpha | Desired size of confidence intervals. Default $=0.05$. |
| timeVec | Vector that contains the time periods associated with the event study coefficients. This vector should not include the reference period that is normalized to zero. |

referencePeriod
Scalar that contains the time period associated with the reference period.
useRelativeEventTime
Logical that specifies whether user would like the plot to be in relative event time (normalizes the reference period to be zero). Default equals FALSE.

## Value

Returns ggplot object of the event study plot.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.

## Examples

```
# Simple use case; for more detailed examples,
# see <https://github.com/asheshrambachan/HonestDiD#honestdid>
createEventStudyPlot(betahat = BCdata_EventStudy$betahat,
    sigma = BCdata_EventStudy$sigma,
    numPrePeriods = length(BCdata_EventStudy$prePeriodIndices),
    numPostPeriods = length(BCdata_EventStudy$postPeriodIndices),
    alpha = 0.05,
    timeVec = BCdata_EventStudy$timeVec,
    referencePeriod = BCdata_EventStudy$referencePeriod)
```

createSensitivityPlot Constructs sensitivity plot for $\Delta=\Delta^{\wedge} S D(M), \Delta^{\wedge} S D B(M)$ and $\Delta^{\wedge} S D M(M)$

## Description

This function constructs sensitivity plots that examine how the robust confidence sets change as the parameter M varies for $\Delta=\Delta^{S D}(M), \Delta^{S D B}(M)$ and $\Delta^{S D M}(M)$. Similar plots are constructed in Section 6 of Rambachan \& Roth (2021).

## Usage

```
createSensitivityPlot(robustResults, originalResults,
    rescaleFactor = 1, maxM = Inf, add_xAxis = TRUE)
```


## Arguments

| robustResults | Dataframe that contains the upper/lower bounds of robust confidence sets for each choice of M. Contains columns: method - Method of constructing robust confidence set (e.g., "FLCI"), lb - Lower bound of robust confidence set, ub Upper bound of robust confidence set, $\mathrm{M}-\mathrm{M}$ values associated with each robust confidence set. |
| :--- | :--- |
| originalResults |  |
|  | Dataframe that contains the original confidence set for the parameter of interest. Contains columns: method-Method of constructing confidence set (e.g., "Original"), lb - Lower bound of confidence set, ub - Upper bound of confidence set. |
| rescaleFactor | Scalar that is used to rescale the user specified choices of M and the upper/lower bounds of the confidence sets. Default equals one. |
| maxM | Scalar that specifies the maximum M value to plot in the sensitivity plot. Default equals infinity (no truncation). |
| add_xAxis | Logical specifying whether to plot the x-axis in the sensitivity plot. Default equals TRUE. |

## Value

Returns ggplot object of the sensitivity plot.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.

## Examples

```
# Simple use case; for more detailed examples,
# see <https://github.com/asheshrambachan/HonestDiD#honestdid>
robustResults <-
    createSensitivityResults(betahat = BCdata_EventStudy$betahat,
                sigma = BCdata_EventStudy$sigma,
            numPrePeriods = length(BCdata_EventStudy$prePeriodIndices),
            numPostPeriods = length(BCdata_EventStudy$postPeriodIndices),
                alpha = 0.05)
originalResults <-
    constructOriginalCS(betahat = BCdata_EventStudy$betahat,
        sigma = BCdata_EventStudy$sigma,
        numPrePeriods = length(BCdata_EventStudy$prePeriodIndices),
        numPostPeriods = length(BCdata_EventStudy$postPeriodIndices),
        alpha = 0.05)
createSensitivityPlot(robustResults, originalResults)
```

```
createSensitivityPlot_relativeMagnitudes
    Constructs sensitivity plot for }\Delta\quad=\quad\mp@subsup{\Delta}{}{\wedge}RM(\mathrm{ Mbar })
    - SDRMMbar and their variants that incorporate additional
    shape or sign restrictions.
```


## Description

This function constructs sensitivity plots that examine how the robust confidence sets change as the parameter Mbar varies for $\Delta=\Delta^{R M}($ Mbar $), \Delta^{S D R M}($ Mbar $)$ and their variants that incorporate additional shape or sign restrictions. Similar plots are constructed in Section 6 of Rambachan \& Roth (2021).

## Usage

```
createSensitivityPlot_relativeMagnitudes(robustResults, originalResults,
    rescaleFactor = 1, maxMbar = Inf,
    add_xAxis = TRUE)
```


## Arguments

| robustResults | Dataframe that contains the upper/lower bounds of robust confidence sets for each choice of Mbar. Contains columns: method - Method of constructing robust confidence set, lb - Lower bound of robust confidence set, ub - Upper bound of robust confidence set, Mbar-M values associated with each robust confidence set. |
| :--- | :--- |
| originalResults |  |
|  | Dataframe that contains the original confidence set for the parameter of interest. Contains columns: method-Method of constructing confidence set (e.g., "Original"), lb - Lower bound of confidence set, ub - Upper bound of confidence set. |
| rescaleFactor | Scalar that is used to rescale the user specified choices of M and the upper/lower bounds of the confidence sets. Default equals one. |
| maxMbar | Scalar that specifies the maximum Mbar value to plot in the sensitivity plot. Default equals infinity (no truncation). |
| add_xAxis | Logical specifying whether to plot the x-axis in the sensitivity plot. Default equals TRUE. |

## Value

Returns ggplot object of the sensitivity plot.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2019.

## Examples

```
# Simple use case. For more detailed examples,
# see <https://github.com/asheshrambachan/HonestDiD#honestdid>
kwargs <- list(betahat = BCdata_EventStudy$betahat,
    sigma = BCdata_EventStudy$sigma,
    numPrePeriods = length(BCdata_EventStudy$prePeriodIndices),
    numPostPeriods = length(BCdata_EventStudy$postPeriodIndices),
    alpha = 0.05)
robustResults <- do.call(createSensitivityResults_relativeMagnitudes, kwargs)
originalResults <- do.call(constructOriginalCS, kwargs)
createSensitivityPlot_relativeMagnitudes(robustResults, originalResults)
```

createSensitivityResults
Constructs robust confidence intervals for $\Delta=\Delta^{\wedge} S D(M)$, $\Delta^{\wedge} S D B(M)$ and $\Delta^{\wedge} S D M(M)$ for vector of possible $M$ values.

## Description

Constructs robust confidence intervals for a choice $\Delta=\Delta^{S D}(M), \Delta^{S D B}(M)$ and $\Delta^{S D M}(M)$ for vector of possible M values. By default, the function constructs robust confidence intervals for $\Delta^{S D}(M)$.

## Usage

```
createSensitivityResults(betahat, sigma,
    numPrePeriods, numPostPeriods,
    method = NULL,
    Mvec = NULL,
    l_vec = .basisVector(index = 1, size = numPostPeriods),
    monotonicityDirection = NULL,
    biasDirection = NULL,
    alpha = 0.05,
    parallel = FALSE,
    seed = 0)
```


## Arguments

betahat Vector of estimated event study coefficients.
sigma Covariance matrix of event study coefficients.
numPrePeriods Number of pre-periods.
numPostPeriods Number of post-periods.

| method | String that specifies the choice of method for constructing robust confidence intervals. This must be one of "FLCI", "Conditional", "C-F" (conditional FLCI hybrid), or "C-LF" (conditional least-favorable hybrid). Default equals NULL and the function automatically sets method based on the recommendations in Rambachan \& Roth (2021) depending on the choice of Delta. If Delta = DeltaSD, default selects the FLCI. If Delta = DeltaSDB or DeltaSDM, default delects the conditional FLCI hybrid. |
| :--- | :--- |
| Mvec | Vector of M values for which the user wishes to construct robust confidence intervals. If NULL, the function constructs a grid of length 10 that starts at M $=0$ and ends at M equal to the upper bound constructed from the pre-periods using the function DeltaSD_upperBound_Mpre if number of pre-periods $>1$ or the standard deviation of the first pre-period coefficient if number of pre-periods $=1$. Default equals null. |
| l_vec | Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=1 \_$vec'tau. Default equals to first basis vector, $(1,0, \ldots, 0)$ |
| biasDirection | This must be specified if the user wishes to add an additional bias restriction to $\Delta^{S D}(M)$. If "positive", bias is restricted to be positive, $\delta \geq 0$. If "negative", bias is restricted to be negative, $\delta \leq 0$. Default equals NULL. |
| monotonicityDirection |  |
|  | This must be specified if the user wishes to add an additional monotonicity restriction to $\Delta^{S D}(M)$. If "increasing", underlying trend specified to be increasing, $\delta_{t} \geq \delta_{t-1}$. If "decreasing", underlying trend specified to be decreasing $\delta_{t} \leq \delta_{t-1}$. Default equals NULL |
| alpha | Desired size of the robust confidence sets. Default equals 0.05 (corresponding to 95\% confidence interval) |
| parallel | Logical to indicate whether the user would like to construct the robust confidence intervals in parallel. This uses the Foreach package and doParallel package. Default equals FALSE. |
| seed | Random seed for internal computations; included for reproducibility. |

## Value

Returns a dataframe with columns

| lb | Lower bound of robust confidence sets. |
| :--- | :--- |
| ub | Upper bound of robust confidence sets. |
| method | Method for constructing robust confidence sets |
| Delta | The set Delta that was specified. |
| M | Values of M associated with each robust confidence set. |

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.

## Examples

```
# Simple use case; for more detailed examples,
# see <https://github.com/asheshrambachan/HonestDiD#honestdid>
createSensitivityResults(betahat = BCdata_EventStudy$betahat,
    sigma = BCdata_EventStudy$sigma,
    numPrePeriods = length(BCdata_EventStudy$prePeriodIndices),
    numPostPeriods = length(BCdata_EventStudy$postPeriodIndices),
    alpha = 0.05)
```

createSensitivityResults_relativeMagnitudes
Constructs robust confidence intervals for $\Delta=\Delta^{\wedge} R M($ Mbar $)$, $\Delta^{\wedge} S D R M(M b a r)$ and their variants that incorporate shape or sign restrictions for a vector of possible Mbar values.

## Description

Constructs robust confidence intervals for $\Delta=\Delta^{R M}($ Mbar $), \Delta^{S D R M}($ Mbar $)$ and their variants that incorporate shape or sign restrictions for a vector of possible Mbar values. By default, the function constructs sensitivity results for $\Delta^{R M}$ ( Mbar ) and its variants. The confidence sets are constructed through test inversion.

## Usage

```
createSensitivityResults_relativeMagnitudes(betahat, sigma,
        numPrePeriods, numPostPeriods,
    bound = "deviation from parallel trends",
        method = "C-LF",
        Mbarvec = NULL,
        l_vec = .basisVector(index = 1,
            size = numPostPeriods),
        monotonicityDirection = NULL,
        biasDirection = NULL,
        alpha = 0.05,
        gridPoints = 10^3,
        grid.ub = NA,
        grid.lb = NA,
        parallel = FALSE,
        seed = 0)
```


## Arguments

betahat Vector of estimated event study coefficients.
sigma Covariance matrix of event study coefficients.

| numPrePeriods | Number of pre-periods. If user selects bound = "deviation from linear trends" (Delta ${ }^{S D R M}$ as base choice of Delta), then numPrePeriods must be greater than one. See details for further explanation. |
| :--- | :--- |
| numPostPeriods | Number of post-periods. |
| bound | String that specifies the base choice of Delta (to which additional sign and shape restrictions will be incorporated if specified by the user). This must be either "deviation from parallel trends" or "deviation from linear trend". If bound equals "deviation from parallel trends", then the function will select $\Delta^{R M}(M b a r)$ as the base choice of $\Delta$. If bound equals "deviation from linear trends", then the function will select $\Delta^{S D R M}$ as the base choice of $\Delta$. By default, this is set to "deviation from parallel trends". See Section 2.3.1 and 2.3.2 of Rambachan \& Roth (2021) for a discussion of these choices of $\Delta$. |
| method | String that specifies the choice of method for constructing robust confidence intervals. This must be either "Conditional", or "C-LF" (conditional least-favorable hybrid). Default equals "C-LF" and the function automatically sets method to be "C-LF" based on the recommendations in Rambachan \& Roth (2021). |
| Mbarvec | Vector of Mbar values for which the user wishes to construct robust confidence intervals. If NULL, the function constructs a grid of length 10 that starts at Mbar $=0$ and ends at $\mathrm{Mbar}=2$. Default equals null. |
| l_vec | Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=1 \_$vec'tau. Default equals to first basis vector, ( $1,0, \ldots, 0$ ) |
| biasDirection | This must be specified if the user wishes to add an additional bias restriction to base choice of Delta. If "positive", bias is restricted to be positive, delta >=0. If "negative", bias is restricted to be negative, delta <= 0. Default equals NULL. |
| monotonicityDirection |  |
|  | This must be specified if the user wishes to add an additional monotonicity restriction to base choice of Delta. If "increasing", underlying trend specified to be increasing, $\delta_{t} \geq \delta_{t-1}$. If "decreasing", underlying trend specified to be decreasing $\delta_{t} \leq \delta_{t-1}$. Default equals NULL. |
| alpha | Desired size of the robust confidence sets. Default equals 0.05 (corresponding to 95\% confidence interval) |
| parallel | Logical to indicate whether the user would like to construct the robust confidence intervals in parallel. This uses the Foreach package and doParallel package. Default equals FALSE. |
| gridPoints | Number of grid points used for the underlying test inversion. Default equals 1000. User may wish to change the number of grid points for computational reasons. |
| grid.ub | Upper bound of grid used for underlying test inversion. Default sets grid.ub to be equal to twenty times the standard deviation of the estimated target parameter, l_vec * betahat. User may wish to change the upper bound of the grid to suit their application. |
| grid.lb | Lower bound of grid used for underlying test inversion. Default sets grid.lb to be equal to negative twenty times the standard deviation of the estimated target parameter, l_vec * betahat. User may wish to change the lower bound of the grid to suit their application. |
| seed | Random seed for internal computations; included for reproducibility. |

## Details

Note: If the user specifies bound = "deviation from linear trends", then numPrePeriods must be greater than one. By specifying bound = "deviation from linear trends", then the function selects $\Delta^{S D R M}$ as the base choice of $\Delta$. As discussed in Section 2.3.2 of Rambachan \& Roth (2021), $\Delta^{S D R M}$ uses observed non-linearities in the pre-treatment difference in trends to bound the possible non-linearities in the post-treatment difference in trends. This is only possible if there are multiple pre-treatment periods (i.e., numPrePeriods > 1).

## Value

Returns a dataframe with columns

| lb | Lower bound of robust confidence sets. |
| :--- | :--- |
| ub | Upper bound of robust confidence sets. |
| method | Method for constructing robust confidence sets |
| Delta | The set Delta that was specified. |
| M | Values of M associated with each robust confidence set. |

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.

## Examples

```
# Simple use case. For more detailed examples,
# see <https://github.com/asheshrambachan/HonestDiD#honestdid>
kwargs <- list(betahat = BCdata_EventStudy$betahat,
    sigma = BCdata_EventStudy$sigma,
    numPrePeriods = length(BCdata_EventStudy$prePeriodIndices),
    numPostPeriods = length(BCdata_EventStudy$postPeriodIndices),
    alpha = 0.05)
do.call(createSensitivityResults_relativeMagnitudes, kwargs)
```

DeltaSD_lowerBound_Mpre
Construct lower bound for $M$ for $\Delta=\Delta^{\wedge} S D(M)$ based on observed pre-period coefficients.

## Description

Constructs a lower bound for M using the observed pre-period coefficients. It constructs a onesided confidence interval for the maximal second difference of the observed pre-period using the conditional test developed in Andrews, Roth \& Pakes (2019). The number of pre-periods (not including the reference period) must be larger than or equal to two.

## Usage

DeltaSD_lowerBound_Mpre(betahat, sigma, numPrePeriods, alpha $=0.05$, grid.ub $=$ NA, gridPoints $=1000$ )

## Arguments

| betahat | Vector of estimated event study coefficients. |
| :--- | :--- |
| sigma | Covariance matrix of event study coefficients. |
| numPrePeriods | Number of pre-periods. Must be larger than or equal to two. |
| alpha | Desired size of the one-sided confidence set. Default equals 0.05 (corresponding to 95\% confidence interval) |
| grid.ub | Upper bound of grid of values of M that is used to construct the confidence interval by test inversion. Default equals NA and the upper bound of the grid is set equal to three times the maximum standard error of the observed pre-period event-study coefficients. |
| gridPoints | Number of points to include in the grid that is used to construct the confidence interval by test inversion. Default equals 1000 points. |

## Value

Returns a scalar that equals the lower bound of a one-sided confidence interval for the maximal second difference of the observed pre-period coefficients.

## Author(s)

Ashesh Rambachan

## References

Andrews, Isaiah, Jonathan Roth and Ariel Pakes. "Inference for Linear Conditional Moment Inequalities." 2019. Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.

DeltaSD_upperBound_Mpre
Construct upper bound for $M$ for $\Delta=\Delta^{\wedge} S D(M)$ based on observed pre-period coefficients.

## Description

Constructs an upper bound for M using the observed pre-period event study coefficients. This is constructed using (1-alpha) level one-sided upper confidence intervala for the second differences of the observed pre-period event study coefficients. The number of pre-periods (not including the reference period) must be larger than or equal to two.

## Usage

DeltaSD_upperBound_Mpre(betahat, sigma, numPrePeriods, alpha = 0.05)

## Arguments

betahat Vector of estimated event study coefficients.
sigma Covariance matrix of event study coefficients.
numPrePeriods Number of pre-periods. Must be larger than or equal to two.
alpha Desired size of the one-sided confidence set. Default equals 0.05 (corresponding to 95\% confidence interval)

## Details

This function returns the maximum of the upper bounds of one-sided upper confidence intervals for the observed second differences of the pre-period event study coefficients.

## Value

Returns a scalar that equals the maximum of the upper bounds of one-sided upper confidence intervals for the observed second differences of the pre-period event study coefficients.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.

| findOptimalFLCI | Constructs optimal fixed length confidence interval for $\Delta=$ <br> $\Delta^{\wedge} S D(M)$. |
| :--- | :--- |

## Description

Computes the optimal FLCI for the scalar parameter of interest under $\Delta=\Delta^{S D}(M)$.

```
Usage
    findOptimalFLCI(betahat, sigma, M = 0,
        numPrePeriods, numPostPeriods,
        l_vec = .basisVector(index = 1, size = numPostPeriods),
        numPoints = 100, alpha = 0.05, seed = 0)
```


## Arguments

| betahat | Vector of estimated event study coefficients. |
| :--- | :--- |
| sigma | Covariance matrix of event study coefficients. |
| numPrePeriods | Number of pre-periods. |
| numPostPeriods | Number of post-periods. |
| l_vec | Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=l \_$vec'tau. Default equals to first basis vector, $(1,0, \ldots, 0)$ |
| M | Tuning parameter for $\Delta^{S D}(M)$ that governs the degree of non-linearity allowed in the violation of parallel trends. Default equals 0 |
| numPoints | Number of possible values when optimizing the FLCI. Default equals 100. |
| alpha | Desired size of the FLCI. Default equals 0.05 (corresponding to $95 \%$ confidence interval) |
| seed | Random seed for internal computations; included for reproducibility. |

## Value

Returns a list containing items
FLCI Vector containing lower and upper bounds of optimal FLCI.
optimalVec Vector of length numPrePeriods + numPostPeriods that contains the vector of coefficients associated with the optimal FLCI.
optimalPrePeriodVec
Vector of length numPrePeriods that contains the vector of coefficients for the optimal FLCI that are associated with the pre-period event study coefficients.
optimalHalfLength
A scalar that equals the half-length of the optimal FLCI.
M Value of M at which the FLCI was computed.
status Status of optimization.

## Author(s)

Ashesh Rambachan

## References

Rambachan, Ashesh and Jonathan Roth. "An Honest Approach to Parallel Trends." 2021.

LWdata_EventStudy Event study estimates from baseline female specification on employment in Lovenheim \& Willen (2019). See discussion in Section 6.2 of Rambachan \& Roth (2021).

## Description

This list contains the event study estimates from the baseline female specification on employment in Lovenheim \& Willen (2019). See discussion in Section 6.2 of Rambachan \& Roth (2021).

## Format

A list, containing 7 objects:
Vector of estimated event study coefficients.
betahghna Estimated variance-covariance matrix.
timeVec Vector that contains the time periods associated with the event study coefficients.
referencePeriod Reference period that is normalized to zero.
prePeriodIndices Vector containing elements of timeVec that correspond to the pre-periods.
postPeriodIndices Vector containing elements of timeVec that correspond to the post-periods.
stdErrors Vector of standard errors associated with estimated event study coefficients

## Index

```
basisVector,2
BCdata_EventStudy, 3
computeConditionalCS_DeltaRM,3
computeConditionalCS_DeltaRMB,5
computeConditionalCS_DeltaRMM,7
computeConditionalCS_DeltaSD, 9
computeConditionalCS_DeltaSDB, 10
computeConditionalCS_DeltaSDM, 12
computeConditionalCS_DeltaSDRM, 14
computeConditionalCS_DeltaSDRMB, 16
computeConditionalCS_DeltaSDRMM, 18
constructOriginalCS, 20
createEventStudyPlot,21
createSensitivityPlot,22
createSensitivityPlot_relativeMagnitudes,
    2 4
createSensitivityResults,25
createSensitivityResults_relativeMagnitudes,
    2 7
DeltaSD_lowerBound_Mpre, 29
DeltaSD_upperBound_Mpre, 31
findOptimalFLCI,32
LWdata_EventStudy, 33
```


[^0]:    Arguments
    betahat Vector of estimated event study coefficients.
    sigma Covariance matrix of event study coefficients.
    numPrePeriods Number of pre-periods.
    numPostPeriods Number of post-periods.
    l_vec Vector of length numPostPeriods that describes the scalar parameter of interest, theta $=1 \_$vec'tau. Default equals to first basis vector, $(1,0, \ldots, 0)$

    Mbar Tuning parameter Mbar for $\Delta^{R M}(M b a r)$ that governs how different the maximal pre-period violation of parallel trends may be from the post-period differential trend. Default sets Mbar = 0. See Section 2.3.2 of Rambachan \& Roth (2021) for more details.
    alpha Desired level of the confidence set. Default equals 0.05 (corresponding to $95 \%$ confidence interval)
    hybrid_flag Flag for whether user wishes to compute a hybridized confidence set. "ARP" specifies the conditional confidence set "LF" specifies the conditional leastfavorable confidence set. The conditional FLCI hybrid confidence set is not available for $\Delta^{R M}$ (Mbar) since the FLCI is infinite length for this choice of $\Delta$. See Section 3.3 and Section 5.3 of Rambachan \& Roth (2021) for details. Default equals "LF".
    hybrid_kappa Desired first-stage size of hybridized confidence set. Only specify this value if the user wishes to compute a hybridized confidence set. Default equals alpha/10. If user specifies hybrid_flag = "ARP", set this value to NULL.
    returnLength Logical value. If TRUE, function only returns the length of the robust confidence. If FALSE, function returns dataframe that contains a grid of possible parameter values and a vector of zeros and ones associated with each value in the grid (one denotes that the grid value lies in the confidence set and zero denotes that the grid value does not fall within the confidence set.) Default equals FALSE.
    postPeriodMomentsOnly
    Logical value. If TRUE, function excludes moments for $\Delta^{R M}($ Mbar $)$ that only include pre-period coefficients. Default equals TRUE.
    gridPoints Number of grid points used in test inversion step. Default equals 1000.
    grid.ub Upper bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA and sets grid upper bound to equal the upper bound of the identified set under parallel trends plus 20*standard deviation of the point estimate, l_vec'betahat.
    grid.lb Lower bound of grid for test inversion. The user should only specify this if she wishes to manually specify the upper bound of the grid. Default equals NA sets grid lower bound to equal the lower bound of the identified set under parallel trends minus 20*standard deviation of the point estimate, 1_vec'betahat.
    seed Random seed for internal computations; included for reproducibility.

