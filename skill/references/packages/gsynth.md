## Package 'gsynth'

> **Historical reference snapshot.** The version recorded here belongs to this
> snapshot and may differ from the installed package or validation ledger. Use
> [installed help](gsynth_quick_start.md#installed-help-topics) for current
> arguments. This file remains available as a historical fallback.

July 22, 2025
Type Package
Title Generalized Synthetic Control Method
Version 1.2.1
Date 2021-08-06
Author Yiqing Xu, Licheng Liu
Maintainer Yiqing Xu <yiqingxu@stanford.edu>
Description Provides causal inference with interactive fixed-effect models. It imputes counterfactuals for each treated unit using control group information based on a linear interactive fixed effects model that incorporates unit-specific intercepts interacted with time-varying coefficients. This method generalizes the synthetic control method to the case of multiple treated units and variable treatment periods, and improves efficiency and interpretability. This version supports unbalanced panels and implements the matrix completion method.

URL https://yiqingxu.org/packages/gsynth/gsynth_examples.html
NeedsCompilation yes
License MIT + file LICENSE
Imports Rcpp ( $>=0.12 .3$ ), ggplot2 ( $>=2.1 .0$ ), GGally ( $>=1.0 .1$ ), future ( $>=1.21 .0$ ), doRNG ( $>=1.8 .2$ ), doParallel ( $>=1.0 .10$ ), foreach ( $>=1.4 .3$ ), abind ( $>=1.4-0$ ), mvtnorm ( $>=1.0-6$ ), MASS ( $>=7.3 .47$ ), $1 \mathrm{fe}(>=1.0-0)$
SystemRequirements A C++11 compiler.
Depends R (>=2.10)
LinkingTo Rcpp, RcppArmadillo
RoxygenNote 6.0.1
Repository CRAN
Date/Publication 2021-08-06 07:50:05 UTC

## Contents
- [gsynth-package](#gsynth-package)
- [cumuEff](#cumueff)
- [gsynth](#gsynth)
- [gsynth-internal](#gsynth-internal)
- [interFE](#interfe)
- [plot.gsynth](#plotgsynth)
- [print.gsynth](#printgsynth)
- [print.interFE](#printinterfe)
- [simdata](#simdata)
- [turnout](#turnout)
- [Index](#index)
gsynth-package
Generalized Synthetic Control Method

## Description

Implements the generalized synthetic control method based on interactive fixed effect models.

## Details

Implements the generalized synthetic control method. It imputes counterfactuals for each treated unit using control group information based on a linear interactive fixed effects model that incorporates unit-specific intercepts interacted with time-varying coefficients.

See gsynth for details.

\author{
Author(s) \\ Yiqing Xu <yiqingxu@stanfprd.edu>, Stanford University \\ Licheng Liu <liulch@mit.edu>, M.I.T.
}

## References

Yiqing Xu. 2017. "Generalized Synthetic Control Method: Causal Inference with Interactive Fixed Effects Models." Political Analysis, Vol. 25, Iss. 1, January 2017, pp. 57-76.

For more details, see https://yiqingxu.org/packages/gsynth/gsynth_examples.html.
cumuEff Calculate Cumulative or sub-gr Treatment Effects

## Description

Calculate Cumulative or sub-gr Treatment Effects

## Usage
cumuEff(x, cumu = TRUE, id = NULL, period = NULL)

## Arguments
\begin{tabular}{|l|l|}
\hline x & a gsynth object. \\
\hline cumu & a logical flag indicating whether to calculate cumulative effects or not. \\
\hline id & a string vector speicfying a sub-group of treated units that treatment effects are to be averaged on. \\
\hline period & a two-element numeric vector specifying the range of term during which treatment effects are to be accumulated. If left blank, atts at all post-treatment periods will be calculated. \\
\hline
\end{tabular}

## Value
catt esimated (cumulative) atts.
est.catt uncertainty estimates for catt.

## Author(s)

Yiqing Xu <yiqingxu@stanfprd.edu>, Stanford University
Licheng Liu <liulch@mit.edu>, M.I.T.

## References

Jushan Bai. 2009. "Panel Data Models with Interactive Fixed Effects." Econometrica 77:12291279.

Yiqing Xu. 2017. "Generalized Synthetic Control Method: Causal Inference with Interactive Fixed Effects Models." Political Analysis, Vol. 25, Iss. 1, January 2017, pp. 57-76.

## See Also
gsynth
```
gsynth
Generalized Synthetic Control Method
```


## Description

Implements the generalized synthetic control method based on interactive fixed effect models.

## Usage
```
gsynth(formula=NULL, data, Y, D, X = NULL, na.rm = FALSE,
    index, weight = NULL, force = "unit", cl = NULL, r = 0,
    lambda = NULL, nlambda = 10, CV = TRUE, criterion = "mspe",
    k = 5, EM = FALSE, estimator = "ife",
    se = FALSE, nboots = 200,
    inference = "nonparametric", cov.ar = 1, parallel = TRUE,
    cores = NULL, tol = 0.001, seed = NULL, min.T0 = 5,
    alpha = 0.05, normalize = FALSE)
```


## Arguments
\begin{tabular}{|l|l|}
\hline formula & an object of class "formula": a symbolic description of the model to be fitted. \\
\hline data & a data frame (must be with a dichotomous treatment but balanced is not required). \\
\hline Y & outcome. \\
\hline D & treatment. \\
\hline X & time-varying covariates. \\
\hline na.rm & a logical flag indicating whether to list-wise delete missing data. The algorithm will report an error if missing data exist. \\
\hline index & a two-element string vector specifying the unit (group) and time indicators. Must be of length 2 . \\
\hline weight & a string specifying the weighting variable(if any) to estimate the weighted average treatment effect. Default is weight = NULL. \\
\hline force & a string indicating whether unit or time fixed effects will be imposed. Must be one of the following, "none", "unit", "time", or "two-way". The default is "unit". \\
\hline cl & a string indicator the cluster variable. The default value is NULL. If cl = NULL, bootstrap will be blocked at unit level (only for non-parametric bootstrap). \\
\hline r & an integer specifying the number of factors. If CV $=$ TRUE, the cross validation procedure will select the optimal number of factors from $r$ to 5 . \\
\hline lambda & a single or sequence of positive numbers specifying the hyper-parameter sequence for matrix completion method. If lambda is a sequence and $\mathrm{CV}=1$, cross-validation will be performed. \\
\hline nlambda & an integer specifying the length of hyper-parameter sequence for matrix completion method. Default is nlambda $=10$. \\
\hline
\end{tabular}
\begin{tabular}{|l|l|}
\hline CV & a logical flag indicating whether cross-validation will be performed to select the optimal number of factors or hyper-parameter in matrix completion algorithm. If $r$ is not specified, the procedure will search through $r=0$ to 5 . \\
\hline criterion & a string specifying the criteria used for determining the number of factors. Choose from c ("mspe", "pc"). "mspe" stands for the mean squared prediction error obtained through the loocv procedure, and "pc" stands for a kind of information criterion. If criterion = "pc", the number of factors that minimize "pc" will be selected. Default is criterion = "mspe". \\
\hline k & a positive integer specifying cross-validation times for matrix completion algorithm. Default is $\mathrm{k}=5$. \\
\hline EM & a logical flag indicating whether an Expectation Maximization algorithm will be used (Gobillon and Magnac 2016). \\
\hline estimator & a string that controls the estimation method, either "ife" (interactive fixed effects) or "mc" (the matrix completion method). \\
\hline se & a logical flag indicating whether uncertainty estimates will be produced. \\
\hline nboots & an integer specifying the number of bootstrap runs. Ignored if se = FALSE. \\
\hline inference & a string specifying which type of inferential method will be used, either "parametric" or "nonparametric". "parametric" is recommended when the number of treated units is small. parametric bootstrap is not valid for matrix completion method. Ignored if estimator $=$ "mc". \\
\hline cov.ar & an integer specifying order of the auto regression process that the residuals follow. Used for parametric bootstrap procedure when data is in the form of unbalanced panel. The default value is 1 . \\
\hline parallel & a logical flag indicating whether parallel computing will be used in bootstrapping and/or cross-validation. Ignored if se = FALSE. \\
\hline cores & an integer indicating the number of cores to be used in parallel computing. If not specified, the algorithm will use the maximum number of logical cores of your computer (warning: this could prevent you from multi-tasking on your computer). \\
\hline tol & a positive number indicating the tolerance level. \\
\hline seed & an integer that sets the seed in random number generation. Ignored if se = FALSE and $r$ is specified. \\
\hline min.T0 & an integer specifying the minimum value of pre-treatment periods. Treated units with pre-treatment periods less than that will be removed automatically. This item is important for unbalanced panels. If users want to perform cross validation procedure to select the optimal number of factors from (r.min, r.max), they should set min. T0 larger than ( $r . \max +1$ ) if no individual fixed effects or ( $r . \max +2$ ) otherwise. If there are too few pre-treatment periods among all treated units, a smaller value of $r$.max is recommended. \\
\hline alpha & a positive number in the range of 0 and 1 specifying significant levels for uncertainty estimates. The default value is alpha $=0.05$. \\
\hline normalize & a logic flag indicating whether to scale outcome and covariates. Useful for accelerating computing speed when magnitude of data is large. The default is normalize=FALSE. \\
\hline
\end{tabular}

## Details
gsynth implements the generalized synthetic control method. It imputes counterfactuals for each treated unit using control group information based on a linear interactive fixed effects model that incorporates unit-specific intercepts interacted with time-varying coefficients. It generalizes the synthetic control method to the case of multiple treated units and variable treatment periods, and improves efficiency and interpretability. It allows the treatment to be correlated with unobserved unit and time heterogeneities under reasonable modeling assumptions. With a built-in cross-validation procedure, it avoids specification searches and thus is easy to implement. Data must be with a dichotomous treatment.

## Value
\begin{tabular}{|l|l|}
\hline Y.dat & a matrix storing data of the outcome variable. \\
\hline Y & name of the outcome variable. \\
\hline D & name of the treatment variable. \\
\hline X & name of the time-varying control variables. \\
\hline index & name of the unit and time indicators. \\
\hline id & a vector of unit IDs. \\
\hline time & a vector of time periods. \\
\hline obs.missing & a matrix storing status of each unit at each time point. 0 for missing, 1 for control group units, 2 for treat group units at pre-treatment period, 3 for treat group units at post-treatment period, and 4 for removed treated group units. Useful for unbalanced panel data. \\
\hline id.tr & a vector of IDs for the treatment units. \\
\hline id.co & a vector of IDs for the control units. \\
\hline removed.id & a vector of IDs for units that are removed. \\
\hline D. tr & a matrix of treatment indicator for the treated unit outcome. \\
\hline I.tr & a matrix of observation indicator for the treated unit outcome. \\
\hline Y.tr & data of the treated unit outcome. \\
\hline Y.ct & predicted counterfactuals for the treated units. \\
\hline Y.co & data of the control unit outcome. \\
\hline eff & difference between actual outcome and predicted $\mathrm{Y}(0)$. \\
\hline Y.bar & average values of Y.tr, Y.ct, and Y.co over time. \\
\hline att & average treatment effect on the treated over time (it is averaged based on the timing of the treatment if it is different for each unit). \\
\hline att.avg & average treatment effect on the treated. \\
\hline force & user specified force option. \\
\hline sameT0 & TRUE if the timing of the treatment is the same. \\
\hline T & the number of time periods. \\
\hline N & the total number of units. \\
\hline p & the number of time-varying observables. \\
\hline
\end{tabular}
\begin{tabular}{|l|l|}
\hline Ntr & the number of treated units. \\
\hline Nco & the number of control units. \\
\hline T0 & a vector that stores the timing of the treatment for balanced panel data. \\
\hline tr & a vector indicating treatment status for each unit. \\
\hline pre & a matrix indicating the pre-treatment/non-treatment status. \\
\hline post & a matrix indicating the post-treatment status. \\
\hline r.cv & the number of factors included in the model - either supplied by users or automatically chosen via cross-validation. \\
\hline lambda.cv & the optimal hyper-parameter in matrix completion method chosen via crossvalidation. \\
\hline res.co & residuals of the control group units. \\
\hline beta & coefficients of time-varying observables from the interactive fixed effect model. \\
\hline sigma2 & the mean squared error of interactive fixed effect model. \\
\hline IC & the information criterion. \\
\hline PC & the proposed criterion for determining factor numbers. \\
\hline est.co & result of the interactive fixed effect model based on the control group data. An interFE object. \\
\hline eff.cnt & difference between actual outcome and predicted $\mathrm{Y}(0)$; rearranged based on the timing of the treatment. \\
\hline Y.tr.cnt & data of the treated unit outcome, rearranged based on the timing of the treatment. \\
\hline Y.ct.cnt & data of the predicted $\mathrm{Y}(0)$, rearranged based on the timing of the treatment. \\
\hline MSPE & mean squared prediction error of the cross-validated model. \\
\hline CV.out & result of the cross-validation procedure. \\
\hline niter & the number of iterations in the estimation of the interactive fixed effect model. \\
\hline factor & estimated time-varying factors. \\
\hline lambda.co & estimated loadings for the control group. \\
\hline lambda.tr & estimated loadings for the treatment group. \\
\hline wgt.implied & estimated weights of each of the control group unit for each of the treatment group unit. \\
\hline mu & estimated ground mean. \\
\hline xi & estimated time fixed effects. \\
\hline alpha.tr & estimated unit fixed effects for the treated units. \\
\hline alpha.co & estimated unit fixed effects for the control units. \\
\hline validX & a logic value indicating if multicollinearity exists. \\
\hline inference & a string indicating bootstrap procedure. \\
\hline est.att & inference for att. \\
\hline est.att.avg & inference for att.avg. \\
\hline est.beta & inference for beta. \\
\hline est.ind & inference for att of each treated unit. \\
\hline att.avg.boot & bootstrap results for att.avg. \\
\hline att.boot & bootstrap results for att. \\
\hline beta.boot & bootstrap results for beta. \\
\hline
\end{tabular}

## Author(s)

Yiqing Xu <yiqingxu@stanfprd.edu>, Stanford University
Licheng Liu <liulch@mit.edu>, M.I.T.

## References

Laurent Gobillon and Thierry Magnac, 2016. "Regional Policy Evaluation: Interactive Fixed Effects and Synthetic Controls." The Review of Economics and Statistics, July 2016, Vol. 98, No. 3, pp. 535-551.

Yiqing Xu. 2017. "Generalized Synthetic Control Method: Causal Inference with Interactive Fixed Effects Models." Political Analysis, Vol. 25, Iss. 1, January 2017, pp. 57-76.
Athey S, Bayati M, Doudchenko N, et al. Matrix completion methods for causal panel data models[J]. arXiv preprint arXiv:1710.10251, 2017.

For more details, see https://yiqingxu.org/packages/gsynth/gsynth_examples.html.
For more details about the matrix completion method, see https://github.com/susanathey/MCPanel.

## See Also
```
plot.gsynth and print.gsynth
```


## Examples
```
library(gsynth)
data(gsynth)
out <- gsynth(Y ~ D + X1 + X2, data = simdata, parallel = FALSE,
    index = c("id","time"), force = "two-way",
    CV = TRUE, r = c(0, 5), se = FALSE)
print(out)
```

gsynth-internal Internal Gsynth Functions

## Description

Internal Gsynth functions

## Details

These are not to be called by the user (or in some cases are just waiting for proper documentation to be written :).
```
interFE
Interactive Fixed Effects Models
```


## Description

Estimating interactive fixed effect models.

## Usage
```
interFE(formula = NULL, data, Y, X, index, $r=0$, force = "none",
    se $=$ TRUE, nboots $=500$, seed $=$ NULL, tol $=1 \mathrm{e}-3$, normalize $=$ FALSE)
```


## Arguments
\begin{tabular}{|l|l|}
\hline formula & an object of class "formula": a symbolic description of the model to be fitted. \\
\hline data & a data frame (must be with a dichotomous treatment but balanced is not required). \\
\hline Y & outcome. \\
\hline X & time-varying covariates. \\
\hline index & a two-element string vector specifying the unit (group) and time indicators. Must be of length 2. \\
\hline r & an integer specifying the number of factors. \\
\hline force & a string indicating whether unit or time fixed effects will be imposed. Must be one of the following, "none", "unit", "time", or "two-way". The default is "unit". \\
\hline se & a logical flag indicating whether uncertainty estimates will be produced via bootstrapping. \\
\hline nboots & an integer specifying the number of bootstrap runs. Ignored if se = FALSE. \\
\hline seed & an integer that sets the seed in random number generation. Ignored if se = FALSE and $r$ is specified. \\
\hline tol & a numeric value that specifies tolerate level. \\
\hline normalize & a logic flag indicating whether to scale outcome and covariates. Useful for accelerating computing speed when magnitude of data is large.The default is normalize=FALSE. \\
\hline
\end{tabular}

## Details
interFE estimates interactive fixed effect models proposed by Bai (2009).

## Value
```
beta estimated coefficients.
mu estimated grand mean.
factor estimated factors.
```

\begin{tabular}{|l|l|}
\hline lambda & estimated factor loadings. \\
\hline VNT & a diagonal matrix that consists of the r eigenvalues. \\
\hline niter & the number of iteration before convergence. \\
\hline alpha & estimated unit fixed effect (if force is "unit" or "two-way"). \\
\hline xi & estimated time fixed effect (if force is "time" or "two-way"). \\
\hline residuals & residuals of the estimated interactive fixed effect model. \\
\hline sigma2 & mean squared error of the residuals. \\
\hline IC & the information criterion. \\
\hline ValidX & a logical flag specifying whether there are valid covariates. \\
\hline dat.Y & a matrix storing data of the outcome variable. \\
\hline dat.X & an array storing data of the independent variables. \\
\hline Y & name of the outcome variable. \\
\hline X & name of the time-varying control variables. \\
\hline index & name of the unit and time indicators. \\
\hline est.table & a table of the estimation results. \\
\hline est.boot & a matrix storing results from bootstraps. \\
\hline
\end{tabular}

## Author(s)

Yiqing Xu <yiqingxu@stanfprd.edu>, Stanford University
Licheng Liu <liulch@mit.edu>, M.I.T.

## References

Jushan Bai. 2009. "Panel Data Models with Interactive Fixed Effects." Econometrica 77:12291279.

## See Also
```
print.interFE and gsynth
```


## Examples
```
library(gsynth)
data(gsynth)
d <- simdata[-(1:150),] # remove the treated units
out <- interFE(Y ~ X1 + X2, data = d, index=c("id","time"),
    r = 2, force = "two-way", nboots = 50)
```

```
plot.gsynth Plotting
```


## Description

Visualizes estimation results of the generalized synthetic control method.

## Usage
```
## S3 method for class 'gsynth'
plot(x, type = "gap", xlim = NULL, ylim = NULL,
    xlab = NULL, ylab = NULL, legendOff = FALSE, raw = "none",
    main = NULL, nfactors = NULL, id = NULL, axis.adjust = FALSE,
    theme.bw = TRUE, shade.post = FALSE, ...)
```


## Arguments
\begin{tabular}{|l|l|}
\hline x & a gsynth object. \\
\hline type & a string that specifies the type of the plot. Must be one of the following: "gap" (plotting the average treatment effect on the treated; "raw" (plotting the raw data); "counterfactual", or "ct" for short, (plotting predicted $\mathrm{Y}(0)$ 's); "factors" (plotting estimated factors); "loadings" (plotting the distribution of estimated factor loadings); "missing" (plotting status of each unit at each time point). \\
\hline xlim & a two-element numeric vector specifying the range of x-axis. When class of time variable is string, must specify not original value but a counting number e.g. $x \lim =c(1,30)$. \\
\hline ylim & a two-element numeric vector specifying the range of $y$-axis. \\
\hline xlab & a string indicating the label of the x-axis. \\
\hline ylab & a string indicating the label of the y -axis. \\
\hline legendOff & a logical flag controlling whether to show the legend. \\
\hline raw & a string indicating whether or how raw data for the outcome variable will be shown in the "counterfactual" plot. Ignored if type is not "counterfactual". Must be one of the following: "none" (not showing the raw data); "band" (showing the middle 90 percentiles of the raw data); and "all" (showing the raw data as they are). \\
\hline main & a string that controls the title of the plot. If not supplied, no title will be shown. \\
\hline nfactors & a positive integer that specifies the number of factors to be shown. The maximum number if 4 . Ignored if type is not "factors" \\
\hline id & a unit identifier of which the predicted counterfactual or the difference between actual and predicted counterfactual is to be shown. It can also be a vector specifying units to be plotted if type=="missing" when data magnitude is large. Ignored if type is none of "missing", "counterfactual", "gap". \\
\hline axis.adjust & a logical flag indicating whether to adjust labels on x-axis. Useful when class of time variable is string and data magnitude is large. \\
\hline
\end{tabular}
theme.bw a logical flag indicating whether to use a black/white theme.
shade.post a logical flag controlling whether to shade the post-treatment periods.
$\ldots$ other argv.

## Details
plot.gsynth visualizes the raw data used by, or estimation results obtained from, the generalized synthetic control method.

## Author(s)

Yiqing Xu <yiqingxu@stanfprd.edu>, Stanford University
Licheng Liu <liulch@mit.edu>, M.I.T.

## References

Yiqing Xu. 2017. "Generalized Synthetic Control Method: Causal Inference with Interactive Fixed Effects Models." Political Analysis, Vol. 25, Iss. 1, January 2017, pp. 57-76.
See https://yiqingxu.org/packages/gsynth/gsynth_examples.html for more detailed information.

## See Also
gsynth and print.gsynth
\begin{tabular}{ll}
\hline print.gsynth & Print Results \\
\hline
\end{tabular}

## Description

Print results of the generalized synthetic control method.

## Usage
\#\# S3 method for class 'gsynth'
print(x, ...)

## Arguments
$x$ a gsynth object.
$\ldots$ other argv.

## Author(s)

Yiqing Xu <yiqingxu@stanfprd.edu>, Stanford University
Licheng Liu <liulch@mit.edu>, M.I.T.

## References

Yiqing Xu. 2017. "Generalized Synthetic Control Method: Causal Inference with Interactive Fixed Effects Models." Political Analysis, Vol. 25, Iss. 1, January 2017, pp. 57-76.

For more details, see https://yiqingxu.org/packages/gsynth/gsynth_examples.html.

## See Also
gsynth and plot.gsynth
\begin{tabular}{ll}
\hline print.interFE & Print Results \\
\hline
\end{tabular}

## Description

Print results of interactive fixed effects estimation.

## Usage
\#\# S3 method for class 'interFE'
print(x, ...)

## Arguments
$x \quad$ an interFE object.
$\ldots$ other argv.

## Author(s)

Yiqing Xu <yiqingxu@stanfprd.edu>, Stanford University
Licheng Liu <liulch@mit.edu>, M.I.T.

## References

Jushan Bai. 2009. "Panel Data Models with Interactive Fixed Effects." Econometrica 77:12291279.

## See Also
interFE and gsynth
simdata simdata

## Description

A simulated dataset.

## Format
dataframe

## References

Yiqing Xu. 2017. "Generalized Synthetic Control Method: Causal Inference with Interactive Fixed Effects Models." Political Analysis, Vol. 25, Iss. 1, January 2017, pp. 57-76.
For more details, see https://yiqingxu.org/packages/gsynth/gsynth_examples.html.
turnout turnout

## Description

State-level voter turnout data.

## Format
dataframe

## References

Melanie Jean Springer. 2014. How the States Shaped the Nation: American Electoral Institutions and Voter Turnout, 1920-2000. University of Chicago Press.
Yiqing Xu. 2017. "Generalized Synthetic Control Method: Causal Inference with Interactive Fixed Effects Models." Political Analysis, Vol. 25, Iss. 1, January 2017, pp. 57-76.
For more details, see https://yiqingxu.org/packages/gsynth/gsynth_examples.html.

## Index
```
* datasets
    simdata, 14
    turnout,14
* ts
    gsynth-internal,8
_gsynth_XXinv (gsynth-internal), 8
_gsynth_Y_demean (gsynth-internal), 8
_gsynth_beta_iter (gsynth-internal), 8
_gsynth_data_ub_adj (gsynth-internal), 8
_gsynth_fe_ad_covar_iter
        (gsynth-internal), 8
_gsynth_fe_ad_inter_covar_iter
        (gsynth-internal), 8
_gsynth_fe_ad_inter_iter
        (gsynth-internal),8
_gsynth_fe_ad_iter(gsynth-internal),8
_gsynth_fe_add (gsynth-internal), 8
_gsynth_inter_fe(gsynth-internal),8
_gsynth_inter_fe_mc (gsynth-internal),8
_gsynth_inter_fe_ub (gsynth-internal), 8
_gsynth_panel_beta(gsynth-internal),8
_gsynth_panel_est (gsynth-internal), 8
_gsynth_panel_factor (gsynth-internal),
        8
_gsynth_panel_fe(gsynth-internal),8
beta_iter (gsynth-internal), 8
ct.adjsut(gsynth-internal),8
cumuEff, 3
data_ub_adj (gsynth-internal), 8
fe_ad_covar_iter (gsynth-internal), 8
fe_ad_inter_covar_iter
        (gsynth-internal), 8
fe_ad_inter_iter (gsynth-internal), 8
fe_ad_iter (gsynth-internal), 8
fe_add (gsynth-internal), 8
gsynth, 2, 3, 4, 10-13
```

```
gsynth-internal,8
gsynth-package,2
gsynth.default(gsynth-internal),8
gsynth.formula(gsynth-internal), 8
initialFit(gsynth-internal),8
inter_fe (gsynth-internal), 8
inter_fe_mc (gsynth-internal), 8
inter_fe_ub (gsynth-internal), 8
interFE, 7, 9, 13
interFE.default(gsynth-internal),8
interFE.formula(gsynth-internal), 8
panel_beta(gsynth-internal),8
panel_est (gsynth-internal), 8
panel_factor (gsynth-internal), 8
panel_fe (gsynth-internal), 8
plot.gsynth, 8, 11, 13
print.gsynth, 8, 12, 12
print.interFE, 10, 13
res.vcov (gsynth-internal),8
simdata,14
synth.boot(gsynth-internal), 8
synth.core(gsynth-internal), 8
synth.em (gsynth-internal), 8
synth.mc (gsynth-internal), 8
turnout, 14
```

```
XXinv (gsynth-internal),8
Y_demean (gsynth-internal),8
```
