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

## Not modelled

Detailed tax law (approximated by `drag`), owner-occupied housing, one-off expenses, bequests, excess medical inflation, city-level living costs, and dynamic withdrawal strategies.

## Reproducing a result

Export JSON from the pro view. It contains every assumption, the seed, the path count and the data version. Each data version is archived in `site/data/`.
