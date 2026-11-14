# 放假年龄：评审修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix review items 1–9 and 11 on branch `overview-limits` (stopped result visible everywhere, value exits, the A11 near-miss flag, zero spending, backward placement, blank boxes, two-digit years, `放假年龄 —`, a ledger that adds up, SWR as a comparison only) and add the one-line item-10 note.

**Architecture:** Every rule stays in `problems()` and every ledger number in `storyRows()` (`site/js/state.js`); views.js renders, app.js wires. One new rule (A11, flag), one changed rule (B10 block → flag), new fixes on A3/A4/A6, one zero rule on spending, a new row family `draw:<age>` in `storyRows` for the ledger's ②. The only engine change is a guard: a withdrawal rate ≤ 0 makes the fixed-return need infinite.

**Tech Stack:** Zero-dependency static site, native ES modules (`site/js/*.js`), node:test (`tests/*.test.mjs`), Playwright (`tests/e2e/*.spec.mjs`, server on port 4173).

**Spec:** `docs/superpowers/specs/2026-11-14-overview-limits-review-fixes.md` (this batch; table §2 is the authority), on top of `docs/superpowers/specs/2026-11-11-overview-limits-ledger-design.md`. Evidence: `.superpowers/review/2026-11-13/synthesis.md` (file:line per item), `round2.md` (Decision, Fix details adopted — binding), screenshots in `E1/`, `E2/`, `U/` beside them. Earlier plan for conventions: `docs/superpowers/plans/2026-11-11-overview-limits-ledger.md`.

## Global Constraints

- Branch `overview-limits`, worktree `.worktrees/overview-limits`, base HEAD f25fd78. File:line references were read there; re-locate by content.
- Baseline: 499 unit tests, 187 browser tests. Every task ends with `npm test`, `npx playwright test` and `node scripts/lint-copy.mjs site/index.html site/method.html site/sources.html site/404.html` all passing. Tests whose asserted copy a task changes are rewritten in that task. The server on 4173 is the owner's (`reuseExistingServer`): never stop it.
- Keep each file's line endings (check with `file <path>`). CRLF: `site/js/state.js`, `site/js/views.js`, `site/css/app.css`, `site/index.html`, `site/method.html`, `docs/method.md`. LF: `site/js/app.js`, all `tests/**`. New files: LF.
- Commits: conventional subject (`feat: …`, `fix: …`, `docs: …`), body ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push; the owner checks http://localhost:4173 before any push.
- One source of truth: rules only in `problems()`, ledger and field-line numbers only in `storyRows()` (`site/js/state.js`). The page never judges a relation or recomputes a ledger number itself.
- Nothing on the page is computed from a refused value: while a `block` or `blank` is shown, every result-derived element stays hidden (`body.result-held`).
- Red (`--bad`) only for 拦住 and 待填; orange `!` (`--warn`) for flags (A10, A11, B10–B14). `✕` only means 拦住.
- Negative numbers and percentages use U+2212 `−`, via `num()` (state.js) and the ledger's `spct`/`pct(...).replace('-', '−')`; never `-`.
- Never mark while typing: rules are judged on blur, Enter, or a button (existing `refresh({ commit })` path). Buttons are never disabled.
- Symbols over sentences (owner: 框架为先讲解在后、轻量化少文字、简单版能走完、专业版不漏). New sentences in this batch: only `放假后汇率变化、养老金币种暂未区分` (panel decision). The simple view says only "X 成".
- Copy is verbatim from spec §2; numbers in it are examples formatted with `num` / `wholeMoney` / `roughMoney`; years are written plain (`2035`, not `2,035`).
- Model unchanged (2% growth, 八成, 2,000 paths, seed 20261026) except the SWR ≤ 0 guard in Task 5.
- 390 px: `document.documentElement.scrollWidth === 390` in every state this plan adds.

## Review Focus

1. Professional view with the split on, A3 or A11 fires and the person taps the value exit: the locked yearly total becomes old total + items, the mortgage lands in 房租和房贷 and the children in 其他, and A2 does not fire afterwards (test in Task 1).
2. Work in CN, retire in TH (simple view): the ledger's ② amounts, the `× N` denominator and the 放假线 are all in the work currency and `年支出 × N ≈ 放假线`; the `→ N 岁起` lines under 退休后每月想花 stay in THB, today's money (test in Task 4).
3. An old save with `retExp: 0` and `touched.retExp: true` opens: the page is held at once with `待填：退休后`, the box keeps its typed `0` (no placeholder involved), and typing 6000 + blur releases it (test in Task 1).
4. Backward mode with `想几岁放假 25` blocked, then the person switches to 几岁能放假: the 想几岁放假 group, its `✕ 1` and the chip all go, and the result appears (test in Task 3).
5. First visit on a phone, spending cleared, 算出 pressed: the chip shows above the full-width button; the person types a value and blurs: the chip goes and the next 算出 leaves the intro normally; 390 px has no horizontal scroll with the chip shown (test in Task 2).

---

### Task 1: Rules and their exits (items 2, 3, 4, 7)

**Files:**
- Modify: `site/js/state.js` — `missingFields` (~179), `problems()` A6 (~380-392), A3 (~445-459), A4 (~461-470), new A11 after A10 (~478-482), B2 loop (~492-502)
- Modify: `site/js/views.js` — `relText` (~603-611), `fieldLinesHtml` (~637-667, the `at === 'expense'` branch)
- Modify: `site/js/app.js` — `syncEstimateMark` (~1032-1041), `renderLines` (where block fixes are drawn under 每月支出, so A11's fixes draw there too)
- Test: `tests/problems.test.mjs` (extend), Create: `tests/e2e/exits.spec.mjs`

**Interfaces:**
- Consumes: existing `problems`, `FIELD_LABEL`, `num`, `fixesHtml`, `applyFix` (already applies several `set` keys in order, split keys through `setSplit`).
- Produces:
  - Problem `A11`: `{ id: 'A11', rule: 'A11', kind: 'flag', field: 'expense', at: 'expense', note: string, fixes: [Fix] }`. `note` is the line without `└` and `!`: `扣掉月供只剩 500/月` | `扣掉孩子只剩 X/月` | `扣掉月供和孩子只剩 X/月`; pro `…/年` with yearly amounts.
  - The "+ items" value fix shared by A3, A4, A11: text `${label(field)} + 月供[ + 孩子] → ${num(X)}`, aria `${label(field)}加上月供[和孩子]改成 ${num(X)}` (children only: `+ 孩子`, `加上孩子`). X in view units (simple monthly, pro yearly). `set`: split off → `{ [field]: state-units value }`; split on (A3/A11 only) → `{ 'split.rent': rent + m.monthly }` when the mortgage counts and `{ 'split.other': other + k.count × k.monthly }` when the children count (monthly state values).
  - A6 range rel: `{ sub: false, left: [{ label, value: y, year: true }], op: '不在', right: { label: null, range: [back, ahead] } }`; `relText` writes `right.range` as `${lo}–${hi}` (plain years).
  - Zero spending: `{ id: 'B2:expense', rule: 'B2', kind: 'block', field: 'expense', rel: { sub: false, left: [{ label, value: 0 }], op: null, right: null }, fixes: [] }`.
  - `missingFields(S)` also lists `retExp` when `S.retExp === 0 && S.touched?.retExp`.

- [ ] **Step 1: Write the failing unit tests** in `tests/problems.test.mjs` (helpers `S0`, `P`, `only`, `real`, `M` already there; amounts below are yearly state values)

```js
test('A3: the first exit adds the items to spending', () => {
  const q = only(S0({ expense: 84000, real: real(M) }), 'A3')[0];
  assert.equal(q.fixes[0].text, '每月支出 + 月供 → 14,500');
  assert.equal(q.fixes[0].aria, '每月支出加上月供改成 14,500');
  assert.deepEqual(q.fixes[0].set, { expense: 174000 });
  assert.deepEqual(q.fixes.slice(1).map(f => f.text), ['改月供']);
});
test('A3 with the split on: mortgage into 房租和房贷, children into 其他, no A2 after', () => {
  let S = S0({ real: real(M, { count: 1, age: 3, monthly: 2000 }) });
  for (const [k, v] of [['rent', 7500], ['food', 1000], ['other', 500]]) S = setSplit(S, k, String(v), DATA);
  const q = only(S, 'A3')[0];
  assert.equal(q.fixes[0].text, '每月支出 + 月供 + 孩子 → 18,500');
  assert.deepEqual(q.fixes[0].set, { 'split.rent': 15000, 'split.other': 2500 });
  for (const [k, v] of Object.entries(q.fixes[0].set)) S = setSplit(S, k.split('.')[1], String(v), DATA);
  assert.equal(S.expense, 18500 * 12);
  assert.deepEqual(P(S).filter(x => x.kind === 'block'), []);
});
test('A4: value exit first, estimate second', () => {
  const S = S0({ retExp: 72000, touched: { retExp: true }, expense: 216000, real: real(M) });
  const q = only(S, 'A4')[0];
  assert.equal(q.fixes[0].text, '退休后每月想花 + 月供 → 13,500');
  assert.deepEqual(q.fixes[0].set, { retExp: 162000 });
  assert.match(q.fixes[1].text, /^改回估算 ≈ /);
});
test('A11: estimated spending that leaves under a quarter flags under 每月支出', () => {
  const S = setField(setReal(setReal(S0({}), 'mortgage', 'monthly', '7500', DATA), 'mortgage', 'endYear', '2030', DATA), 'expense', '96000', DATA);
  const q = only(S, 'A11')[0];
  assert.equal(q.kind, 'flag'); assert.equal(q.field, 'expense'); assert.equal(q.note, '扣掉月供只剩 500/月');
  assert.equal(q.fixes[0].text, '每月支出 + 月供 → 15,500'); assert.deepEqual(q.fixes[0].set, { expense: 186000 });
  assert.deepEqual(P(S).filter(x => x.kind === 'block' || x.kind === 'blank'), []);
  assert.equal(P({ ...S, view: 'pro' }).find(x => x.rule === 'A11').note, '扣掉月供只剩 6,000/年');
});
test('A11: exactly a quarter left does not flag; typed retirement spending does not matter', () => {
  assert.deepEqual(only(S0({ expense: 120000, real: real(M) }), 'A11'), []);
  assert.equal(only(S0({ expense: 96000, retExp: 300000, touched: { retExp: true }, real: real(M) }), 'A11').length, 1);
  assert.deepEqual(only(S0({ expense: 90000, real: real(M) }), 'A11'), []);   // A3 blocks instead
});
test('zero: spending 0 blocks with no value button; typed retirement spending 0 is blank', () => {
  const z = only(S0({ expense: 0 }), 'B2').find(q => q.field === 'expense');
  assert.equal(z.kind, 'block'); assert.equal(z.rel.op, null); assert.deepEqual(z.fixes, []);
  assert.ok(P(S0({ retExp: 0, touched: { retExp: true } })).some(q => q.kind === 'blank' && q.field === 'retExp'));
  assert.ok(!P(S0({ expense: 0, retExp: 0 })).some(q => q.kind === 'blank' && q.field === 'retExp'));
});
test('A6: a two-digit year offers 20xx only when it lands in range; the line names the range', () => {
  const q = only(S0({ real: real({ monthly: 3000, endYear: 35 }) }), 'A6')[0];
  assert.equal(q.rel.op, '不在'); assert.deepEqual(q.rel.right.range, [1976, 2066]);
  assert.deepEqual(q.fixes.map(f => [f.text, f.aria]), [['→ 2035', '还到哪年改成 2035']]);
  assert.deepEqual(only(S0({ real: real({ monthly: 3000, endYear: 80 }) }), 'A6')[0].fixes, []);
  assert.deepEqual(only(S0({ real: real({ monthly: 3000, endYear: 2200 }) }), 'A6')[0].fixes, []);
});
test('relText writes a range as plain years', () => {
  assert.equal(relText(only(S0({ real: real({ monthly: 3000, endYear: 35 }) }), 'A6')[0].rel), '还到哪年 35 不在 1976–2066');
});
```

Add `relText` to the views.js import of this file. Update any existing A3/A6/A4/B10-free test that asserted the old fixes or `<` / `>` A6 text.

- [ ] **Step 2: Run** `node --test tests/problems.test.mjs` — Expected: the new tests FAIL (no A11, old fixes, old A6 op).

- [ ] **Step 3: Implement in `site/js/state.js`**
  - A3: prepend the "+ items" fix (field `expense`); keep `改月供` / `改孩子` focus fixes, drop `改每月支出` (the value button is the spending exit; the chip still lands in the field).
  - A4: fixes become `[+ items fix on retExp (retirement currency: X = whole(S.retExp/12) + whole(toRet(items monthly)), set retExp = S.retExp + toRet(itemsY) rounded), 改回估算 ≈ …]`.
  - A11 after A10: when `!a2 && no A3 && isSet(S.expense) && S.expense > 0 && itemsY > 0 && S.expense - itemsY < S.expense * LIMITS.low`. Amounts in the work currency; independent of `touched.retExp`.
  - A6: the out-of-range rel as in Interfaces; value fix only when `Number.isInteger(y) && y >= 0 && y <= 99 && 2000 + y` within `[back, ahead]`, text/aria written with the plain year (not `num`). Non-integer keeps `op: null`, no fix.
  - B2: spending exactly 0 (split off) adds the zero block above; `missingFields` as in Interfaces.
- [ ] **Step 4: Render in views.js / app.js**
  - `relText`: `right.range` → `${lo}–${hi}`; `op` printed as given (so `不在` reads `还到哪年 35 不在 1976–2066`).
  - `fieldLinesHtml` (`at === 'expense'`): after the `└` items and before B14, A11 as `<p class="row warn">${OP('└')} ${note} ${WARN}</p>`; its fixes render below it the same way block fixes under 每月支出 do (find the call that draws `fixesHtml` under the expense lines in `renderLines` and include flag problems that carry `fixes`).
  - `syncEstimateMark`: `.est-back` hidden when `!typed || A4 is among the marked problems` (read `markedNow`).
- [ ] **Step 5: Write the failing e2e** `tests/e2e/exits.spec.mjs` (390 × 844, mobile, `storageState` fresh; reuse `withSaved` from `limits.spec.mjs`):
  - `A11 shows under 每月支出 and its button adds the mortgage`: saved `{ expense: 96000, real: { mortgage: { monthly: 7500, endYear: 2030 }, kids: {...nulls} } }` → `.row.warn` under spending has text `└ 扣掉月供只剩 500/月 !`; `.chip` count 0; `#hero .hero-big` matches `/\d+ 岁放假/`; button `每月支出 + 月供 → 15,500` has `aria-label` `每月支出加上月供改成 15,500`; click → `#s-expense` value `15500`, the warn row gone.
  - `A3 value exit`: expense 84000 + mortgage 7500/2045 → chip `拦住：房贷 ›`; click `每月支出 + 月供 → 14,500` → chip gone, result shows.
  - `A4 hides the label link while blocked`: typed retExp 72000, expense 216000, mortgage → `.est-back` hidden; first fix button text `退休后每月想花 + 月供 → 13,500`; after tapping it `.est-back` visible.
  - `two-digit year`: fill `#life-mortgage` 3000, `#life-mortgage-end` 35, blur → the line under the year reads `还到哪年 35 不在 ${y − 50}–${y + 40} ✕` with `y = new Date().getFullYear()`; tap `→ 2035` → `#life-mortgage-end` value `2035`, no chip.
  - `zero`: fill `#s-expense` 0, blur → chip `拦住：每月支出 ›`, line `每月支出 0 ✕`, no fix button under it.
  - Review Focus 3: saved `{ retExp: 0, touched: { retExp: true } }` → chip `待填：退休后 ›` at open; fill `#s-retexp` 6000, blur → chip gone.
- [ ] **Step 6: Run** `npx playwright test tests/e2e/exits.spec.mjs` — FAIL before Step 4 wiring is complete, PASS after; then the full gate (Global Constraints).
- [ ] **Step 7: Commit** `feat: value exits for A3 A4 A6, A11 under monthly spending, zero spending stops` (+ Co-Authored-By line).

**Acceptance:** spec §2 rows 2, 3, 4, 7 visible in both views; A11 never puts a chip up; Review Focus 1 and 3 pass.

---

### Task 2: The stopped result is visible everywhere (items 1, 8)

**Files:**
- Modify: `site/js/views.js` — `heldHeroHtml` (~682), `heldHeadHtml` (~684), `stickyHtml` chip branch (~979), `sideCardHtml` chip branch (~1208)
- Modify: `site/js/app.js` — `holdResult` (~1178-1213), the side links (`<a href="#zone-learn">参数</a>`, ~998), `startIntro`/`endIntro` (~1731-1742)
- Modify: `site/index.html` — `.zone-nav` `参数` link (line 42) gets `data-needs-result`; the start row (line 93) gets `<span id="start-chip"></span>` before the button
- Modify: `site/css/app.css` — held rules (~94-98): `body.result-held #zone-learn { display: none; }`; hero chip shown only `@media (min-width: 1024px)`; `#start-chip` shown only under `body.intro.result-held`, on its own line above the full-width button
- Test: `tests/ledger.test.mjs` (held hero copy), Create: `tests/e2e/held.spec.mjs`; rewrite the assertions of `— 岁放假` / `财务独立 — 岁` / `— 岁` in existing specs (`grep -rn "— 岁" tests`)

**Interfaces:**
- Consumes: `chipText(list)`, the `[data-chip]` click handler (already calls `stopAtProblem()`), `[data-needs-result]` handler.
- Produces:
  - `heldHeroHtml(open = false, chip = '')`: `<div class="hero-big">放假年龄 ${NO_RESULT}${chip ? ` <button type="button" class="chip" data-chip>${chip}</button>` : ''}</div>` + the unchanged fund line.
  - `heldHeadHtml(view, chip = '')`: pro `<p class="say">财务独立年龄 ${NO_RESULT}</p>` with the same chip button appended; simple `''`.
  - Sticky and side card copy: simple `放假年龄 —`, pro `财务独立年龄 —` (NO_RESULT keeps `aria-label="暂无结果"`).

- [ ] **Step 1: Failing unit test** (`tests/ledger.test.mjs`): `strip(heldHeroHtml(false, '拦住：房贷 ›'))` starts with `放假年龄 — 拦住：房贷 ›`; `strip(stickyHtml(null, { pro: true, chip: 'x' }))` starts with `财务独立年龄 —`; `strip(sideCardHtml(null, { view: 'simple', chip: 'x' }))` starts with `放假年龄 —`; none contains `— 岁`.
- [ ] **Step 2: Failing e2e** `tests/e2e/held.spec.mjs`:
  - 1280 × 800: saved spending 84000 + mortgage 7500/2045 → `#hero .chip` visible with the same text as `#side-card .chip`; clicking the hero chip focuses `#life-mortgage` (A3 solid frame on the mortgage when loading state, per C19).
  - 390: same save → `#hero .chip` hidden, `#sticky-result .chip` visible; `#zone-learn` hidden (heading `你能决定的参数` not visible); `.zone-nav a` `参数` click focuses the stopped field.
  - Pro at 1280: `#zone-learn` hidden (no `敏感度` heading); headline text starts `财务独立年龄 —`.
  - Review Focus 5 (390, fresh storage): clear `#s-expense`, tap `#start-calc` → `#start-chip` visible with `待填：每月支出 ›`, `body.intro` still set, `scrollWidth === 390`; fill 6000, blur → `#start-chip` hidden; tap `#start-calc` → `body.intro` gone, `#hero .hero-big` matches `/\d+ 岁放假/`.
  - The example path test in `limits.spec.mjs` (0 fields, 3 taps) still passes unchanged.
- [ ] **Step 3: Run both** — FAIL.
- [ ] **Step 4: Implement** the Interfaces; `holdResult` passes `chipText(stops)` into `heldHeroHtml`/`heldHeadHtml` and writes the same chip into `#start-chip` (empty when not held). Because the hero is drawn once per set of numbers, redraw it when the chip text changes too (compare `chipText(stops)` with the last drawn). `#start-chip`'s button uses `class="chip" data-chip`.
- [ ] **Step 5: Run** the two tests, then the full gate.
- [ ] **Step 6: Commit** `fix: the stopped result shows its chip by the big age at 1024 px and on the first-visit page, reads 放假年龄 —, hides the empty learn zone`.

**Acceptance:** at 390, 1000 and 1280 px, in both views, a stop shows `放假年龄 —` / `财务独立年龄 —` and a chip in view without scrolling to the sidebar; nothing headed and empty is left while held.

---

### Task 3: Backward placement and blank boxes (items 5, 6)

**Files:**
- Modify: `site/js/app.js` — `SIMPLE_FIELDS` (~150-170): move the `tage` sub out of the 养老金 group into its own first group `{ legend: '想几岁放假', grp: 'tage', bwdOnly: true, fields: [tAge] }`; `placeRows` (~959-972) drops the tage move; `markProblems` (~857-885) handles placeholders
- Modify: `site/js/state.js` — `GROUP_OF.simple` (~217) `tage` maps to `'tage'`; `FORM_GROUPS` (~228) adds `'tage'`
- Modify: `site/css/app.css` only if the new fieldset needs the existing `bwdOnly` hiding (reuse it)
- Test: `tests/problems.test.mjs` (`groupStates` / `formGroupOf`), Create: `tests/e2e/tage.spec.mjs`

**Interfaces:**
- Consumes: `groupStates(S, list, data)`, `groupStatusHtml`, the existing `bwdOnly` visibility.
- Produces: `formGroupOf('tage', 'simple') === 'tage'`; `groupStates(...).tage` exists (`{ blank, block, … }`). Pro: unchanged (`tAge` stays in 退休后).
- Placeholder rule: an input marked with a `blank` problem (B1 or A5, `q.field` and `q.more`) has `placeholder=""`; its original placeholder is kept in `data-ph` and restored when the mark goes.

- [ ] **Step 1: Failing unit tests**: `formGroupOf('tage', 'simple') === 'tage'`; with `S0({ mode: 'bwd', tAge: 25 })`, `groupStates(S, P(S), DATA).tage.block === 1` and `.pension.block === 0`.
- [ ] **Step 2: Failing e2e** `tests/e2e/tage.spec.mjs` (390 mobile, then 1280):
  - Backward: switch to 想几岁放假, open the numbers → the first `fieldset` of `#simple-form` has legend `想几岁放假` and contains `#s-tage`; fill 25, blur → that legend shows `✕ 1`, the 养老金 legend shows none, chip `拦住：想几岁放假 ›`.
  - Review Focus 4: then switch back to 几岁能放假 → the 想几岁放假 group hidden, no `✕` in any legend, chip gone, `#hero .hero-big` matches `/\d+ 岁放假/`.
  - 1280: the first `.grp-head` row is 想几岁放假 (unchanged behaviour).
  - Blank boxes: clear `#s-expense`, blur → `#s-expense` has `placeholder` `""` and the red frame; fill 6000 → placeholder `0` again. Half-filled children (`#life-kid-count` 1 only, blur) → `#life-kid-monthly` placeholder `""`.
  - Tab order at 390 in backward mode: `#s-tage` comes before `#s-age`.
- [ ] **Step 3: Run** — FAIL.
- [ ] **Step 4: Implement** per Interfaces; the `fieldEl('tAge')` → `s-tage` mapping (app.js ~826) stays.
- [ ] **Step 5: Run** the tests, then the full gate (sidebar specs that count `.grp-head` rows must still pass).
- [ ] **Step 6: Commit** `fix: 想几岁放假 is its own first group when working backward, boxes waiting to be filled show no 0`.

**Acceptance:** spec §2 rows 5, 6.

---

### Task 4: The ledger adds up (item 9, item-10 note)

**Files:**
- Modify: `site/js/state.js` — `storyRows` ② (~667-721): the simple `retExp` row with a plan, new `draw:<age>` rows, the `times` row carries its denominator
- Modify: `site/js/views.js` — `ledgerHtml` (~715-931): `shown` excludes `after:*` (they stay for the field lines), draws `draw:*`; the `⇒` note; simple ① bridge line; pro ② FX note
- Modify: `site/js/app.js` — `ledgerNow` (~588-605) passes `mc` as it does now (check the simple view receives it)
- Test: `tests/ledger.test.mjs`, `tests/e2e/ledger.spec.mjs`

**Interfaces:**
- Consumes: `planFlows`, `firstDraw` (engine.js), the plan `{ p, t, need }`, `mc.bands[t][2]`.
- Produces (rows from `storyRows`, units by view: simple monthly, pro yearly, `whole`-rounded):
  - Engine spending without pension and self-pay at plan year `y`: `spendAt(p, t, y) = planFlows({ ...p, pension: 0, selfPay: 0 }, t, null).full[y]` (module-local in state.js; `retReal` already equals `spendAt(p, t, t)`).
  - Simple `retExp` row, with a plan: `value = spendAt(p, t, t) / 12`, `cur: 'work'`. Without a plan: unchanged (today's money, retirement currency). Pro `retExp` and `retReal` rows unchanged.
  - `draw:<age>` for each end age in `ends` with `age > holiday` (plan only): `{ key, section: 'after', op: '−', ages: [age, null], items: ['孩子'] | ['月供'] | both, less: what the engine counted for those items in their last year (age − 1), i.e. at plan year `y = age − 1 − p.age`, `spendAt(p, t, y)` minus the same with those items removed from `p` (this isolates the items from the mortgage's yearly drift) (simple monthly, pro yearly, work currency, `whole`-rounded), `lessTyped`: the typed amount; the cell shows `≈` before `less` when it differs from `lessTyped` (the mortgage, lighter in real terms), value: spendAt(p, t, age − p.age) in view units, cur: 'work', views: 'both' }`. Held: no `draw:*` rows.
  - `times` row: `{ value: N, draw: firstDraw(p, t) }` (yearly, work currency, the denominator).
- Ledger copy (normalised textContent):
  - ② item row: op cell `−`, then `54 起 孩子 2,000` (or `55 起 月供 ≈ 5,652` when the counted amount differs from the typed one), number cell `= ¥14,152`. `value` is exactly the spending of the year before minus `less` when the row above is that year; otherwise the difference also holds the mortgage's real-terms drift, which the `≈` on the mortgage marks. No strike-through in the ledger (struck stays in the field lines).
  - ⇒ note: simple `≈ 年支出 ${roughMoney(draw)} × ${N} 倍 · 八成年景够花到 ${life} 岁`; pro `≈ 年支出 ${wholeMoney(draw)} × ${N} 倍 · 反推提取率 …` (the rest is Task 5's).
  - Simple ① last row (state `ok` or backward, not `now`/`unreachable`/held): op `⇒`, label `${holiday} 岁时一般攒到 ${TOOL_TAG}`, number `roughMoney(mc.bands[t][2])`, or `—` until `mc` is ready.
  - Pro ②, only when `p.wCur !== p.rCur`, after the 退休币升值 row: `放假后汇率变化、养老金币种暂未区分`.

- [ ] **Step 1: Failing unit tests** in `tests/ledger.test.mjs` (`solve` as in the file; thisYear 2026; the literals are 2026-11 data, guard them with `if (DATA.version === '2026-11')` and always assert the engine relation):

```js
const family = () => {
  let s = { ...defaultState(DATA), age: 35, assets: 500000, income: 360000, touched: {} };
  s = setField(s, 'expense', '216000', DATA);
  for (const [g, k, v] of [['mortgage', 'monthly', '7500'], ['mortgage', 'endYear', '2045'], ['kids', 'count', '1'], ['kids', 'age', '3'], ['kids', 'monthly', '2000']]) s = setReal(s, g, k, v, DATA);
  return s;
};
test('simple ②: the first row is what the engine spends the first year, × N rebuilds the line', () => {
  const s = family(); const plan = solve(s); const { p, t } = plan;
  const rows = storyRows(s, DATA, 2026, plan);
  const first = rows.find(r => r.key === 'retExp'), times = rows.find(r => r.key === 'times');
  assert.equal(first.value, Math.round(firstDraw({ ...p, pension: 0, selfPay: 0 }, t) / 12));
  assert.equal(times.draw, firstDraw(p, t)); assert.equal(times.value, Math.round(plan.need / firstDraw(p, t)));
  assert.deepEqual(rows.filter(r => r.key.startsWith('draw:')).map(r => [r.ages[0], r.items, r.less, r.op]), [[54, ['孩子'], 2000, '−'], [55, ['月供'], 5652, '−']]);
  if (DATA.version === '2026-11') {
    assert.equal(p.age + t, 50); assert.equal(first.value, 16499); assert.equal(times.value, 21); assert.equal(Math.round(plan.need), 4149879);
    assert.deepEqual(rows.filter(r => r.key.startsWith('draw:')).map(r => r.value), [14152, 8500]);
    const pro = storyRows({ ...s, view: 'pro' }, DATA, 2026, plan);
    assert.deepEqual(pro.filter(r => r.key.startsWith('draw:')).map(r => r.value), [169825, 102000]);
  }
});
test('simple ②: the example numbers', () => {
  const s = defaultState(DATA); const plan = solve(s);
  const rows = storyRows(s, DATA, 2026, plan);
  assert.equal(rows.find(r => r.key === 'retExp').value, 6000);
  if (DATA.version === '2026-11') {
    assert.equal(plan.p.age + plan.t, 50); assert.equal(rows.find(r => r.key === 'times').value, 35);
    assert.equal(rows.find(r => r.key === 'saveLate').value, 11482);
    assert.equal(pct(plan.p.r, 2), '2.87%'); assert.equal(pct(plan.p.sigma, 1), '10.9%');
  }
});
test('ledger copy: − rows, the named denominator, the bridge line, the FX note', () => {
  const s = family(); const plan = solve(s);
  const mc = { bands: { [plan.t]: [0, 0, 5000000, 0, 0] } };
  const html = strip(ledgerHtml({ rows: storyRows(s, DATA, 2026, plan), odds: oddsAround(plan.p, plan.t), plan, p: plan.p, dispCur: 'CNY', mc }));
  assert.match(html, /− 54 起 孩子 2,000 = ¥14,152/);
  assert.match(html, /≈ 年支出 ¥19\.8万 × 21 倍 · 八成年景够花到 95 岁/);
  assert.match(html, /⇒ 50 岁时一般攒到 本工具设定 ¥500万/);
  assert.doesNotMatch(html, /汇率变化/);
});
```

Plus: Review Focus 2 — `setRetireCountry(family(), 'TH', DATA)`, simple rows: `retExp`, `draw:*` have `cur: 'work'` and `times.value === Math.round(need / times.draw)`; the field-line rows `after:*` keep `cur: 'retire'`. Pro ledger of that state contains `放假后汇率变化、养老金币种暂未区分`. Held (`plan = null`): no `draw:*` rows. Import `setField`, `setReal`, `pct` as needed. Rewrite older ledger tests that expected the struck `after:*` rows in the ledger or `≈ 年支出 × N 倍` without the amount.

- [ ] **Step 2: Run** `node --test tests/ledger.test.mjs` — FAIL.
- [ ] **Step 3: Implement** per Interfaces. `after:*` rows and `fieldLinesHtml` stay as they are (the `→ N 岁起` lines under 退休后每月想花 keep today's money in the retirement currency).
- [ ] **Step 4: e2e** in `tests/e2e/ledger.spec.mjs`: save the family numbers (simple, 390), open `怎么算的` → ② shows a row matching `/− \d+ 起 孩子 2,000 = ¥[\d,]+/`, the note matches `/≈ 年支出 ¥[\d.]+万 × \d+ 倍/`, ① ends with `/⇒ \d+ 岁时一般攒到 本工具设定 ¥[\d.]+万/` once the simulation is in; no `<s>` inside `#ledger` ② item rows; `scrollWidth === 390`.
- [ ] **Step 5: Run** the tests, then the full gate.
- [ ] **Step 6: Commit** `fix: ledger ② starts from what the engine spends, item rows subtract, × N names its denominator, ① ends with the median`.

**Acceptance:** for the family case, `16,499 × 12 × 21 ≈ 4,149,879` reads off the page; the simple ① median equals the pro `50 岁中位资产` for the same numbers.

---

### Task 5: Safe withdrawal rate as a comparison only (item 11)

**Files:**
- Modify: `site/js/state.js` — B10 (~533-537) becomes a flag
- Modify: `site/js/engine.js` — `fiNeed` (~72): a rate ≤ 0 returns `Infinity`
- Modify: `site/js/views.js` — `proLinesHtml` (~953-976): B10 line and the Morningstar line under `swr`; `ledgerHtml` pro note (~897); `THIRD_FIELDS` (~711) drops `'swr'`
- Modify: `site/js/app.js` — field label (~201) `安全提取率（对照）`; the orange frame for B10 the same way B11 gets it
- Test: `tests/problems.test.mjs`, `tests/ledger.test.mjs`, `tests/engine.test.mjs`, `tests/e2e/pro.spec.mjs`

**Interfaces:**
- Consumes: `swrFor(p, H)` (engine.js), the B11 rendering path (`out[q.field]` in `proLinesHtml`, orange `.f.warn`).
- Produces:
  - B10: `{ rule: 'B10', kind: 'flag', field: 'swr', rel: (unchanged: `安全提取率 12 > 10` / `安全提取率 0 ≤ 0`), fixes: [] }`; never a chip, never held.
  - Under the swr field (pro): `<p class="row">3.9% = Morningstar · 30 年 · 九成</p>`, and when B10 fires `<p class="row warn">! 安全提取率 12 &gt; 10</p>`.
  - Pro ⇒ note: `≈ 年支出 ¥197,987 × 21 倍 · 反推提取率 4.8%（八成）· 对照 ${pct(swrFor(p, p.life − p.age − t), 1)}` (auto 3.9 at ≤ 30 years, typed value when not auto).
  - `fiNeed(p, t, E, r)` returns `Infinity` when the withdrawal rate it divides by is ≤ 0, so `fwdSolve` gives `null` and `按固定收益算（约五成）` shows `—`.

- [ ] **Step 1: Failing tests**: `only(S0({ autoSwr: false, swr: 12, view: 'pro' }), 'B10')[0].kind === 'flag'` and `fixes` empty; `P(S0({ autoSwr: false, swr: 0 })).filter(q => q.kind === 'block')` is empty; `fwdSolve(toParams(S0({ autoSwr: false, swr: 0 }), DATA, 2026)) === null` and the same with `swr: -1`; pro ledger html for `S0({ autoSwr: false, swr: 5, view: 'pro' })` contains `对照 5.0%` and `（八成）`, auto contains `对照 3.9%` when the holiday lasts ≤ 30 years (else the `swrFor` value).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** per Interfaces; update `tests/e2e/pro.spec.mjs` cases that expected B10 to stop the result (the U screenshot case `u4c-06-swr-0.png`): now the result shows, the field has the orange frame and line, the fixed-return row reads `—`.
- [ ] **Step 4: Run** the tests, then the full gate.
- [ ] **Step 5: Commit** `fix: safe withdrawal rate only warns, its comparison follows the field and says 九成 against the page's 八成`.

**Acceptance:** typing 0 or 12 in 安全提取率（对照） never changes 财务独立年龄 and never shows a chip.

---

### Task 6: Method page and docs (items 4, 3, 11 tables; item-10 line)

**Files:**
- Modify: `site/method.html` — limits table (~152-176), list under it, `模型不包含` (~185-191)
- Modify: `docs/method.md` — "Limits on the page" (~68-79), "Not modelled" (~81-83), the "Under retirement spending" bullet (~65) mentions A11
- Test: `tests/method.test.mjs`

**Interfaces:** none (copy only). Copy:
- `金额` row: `≥ 0；每月支出大于 0；退休后每月想花填 0 算没填`.
- `安全提取率（对照）` row: second column empty, third column `大于 0，不超过 10%`.
- New row after `剩得很少`: `扣掉月供和孩子后每月支出剩下的` | `少于 25% 时提示` | (empty).
- `还到哪年` row unchanged; `模型不包含` adds `<li>放假后汇率变化、养老金币种暂未区分</li>`.
- `docs/method.md`: the same three facts in English (spending above 0, typed retirement spending of 0 counts as blank; safe withdrawal rate moves to warnings; under-25% left after the items warns under monthly spending), and "Exchange-rate changes after the holiday and the pension's own currency are not yet separated." under Not modelled.

- [ ] **Step 1: Failing test** in `tests/method.test.mjs`: the method page text contains `每月支出大于 0`, `退休后每月想花填 0 算没填`, `放假后汇率变化、养老金币种暂未区分`; the `安全提取率` row's second cell is empty; `docs/method.md` contains `not yet separated`.
- [ ] **Step 2: Run** `node --test tests/method.test.mjs` — FAIL.
- [ ] **Step 3: Edit** the two files (CRLF kept).
- [ ] **Step 4: Run** the full gate (lint-copy covers `site/method.html`).
- [ ] **Step 5: Commit** `docs: method page lists the zero spending rule, the under-25% flag, the warn-only withdrawal rate and the FX limit`.

---

## Rulings (decided here where the spec and the panel were silent)

1. The spending-side near-miss is a new rule `A11`, not a second A10; A10 under 退休后 stays as it is (typed only). Cost if wrong: a reviewer expecting one rule id; rename is local to state.js and tests.
2. A3 uses the panel's A11 button form `每月支出 + 月供 → X` (synthesis wrote `每月支出 → X`); A4 uses `退休后每月想花 + 月供 → X`. Cost: one copy change per rule.
3. Spending 0 reads `每月支出 0 ✕` with no value button (no meaning to guess, C26); retirement spending 0 is blank only when typed, so spending 0 is not reported twice. Cost: if the owner wants a hint value, add a fix.
4. A6 line `还到哪年 35 不在 1976–2066 ✕` (two characters 不在 plus the range), for both too low and too high. Cost: a word-free alternative later is a `relText` change.
5. First visit: the chip appears in the sticky start row above 算出 and the intro stays; the intro is not ended by a stopped 算出. Cost: if the owner prefers leaving the intro, `stopAtProblem` there calls `endIntro()` instead.
6. The main-column chip shows only at ≥ 1024 px (below, the top bar already holds it), so one chip is in view at a time. Cost: none at 900–1023 if the sticky bar is visible there (it is).
7. Ledger ② rows (controller override, 2026-11-14): `=` is the engine's spending that year; `−` is what the engine counted for the ending item in its last year, with `≈` when that differs from the typed amount (family: `55 起 月供 ≈ 5,652 = ¥8,500`, and 14,152 − 5,652 = 8,500 exactly, since the 54 row is the year before). Between rows further apart the gap also holds the mortgage's yearly real-terms drift (family 50 → 54: 16,499 − 2,000 vs 14,152), which the mortgage's `≈` marks. Reason: the panel required the ledger's arithmetic to add up (E2 item 9, E1 visible arithmetic); a typed 7,500 beside 14,152 → 8,500 reads as an error. Implementer: verify 5,652 from the engine (90,000 / 1.015^19 / 12) and children's counted amount equals the typed 2,000 in the 2026-11 data; if not, assert the engine relation and report the numbers.
8. With a plan, simple ② amounts are in the work currency (the 放假线's), while the `→ N 岁起` field lines keep the retirement currency and today's money. Cost: a cross-country simple user sees ¥ in ② and ฿ under the field; item 10 next batch revisits currencies.
9. The bridge line `⇒ 50 岁时一般攒到` is simple-only (pro already has `50 岁中位资产`) and absent for 现在就能放 / 到不了. Cost: one more row in pro if asked.
10. `× N` names its denominator as `年支出 ¥X` with X = `firstDraw` (spending + self-pay − pension that year), `roughMoney` in simple, `wholeMoney` in pro.
11. The FX note shows only when work and retirement currencies differ. Cost: none for same-currency users.
12. 安全提取率（对照） is the form label only; lines and the chip map keep `安全提取率`. The Morningstar fact sits under the field as `3.9% = Morningstar · 30 年 · 九成`. The ≤ 0 guard lives in `fiNeed` (engine), the one place every fixed-return comparison passes through.
13. Item 8 (`放假年龄 —`) is done with item 1 in Task 2 because both edit the same three render functions.
14. 想几岁放假 as its own first group applies to the simple view only; the pro form keeps 目标放假年龄 in 退休后.
15. The placeholder is removed only while a box is marked 待填 and restored after, so optional amount boxes keep `0`.

## Self-review notes

- Coverage: spec §2 rows 1a, 1b, 8 → Task 2; 2, 3, 4, 7 → Task 1; 5, 6 → Task 3; 9 and the item-10 ledger line → Task 4; 11 → Task 5; §3 → Task 6; §4 examples → Tasks 1 and 4 tests.
- Names used across tasks: `A11`, `spendAt`, `draw:<age>` rows with `items`/`less`, `times.draw`, `heldHeroHtml(open, chip)`, `heldHeadHtml(view, chip)`, `#start-chip`, `formGroupOf('tage','simple')`. Task 5 adds to the pro ⇒ note Task 4 rewrites: run Task 4 before Task 5.
- Order: 1 → 2 → 3 → 4 → 5 → 6. Tasks 2 and 3 both touch `markProblems`/`holdResult` neighbourhoods in app.js; keep them sequential.
