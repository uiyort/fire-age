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
| Retirement spending estimate | `(expense − items) ÷ FX(work) × (PL(retire) ÷ PL(work)) × FX(retire) + items ÷ FX(work) × FX(retire)`, items = mortgage and children still running |

`SWR(H)` is 3.9% up to 30 years (Morningstar 2026), then falls linearly through 3.5% at 40 years and 3.3% at 50 years to 3.1% at 60 years and beyond. The step-down past 30 years is this tool's own assumption, not Morningstar's. Since 2026-11 the SWR-based need is a fixed-return comparison (about 5 in 10) shown in the pro view; it no longer sets the holiday age.

The holiday age is the 8-in-10 age, computed in `site/js/odds.js` on the same draws as `monteCarlo`. The same module gives the 5-in-10 and 9-in-10 ages, the holiday line, the backward saving for 8 in 10, and ten decile paths. Every comparison in years (levers, places, sliders, variants, heat map, type, goals) uses it. Odds are rounded down when said in tenths; the slogan needs a success rate of at least 80%.

## Simulation

2,000 paths with log-normal annual returns whose median compounds at `r`. Seed 20261026, mulberry32 generator, Box-Muller transform. Default volatility is 17% for equities and 6% for bonds, with correlation 0.2. Withdrawals happen at the start of each retired year, net of any pension. A path succeeds if assets never run out before the planning age.

Assets cannot go below zero during accumulation, in either the deterministic path or the simulation: overspending is not carried as debt. Currency drift applies only when the work and retirement currencies differ, and it stops at retirement in both the need calculation and the simulation.

## Result features

- **Mondays and workdays:** `years × 365.25 ÷ 7` and `years × 250`, rounded. 250 is an approximation.
- **Holiday type:** four letters, 16 types in 4 groups, computed from the inputs. The letters appear only on the method page, in exports and in `data-code` attributes; the result page and cards show the words. When: holiday age at most 50 is E (早班), later or never is L (正点). Where: same place as now is H (在地), elsewhere is A (远方). Luggage: retirement spending in the work currency, the part other than the mortgage and children divided by the ratio of price levels, compared with current spending: at most 1.05 times is T (轻装), more is F (宽裕). Fare: `assets × (1+r)^t ÷ assets at the holiday` at least 50% is G (老本), otherwise S (现攒). Groups follow the middle letters: HT 归园派, HF 主场派, AT 漫游派, AF 环球派. Progress is reported separately: reached, coasting (assets ≥ need at pension age ÷ (1+r)^years), on the way, waiting. The thresholds are this tool's own, not an academic standard. The type copy never states investment returns as certain (no 复利, 钱生钱, 替你上班); `tests/release.test.mjs` checks it.
- **Weakness line:** one sentence under each type, from the inputs, not personality. The first rule that fits wins: (1) progress is waiting; (2) the success rate at that age is under 80% (when working backward, at the age asked for); (3) the pension is 50% or more of spending after the holiday; (4) Where is A; (5) Luggage is F; (6) Fare is G; (7) When is E; (8) otherwise. A type-only card and the weakness sentences contain no numbers.
- **Place ranking:** other assumptions held, retirement spending is converted at FX and scaled by the ratio of price levels, except the mortgage and children, which are converted at FX only; a pension is converted at FX only. Visas, tax, healthcare and currency risk are not included. It is not one of the ways to retire earlier; it sits in its own fold.
- **Town:** the first part of the same fold (its heading says 国内 only when the retirement place is mainland China). The user types a place name (kept to its first 6 characters, stored only in the browser) and a monthly spending figure in the retirement currency; retirement spending becomes that figure × 12, everything else is unchanged, and the 8-in-10 age is compared with the current one. A typed figure below the mortgage and children (converted to the retirement currency) cannot hold them, so that line leaves them out and says so. The tool supplies no per-city cost figures. When a town is typed and the age comes at least one month earlier, the card's "go to X for the holiday" uses the typed name ahead of the first foreign place, labelled 换个地方 (the spend was typed, not the same money); the card's note order is rewritten life > goal met > typed town > way to retire earlier > first foreign place (labelled 同样的钱); the fold title's "up to N years earlier" still counts only foreign places.
- **Drawn conclusion:** the life bar shows work and holiday years. The ten parallel people are the success rate times ten, rounded down. The money bar is assets ÷ holiday line, capped at 100%. Months of holiday saved are assets ÷ monthly retirement spending, rounded down.
- **Parallel lives:** the 2,000 paths are ordered from hardest (earliest to run out) to easiest (most left), cut into tenths, and the first path of each tenth is one of the ten people. The four lives told are tenths 1, 3, 6 and 9; "draw again" picks another path in the same tenths. The last, called waiting to be written, takes the hardest of the four and walks its draws with the person's own view of the years ahead, re-solving the 8-in-10 age; it shows its odds and the 1-in-20 bad year of its mix, and says it is not better. When working backward it keeps the chosen age. Those views set the long-run equity return, the bad-year cut, the stock share actually held, inflation, the bond yield and wage growth. Sliders can also write decisions into it. Answers are kept in the browser and can be carried into the professional view. When all six are answered, the six options are counted anonymously, as stated above the questions: the server adds one to each chosen option and stores nothing else, once per browser.
- **Bad-year cut:** off by default. When set, a portfolio fall of more than 15% cuts the next year's living spending by that percentage (children's costs count as living spending), before any pension. Self-paid insurance and a mortgage payment still due are paid in full. It raises the success rate, so it can bring the 8-in-10 age forward. Life names follow from outcomes as listed on the method page.
- **Holiday card:** drawn in the browser. By default it shows no amounts and no saved share; "show amounts" adds them. "Show today's age" (on by default) also controls the route's start label and the route under the barcode. A type-only card has no numbers. The small print states the assumptions and "simulated under this tool's assumptions".

## Pension estimate and self-pay

Shown only when the work place is mainland China, under the pension field. Enterprise-employee basic pension, in today's money, per month: `basic = base × (1 + average contribution index) ÷ 2 × contribution years × 1%` and `personal = account balance ÷ payout months` (Guo Fa [2005] No. 38 art. 6). Payout months are looked up by completed whole years of the claim age (60: 139, 63: 117). The account balance is the current balance plus 8% of `base × index` a year for the remaining years.

Statutory claim age follows the NPC Standing Committee decision of 2024-09-13 (in force 2025-01-01): men and women originally retiring at 55 delay 1 month per 4 months, up to 63 and 58; women originally retiring at 50, 1 month per 2 months, up to 55. The minimum contribution period rises from 15 years by 6 months a year from 2030 to 20 years in 2039; below it the page says no monthly pension is paid and counts 0; if the pension field still holds an earlier figure, the page says so and asks to clear it. The official comparison tables are images; the formula was checked against transcribed rows, not the images. Sources are in `docs/data-sources.md`.

This tool's settings (not official rules, not forecasts): the base is in today's money and moves only with prices; the account's interest equals inflation, so no interest is added; contribution years default to years paid plus years to the claim date and can be edited; a claim age that is not a whole year rounds up for the model while payout months use the completed years. The tool gives no default base: the user looks it up locally.

**Self-pay after the holiday:** no employer pays, so the user pays pension and medical insurance. Both are monthly amounts; pension defaults to `base × 60% × 20%` (20%: Guo Fa [2005] No. 38 art. 3; the 60% floor is set by each province and is only an editable default), medical is typed by the user. The model adds their monthly sum × 12 as extra spending from the holiday year through the claim year, in the need line and the simulation alike. It counts only when the work place is mainland China and a pension is filled in. It sits outside the "a pension can only help" cap, and the "without pension" comparison drops it too. Regional rules that let medical contributions stop after a set number of years are not modelled.

## Mortgage and children

Two entries under "mortgage or children? add and recalculate". They are already part of "monthly spending" and "retirement monthly spending"; the model does not add them again, it only subtracts them once they end. Both are monthly amounts in the work currency; the model uses × 12.

- **Mortgage is nominal:** the payment is fixed, so the real burden shrinks with long-run inflation; the real payment in year t is `payment × (1 + inflation)^−t`. Everything else stays in today's money.
- **Children's spending is real**, and counted to age 22 (this tool's setting). Several children are modelled at the youngest child's age, which is conservative.
- **End year:** "still paying through year X" counts payments through that year, so spending drops at the start of the following year (mortgage end age = rounded age + end year − this year + 1).
- The two together must not exceed monthly spending or retirement monthly spending; if they do the page says so and ignores them for now. The "already includes N items" tag counts the items actually used.
- **Retiring elsewhere:** the items do not follow local prices. In the automatic retirement spending estimate and the place ranking only the rest is scaled by the price ratio; the items are converted at FX, so the amount removed when one ends is the amount the spending holds.

## Not modelled

Detailed tax law (approximated by `drag`), owner-occupied housing, one-off expenses, bequests, excess medical inflation, city-level living costs, and dynamic withdrawal strategies other than the bad-year cut.

## Reproducing a result

Export JSON from the pro view. It contains every assumption, the seed, the path count and the data version. Each data version is archived in `site/data/`.
