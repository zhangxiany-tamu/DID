## Package 'bacondecomp'

> **Historical reference snapshot.** The version recorded here belongs to this
> snapshot and may differ from the installed package or validation ledger. Use
> [installed help](bacondecomp_quick_start.md#installed-help-topics) for current
> arguments. This file remains available as a historical fallback.

July 22, 2025
Type Package
Title Goodman-Bacon Decomposition
Version 0.1.1
Maintainer Evan Flack [evanjflack@gmail.com](mailto:evanjflack@gmail.com)
Description Decomposition for differences-in-differences with variation in treatment timing from Goodman-Bacon (2018) [doi:10.3386/w25018](doi:10.3386/w25018).

License MIT + file LICENSE
Depends R (>=2.10)
Suggests knitr, rmarkdown, testthat, ggplot2, covr
VignetteBuilder knitr
RoxygenNote 7.0.2
Encoding UTF-8
LazyData true
NeedsCompilation no
Author Evan Flack [aut, cre],
Edward Jee [aut]
Repository CRAN
Date/Publication 2020-01-24 20:40:02 UTC

## Contents
- [bacon](#bacon)
- [castle](#castle)
- [divorce](#divorce)
- [math_reform](#math_reform)

## Description

bacon() is a function that performs the Goodman-Bacon decomposition for differences-in-differences with variation in treatment timing (with or without time-varying covariates).

## Usage

bacon(formula, data, id_var, time_var, quietly = F)

## Arguments

| formula | an object of class "formula": a symbolic representation of the model to be fitted. Must be of the form $\mathrm{y} \sim \mathrm{D}+$ controls, where y is the outcome variable, D is the binary treatment indicator, and 'controls' can be any additional control variables. Do not include the fixed effects in the formula. If using '. ' notation must be of the form $\mathrm{y} \sim \mathrm{D}+.-\mathrm{FE} 1-\mathrm{FE} 2$ |
| :--- | :--- |
| data | a data.frame containing the variables in the model. |
| id_var | character, the name of id variable for units. |
| time_var | character, the name of time variable. |
| quietly | logical, default = FALSE, if set to TRUE then bacon() does not print the summary of estimates/weights by type (e.g. Treated vs Untreated) |

## Value

If control variables are included in the formula, then an object of class "list" with three elements:

| Omega | a number between 0 and 1, the weight of the within timing group coefficient |
| :--- | :--- |
| beta_hat_w | a number, the within timing group coefficient |
| two_by_twos | a data.frame with the covariate adjusted $2 \times 2$ estimates and weights |

If not control variables are included then only the two_by_twos data.frame is returned.

## Examples

```
# Castle Doctrine (Uncontrolled)
df_bacon <- bacon(l_homicide ~ post,
    data = bacondecomp::castle,
    id_var = "state",
    time_var = "year")
# Castle Doctrine (Controlled)
ret_bacon <- bacon(l_homicide ~ post + l_pop + l_income,
    data = bacondecomp::castle,
    id_var = "state",
    time_var = "year")
```

castle Data from Cheng and Hoekstra (2013, JHR)

## Description

Data from Cheng and Hoekstra (2013, JHR)

Usage
castle

## Format

A data.frame with 520 observations and 159 variables
st The state (unit of analysis).
year Calendar year (time).
l_homicide Log of state/year homicide rate
post Indicator whether castle reform has been implemented
divorce Data from Stevenson and Wolfers (2006, QJE)

## Description

Data from Stevenson and Wolfers (2006, QJE)

## Usage

divorce

## Format

A data.frame with 3366 observations and 147 variables
math_reform Aggregated data from Goodman (In Press)

## Description

A data set containing state/year level data on an educational reform and future income. This is an aggregated version of the data used by Goodman (2019, JOLE) to estimate the effect of compulsory high school math coursework on future earnings.

## Usage

math_reform

## Format

A data.frame with 520 observations and 5 variables
state The state (unit of analysis).
class The high school class (time).
reform_math Indicator for whether the reform was in place for the state/class.
reformyr_math The year the math reform was first implemented for the state. Set to NA if never implemented.
incearn_ln Natural log of future income.


