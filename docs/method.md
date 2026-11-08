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
| Fractional years to independence | `t − 1 + gapPrev ÷ (gapPrev + surplusNow)` |
| Portfolio volatility | `σ² = w²σe² + (1−w)²σb² + 2w(1−w)ρσeσb` |
| Retirement spending estimate | `expense ÷ FX(work) × (PL(retire) ÷ PL(work)) × FX(retire)` |

`SWR(H)` is 3.9% up to 30 years (Morningstar 2026), then falls linearly through 3.5% at 40 years and 3.3% at 50 years to 3.1% at 60 years and beyond. The step-down past 30 years is this tool's own assumption, not Morningstar's.

## Simulation

2,000 paths with log-normal annual returns whose median compounds at `r`. Seed 20261026, mulberry32 generator, Box-Muller transform. Default volatility is 17% for equities and 6% for bonds, with correlation 0.2. Withdrawals happen at the start of each retired year, net of any pension. A path succeeds if assets never run out before the planning age.

Assets cannot go below zero during accumulation, in either the deterministic path or the simulation: overspending is not carried as debt. Currency drift applies only when the work and retirement currencies differ, and it stops at retirement in both the need calculation and the simulation.

## Result features

- **Mondays and workdays:** `years × 365.25 ÷ 7` and `years × 250`, rounded. 250 is an approximation.
- **Holiday type:** four letters, 16 types in 4 groups, computed from the inputs. When: holiday age at most 50 is E, later or never is L. Where: same place as now is H, elsewhere is A. Luggage: retirement spending in the work currency, divided by the ratio of price levels, compared with current spending: at most 1.05 times is T, more is F. Fare: `assets × (1+r)^t ÷ assets at the holiday` at least 50% is G, otherwise S. Groups follow the middle letters: HT, HF, AT, AF. Progress is reported separately: reached, coasting (assets ≥ need at pension age ÷ (1+r)^years), on the way, waiting. The thresholds are this tool's own, not an academic standard.
- **Place ranking:** other assumptions held, retirement spending is converted at FX and scaled by the ratio of price levels; a pension is converted at FX only. Visas, tax, healthcare and currency risk are not included.
- **Drawn conclusion:** the life bar shows work and holiday years. The ten parallel people are the success rate times ten, rounded, with ten reserved for exactly 100% and none for exactly 0%. The money bar is assets ÷ need, capped at 100%.
- **Parallel lives:** the first four are simulated paths under the same rules, with seeds shown on the page, starting from four consecutive seeds from 20261026. The last, called waiting to be written, takes the hardest of the four (earliest to run out, then least left) and walks the same seed with the person's own view of the years ahead, re-solving the holiday age; when working backward from a chosen holiday age, it keeps that age and its saving plan. Those views set the long-run equity return, the bad-year cut, the stock share, inflation, the bond yield and wage growth. Sliders can also write decisions into it. Answers are kept in the browser and can be carried into the professional view. When all six are answered, the six options are counted anonymously, as stated above the questions: the server adds one to each chosen option and stores nothing else, once per browser.
- **Bad-year cut:** off by default. When set, a portfolio fall of more than 15% cuts the next year's spending by that percentage, before any pension. It changes the success rate, not the holiday age. Life names follow from outcomes as listed on the method page.

## Not modelled

Detailed tax law (approximated by `drag`), owner-occupied housing, one-off expenses, bequests, excess medical inflation, city-level living costs, and dynamic withdrawal strategies other than the bad-year cut.

## Reproducing a result

Export JSON from the pro view. It contains every assumption, the seed, the path count and the data version. Each data version is archived in `site/data/`.
