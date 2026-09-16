## Package 'did'

> **Historical reference snapshot.** The version recorded here belongs to this
> snapshot and may differ from the installed package or validation ledger. Use
> [installed help](did_quick_start.md#installed-help-topics) for current
> arguments. This file remains available as a historical fallback.

July 22, 2025
Title Treatment Effects with Multiple Periods and Groups
Version 2.1.2
URL https://bcallaway11.github.io/did/, https://github.com/bcallaway11/did/
Description The standard Difference-in-Differences (DID) setup involves two periods and two groups -- a treated group and untreated group. Many applications of DID methods involve more than two periods and have individuals that are treated at different points in time. This package contains tools for computing average treatment effect parameters in Difference in Differences setups with more than two periods and with variation in treatment timing using the methods developed in Callaway and Sant'Anna (2021) [doi:10.1016/j.jeconom.2020.12.001](doi:10.1016/j.jeconom.2020.12.001). The main parameters are group-time average treatment effects which are the average treatment effect for a particular group at a a particular time. These can be aggregated into a fewer number of treatment effect parameters, and the package deals with the cases where there is selective treatment timing, dynamic treatment effects, calendar time effects, or combinations of these. There are also functions for testing the Difference in Differences assumption, and plotting group-time average treatment effects.
Depends R (>= 3.5),
License GPL-2
Encoding UTF-8
LazyData true
Imports BMisc (>= 1.4.4), Matrix, pbapply, ggplot2, ggpubr, DRDID, generics, methods, tidyr
RoxygenNote 7.2.1
VignetteBuilder knitr
Suggests rmarkdown, plm, here, knitr, covr
NeedsCompilation no
Author Brantly Callaway [aut, cre],
Pedro H. C. Sant'Anna [aut]
Maintainer Brantly Callaway [brantly.callaway@uga.edu](mailto:brantly.callaway@uga.edu)
Repository CRAN
Date/Publication 2022-07-20 16:00:05 UTC

## Contents

- [aggte](#aggte)
- [AGGTEobj](#aggteobj)
- [att_gt](#att_gt)
- [build_sim_dataset](#build_sim_dataset)
- [conditional_did_pretest](#conditional_did_pretest)
- [did](#did)
- [DIDparams](#didparams)
- [ggdid](#ggdid)
- [ggdid.AGGTEobj](#ggdidaggteobj)
- [ggdid.MP](#ggdidmp)
- [glance.AGGTEobj](#glanceaggteobj)
- [glance.MP](#glancemp)
- [indicator](#indicator)
- [mboot](#mboot)
- [MP](#mp)
- [MP.TEST](#mptest)
- [mpdta](#mpdta)
- [pre_process_did](#pre_process_did)
- [print.AGGTEobj](#printaggteobj)
- [print.MP](#printmp)
- [process_attgt](#process_attgt)
- [reset.sim](#resetsim)
- [sim](#sim)
- [summary.AGGTEobj](#summaryaggteobj)
- [summary.MP](#summarymp)
- [summary.MP.TEST](#summarymptest)
- [test.mboot](#testmboot)
- [tidy.AGGTEobj](#tidyaggteobj)
- [tidy.MP](#tidymp)
- [trimmer](#trimmer)
aggte Aggregate Group-Time Average Treatment Effects

## Description

A function to take group-time average treatment effects and aggregate them into a smaller number of parameters. There are several possible aggregations including "simple", "dynamic", "group", and "calendar."

## Usage

```
aggte(
    MP,
    type = "group",
    balance_e = NULL,
    min_e = -Inf,
    max_e = Inf,
    na.rm = FALSE,
    bstrap = NULL,
    biters = NULL,
    cband = NULL,
    alp = NULL,
    clustervars = NULL
)
```


## Arguments

| MP | an MP object (i.e., the results of the att_gt() method) |
| :--- | :--- |
| type | Which type of aggregated treatment effect parameter to compute. One option is "simple" (this just computes a weighted average of all group-time average treatment effects with weights proportional to group size). Other options are "dynamic" (this computes average effects across different lengths of exposure to the treatment and is similar to an "event study"; here the overall effect averages the effect of the treatment across all positive lengths of exposure); "group" (this is the default option and computes average treatment effects across different groups; here the overall effect averages the effect across different groups); and "calendar" (this computes average treatment effects across different time periods; here the overall effect averages the effect across each time period). |
| balance_e | If set (and if one computes dynamic effects), it balances the sample with respect to event time. For example, if balance.e=2, aggte will drop groups that are not exposed to treatment for at least three periods. (the initial period when $\mathrm{e}=0$ as well as the next two periods when $\mathrm{e}=1$ and the $\mathrm{e}=2$ ). This ensures that the composition of groups does not change when event time changes. |
| min_e | For event studies, this is the smallest event time to compute dynamic effects for. By default, min_e = -Inf so that effects at all lengths of exposure are computed. |
| max_e | For event studies, this is the largest event time to compute dynamic effects for. By default, max_e = Inf so that effects at all lengths of exposure are computed. |
| na.rm | Logical value if we are to remove missing Values from analyses. Defaults is FALSE. |
| bstrap | Boolean for whether or not to compute standard errors using the multiplier bootstrap. If standard errors are clustered, then one must set bstrap=TRUE. Default is value set in the MP object. If bstrap is FALSE, then analytical standard errors are reported. |
| biters | The number of bootstrap iterations to use. The default is the value set in the MP object, and this is only applicable if bstrap=TRUE. |


| cband | Boolean for whether or not to compute a uniform confidence band that covers all of the group-time average treatment effects with fixed probability 1-alp. In order to compute uniform confidence bands, bstrap must also be set to TRUE. The default is the value set in the MP object |
| :--- | :--- |
| alp | the significance level, default is value set in the MP object. |
| clustervars | A vector of variables to cluster on. At most, there can be two variables (otherwise will throw an error) and one of these must be the same as idname which allows for clustering at the individual level. Default is the variables set in the MP object |

## Value

An AGGTEobj object that holds the results from the aggregation

## Examples

Initial ATT(g,t) estimates from att_gt()

```
data(mpdta)
out <- att_gt(yname="lemp",
    tname="year",
    idname="countyreal",
    gname="first.treat",
    xformla=NULL,
    data=mpdta)
```

You can aggregate the $\operatorname{ATT}(\mathrm{g}, \mathrm{t})$ in many ways.

## Overall ATT:

```
aggte(out, type = "simple")
#>
#> Call:
#> aggte(MP = out, type = "simple")
#>
#> Reference: Callaway, Brantly and Pedro H.C. Sant'Anna. "Difference-in-Differences with Multiple Tim
#>
#>
#> ATT Std. Error [ 95% Conf. Int.]
#> -0.04 0.013 -0.0654 -0.0145 *
#>
#>
#> ---
#> Signif. codes: `*' confidence band does not cover 0
#>
#> Control Group: Never Treated, Anticipation Periods: 0
#> Estimation Method: Doubly Robust
```


## Dynamic ATT (Event-Study):

```
aggte(out, type = "dynamic")
#>
#> Call:
#> aggte(MP = out, type = "dynamic")
#>
#> Reference: Callaway, Brantly and Pedro H.C. Sant'Anna. "Difference-in-Differences with Multiple Tim
#>
#>
#> Overall summary of ATT's based on event-study/dynamic aggregation:
#> ATT Std. Error [ 95% Conf. Int.]
#> -0.0772 0.02 -0.1165 -0.038 *
#>
#>
#> Dynamic Effects:
\begin{tabular}{|l|l|l|l|l|l|l|}
\hline \#> & Event time & Estimate & Std. Error & [95\% & Simult. & Conf. Band] \\
\hline \#> & -3 & 0.0305 & 0.0150 & & -0.0060 & 0.0670 \\
\hline \#> & -2 & -0.0006 & 0.0139 & & -0.0344 & 0.0333 \\
\hline \#> & -1 & -0.0245 & 0.0150 & & -0.0610 & 0.0121 \\
\hline \#> & 0 & -0.0199 & 0.0117 & & -0.0485 & 0.0087 \\
\hline \#> & 1 & -0.0510 & 0.0168 & & -0.0919 & -0.0100 * \\
\hline \#> & 2 & -0.1373 & 0.0380 & & -0.2299 & -0.0446 * \\
\hline \#> & 3 & -0.1008 & 0.0360 & & -0.1887 & -0.0130 * \\
\hline
\end{tabular}
#> ---
#> Signif. codes: `*' confidence band does not cover 0
#>
#> Control Group: Never Treated, Anticipation Periods: 0
#> Estimation Method: Doubly Robust
```


## ATT for each group:

```
aggte(out, type = "group")
#>
#> Call:
#> aggte(MP = out, type = "group")
#>
#> Reference: Callaway, Brantly and Pedro H.C. Sant'Anna. "Difference-in-Differences with Multiple Tim
#>
#>
#> Overall summary of ATT's based on group/cohort aggregation:
\begin{tabular}{lrrrr} 
\#> & ATT & Std. Error & [ 95\% & Conf. Int.] \\
\#> & -0.031 & 0.0127 & -0.0558 & -0.0062 *
\end{tabular}
#>
#>
#> Group Effects:
\begin{tabular}{lrrrrr} 
\#> & Group & Estimate & Std. Error [95\% & Simult. & Conf. Band] \\
\#> & 2004 & -0.0797 & 0.0308 & -0.1461 & -0.0134 * \\
\#> & 2006 & -0.0229 & 0.0175 & -0.0606 & 0.0148 \\
\#> & 2007 & -0.0261 & 0.0163 & -0.0612 & 0.0091
\end{tabular}
#> ---
```

```
#> Signif. codes: `*' confidence band does not cover 0
#>
#> Control Group: Never Treated, Anticipation Periods: 0
#> Estimation Method: Doubly Robust
```


## ATT for each calendar year:

```
aggte(out, type = "calendar")
#>
#> Call:
#> aggte(MP = out, type = "calendar")
#>
#> Reference: Callaway, Brantly and Pedro H.C. Sant'Anna. "Difference-in-Differences with Multiple Tim
#>
#>
#> Overall summary of ATT's based on calendar time aggregation:
#> ATT Std. Error [ 95% Conf. Int.]
#> -0.0417 0.0177 -0.0765 -0.0069 *
#>
#>
#> Time Effects:
#> Time Estimate Std. Error [95% Simult. Conf. Band]
#> 2004 -0.0105 0.0248 -0.0689 0.0479
#> 2005 -0.0704 0.0313 -0.1443 0.0035
#> 2006-0.0488 0.0199-0.0956-0.0020 *
#> 2007-0.0371-0.0143-0.0708-0.0033 *
#> ---
#> Signif. codes: `*' confidence band does not cover 0
#>
#> Control Group: Never Treated, Anticipation Periods: 0
#> Estimation Method: Doubly Robust
```

AGGTEobj
AGGTEobj

## Description

Objects of this class hold results on aggregated group-time average treatment effects
An object for holding aggregated treatment effect parameters.

## Usage

```
AGGTEobj(
    overall.att = NULL,
    overall.se = NULL,
    type = "simple",
```

```
    egt = NULL,
    att.egt = NULL,
    se.egt = NULL,
    crit.val.egt = NULL,
    inf.function = NULL,
    min_e = NULL,
    max_e = NULL,
    balance_e = NULL,
    call = NULL,
    DIDparams = NULL
)
```


## Arguments

| overall.att | The estimated overall ATT |
| :--- | :--- |
| overall.se | Standard error for overall ATT |
| type | Which type of aggregated treatment effect parameter to compute. One option is "simple" (this just computes a weighted average of all group-time average treatment effects with weights proportional to group size). Other options are "dynamic" (this computes average effects across different lengths of exposure to the treatment and is similar to an "event study"; here the overall effect averages the effect of the treatment across all positive lengths of exposure); "group" (this is the default option and computes average treatment effects across different groups; here the overall effect averages the effect across different groups); and "calendar" (this computes average treatment effects across different time periods; here the overall effect averages the effect across each time period). |
| egt | Holds the length of exposure (for dynamic effects), the group (for selective treatment timing), or the time period (for calendar time effects) |
| att.egt | The ATT specific to egt |
| se.egt | The standard error specific to egt |
| crit.val.egt | A critical value for computing uniform confidence bands for dynamic effects, selective treatment timing, or time period effects. |
| inf.function | The influence function of the chosen aggregated parameters |
| min_e | For event studies, this is the smallest event time to compute dynamic effects for. By default, min_e = -Inf so that effects at all lengths of exposure are computed. |
| max_e | For event studies, this is the largest event time to compute dynamic effects for. By default, max_e = Inf so that effects at all lengths of exposure are computed. |
| balance_e | If set (and if one computes dynamic effects), it balances the sample with respect to event time. For example, if balance.e=2, aggte will drop groups that are not exposed to treatment for at least three periods. (the initial period when $\mathrm{e}=0$ as well as the next two periods when $\mathrm{e}=1$ and the $\mathrm{e}=2$ ). This ensures that the composition of groups does not change when event time changes. |
| call | The function call to aggte |
| DIDparams | A DIDparams object |

## Value

an AGGTEobj

```
att_gt Group-Time Average Treatment Effects
```


## Description

att_gt computes average treatment effects in DID setups where there are more than two periods of data and allowing for treatment to occur at different points in time and allowing for treatment effect heterogeneity and dynamics. See Callaway and Sant'Anna (2021) for a detailed description.

## Usage

```
att_gt(
    yname,
    tname,
    idname = NULL,
    gname,
    xformla = NULL,
    data,
    panel = TRUE,
    allow_unbalanced_panel = FALSE,
    control_group = c("nevertreated", "notyettreated"),
    anticipation = 0,
    weightsname = NULL,
    alp = 0.05,
    bstrap = TRUE,
    cband = TRUE,
    biters = 1000,
    clustervars = NULL,
    est_method = "dr",
    base_period = "varying",
    print_details = FALSE,
    pl = FALSE,
    cores = 1
)
```


## Arguments

| yname | The name of the outcome variable |
| :--- | :--- |
| tname | The name of the column containing the time periods |
| idname | The individual (cross-sectional unit) id name |
| gname | The name of the variable in data that contains the first period when a particular observation is treated. This should be a positive number for all observations in treated groups. It defines which "group" a unit belongs to. It should be 0 for units in the untreated group. |


| xformla | A formula for the covariates to include in the model. It should be of the form $\sim \mathrm{X} 1+\mathrm{X} 2$. Default is NULL which is equivalent to $\mathrm{xformla}=\sim 1$. This is used to create a matrix of covariates which is then passed to the $2 \times 2$ DID estimator chosen in est_method. |
| :--- | :--- |
| data | The name of the data.frame that contains the data |
| panel | Whether or not the data is a panel dataset. The panel dataset should be provided in long format - that is, where each row corresponds to a unit observed at a particular point in time. The default is TRUE. When is using a panel dataset, the variable idname must be set. When panel=FALSE, the data is treated as repeated cross sections. |
| allow_unbalanced_panel |  |
|  | Whether or not function should "balance" the panel with respect to time and id. The default values if FALSE which means that att_gt() will drop all units where data is not observed in all periods. The advantage of this is that the computations are faster (sometimes substantially). |
| control_group | Which units to use the control group. The default is "nevertreated" which sets the control group to be the group of units that never participate in the treatment. This group does not change across groups or time periods. The other option is to set group="notyettreated". In this case, the control group is set to the group of units that have not yet participated in the treatment in that time period. This includes all never treated units, but it includes additional units that eventually participate in the treatment, but have not participated yet. |
| anticipation | The number of time periods before participating in the treatment where units can anticipate participating in the treatment and therefore it can affect their untreated potential outcomes |
| weightsname | The name of the column containing the sampling weights. If not set, all observations have same weight. |
| alp | the significance level, default is 0.05 |
| bstrap | Boolean for whether or not to compute standard errors using the multiplier bootstrap. If standard errors are clustered, then one must set bstrap=TRUE. Default is TRUE (in addition, cband is also by default TRUE indicating that uniform confidence bands will be returned. If bstrap is FALSE, then analytical standard errors are reported. |
| cband | Boolean for whether or not to compute a uniform confidence band that covers all of the group-time average treatment effects with fixed probability 1-alp. In order to compute uniform confidence bands, bstrap must also be set to TRUE. The default is TRUE. |
| biters | The number of bootstrap iterations to use. The default is 1000 , and this is only applicable if bstrap=TRUE. |
| clustervars | A vector of variables names to cluster on. At most, there can be two variables (otherwise will throw an error) and one of these must be the same as idname which allows for clustering at the individual level. By default, we cluster at individual level (when bstrap=TRUE). |
| est_method | the method to compute group-time average treatment effects. The default is "dr" which uses the doubly robust approach in the DRDID package. Other built-in |

methods include "ipw" for inverse probability weighting and "reg" for first step regression estimators. The user can also pass their own function for estimating group time average treatment effects. This should be a function $\mathrm{f}(\mathrm{Y} 1, \mathrm{Y} 0$, treat, covariates) where Y 1 is an $\mathrm{n} \times 1$ vector of outcomes in the post-treatment outcomes, Y 0 is an $n \times 1$ vector of pre-treatment outcomes, treat is a vector indicating whether or not an individual participates in the treatment, and covariates is an $n \times k$ matrix of covariates. The function should return a list that includes ATT (an estimated average treatment effect), and inf. func (an $\mathrm{n} \times 1$ influence function). The function can return other things as well, but these are the only two that are required. est_method is only used if covariates are included.
base_period Whether to use a "varying" base period or a "universal" base period. Either choice results in the same post-treatment estimates of ATT(g,t)'s. In pre-treatment periods, using a varying base period amounts to computing a pseudo-ATT in each treatment period by comparing the change in outcomes for a particular group relative to its comparison group in the pre-treatment periods (i.e., in pretreatment periods this setting computes changes from period $\mathrm{t}-1$ to period t , but repeatedly changes the value of t )
A universal base period fixes the base period to always be (g-anticipation-1). This does not compute pseudo-ATT(g,t)'s in pre-treatment periods, but rather reports average changes in outcomes from period $t$ to ( $g$-anticipation-1) for a particular group relative to its comparison group. This is analogous to what is often reported in event study regressions.
Using a varying base period results in an estimate of ATT(g,t) being reported in the period immediately before treatment. Using a universal base period normalizes the estimate in the period right before treatment (or earlier when the user allows for anticipation) to be equal to 0 , but one extra estimate in an earlier period.
print_details Whether or not to show details/progress of computations. Default is FALSE.
pl Whether or not to use parallel processing
cores The number of cores to use for parallel processing

## Value

an MP object containing all the results for group-time average treatment effects

## Examples:

Basic att_gt() call:
\# Example data
data(mpdta)
out1 <- att_gt(yname="lemp",
tname="year",
idname="countyreal",
gname="first.treat",
xformla=NULL,

```
            data=mpdta)
summary(out1)
#>
#> Call:
#> att_gt(yname = "lemp", tname = "year", idname = "countyreal",
#> gname = "first.treat", xformla = NULL, data = mpdta)
#>
#> Reference: Callaway, Brantly and Pedro H.C. Sant'Anna. "Difference-in-Differences with Multiple Tim
#>
#> Group-Time Average Treatment Effects:
#> Group Time ATT(g,t) Std. Error [95% Simult. Conf. Band]
#> 2004 2004-0.0105 0.0235 -0.0752 0.0542
#> 2004 2005-0.0704 0.0307 -0.1549 0.0140
#> 2004 2006-0.1373 0.0365 -0.2379 -0.0367 *
#> 2004 2007-0.1008 0.0383 -0.2062 0.0046
#> 2006 2004 0.0065 0.0236 -0.0585 0.0715
#> 2006 2005-0.0028 0.0195 -0.0564 0.0509
#> 2006 2006 -0.0046 0.0185 -0.0556 0.0464
#> 2006 2007-0.0412 0.0202 -0.0969 0.0145
#> 2007 2004 0.0305 0.0155 -0.0122 0.0733
#> 2007 2005-0.0027 0.0158 -0.0462 0.0408
#> 2007 2006 -0.0311 0.0176 -0.0794 0.0173
#> 2007 2007-0.0261 0.0167 -0.0720 0.0199
#> ---
#> Signif. codes: `*' confidence band does not cover 0
#>
#> P-value for pre-test of parallel trends assumption: 0.16812
#> Control Group: Never Treated, Anticipation Periods: 0
#> Estimation Method: Doubly Robust
```


## Using covariates:

```
out2 <- att_gt(yname="lemp",
        tname="year",
        idname="countyreal",
        gname="first.treat",
        xformla=~lpop,
        data=mpdta)
summary(out2)
#>
#> Call:
#> att_gt(yname = "lemp", tname = "year", idname = "countyreal",
#> gname = "first.treat", xformla = ~lpop, data = mpdta)
#>
#> Reference: Callaway, Brantly and Pedro H.C. Sant'Anna. "Difference-in-Differences with Multiple Tim
#>
#> Group-Time Average Treatment Effects:
#> Group Time ATT(g,t) Std. Error [95% Simult. Conf. Band]
#> 2004 2004 -0.0145 0.0233 -0.0759 0.0469
```

| \#> | 2004 | 2005 | -0.0764 | 0.0297 | -0.1546 |  | 0.0018 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| \#> | 2004 | 2006 | -0.1404 | 0.0348 | -0.2321 |  | -0.0488 |
| \#> | 2004 | 2007 | -0.1069 | 0.0340 | -0.1964 |  | -0.0174 |
| \#> | 2006 | 2004 | -0.0005 | 0.0236 | -0.0627 |  | 0.0618 |
| \#> | 2006 | 2005 | -0.0062 | 0.0184 | -0.0548 |  | 0.0424 |
| \#> | 2006 | 2006 | 0.0010 | 0.0194 | -0.0502 |  | 0.0521 |
| \#> | 2006 | 2007 | -0.0413 | 0.0189 | -0.0912 |  | 0.0086 |
| \#> | 2007 | 2004 | 0.0267 | 0.0145 | -0.0115 |  | 0.0650 |
| \#> | 2007 | 2005 | -0.0046 | 0.0163 | -0.0476 |  | 0.0384 |
| \#> | 2007 | 2006 | -0.0284 | 0.0191 | -0.0788 |  | 0.0219 |
| \#> | 2007 | 2007 | -0.0288 | 0.0166 | -0.0724 |  | 0.0149 |
| \#> | --- |  |  |  |  |  |  |
| \#> Signif. codes: `*' confidence band does not cover 0 |  |  |  |  |  |  |  |
| \#> |  |  |  |  |  |  |  |
| \#> | P-value | for | pre-test | of parallel | trends | assumption: | 0.23267 |
| \#> | Control | Group: | Never | Treated, | Anticipation | Periods: | 0 |
| \#> | Estimat | ion | Method: | Doubly Robust |  |  |  |

## Specify comparison units:

```
out3 <- att_gt(yname="lemp",
            tname="year",
            idname="countyreal",
            gname="first.treat",
            xformla=~lpop,
            control_group = "notyettreated",
            data=mpdta)
summary(out3)
#>
#> Call:
#> att_gt(yname = "lemp", tname = "year", idname = "countyreal",
#> gname = "first.treat", xformla = ~lpop, data = mpdta, control_group = "notyettreated")
#>
#> Reference: Callaway, Brantly and Pedro H.C. Sant'Anna. "Difference-in-Differences with Multiple Tim
#>
#> Group-Time Average Treatment Effects:
#> Group Time ATT(g,t) Std. Error [95% Simult. Conf. Band]
#> 2004 2004 -0.0212 0.0225 -0.0810 0.0386
#> 2004 2005-0.0816 0.0296 -0.1603 -0.0029 *
#> 2004 2006-0.1382 0.0382 -0.2397-0.0367 *
#> 2004 2007-0.1069 0.0353-0.2007-0.0131 *
#> 2006 2004 -0.0075 0.0236 -0.0703 0.0553
#> 2006 2005-0.0046 0.0193 -0.0559 0.0468
#> 2006 2006 0.0087 0.0171 -0.0367 0.0540
#> 2006 2007-0.0413 0.0195 -0.0931 0.0105
#> 2007 2004 0.0269 0.0136 -0.0093 0.0632
#> 2007 2005-0.0042 0.0158 -0.0461 0.0377
#> 2007 2006 -0.0284 0.0185 -0.0777 0.0208
#> 2007 2007-0.0288 0.0167 -0.0732 0.0156
```

```
#> ---
#> Signif. codes: `*' confidence band does not cover 0
#>
#> P-value for pre-test of parallel trends assumption: 0.23326
#> Control Group: Not Yet Treated, Anticipation Periods: 0
#> Estimation Method: Doubly Robust
```


## References

Callaway, Brantly and Pedro H.C. Sant'Anna. \"Difference-in-Differences with Multiple Time Periods.\" Journal of Econometrics, Vol. 225, No. 2, pp. 200-230, 2021. doi:10.1016/j.jeconom.2020.12.001, https://arxiv.org/abs/1803.09015

```
build_sim_dataset build_sim_dataset
```


## Description

A function for building simulated data

## Usage

build_sim_dataset(sp_list, panel = TRUE)

## Arguments

sp_list A list of simulation parameters. See reset. sim to generate some default values for parameters
panel whether to construct panel data (the default) or repeated cross sections data

## Value

a data.frame with the following columns

- G observations group
- X value of covariate
- id observation's id
- cluster observation's cluster (by construction there is no within-cluster correlation)
- period time period for current observation
- Y outcome
- treat whether or not this unit is ever treated

```
conditional_did_pretest
        Pre-Test of Conditional Parallel Trends Assumption
```


## Description

An integrated moments test for the conditional parallel trends assumption holding in all pre-treatment time periods for all groups

## Usage

```
conditional_did_pretest(
    yname,
    tname,
    idname = NULL,
    gname,
    xformla = NULL,
    data,
    panel = TRUE,
    allow_unbalanced_panel = FALSE,
    control_group = c("nevertreated", "notyettreated"),
    weightsname = NULL,
    alp = 0.05,
    bstrap = TRUE,
    cband = TRUE,
    biters = 1000,
    clustervars = NULL,
    est_method = "ipw",
    print_details = FALSE,
    pl = FALSE,
    cores = 1
)
```


## Arguments

| yname | The name of the outcome variable |
| :--- | :--- |
| tname | The name of the column containing the time periods |
| idname | The individual (cross-sectional unit) id name |
| gname | The name of the variable in data that contains the first period when a particular observation is treated. This should be a positive number for all observations in treated groups. It defines which "group" a unit belongs to. It should be 0 for units in the untreated group. |
| xformla | A formula for the covariates to include in the model. It should be of the form $\sim \mathrm{X} 1+\mathrm{X} 2$. Default is NULL which is equivalent to $\mathrm{xformla}=\sim 1$. This is used to create a matrix of covariates which is then passed to the $2 \times 2$ DID estimator chosen in est_method. |


| data | The name of the data.frame that contains the data |
| :--- | :--- |
| panel | Whether or not the data is a panel dataset. The panel dataset should be provided in long format - that is, where each row corresponds to a unit observed at a particular point in time. The default is TRUE. When is using a panel dataset, the variable idname must be set. When panel=FALSE, the data is treated as repeated cross sections. |
|  | allow_unbalanced_panel <br> Whether or not function should "balance" the panel with respect to time and id. The default values if FALSE which means that att_gt() will drop all units where data is not observed in all periods. The advantage of this is that the computations are faster (sometimes substantially). |
| control_group | Which units to use the control group. The default is "nevertreated" which sets the control group to be the group of units that never participate in the treatment. This group does not change across groups or time periods. The other option is to set group="notyettreated". In this case, the control group is set to the group of units that have not yet participated in the treatment in that time period. This includes all never treated units, but it includes additional units that eventually participate in the treatment, but have not participated yet. |
| weightsname | The name of the column containing the sampling weights. If not set, all observations have same weight. |
| alp | the significance level, default is 0.05 |
| bstrap | Boolean for whether or not to compute standard errors using the multiplier bootstrap. If standard errors are clustered, then one must set bstrap=TRUE. Default is TRUE (in addition, cband is also by default TRUE indicating that uniform confidence bands will be returned. If bstrap is FALSE, then analytical standard errors are reported. |
| cband | Boolean for whether or not to compute a uniform confidence band that covers all of the group-time average treatment effects with fixed probability 1-alp. In order to compute uniform confidence bands, bstrap must also be set to TRUE. The default is TRUE. |
| biters | The number of bootstrap iterations to use. The default is 1000 , and this is only applicable if bstrap=TRUE. |
| clustervars | A vector of variables names to cluster on. At most, there can be two variables (otherwise will throw an error) and one of these must be the same as idname which allows for clustering at the individual level. By default, we cluster at individual level (when bstrap=TRUE). |
| est_method | the method to compute group-time average treatment effects. The default is "dr" which uses the doubly robust approach in the DRDID package. Other built-in methods include "ipw" for inverse probability weighting and "reg" for first step regression estimators. The user can also pass their own function for estimating group time average treatment effects. This should be a function $\mathrm{f}(\mathrm{Y} 1, \mathrm{Y} 0$, treat, covariates) where Y 1 is an $\mathrm{n} \times 1$ vector of outcomes in the post-treatment outcomes, Y 0 is an $\mathrm{n} \times 1$ vector of pre-treatment outcomes, treat is a vector indicating whether or not an individual participates in the treatment, and covariates is an $\mathrm{n} \times \mathrm{k}$ matrix of covariates. The function should return a list that includes ATT (an estimated average treatment effect), and inf. func (an $\mathrm{n} \times 1$ influence function). |

The function can return other things as well, but these are the only two that are required. est_method is only used if covariates are included.
print_details Whether or not to show details/progress of computations. Default is FALSE.
pl Whether or not to use parallel processing
cores The number of cores to use for parallel processing

## Value

an MP. TEST object

## References

Callaway, Brantly and Sant'Anna, Pedro H. C. "Difference-in-Differences with Multiple Time Periods and an Application on the Minimum Wage and Employment." Working Paper https://arxiv.org/abs/1803.09015v2 (2018).

## Examples

```
## Not run:
data(mpdta)
pre.test <- conditional_did_pretest(yname="lemp",
    tname="year",
    idname="countyreal",
    gname="first.treat",
    xformla=~lpop,
    data=mpdta)
summary(pre.test)
## End(Not run)
```

did Difference in Differences

## Description

Difference in Differences with multiple periods and variation in treatment timing
DIDparams DIDparams

## Description

Object to hold did parameters that are passed across functions

## Usage

```
DIDparams(
    yname,
    tname,
    idname = NULL,
    gname,
    xformla = NULL,
    data,
    control_group,
    anticipation = 0,
    weightsname = NULL,
    alp = 0.05,
    bstrap = TRUE,
    biters = 1000,
    clustervars = NULL,
    cband = TRUE,
    print_details = TRUE,
    pl = FALSE,
    cores = 1,
    est_method = "dr",
    base_period = "varying",
    panel = TRUE,
    true_repeated_cross_sections,
    n = NULL,
    nG = NULL,
    nT = NULL,
    tlist = NULL,
    glist = NULL,
    call = NULL
)
```


## Arguments

| yname | The name of the outcome variable |
| :--- | :--- |
| tname | The name of the column containing the time periods |
| idname | The individual (cross-sectional unit) id name |
| gname | The name of the variable in data that contains the first period when a particular <br> observation is treated. This should be a positive number for all observations in |


|  | treated groups. It defines which "group" a unit belongs to. It should be 0 for units in the untreated group. |
| :--- | :--- |
| xformla | A formula for the covariates to include in the model. It should be of the form $\sim \mathrm{X} 1+\mathrm{X} 2$. Default is NULL which is equivalent to $\mathrm{xformla}=\sim 1$. This is used to create a matrix of covariates which is then passed to the $2 \times 2$ DID estimator chosen in est_method. |
| data | The name of the data.frame that contains the data |
| control_group | Which units to use the control group. The default is "nevertreated" which sets the control group to be the group of units that never participate in the treatment. This group does not change across groups or time periods. The other option is to set group="notyettreated". In this case, the control group is set to the group of units that have not yet participated in the treatment in that time period. This includes all never treated units, but it includes additional units that eventually participate in the treatment, but have not participated yet. |
| anticipation | The number of time periods before participating in the treatment where units can anticipate participating in the treatment and therefore it can affect their untreated potential outcomes |
| weightsname | The name of the column containing the sampling weights. If not set, all observations have same weight. |
| alp | the significance level, default is 0.05 |
| bstrap | Boolean for whether or not to compute standard errors using the multiplier bootstrap. If standard errors are clustered, then one must set bstrap=TRUE. Default is TRUE (in addition, cband is also by default TRUE indicating that uniform confidence bands will be returned. If bstrap is FALSE, then analytical standard errors are reported. |
| biters | The number of bootstrap iterations to use. The default is 1000 , and this is only applicable if bstrap=TRUE. |
| clustervars | A vector of variables names to cluster on. At most, there can be two variables (otherwise will throw an error) and one of these must be the same as idname which allows for clustering at the individual level. By default, we cluster at individual level (when bstrap=TRUE). |
| cband | Boolean for whether or not to compute a uniform confidence band that covers all of the group-time average treatment effects with fixed probability $1-\mathrm{alp}$. In order to compute uniform confidence bands, bstrap must also be set to TRUE. The default is TRUE. |
| print_details | Whether or not to show details/progress of computations. Default is FALSE. |
| pl | Whether or not to use parallel processing |
| cores | The number of cores to use for parallel processing |
| est_method | the method to compute group-time average treatment effects. The default is "dr" which uses the doubly robust approach in the DRDID package. Other built-in methods include "ipw" for inverse probability weighting and "reg" for first step regression estimators. The user can also pass their own function for estimating group time average treatment effects. This should be a function $\mathrm{f}(\mathrm{Y} 1, \mathrm{Y} 0$, treat, covariates) where Y 1 is an $\mathrm{n} \times 1$ vector of outcomes in the post-treatment outcomes, Y 0 is |

an $\mathrm{n} \times 1$ vector of pre-treatment outcomes, treat is a vector indicating whether or not an individual participates in the treatment, and covariates is an $n \times k$ matrix of covariates. The function should return a list that includes ATT (an estimated average treatment effect), and inf. func (an $\mathrm{n} \times 1$ influence function). The function can return other things as well, but these are the only two that are required. est_method is only used if covariates are included.
base_period Whether to use a "varying" base period or a "universal" base period. Either choice results in the same post-treatment estimates of ATT(g,t)'s. In pre-treatment periods, using a varying base period amounts to computing a pseudo-ATT in each treatment period by comparing the change in outcomes for a particular group relative to its comparison group in the pre-treatment periods (i.e., in pretreatment periods this setting computes changes from period $\mathrm{t}-1$ to period t , but repeatedly changes the value of t )
A universal base period fixes the base period to always be (g-anticipation-1). This does not compute pseudo-ATT(g,t)'s in pre-treatment periods, but rather reports average changes in outcomes from period $t$ to ( $g$-anticipation-1) for a particular group relative to its comparison group. This is analogous to what is often reported in event study regressions.
Using a varying base period results in an estimate of ATT(g,t) being reported in the period immediately before treatment. Using a universal base period normalizes the estimate in the period right before treatment (or earlier when the user allows for anticipation) to be equal to 0 , but one extra estimate in an earlier period.
panel Whether or not the data is a panel dataset. The panel dataset should be provided in long format - that is, where each row corresponds to a unit observed at a particular point in time. The default is TRUE. When is using a panel dataset, the variable idname must be set. When panel=FALSE, the data is treated as repeated cross sections.
true_repeated_cross_sections
Whether or not the data really is repeated cross sections. (We include this because unbalanced panel code runs through the repeated cross sections code)
$n \quad$ The number of observations. This is equal to the number of units (which may be different from the number of rows in a panel dataset).
nG The number of groups
nT The number of time periods
tlist a vector containing each time period
glist a vector containing each group
call Function call to att_gt
ggdid Plot did objects using ggplot2

## Description

Function to plot objects from the did package

## Usage

```
ggdid(object, ...)
```


## Arguments

```
object either aMP object or AGGTEobj object. See help(ggdid.MP) and help(ggdid.AGGTEobj).
... other arguments
```

ggdid.AGGTEobj Plot AGGTEobj objects

## Description

A function to plot AGGTEobj objects

## Usage

```
## S3 method for class 'AGGTEobj'
ggdid(
    object,
    ylim = NULL,
    xlab = NULL,
    ylab = NULL,
    title = "",
    xgap = 1,
    legend = TRUE,
    ref_line = 0,
    theming = TRUE,
)
```


## Arguments

| object | either a MP object or AGGTEobj object. See help(ggdid.MP) and help(ggdid.AGGTEobj). |
| :--- | :--- |
| ylim | optional y limits for the plot; setting here makes the $y$ limits the same across different plots |
| xlab | optional x-axis label |
| ylab | optional y -axis label |
| title | optional plot title |
| xgap | optional gap between the labels on the x -axis. For example, xgap=3 indicates that the labels should show up for every third value on the x -axis. The default is 1. |
| legend | Whether or not to include a legend (which will indicate color of pre- and posttreatment estimates). Default is TRUE. |


| ref_line | A reference line at this value, usually to compare confidence intervals to 0. Set <br> to NULL to omit. |
| :--- | :--- |
| theming | Set to FALSE to skip all theming so you can do it yourself. |
| $\ldots$ | other arguments |

ggdid.MP Plot MP objects using ggplot2

## Description

A function to plot MP objects

## Usage

```
## S3 method for class 'MP'
ggdid(
    object,
    ylim = NULL,
    xlab = NULL,
    ylab = NULL,
    title = "Group",
    xgap = 1,
    ncol = 1,
    legend = TRUE,
    group = NULL,
    ref_line = 0,
    theming = TRUE,
    grtitle = "Group",
)
```


## Arguments

| object | either a MP object or AGGTEobj object. See help(ggdid.MP) and help(ggdid.AGGTEobj). |
| :--- | :--- |
| ylim | optional y limits for the plot; setting here makes the y limits the same across different plots |
| xlab | optional x-axis label |
| ylab | optional y -axis label |
| title | optional plot title |
| xgap | optional gap between the labels on the x -axis. For example, xgap=3 indicates that the labels should show up for every third value on the x -axis. The default is 1. |
| ncol | The number of columns to include in the resulting plot. The default is 1 . |
| legend | Whether or not to include a legend (which will indicate color of pre- and posttreatment estimates). Default is TRUE. |


| group | Vector for which groups to include in the plots of ATT(g,t). Default is NULL, and, in this case, plots for all groups will be included (ggdid.MP only). |
| :--- | :--- |
| ref_line | A reference line at this value, usually to compare confidence intervals to 0 . Set to NULL to omit. |
| theming | Set to FALSE to skip all theming so you can do it yourself. |
| grtitle | Title to append before each group name (ggdid.MP only). |
| $\cdots$ | other arguments |

glance.AGGTEobj glance model characteristics from AGGTEobj objects

## Description

glance model characteristics from AGGTEobj objects

## Usage

```
## S3 method for class 'AGGTEobj'
glance(x, ...)
```


## Arguments

x a model of class AGGTEobj produced by the aggte() function
... other arguments passed to methods
glance.MP
glance model characteristics from MP objects

## Description

glance model characteristics from MP objects

## Usage

\#\# S3 method for class 'MP'
glance(x, ...)

## Arguments

x a model of class MP produced by the att_gt() function ... other arguments passed to methods
indicator indicator

## Description

indicator weighting function

## Usage

indicator(X, u)

## Arguments

X matrix of X's from the data
u a particular value to compare X's to

## Value

numeric vector

## Examples

```
data(mpdta)
dta <- subset(mpdta, year==2007)
X <- model.matrix(~lpop, data=dta)
X <- indicator(X, X[1,])
```

mboot Multiplier Bootstrap

## Description

A function to take an influence function and use the multiplier bootstrap to compute standard errors and critical values for uniform confidence bands.

## Usage

mboot(inf.func, DIDparams, pl = FALSE, cores = 1)

## Arguments

| inf.func | an influence function |
| :--- | :--- |
| DIDparams | DIDparams object |
| pl | whether or not to use parallel processing in the multiplier bootstrap, default=FALSE |
| cores | the number of cores to use with parallel processing, default=1 |

## Value

list with elements

| bres | results from each bootstrap iteration |
| :--- | :--- |
| V | variance matrix |
| se | standard errors |
| crit.val | a critical value for computing uniform confidence bands |

MP MP

## Description

Multi-period objects that hold results for group-time average treatment effects

## Usage

```
MP(
    group,
    t,
    att,
    V_analytical,
    se,
    c,
    inffunc,
    n = NULL,
    W = NULL,
    Wpval = NULL,
    aggte = NULL,
    alp = 0.05,
    DIDparams = NULL
)
```


## Arguments

| group | which group (defined by period first treated) an group-time average treatment effect is for |
| :--- | :--- |
| t | which time period a group-time average treatment effect is for |
| att | the group-average treatment effect for group group and time period $t$ |
| V_analytical | Analytical estimator for the asymptotic variance-covariance matrix for grouptime average treatment effects |
| se | standard errors for group-time average treatment effects. If bootstrap is set to TRUE, this provides bootstrap-based se. |
| C | simultaneous critical value if one is obtaining simultaneous confidence bands. Otherwise it reports the critical value based on pointwise normal approximation. |


| inffunc | the influence function for estimating group-time average treatment effects |
| :--- | :--- |
| n | the number of unique cross-sectional units (unique values of idname) |
| W | the Wald statistic for pre-testing the common trends assumption |
| Wpval | the p -value of the Wald statistic for pre-testing the common trends assumption |
| aggte | an aggregate treatment effects object |
| alp | the significance level, default is 0.05 |
| DIDparams | a DIDparams object. A way to optionally return the parameters of the call to att_gt() or conditional_did_pretest(). |

## Value

MP object
MP.TEST MP.TEST

## Description

An object that holds results from computing pre-test of the conditional parallel trends assumption

## Usage

```
MP.TEST(
    CvM = NULL,
    CvMb = NULL,
    CvMcval = NULL,
    CvMpval = NULL,
    KS = NULL,
    KSb = NULL,
    KScval = NULL,
    KSpval = NULL,
    clustervars = NULL,
    xformla = NULL
)
```


## Arguments

| CvM | Cramer von Mises test statistic |
| :--- | :--- |
| CvMb | a vector of bootstrapped Cramer von Mises test statistics |
| CvMcval | CvM critical value |
| CvMpval | p-value for CvM test |
| KS | Kolmogorov-Smirnov test statistic |
| KSb | a vector of bootstrapped KS test statistics |
| KScval | KS critical value |


| KSpval | p -value for KS test |
| :--- | :--- |
| clustervars | vector of which variables were clustered on for the test |
| xformla | formla for the X variables used in the test |

mpdta County Teen Employment Dataset

## Description

A dataset containing (the log of) teen employment in 500 counties in the U.S. from 2004 to 2007. This is a subset of the dataset used in Callaway and Sant'Anna (2021). See that paper for additional descriptions.

## Usage

mpdta

## Format

A data frame with 2000 rows and 5 variables:
year the year of the observation
countyreal a unique identifier for a particular county
lpop the $\log$ of 1000s of population for the county
lemp the log of teen employment in the county
first.treat the year that the state where the county is located raised its minimum wage, it is set equal to 0 for counties that have minimum wages equal to the federal minimum wage over the entire period.
treat whether or not a particular county is treated in that year

## Source

Callaway and Sant'Anna (2020)

```
pre_process_did Process did Function Arguments
```


## Description

Function to process arguments passed to the main methods in the did package as well as conducting some tests to make sure data is in proper format / try to throw helpful error messages.

## Usage

```
pre_process_did(
    yname,
    tname,
    idname,
    gname,
    xformla = NULL,
    data,
    panel = TRUE,
    allow_unbalanced_panel,
    control_group = c("nevertreated", "notyettreated"),
    anticipation = 0,
    weightsname = NULL,
    alp = 0.05,
    bstrap = FALSE,
    cband = FALSE,
    biters = 1000,
    clustervars = NULL,
    est_method = "dr",
    base_period = "varying",
    print_details = TRUE,
    pl = FALSE,
    cores = 1,
    call = NULL
)
```


## Arguments

| yname | The name of the outcome variable |
| :--- | :--- |
| tname | The name of the column containing the time periods |
| idname | The individual (cross-sectional unit) id name |
| gname | The name of the variable in data that contains the first period when a particular observation is treated. This should be a positive number for all observations in treated groups. It defines which "group" a unit belongs to. It should be 0 for units in the untreated group. |


| xformla | A formula for the covariates to include in the model. It should be of the form $\sim \mathrm{X} 1+\mathrm{X} 2$. Default is NULL which is equivalent to $\mathrm{xformla}=\sim 1$. This is used to create a matrix of covariates which is then passed to the $2 \times 2$ DID estimator chosen in est_method. |
| :--- | :--- |
| data | The name of the data.frame that contains the data |
| panel | Whether or not the data is a panel dataset. The panel dataset should be provided in long format - that is, where each row corresponds to a unit observed at a particular point in time. The default is TRUE. When is using a panel dataset, the variable idname must be set. When panel=FALSE, the data is treated as repeated cross sections. |
| allow_unbalanced_panel |  |
|  | Whether or not function should "balance" the panel with respect to time and id. The default values if FALSE which means that att_gt() will drop all units where data is not observed in all periods. The advantage of this is that the computations are faster (sometimes substantially). |
| control_group | Which units to use the control group. The default is "nevertreated" which sets the control group to be the group of units that never participate in the treatment. This group does not change across groups or time periods. The other option is to set group="notyettreated". In this case, the control group is set to the group of units that have not yet participated in the treatment in that time period. This includes all never treated units, but it includes additional units that eventually participate in the treatment, but have not participated yet. |
| anticipation | The number of time periods before participating in the treatment where units can anticipate participating in the treatment and therefore it can affect their untreated potential outcomes |
| weightsname | The name of the column containing the sampling weights. If not set, all observations have same weight. |
| alp | the significance level, default is 0.05 |
| bstrap | Boolean for whether or not to compute standard errors using the multiplier bootstrap. If standard errors are clustered, then one must set bstrap=TRUE. Default is TRUE (in addition, cband is also by default TRUE indicating that uniform confidence bands will be returned. If bstrap is FALSE, then analytical standard errors are reported. |
| cband | Boolean for whether or not to compute a uniform confidence band that covers all of the group-time average treatment effects with fixed probability 1-alp. In order to compute uniform confidence bands, bstrap must also be set to TRUE. The default is TRUE. |
| biters | The number of bootstrap iterations to use. The default is 1000 , and this is only applicable if bstrap=TRUE. |
| clustervars | A vector of variables names to cluster on. At most, there can be two variables (otherwise will throw an error) and one of these must be the same as idname which allows for clustering at the individual level. By default, we cluster at individual level (when bstrap=TRUE). |
| est_method | the method to compute group-time average treatment effects. The default is "dr" which uses the doubly robust approach in the DRDID package. Other built-in |

methods include "ipw" for inverse probability weighting and "reg" for first step regression estimators. The user can also pass their own function for estimating group time average treatment effects. This should be a function $\mathrm{f}(\mathrm{Y} 1, \mathrm{Y} 0$, treat, covariates) where Y 1 is an $\mathrm{n} \times 1$ vector of outcomes in the post-treatment outcomes, Y 0 is an $n \times 1$ vector of pre-treatment outcomes, treat is a vector indicating whether or not an individual participates in the treatment, and covariates is an $n \times k$ matrix of covariates. The function should return a list that includes ATT (an estimated average treatment effect), and inf.func (an $\mathrm{n} \times 1$ influence function). The function can return other things as well, but these are the only two that are required. est_method is only used if covariates are included.
base_period Whether to use a "varying" base period or a "universal" base period. Either choice results in the same post-treatment estimates of ATT(g,t)'s. In pre-treatment periods, using a varying base period amounts to computing a pseudo-ATT in each treatment period by comparing the change in outcomes for a particular group relative to its comparison group in the pre-treatment periods (i.e., in pretreatment periods this setting computes changes from period $\mathrm{t}-1$ to period t , but repeatedly changes the value of t )
A universal base period fixes the base period to always be (g-anticipation-1). This does not compute pseudo-ATT(g,t)'s in pre-treatment periods, but rather reports average changes in outcomes from period $t$ to ( $g$-anticipation-1) for a particular group relative to its comparison group. This is analogous to what is often reported in event study regressions.
Using a varying base period results in an estimate of ATT(g,t) being reported in the period immediately before treatment. Using a universal base period normalizes the estimate in the period right before treatment (or earlier when the user allows for anticipation) to be equal to 0 , but one extra estimate in an earlier period.
print_details Whether or not to show details/progress of computations. Default is FALSE.
pl Whether or not to use parallel processing
cores The number of cores to use for parallel processing
call Function call to att_gt

## Value

a DIDparams object

```
print.AGGTEobj print.AGGTEobj
```


## Description

prints value of a AGGTEobj object

## Usage

\#\# S3 method for class 'AGGTEobj'
print(x, ...)

## Arguments

x
a AGGTEobj object
...
extra arguments

| print.MP | print.MP |
| :--- | :--- |

## Description

prints value of a MP object

## Usage

\#\# S3 method for class 'MP'
print(x, ...)

## Arguments

x
a MP object
...
extra arguments
process_attgt Process Results from compute.att_gt()

## Description

Process Results from compute.att_gt()

## Usage

```
process_attgt(attgt.list)
```


## Arguments

```
attgt.list list of results from compute.att_gt()
```


## Value

list with elements:

```
group which group a set of results belongs to
tt which time period a set of results belongs to
att the group time average treatment effect
```

```
reset.sim
reset.sim
```


## Description

a function to create a "reasonable" set of parameters to create simulated panel data that obeys a parallel trends assumption. In particular, it provides parameters where the the effect of participating in the treatment is equal to one in all post-treatment time periods.

After calling this function, the user can change particular values of the parameters in order to generate dynamics, heterogeneous effects across groups, etc.

## Usage

reset.sim(time.periods $=4, \mathrm{n}=5000, \mathrm{ipw}=$ TRUE, reg $=$ TRUE)

## Arguments

time.periods The number of time periods to include
$n \quad$ The total number of observations
ipw If TRUE, sets parameters so that DGP is compatible with recovering ATT( $\mathrm{g}, \mathrm{t}$ )'s using IPW (i.e., where logit that just includes a linear term in X works). If FALSE, sets parameters that will be incompatible with IPW. Either way, these parameters can be specified by the user if so desired.
reg If TRUE, sets parameters so that DGP is compatible with recovering ATT(g,t)'s using regressions on untreated untreated potential outcomes. If FALSE, sets parameters that will be incompatible with using regressions (i.e., regressions that include only linear term in X). Either way, these parameters can be specified by the user if so desired.

## Value

list of simulation parameters
$\operatorname{sim} \operatorname{sim} \operatorname{sim}$

## Description

An internal function that builds simulated data, computes ATT(g,t)'s and some aggregations. It is useful for testing the inference procedures in the did function.

## Usage

```
sim(
    sp_list,
    ret = NULL,
    bstrap = TRUE,
    cband = TRUE,
    control_group = "nevertreated",
    xformla = ~X,
    est_method = "dr",
    clustervars = NULL,
    panel = TRUE
)
```


## Arguments

| sp_list | A list of simulation parameters. See reset. sim to generate some default values for parameters |
| :--- | :--- |
| ret | which type of results to return. The options are Wpval (returns 1 if the p-value from a Wald test that all pre-treatment ATT(g,t)'s are equal is less than .05 ), cband (returns 1 if a uniform confidence band covers 0 for groups and times), simple (returns 1 if, using the simple treatment effect aggregation results in rejecting that this aggregated treatment effect parameter is equal to 0 ), dynamic (returns 1 if the uniform confidence band from the dynamic treatment effect aggregation covers 0 in all pre- and post-treatment periods). The default value is NULL, and in this case the function will just return the results from the call to att_gt. |
| bstrap | whether or not to use the bootstrap to conduct inference (default is TRUE) |
| cband | whether or not to compute uniform confidence bands in the call to att_gt (the default is TRUE) |
| control_group | Whether to use the "nevertreated" comparison group (the default) or the "notyettreated" as the comparison group |
| xformla | Formula for covariates in att_gt (default is $\sim \mathrm{X}$ ) |
| est_method | Which estimation method to use in att_gt (default is "dr") |
| clustervars | Any additional variables which should be clustered on |
| panel | whether to simulate panel data (the default) or otherwise repeated cross sections data |

## Value

When ret=NULL, returns the results of the call to att_gt, otherwise returns 1 if the specified test rejects or 0 if not.
summary.AGGTEobj Summary Aggregate Treatment Effect Parameter Objects

## Description

A function to summarize aggregated treatment effect parameters.

## Usage

\#\# S3 method for class 'AGGTEobj'
summary(object, ...)

## Arguments

object an AGGTEobj object
$\ldots$ other arguments

| summary.MP | summary.MP |
| :--- | :--- |

## Description

prints a summary of a MP object

## Usage

\#\# S3 method for class 'MP'
summary(object, ...)

## Arguments

object an MP object
... extra arguments

```
summary.MP.TEST summary.MP.TEST
```


## Description

print a summary of test results

## Usage

\#\# S3 method for class 'MP.TEST'
summary(object, ...)

## Arguments

| object | an MP.TEST object |
| :--- | :--- |
| $\ldots$ | other variables |

test.mboot Multiplier Bootstrap for Conditional Moment Test

## Description

A slightly modified multiplier bootstrap procedure for the pre-test of the conditional parallel trends assumption

## Usage

test.mboot(inf.func, DIDparams, cores = 1)

## Arguments

inf.func an influence function
DIDparams DIDparams object
cores The number of cores to use to bootstrap the test statistic in parallel. Default is cores=1 which corresponds to not running parallel.

## Value

list
bres CvM test statistics for each bootstrap iteration
crit.val critical value for CvM test statistic
tidy.AGGTEobj tidy results from AGGTEobj objects

## Description

tidy results from AGGTEobj objects

## Usage

\#\# S3 method for class 'AGGTEobj'
tidy( $x, \ldots$ )

## Arguments

x a model of class AGGTEobj produced by the aggte() function
... Additional arguments to tidying method.
tidy.MP tidy results from MP objects

## Description

tidy results from MP objects

## Usage

\#\# S3 method for class 'MP'
tidy(x, ...)

## Arguments

x a model of class MP produced by the att_gt() function
... Additional arguments to tidying method.

```
trimmer
trimmer
```


## Description

A utility function to find observations that appear to violate support conditions. This function is not called anywhere in the code, but it is just useful for debugging some common issues that users run into.

## Usage

```
trimmer(
    g,
    tname,
    idname,
    gname,
    xformla,
    data,
    control_group = "notyettreated",
    threshold = 0.999
)
```


## Arguments

| g | is a particular group (below I pass in 2009) |
| :--- | :--- |
| tname | The name of the column containing the time periods |
| idname | The individual (cross-sectional unit) id name |
| gname | The name of the variable in data that contains the first period when a particular observation is treated. This should be a positive number for all observations in treated groups. It defines which "group" a unit belongs to. It should be 0 for units in the untreated group. |
| xformla | A formula for the covariates to include in the model. It should be of the form $\sim \mathrm{X} 1+\mathrm{X} 2$. Default is NULL which is equivalent to $\mathrm{xformla}=\sim 1$. This is used to create a matrix of covariates which is then passed to the $2 \times 2$ DID estimator chosen in est_method. |
| data | The name of the data.frame that contains the data |
| control_group | Which units to use the control group. The default is "nevertreated" which sets the control group to be the group of units that never participate in the treatment. This group does not change across groups or time periods. The other option is to set group="notyettreated". In this case, the control group is set to the group of units that have not yet participated in the treatment in that time period. This includes all never treated units, but it includes additional units that eventually participate in the treatment, but have not participated yet. |
| threshold | the cutoff for which observations are flagged as likely violators of the support condition. |

Value
list of ids of observations that likely violate support conditions

## Index

```
* datasets
    mpdta,26
aggte, 2
aggte(), 22, 35
AGGTEobj, 4, 6
att_gt,8
att_gt(), 3, 4, 9, 10, 15, 22, 25, 28, 35
build_sim_dataset,13
compute.att_gt(),30
conditional_did_pretest, 14
conditional_did_pretest(), 25
did,16
DIDparams, 17, 25, 29
ggdid,19
ggdid.AGGTEobj,20
ggdid.MP,21
glance.AGGTEobj, 22
glance.MP, 22
indicator,23
mboot,23
MP, 10, 24
MP.TEST, 16, 25
mpdta,26
pre_process_did, 27
print.AGGTEobj,29
print.MP,30
process_attgt,30
reset.sim,31
sim, 31
summary.AGGTEobj,33
summary.MP, 33
```

