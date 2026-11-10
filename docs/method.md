# Method

The published version of this document is `site/method.html`, which is the authority for the formulas. The code that implements them is `site/js/engine.js`, with regression tests in `tests/engine.test.mjs`.

## Conventions

All amounts are real (today's purchasing power), computed in the work currency and converted for display at the current exchange rate.

## Formulas

| Quantity | Formula |
|---|---|
| Portfolio real return | `r = w × equityReal + (1 − w) × (bond10y − longRunInflation) − drag` |
| Long-run inflation | `(latest CPI + target) ÷ 2`, rounded to one decimal |
| Accumulation | `A(t+1) = A(t)(1 + r) + S(t)`, with `S(t) = income(1 + g)^t − expense` |
| Need with no pension | `E ÷ SWR(H)` |
| Need once the pension has started | `max(E − P, 0) ÷ SWR(H)` |
| Need before the pension starts | `min(Σ(k=0..b−1) E ÷ (1+r)^k + max(E − P, 0) ÷ SWR(H−b) ÷ (1+r)^b, E ÷ SWR(H))`, because a pension can only reduce the need |
| Holiday age | first year t whose simulated success rate (accumulate to t, then spend from t) is at least 80% |
| Fractional years | `t − 1 + (0.8 − success(t−1)) ÷ (success(t) − success(t−1))` |
| Holiday line at year t | 80th percentile over paths of `need(s) = spend(s) + need(s+1) ÷ growth(s)`, `need(end) = 0` |
| Portfolio volatility | `σ² = w²σe² + (1−w)²σb² + 2w(1−w)ρσeσb` |
| Retirement spending estimate | `expense ÷ FX(work) × (PL(retire) ÷ PL(work)) × FX(retire)` |

`SWR(H)` is 3.9% up to 30 years (Morningstar 2026), then falls linearly through 3.5% at 40 years and 3.3% at 50 years to 3.1% at 60 years and beyond. The step-down past 30 years is this tool's own assumption, not Morningstar's. Since 2026-11 the SWR-based need is a fixed-return comparison (about 5 in 10) shown in the pro view; it no longer sets the holiday age.

The holiday age is the 8-in-10 age, computed in `site/js/odds.js` on the same draws as `monteCarlo`. The same module gives the 5-in-10 and 9-in-10 ages, the holiday line, the backward saving for 8 in 10, and ten decile paths. Every comparison in years (levers, places, sliders, variants, heat map, type, goals) uses it. Odds are rounded down when said in tenths; the slogan needs a success rate of at least 80%.

## Simulation

2,000 paths with log-normal annual returns whose median compounds at `r`. Seed 20261026, mulberry32 generator, Box-Muller transform. Default volatility is 17% for equities and 6% for bonds, with correlation 0.2. Withdrawals happen at the start of each retired year, net of any pension. A path succeeds if assets never run out before the planning age.

Assets cannot go below zero during accumulation, in either the deterministic path or the simulation: overspending is not carried as debt. Currency drift applies only when the work and retirement currencies differ, and it stops at retirement in both the need calculation and the simulation.

## Result features

- **Mondays and workdays:** `years × 365.25 ÷ 7` and `years × 250`, rounded. 250 is an approximation.
- **Holiday type:** four letters, 16 types in 4 groups, computed from the inputs. When: holiday age at most 50 is E, later or never is L. Where: same place as now is H, elsewhere is A. Luggage: retirement spending in the work currency, divided by the ratio of price levels, compared with current spending: at most 1.05 times is T, more is F. Fare: `assets × (1+r)^t ÷ assets at the holiday` at least 50% is G, otherwise S. Groups follow the middle letters: HT, HF, AT, AF. Progress is reported separately: reached, coasting (assets ≥ need at pension age ÷ (1+r)^years), on the way, waiting. The thresholds are this tool's own, not an academic standard.
- **Place ranking:** other assumptions held, retirement spending is converted at FX and scaled by the ratio of price levels; a pension is converted at FX only. Visas, tax, healthcare and currency risk are not included.
- **Drawn conclusion:** the life bar shows work and holiday years. The ten parallel people are the success rate times ten, rounded down. The money bar is assets ÷ holiday line, capped at 100%. Months of holiday saved are assets ÷ monthly retirement spending, rounded down.
- **Parallel lives:** the 2,000 paths are ordered from hardest (earliest to run out) to easiest (most left), cut into tenths, and the first path of each tenth is one of the ten people. The four lives told are tenths 1, 3, 6 and 9; "draw again" picks another path in the same tenths. The last, called waiting to be written, takes the hardest of the four and walks its draws with the person's own view of the years ahead, re-solving the 8-in-10 age; it shows its odds and the 1-in-20 bad year of its mix, and says it is not better. When working backward it keeps the chosen age. Those views set the long-run equity return, the bad-year cut, the stock share actually held, inflation, the bond yield and wage growth. Sliders can also write decisions into it. Answers are kept in the browser and can be carried into the professional view. When all six are answered, the six options are counted anonymously, as stated above the questions: the server adds one to each chosen option and stores nothing else, once per browser.
- **Bad-year cut:** off by default. When set, a portfolio fall of more than 15% cuts the next year's spending by that percentage, before any pension. It raises the success rate, so it can bring the 8-in-10 age forward. Life names follow from outcomes as listed on the method page.
- **Holiday card:** drawn in the browser. By default it shows no amounts and no saved share; "show amounts" adds them. "Show today's age" (on by default) also controls the route's start label and the route under the barcode. A type-only card has no numbers. The small print states the assumptions and "simulated under this tool's assumptions".

## Not modelled

Detailed tax law (approximated by `drag`), owner-occupied housing, one-off expenses, bequests, excess medical inflation, city-level living costs, and dynamic withdrawal strategies other than the bad-year cut.

## Reproducing a result

Export JSON from the pro view. It contains every assumption, the seed, the path count and the data version. Each data version is archived in `site/data/`.
