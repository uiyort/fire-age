# Competitor analysis

Reviewed October 2026. Moved here from the original calculator page because it is background for the project, not something users need while calculating.

| Tool | Strength | Gap | What this project takes or adds |
|---|---|---|---|
| [FIRECalc](https://firecalc.com) | Backtests against US history since 1871; popularised the success rate | US data only, no tax modelling, USD only, dated interface | Keeps the success rate, uses Monte Carlo with stated assumptions |
| [cFIREsim](https://www.cfiresim.com) | Historical and Monte Carlo, many spending strategies, income streams such as pensions | Many parameters, steep learning curve, US-centric | Pension bridge: pay in full before the pension, cover only the gap afterwards |
| [FI Calc](https://ficalc.app) | Modern interface, instant results, multiple withdrawal strategies | US data and USD, no backward solving | Recalculates on input, percentile bands instead of a single line |
| [ProjectionLab](https://projectionlab.com) | Full life planning, tax systems of several countries, strong visuals | Paid, complex, weak Asian coverage | One-click country parameters |
| [Networthify](https://networthify.com/calculator/earlyretirement) | Shows the savings rate is the first lever | Fixed returns, no risk, no inflation split | Sensitivity table over savings and return |
| [WalletBurst Coast FI](https://walletburst.com/tools/coast-fi-calc/) | Clear Coast FIRE concept | One scenario only | Lean, standard, Fat, Coast and Barista side by side |
| Chinese tools ([miniwebtool](https://miniwebtool.com/zh-cn/fire计算器-财务自由-提前退休/), [richify](https://www.richify.ai/cn/tools/fire-calculator)) | Chinese interface; some mention social insurance and family costs | Mostly translations, one currency, no backward solving, assumptions without source or date | Every default has a source and a date; consistent real-return basis |
| [Portfolio Charts](https://portfoliocharts.com) | Historical withdrawal rates by country and portfolio | Research tool, not a personal plan | Reminder that the 4% rule rests on US data; Pfau (2010) found it unsafe in most of 17 countries |

## Shared gaps this project targets

- One country and one currency, so saving in one place and retiring in another cannot be modelled.
- Forward only, answering "how many years" but not "what would it take".
- Nominal and real figures mixed together.
- Assumptions with no source or date.
