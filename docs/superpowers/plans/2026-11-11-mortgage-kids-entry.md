# Mortgage and children: entry, wording and double-counting guard

Source: review panel of 2026-11-11 (3 experts, 4 users, two rounds). Synthesis at
`.superpowers/sdd/2026-11-10-trust-batch-2/panel/synthesis.md`. The author accepted every consensus point and the
recommended option on each open question ("都按推荐", 2026-11-11). Spec: `docs/superpowers/specs/2026-11-08-trust-and-sharing-design.md`;
this plan overrides it where they differ (placement and wording of the mortgage/children section).

Branch `trust-batch-2`, worktree `.worktrees/trust-batch-2`. Shared context and global constraints:
`.superpowers/sdd/2026-11-10-trust-batch-2/context.md` (all still bind).

## Global constraints for this plan
- Model unchanged: items (mortgage, children) are inside 每月支出 and 退休后每月想花 and are removed when they end. No new input field, no include/exclude question.
- People without a mortgage or children see at most one extra grey line in the input form; no new boxes, no extra screen.
- No "比不算早 N 年" next to the big age. That comparison appears only inside the fold.
- No reference values for child costs or city spending.
- All copy below is exact; use it verbatim. `¥X` means the amount formatted with the existing `wholeMoney(amount, currency)` (currency sign included); `YYYY` is the mortgage end year as typed.

## Task 1: Model helpers and plain-text outputs (state.js, holiday.js, card.js, views.js townHtml)

1. `lifeIssue` in `site/js/state.js`: both comparisons become "greater than or equal": items monthly `>=` expense monthly gives the existing first message; items monthly `>=` retExp monthly (converted to work currency) gives the existing second message. Update unit tests that assumed `>`.
2. New export in `site/js/state.js`: `lifeSummary(S, data, thisYear = new Date().getFullYear())` returning `null` when `eventsOf(S, data, thisYear)` is empty, else
   `{ mortgageEnd: <endYear or null>, kidsTo22: <true if the kids event is in eventsOf, else false>, afterMonthly: <number>, low: <boolean> }`, where
   - `afterMonthly` = retirement spending per month once every item has ended, in the retirement currency, today's money: `(S.retExp − convert(sum of running item yearly amounts, work currency → retirement currency)) / 12`, rounded to a whole unit.
   - `low` is true when `afterMonthly` converted to the work currency is below 25% of `S.expense / 12`.
3. `townPlan` in `site/js/holiday.js`: when the typed town spend is below the items (the existing `ignored` condition), return `{ age: null, years: null, gain: null, ignored: true }` without solving. Otherwise unchanged (`ignored: false`). `cardPlace` therefore never names such a town. Update `tests/final-review.test.mjs` lines around 73-79 accordingly.
4. `townHtml` in `site/js/views.js`: when `plan.ignored`, the line is `在<name>每月花 ¥X：比月供和孩子的花销还少。把月供和孩子算进这里的花销，再看几岁能放假。` (no age). Other cases unchanged, and the old sentence `这里填的比月供和孩子的花销还少，这一行没有算这两项。` is removed.
5. `assumptionLine` in `site/js/card.js` takes `events = []`; when `events.length > 0`, append ` · 含到期支出` to the returned string. No amount. The caller in `site/js/app.js` (around line 899) passes `events: p.events`.
6. New export in `site/js/holiday.js`: `withoutItemsGain(p)` returning the whole number of years by which the holiday comes earlier with the items than without them: build `q = buildParams({ ...p, events: [] }, p.fx)`, compare `oddsYears(q)` with `oddsYears(p)`. Return `{ years: Math.round(without − with) }` when both are reachable; `{ unreachableWithout: true }` when only the version with items is reachable; `null` when `p.events` is empty or the version with items is unreachable.
7. Unit tests for 1, 2, 3, 4, 5, 6 (include: equal-to-expense is an issue; afterMonthly across currencies (CN work, TH retire); low true/false at the 25% edge; town ignored has no age and cardPlace returns the overseas place or null; assumptionLine with and without events; withoutItemsGain years ≥ 0 for a mortgage case and null without events).

## Task 2: The page (index.html, app.js, views.js, app.css, e2e)

1. Placement. The fold `#life-fold` moves out of its current spot (after `#inputs-box`) to directly under the 每月支出 field, after its `拆开来加` split, in the simple form; in the professional form it sits directly after the `当前年支出` field (`p-expense`). One DOM node, moved when the view changes (inputs keep their values and listeners). Closed, it reads as a single grey line styled like the `拆开来加` summary (not a card). Inputs inside a form must not submit it on Enter.
2. Summary text: `有房贷或孩子？到期后开销会降`.
3. Intro paragraph inside the fold (replaces `这些已经算在上面的每月支出里。到期以后，支出相应减少。`): `月供和孩子的花销，算在每月支出里，也算在退休后每月想花里。到期以后，这部分自动减掉。`
4. Under the inputs, when `lifeSummary` is not null, a status line `#life-after`: `到期后，退休后每月约花 ¥X。` (X = `afterMonthly`, retirement currency). When `low` is true, append: `比现在少很多。如果退休后每月想花里没有包含月供和孩子，请把它们加回去。`
5. Under that, when `withoutItemsGain(p)` gives `years ≥ 1`: `算上到期，比不算早 N 年放假。`; `years` 0: `算上到期，放假年龄没变。`; `unreachableWithout`: `不算到期的话，按现在的计划到不了。`; null: nothing.
6. Keep the existing note about nominal mortgage and children to 22, and add a last line: `没算：给孩子买房或婚嫁、赡养父母、出国读书、提前还款或利率变化。`
7. Tag `#life-tag` moves to directly under the big age line in the hero (simple view), and in the professional view stays directly under `#headline`. Text, built from `lifeSummary`: `已算：` + parts joined by `、` (`房贷到 YYYY` if mortgageEnd, `孩子到 22 岁` if kidsTo22) + ` · 之后每月约 ¥X ›`. Hidden when `lifeSummary` is null. Click opens `#inputs-box` and `#life-fold` and scrolls the fold into view.
8. Header note `#mode-note` in the simple view becomes `专业版：改收益、通胀等全部假设` (same as the static HTML); the pro-view text is unchanged.
9. 退休后每月想花 hint (`renderEstimate`, simple view): when `eventsOf` is non-empty, the hint is `估算值，请按你计划的实际生活改写。要包含月供和孩子，到期会自动减掉。`; otherwise unchanged.
10. Split link: when `#split-rent` holds a value above 0, show under the split row a button `房贷会还完？填上还到哪年 ›` that opens `#life-fold` and focuses `#life-mortgage`. Hidden otherwise.
11. Type note: when `eventsOf` is non-empty, under the type in `#type-section` show `<p class="fine">算上到期支出，放假可能更早，类型也可能跟着变。</p>`. No numbers.
12. `site/method.html` line ~91 names the old title; change it to the new title. Update `docs/method.md` if it names the old title or tag.
13. E2E: update `tests/e2e/life.spec.mjs` to the new texts and positions; add tests: the fold sits right after the expense field in simple view (and after `p-expense` in pro view); summary text; tag text with a mortgage `7500` to `2045` on defaults (exact string computed from the page's own values is fine, assert the `已算：房贷到 2045` prefix and `之后每月约 ¥` part); `#life-after` appears; low warning appears when 退休后每月想花 is set equal to the mortgage plus a little; mode-note text; split link shows only with rent > 0 and opens the fold; tag click opens the fold; town line with spend below the mortgage has no `岁`. Phone width 390 px: closed fold adds one line only (assert its height under 48 px).
14. Lint copy passes; full unit and e2e suites pass.
