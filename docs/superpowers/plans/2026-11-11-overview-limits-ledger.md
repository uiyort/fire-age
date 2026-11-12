# 放假年龄：条目总览、硬限制、数据账本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every relation between the person's numbers is enforced by the page (derived-and-locked, or stopped with a one-tap exit), the form's group headers and a ≥ 1024 px sidebar give an overview of the entries, and a ledger shows how the numbers become the age, all read from two pure functions in `state.js`.

**Architecture:** `problems(S, data, thisYear, { last })` lists every rule result (blank, block, ended, flag, local) in page order; `storyRows(S, data, thisYear, plan)` lists the rows under the fields and the ledger's sections ① ②. The page (app.js) never judges a relation itself: the chip, the red frames, the group counts, the lines under the fields, the sidebar summaries and the ledger all render from these two lists. Model code is unchanged except one helper (`firstDraw`) that names a number the engine already computes.

**Tech Stack:** Zero-dependency static site, native ES modules (`site/js/*.js`), node:test unit tests (`tests/*.test.mjs`), Playwright browser tests (`tests/e2e/*.spec.mjs`, port 4173).

**Spec:** `docs/superpowers/specs/2026-11-11-overview-limits-ledger-design.md` (the authority; §12 answered: Q1 keep the fold intro paragraph `index.html:73` verbatim, Q2 the listed limits go in and onto the method page; §13 controller's calls C1–C44 are decided). Mockups: `.superpowers/design/2026-11-11-sidebar/x1/mock-*-r3.png`, `x2/mock-r3-*-v2.png`, `x3/mock-ledger-r3-v2-390.png` (the spec wins where they differ; its intro lists the differences). Shared repo context: `.superpowers/sdd/2026-11-10-trust-batch-2/context.md`.

## Global Constraints

- Branch `overview-limits`, created from `main` after batch 2 is merged, worktree `.worktrees/overview-limits`. Code equals `trust-batch-2` HEAD; every file:line in this plan was read there and must be re-located by content.
- Baseline: 382 unit tests, 123 browser tests, copy lint clean. Every task ends with `npm test`, `npx playwright test` and `node scripts/lint-copy.mjs site/index.html site/method.html site/sources.html site/404.html` all passing (tests whose asserted copy this plan removes are rewritten in the task that removes it).
- Keep each file's line endings. CRLF: `site/js/state.js`, `app.js`, `views.js`, `engine.js`, `holiday.js`, `odds.js`, `params.js`, `site/index.html`, `site/method.html`, `docs/method.md`, `tests/engine.test.mjs`, `tests/e2e/{app,pro,review-fixes,share,start,pension}.spec.mjs`. LF: `site/css/app.css`, `tests/state.test.mjs`, `tests/holiday.test.mjs`, `tests/e2e/{layout,life}.spec.mjs`. New files: LF.
- Commits: conventional subject (`feat: …`, `fix: …`), body ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.
- All page copy comes verbatim from spec §3, §4.1, §6, §7, §10; numbers in the spec's copy are examples (`¥X` via `wholeMoney` / `roughMoney`, ages and years are the person's own). The data-month label is `${DATA.version} 数据` (spec example `2026-10 数据`; today's data gives `2026-11 数据`).
- Symbols: only spec §3's twelve (`—` `拦住/待填` chip `✕` frames `>≥<≤` `= + − ⇒ └ 其中` `→` dashed `= N` `≈` `＋` strike-through `!`) plus the written label `本工具设定`, and the existing `›`, `▸`/`▾`. Never `◇`, `⌄`, `⌃`, `↑`, `↓`, `↘`, `↗`, `✓`, zig-zag lines. `✕` only means 拦住.
- Colours: red (`--bad`) only for 拦住 and 待填; orange `!` uses `--warn`; the `≈` estimate uses blue `--s1`; ended rows grey (`--ink-3`).
- Negative numbers on the page are written with U+2212 `−` (`−500`, `−1`), never `-`.
- New explanatory sentences: 0. The only sentences kept are spec §10.6's five.
- Buttons are never disabled. Nothing turns red while a field is being typed in.
- User-visible text never contains 杠杆、解锁、🔒、裸放; the simple view says only "X 成", never a success percentage or a count of runs.
- Model unchanged: income growth default 2%, 八成, 2,000 paths, seed 20261026; engine clamps (`engine.js:17-21`) stay as unreachable backstops (blocked values never reach the engine).
- Every new limit and common range is 本工具设定 and is listed on the method page (Task 11).
- 390 px: `document.documentElement.scrollWidth === 390` in every state this plan adds.

## Review Focus

1. A value only the professional view can edit (股票占比 150, 规划到 120) is saved, then the person switches to the simple view: the chip still names it, and tapping the chip switches to the professional view and puts the cursor in that field (test in Task 4).
2. The person clears all three split parts by hand instead of tapping `只填总数`: the split turns off and monthly spending returns to the total it had before the split, exactly as `只填总数` would (tests in Task 1 and Task 5).
3. The work country changes while the split is on: the three parts and the remembered total convert at the market rate like the other work-currency fields, and monthly spending stays exactly their sum × 12 (test in Task 1).
4. A saved split from an older or broken save (missing, a string, an array, a part that is not a number): it reads as "not split", nothing is locked, no error (test in Task 1).
5. An exit button fixes one problem while another remains (for example `孩子几个 → 1` with the mortgage still half filled): the fixed field loses its marks at once, and the chip, the group `✕ N` and the result reflect the remaining problem without a stale mark (test in Task 6).

---

### Task 1: `problems()` for blanks and the mortgage/children/spending relations, and the stored split

**Files:**
- Modify: `site/js/state.js` (`realNum`/`cleanReal` ~40-52, `realItems` 61-67, `eventsOf` 81-83, `itemsYearly` 95-98, `defaultState` 144-160, `setWorkCountry` 196-212, `loadState` 266-280; add the new exports right after `missingFields` 188-192)
- Create: `tests/problems.test.mjs`
- Modify: `tests/state.test.mjs` (only where an assertion relied on negatives being dropped by `cleanReal`)

**Interfaces:**
- Consumes: nothing new.
- Produces (all exported from `site/js/state.js`):
  - `FieldKey`: one of `'age' 'assets' 'income' 'expense' 'retExp' 'pension' 'selfPension' 'selfMedical' 'tAge' 'life' 'pAge' 'growth' 'eq' 'eqReal' 'bondY' 'infl' 'drag' 'fxDrift' 'swr' 'sigEq' 'sigBd' 'rho' 'flexCut' 'split.rent' 'split.food' 'split.other' 'mortgage.monthly' 'mortgage.endYear' 'kids.count' 'kids.age' 'kids.monthly' 'pen.years' 'town.monthly'`.
  - `FIELD_ORDER = { simple: FieldKey[], pro: FieldKey[] }` — page order. simple: `age assets income expense split.rent split.food split.other mortgage.monthly mortgage.endYear kids.count kids.age kids.monthly pension selfPension selfMedical pen.years tAge retExp` then the professional-only fields in pro order; pro: `age assets income growth expense split.* mortgage.* kids.* retExp life pension pAge selfPension selfMedical pen.years tAge eq eqReal bondY infl drag fxDrift swr sigEq sigBd rho flexCut`. (`growth` moves above `expense` in the pro form in Task 10; the order is fixed now.)
  - `rowOf(field: FieldKey, view: 'simple'|'pro') -> RowKey`. Simple rows: `tage` (tAge), `now` (age assets income), `spend` (expense, split.*, mortgage.*, kids.*), `where`, `pension` (pension selfPension selfMedical pen.years), `retire` (retExp). Pro rows: `region`, `now` (age assets income growth), `spend`, `retire` (retExp life pension pAge selfPension selfMedical pen.years tAge), `returns` (eq eqReal bondY infl drag fxDrift swr), `risk` (sigEq sigBd rho flexCut), `sim`. In the simple view a professional-only field uses its pro row.
  - `formGroupOf(row: RowKey, view) -> FormGroup|null`: identity except simple `tage→pension`, `spend→now`, `returns|risk→null`; pro `spend→now`.
  - `CHIP_NAME` and `FIELD_LABEL`: `{ simple: Record<FieldKey,string>, pro: Record<FieldKey,string> }`, values verbatim from spec §10.1 (chip) and the row texts of §10.2 (label: `年龄`, `已有存款和投资`, `每月到手收入`, `每月支出`, `退休后每月想花`, `预计每月养老金`, `放假后每月自缴养老保险`, `放假后每月自缴医保`, `想几岁放假`, `房租和房贷`, `吃饭`, `其他`, `月供`, `还到哪年`, `孩子几个`, `最小的孩子`, `每个孩子每月`; pro: `可投资资产`, `税后年收入`, `当前年支出`, `年支出`, `养老金/年`, `目标放假年龄`, `规划到`, `领取年龄`, `股票占比`, `一年跌 ≥ 15% 后少花`, `股债相关性`, `股票波动率`, `债券波动率`, `安全提取率`, and the pro names for the rest).
  - `num(v: number) -> string`: zh-CN grouping, at most 2 decimals, U+2212 for negatives (`num(-1000) === '−1,000'`, `num(0.17) === '0.17'`).
  - `LIMITS`: `{ age: [16, 85], endYearBack: 50, endYearAhead: 40, pAge: [45, 75], lifeMin: 2, lifeMax: 110, swrMax: 10, low: 0.25, common: { growth: [-2, 5], eqReal: [-2, 10], bondY: [0, 8], infl: [0, 6], drag: [0, 2], fxDrift: [-3, 3] } }` (Task 2 uses the rest).
  - Types:
    ```
    Problem = { id, rule, kind: 'blank'|'block'|'ended'|'flag'|'local', row: RowKey|null, field: FieldKey,
                more: FieldKey[], compare: FieldKey[], at: 'expense'|'retExp'|FieldKey,
                chip: string|null, rel: Rel|null, note: string|null, fixes: Fix[] }
    Rel  = { sub: boolean, left: {label, value, unit?}[], op: '>'|'≥'|'<'|'≤'|null, right: {label: string|null, value, unit?}|null }
         | { sub: true, ended: true, label, value, fact }
    Fix  = { text, aria?, set: Partial<Record<FieldKey, number>> } | { text, focus: FieldKey }
         | { text, clear: 'mortgage'|'kids' } | { text, reset: 'retExp' } | { text, unsplit: true }
    ```
    `id`: rule for whole-relation rules (`'A2' 'A3' 'A4' 'A9' 'A10' 'B14'`), `'A5:mortgage'`/`'A5:kids'`, `'end:mortgage'`/`'end:kids'`, `${rule}:${field}` otherwise. `rel` values are in the view's display units (simple: monthly; pro: yearly for expense, income, retExp, pension and for the mortgage/children in A3/A4, with `unit: '/年'`); `set` values are in state units (yearly for `expense income retExp pension`). `row` is `null` and `chip` is `null` for `local` problems.
  - `problems(S, data, thisYear = new Date().getFullYear(), { last = null } = {}) -> Problem[]` in page order (`FIELD_ORDER[S.view]` of `field`). `last` is the last committed FieldKey; it picks the solid frame where the spec says "刚提交的那一格"; without it the rule's default field is used.
  - Split state: `S.split = { rent, food, other, before }` — monthly parts in the work currency (number or null) and `before`, the yearly `expense` at the moment the first part was entered. `cleanSplit(raw) -> Split`; `splitOn(S) -> boolean` (any part > 0); `setSplit(S, part: 'rent'|'food'|'other', rawText, data) -> S` (sets the part; when the split is on, `expense = (rent + food + other) × 12` with blanks as 0; the first part on stores `before`; turning the split off by clearing all parts behaves like `unsplit`; re-estimates `retExp` when `!S.touched.retExp`, as `setField` does); `unsplit(S, data) -> S` (parts and `before` → null, `expense = before` when it is not null, re-estimate as above).
  - `itemsYearly(S, thisYear)` now uses `>=` (C44). `eventsOf(S, data, thisYear)` keeps its fallback (drop items that do not fit, same `>=` edges as A3/A4) but only valid items enter: mortgage `monthly > 0`, `endYear` an integer from `thisYear − 50` to `thisYear + 40`; kids `count` an integer ≥ 1, `age` an integer ≥ 0, `monthly > 0`.
  - `lifeIssue` and `lifeSummary` stay exported unchanged until Task 6 removes them with their consumers.

- [ ] **Step 1: Write the failing tests** in `tests/problems.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, loadState, problems, setSplit, unsplit, splitOn, cleanSplit, itemsYearly, setWorkCountry, num } from '../site/js/state.js';

const real = (m = {}, k = {}) => ({ mortgage: { monthly: null, endYear: null, ...m }, kids: { count: null, age: null, monthly: null, ...k } });
const S0 = o => ({ ...defaultState(DATA), ...o });
const P = (S, o) => problems(S, DATA, 2026, o);
const only = (S, rule, o) => P(S, o).filter(q => q.rule === rule);
const M = { monthly: 7500, endYear: 2045 };

test('problems: the example numbers break no rule', () => {
  assert.deepEqual(P(defaultState(DATA)), []);
});

test('num writes grouped numbers with a true minus sign', () => {
  assert.equal(num(-1000), '−1,000'); assert.equal(num(9000), '9,000'); assert.equal(num(0.17), '0.17');
});

test('A3: the mortgage at or above monthly spending blocks; one yuan below does not', () => {
  const [q] = only(S0({ expense: 84000, real: real(M) }), 'A3');
  assert.equal(q.kind, 'block'); assert.equal(q.field, 'mortgage.monthly'); assert.deepEqual(q.compare, ['expense']);
  assert.equal(q.chip, '房贷'); assert.equal(q.at, 'expense'); assert.equal(q.row, 'spend');
  assert.deepEqual(q.rel, { sub: true, left: [{ label: '月供', value: 7500 }], op: '≥', right: { label: '每月支出', value: 7000 } });
  assert.deepEqual(q.fixes, [{ text: '改每月支出', focus: 'expense' }, { text: '改月供', focus: 'mortgage.monthly' }]);
  assert.equal(only(S0({ expense: 90000, real: real(M) }), 'A3').length, 1);
  assert.equal(only(S0({ expense: 90012, real: real(M) }), 'A3').length, 0);
});

test('A3: mortgage and children together; the last committed field takes the solid frame', () => {
  const S = S0({ expense: 96000, real: real(M, { count: 1, age: 5, monthly: 1700 }) });
  const [q] = only(S, 'A3');
  assert.deepEqual(q.rel.left, [{ label: '月供', value: 7500 }, { label: '孩子', value: 1700 }]);
  assert.deepEqual(q.fixes.map(f => f.text), ['改每月支出', '改月供', '改孩子']);
  const [byExpense] = only(S, 'A3', { last: 'expense' });
  assert.equal(byExpense.field, 'expense'); assert.equal(byExpense.chip, '每月支出');
  assert.deepEqual(byExpense.compare, ['mortgage.monthly', 'kids.monthly']);
  const [kidsOnly] = only(S0({ expense: 12000, real: real({}, { count: 1, age: 5, monthly: 1000 }) }), 'A3');
  assert.equal(kidsOnly.field, 'kids.monthly'); assert.equal(kidsOnly.chip, '孩子');
});

test('A3: with the split on, the dashed frame and 改每月支出 go to 其他; pro speaks in years', () => {
  const S = setSplit(S0({ real: real(M) }), 'rent', '7500', DATA);   // rent part = mortgage (A2 allows equal), total 7,500 (A3 blocks equal)
  const [q] = only(S, 'A3');
  assert.deepEqual(q.compare, ['split.other']); assert.deepEqual(q.fixes[0], { text: '改每月支出', focus: 'split.other' });
  const [pro] = only(S0({ view: 'pro', expense: 84000, real: real(M) }), 'A3');
  assert.deepEqual(pro.rel, { sub: true, left: [{ label: '月供', value: 90000, unit: '/年' }], op: '≥', right: { label: '当前年支出', value: 84000 } });
  assert.equal(pro.chip, '房贷'); assert.equal(pro.fixes[0].text, '改当前年支出');
});

test('A2: with the split, the mortgage may equal the rent part but not exceed it; A3 is not reported beside it', () => {
  let S = S0({ real: real({ monthly: 9000, endYear: 2045 }) });
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) S = setSplit(S, k, v, DATA);
  assert.deepEqual(P(S).map(q => q.rule), ['A2']);
  const [q] = only(S, 'A2');
  assert.deepEqual(q.rel, { sub: true, left: [{ label: '月供', value: 9000 }], op: '>', right: { label: '房租和房贷', value: 5000 } });
  assert.deepEqual(q.fixes, [{ text: '房租和房贷 → 9,000', aria: '房租和房贷改成 9,000', set: { 'split.rent': 9000 } }, { text: '改月供', focus: 'mortgage.monthly' }]);
  assert.equal(q.field, 'mortgage.monthly'); assert.deepEqual(q.compare, ['split.rent']); assert.equal(q.chip, '房贷');
  assert.equal(only(S, 'A2', { last: 'split.rent' })[0].field, 'split.rent');
  assert.equal(only({ ...S, real: real({ monthly: 5000, endYear: 2045 }) }, 'A2').length, 0);
});

test('A4: typed retirement spending must exceed the items; equal blocks; the estimate never does', () => {
  const items = real({ monthly: 4000, endYear: 2045 }, { count: 1, age: 5, monthly: 2200 });
  const typed = retExp => S0({ expense: 120000, retExp, touched: { retExp: true }, real: items });
  const [q] = only(typed(74400), 'A4');
  assert.deepEqual(q.rel, { sub: true, left: [{ label: '月供', value: 4000 }, { label: '孩子', value: 2200 }], op: '≥', right: { label: '退休后每月想花', value: 6200 } });
  assert.equal(q.field, 'retExp'); assert.equal(q.chip, '退休后'); assert.equal(q.at, 'retExp');
  assert.deepEqual(q.fixes, [{ text: '改回估算 ≈ 10,000', reset: 'retExp' }]);
  assert.equal(only(typed(74412), 'A4').length, 0);
  assert.equal(only(S0({ expense: 120000, retExp: 74400, real: items }), 'A4').length, 0);
});

test('A5: a half-filled group waits; children counted as 0 need nothing more', () => {
  const [m] = P(S0({ real: real({ monthly: 3000 }) }));
  assert.equal(m.kind, 'blank'); assert.equal(m.id, 'A5:mortgage'); assert.equal(m.field, 'mortgage.endYear');
  assert.equal(m.chip, '房贷'); assert.equal(m.rel, null); assert.deepEqual(m.fixes, [{ text: '不算房贷', clear: 'mortgage' }]);
  const [k] = P(S0({ real: real({}, { count: 2 }) }));
  assert.equal(k.field, 'kids.age'); assert.deepEqual(k.more, ['kids.monthly']); assert.deepEqual(k.fixes, [{ text: '不算孩子', clear: 'kids' }]);
  assert.deepEqual(P(S0({ real: real({}, { count: 0 }) })), []);
});

test('A6: the end year is a whole year from 50 years back to 40 ahead; before this year it has ended', () => {
  const at = endYear => P(S0({ real: real({ monthly: 3000, endYear }) }));
  assert.deepEqual(at(20)[0].rel, { sub: false, left: [{ label: '还到哪年', value: 20 }], op: '<', right: { label: null, value: 1976 } });
  assert.deepEqual(at(20)[0].fixes, []); assert.equal(at(20)[0].chip, '房贷');
  assert.equal(at(1975)[0].kind, 'block');
  assert.deepEqual(at(1976)[0].rel, { sub: true, ended: true, label: '月供', value: 3000, fact: '1976 已还完' });
  assert.equal(at(2025)[0].kind, 'ended');
  assert.deepEqual(at(2026), []); assert.deepEqual(at(2066), []);
  assert.deepEqual(at(2067)[0].rel.right, { label: null, value: 2066 }); assert.equal(at(2067)[0].rel.op, '>');
  assert.deepEqual(at(2045.5)[0].rel, { sub: false, left: [{ label: '还到哪年', value: 2045.5 }], op: null, right: null });
});

test('A7: children are a whole number, not negative; 0 has ended', () => {
  const at = count => P(S0({ expense: 120000, real: real({}, { count, age: 5, monthly: 1600 }) }));
  assert.deepEqual(at(1.5)[0].fixes, [{ text: '→ 1', aria: '孩子几个改成 1', set: { 'kids.count': 1 } }, { text: '→ 2', aria: '孩子几个改成 2', set: { 'kids.count': 2 } }]);
  assert.deepEqual(at(1.5)[0].rel, { sub: false, left: [{ label: '孩子几个', value: 1.5 }], op: null, right: null });
  assert.deepEqual(at(-1)[0].rel, { sub: false, left: [{ label: '孩子几个', value: -1 }], op: '<', right: { label: null, value: 0 } });
  assert.deepEqual(at(-1)[0].fixes.map(f => f.text), ['→ 0']);
  assert.deepEqual(at(0)[0].rel, { sub: true, ended: true, label: '孩子', value: 1600, fact: '0 个' });
});

test('A8: the youngest child: below 0 blocks, 22 has ended, 21 still counts', () => {
  const at = age => P(S0({ expense: 120000, real: real({}, { count: 2, age, monthly: 1600 }) }));
  assert.equal(at(-3)[0].rel.left[0].label, '最小的孩子'); assert.deepEqual(at(-3)[0].fixes.map(f => f.text), ['→ 0']);
  assert.deepEqual(at(22)[0].rel, { sub: true, ended: true, label: '孩子', value: 3200, fact: '已满 22 岁' });
  assert.deepEqual(at(21), []);
});

test('A9: a town spend below the items stops only that line; equal is fine', () => {
  const S = m => S0({ real: real({ monthly: 4000, endYear: 2045 }), expense: 120000, town: { name: '大理', monthly: m } });
  const [q] = P(S(3000));
  assert.equal(q.kind, 'local'); assert.equal(q.field, 'town.monthly'); assert.equal(q.chip, null); assert.equal(q.row, null);
  assert.deepEqual(q.fixes, [{ text: '改花销', focus: 'town.monthly' }]);
  assert.deepEqual(P(S(4000)), []);
});

test('A10: little left after the items is flagged only for typed spending, strictly below a quarter', () => {
  const S = (retMonthly, touched = true) => S0({ expense: 120000, retExp: retMonthly * 12, touched: touched ? { retExp: true } : {}, real: real({ monthly: 4000, endYear: 2045 }) });
  assert.equal(only(S(4000 + 2499), 'A10')[0].kind, 'flag');
  assert.equal(only(S(4000 + 2500), 'A10').length, 0);
  assert.equal(only(S(4000 + 2499, false), 'A10').length, 0);
});

test('B14: spending above income is flagged, not blocked; equal is nothing', () => {
  const [q] = only(S0({ income: 60000 }), 'B14');
  assert.equal(q.kind, 'flag'); assert.equal(q.at, 'expense');
  assert.deepEqual(q.rel, { sub: false, left: [{ label: '每月存下', value: -1000 }], op: null, right: null });
  const [pro] = only(S0({ view: 'pro', income: 60000 }), 'B14');
  assert.deepEqual(pro.rel.left, [{ label: '年储蓄', value: -12000 }]); assert.equal(pro.note, '存款用完后按 0 算');
  assert.equal(only(S0({ income: 72000 }), 'B14').length, 0);
});

test('B1: blanks keep page order and their view names', () => {
  const S = S0({ expense: null, retExp: null });
  assert.deepEqual(P(S).map(q => [q.kind, q.field, q.chip]), [['blank', 'expense', '每月支出'], ['blank', 'retExp', '退休后']]);
  assert.deepEqual(P({ ...S, view: 'pro' }).map(q => q.chip), ['当前年支出', '年支出']);
  assert.deepEqual(P(S0({ mode: 'bwd', tAge: null })).map(q => q.chip), ['想几岁放假']);
});

test('itemsYearly uses the same edge as A3', () => {
  const S = S0({ expense: 90000, real: real(M) });
  assert.equal(itemsYearly(S, 2026), 0);
  assert.equal(itemsYearly({ ...S, expense: 90012 }, 2026), 90000);
});

test('the split: the parts make the spending, the first part keeps the old total, unsplit brings it back', () => {
  let S = setSplit(defaultState(DATA), 'rent', '5000', DATA);
  assert.deepEqual(S.split, { rent: 5000, food: null, other: null, before: 72000 });
  assert.equal(S.expense, 60000); assert.equal(S.retExp, 60000); assert.equal(splitOn(S), true);
  S = setSplit(setSplit(S, 'food', '2000', DATA), 'other', '1000', DATA);
  assert.equal(S.expense, 96000); assert.equal(S.split.before, 72000);
  const back = unsplit(S, DATA);
  assert.equal(back.expense, 72000); assert.equal(splitOn(back), false);
  assert.deepEqual(back.split, { rent: null, food: null, other: null, before: null });
});

test('the split: clearing all three parts by hand is the same as unsplit', () => {
  let S = defaultState(DATA);
  for (const [k, v] of [['rent', '5000'], ['food', '2000']]) S = setSplit(S, k, v, DATA);
  S = setSplit(setSplit(S, 'rent', '', DATA), 'food', '', DATA);
  assert.equal(S.expense, 72000); assert.equal(splitOn(S), false);
});

test('the split survives a reload; a missing or broken saved split reads as none', () => {
  const store = v => ({ getItem: () => JSON.stringify(v) });
  const S = setSplit(defaultState(DATA), 'rent', '5000', DATA);
  assert.deepEqual(loadState(DATA, store(S)).split, S.split);
  const { split, ...old } = S;
  for (const bad of [undefined, 'x', [1, 2], { rent: 'a' }, null]) {
    assert.equal(splitOn(loadState(DATA, store({ ...old, split: bad }))), false);
  }
  assert.deepEqual(cleanSplit({ rent: -5 }).rent, -5); // kept so B2 can stop it
});

test('moving the work country converts the parts and the old total; spending stays their sum', () => {
  let S = defaultState(DATA);
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) S = setSplit(S, k, v, DATA);
  const moved = setWorkCountry(S, 'US', DATA);
  const { rent, food, other } = moved.split;
  assert.equal(moved.expense, (rent + food + other) * 12);
  assert.ok(moved.split.before > 0 && moved.split.before < 72000);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/problems.test.mjs`
Expected: FAIL (`problems is not a function` / missing exports).

- [ ] **Step 3: Implement in `site/js/state.js`** the exports named in Interfaces.
  - `realNum` keeps any finite number (negatives and fractions survive so A6–A8 can see them); `realItems`/`itemEvents` admit only the valid items listed above.
  - Rules A2–A10, B1, B14 exactly as spec §4.1 table A/B, with: A2 checked only when `splitOn(S)` and the mortgage is counted (filled, in range, not ended); when A2 fires, A3 is not reported. A3/A4 count only items that would enter the model; compare in one currency (A4: items converted to the retirement currency, as `lifeIssue` does). A3 default solid frame: `mortgage.monthly`, or `kids.monthly` when there is no mortgage; when `last` is one of the A3 fields, that field; compare = the other A3 fields that are filled, with `expense` replaced by `split.other` when the split is on. A4 estimate for the fix text: `estimateRetireSpend(expense, workC, retC, data, itemsYearly(S))`, shown monthly with `num`. A5: a group is half filled when at least one cell is set and one is blank, except kids with `count === 0`. B1 is `missingFields`, chip from `CHIP_NAME`. A10 compares against `S.expense / 12 × LIMITS.low` in the work currency.
  - `defaultState` adds `split: cleanSplit(null)`; `loadState` adds `split: cleanSplit(saved.split)`; `setWorkCountry` converts `split.rent/food/other/before` with the same rounding as the payments, then sets `expense` to the parts' sum × 12 when the split is on.

- [ ] **Step 4: Run to see it pass**

Run: `node --test tests/problems.test.mjs` then `npm test`
Expected: all pass (fix any `tests/state.test.mjs` assertion that relied on `cleanReal` dropping negatives; keep its meaning: such entries still produce no events).

- [ ] **Step 5: Commit**

```bash
git add site/js/state.js tests/problems.test.mjs tests/state.test.mjs
git commit -m "feat: problems() for blanks and item relations, stored spending split"
```

---

### Task 2: `problems()` for ranges and the professional checks

**Files:**
- Modify: `site/js/state.js` (inside `problems`)
- Modify: `tests/problems.test.mjs`

**Interfaces:**
- Consumes: Task 1's `problems`, `LIMITS`, `CHIP_NAME`, `FIELD_LABEL`, `num`, `Problem`/`Fix` shapes.
- Produces: rules B2–B13 and B15 inside `problems()`. Range rules B2–B10 run in both views (the value is used either way); only labels and units follow `S.view`. The judgement flags B11–B13 run only when `S.view === 'pro'` (spec §8.1: the simple view has only A10 and B14 `!`). B4 runs only when `S.mode === 'bwd'`; B10 only when `!S.autoSwr`; B11 only for a value that differs from its default (`growth` 2, `eqReal` 5, `fxDrift` 0 from `defaultState`; `bondY`, `infl`, `drag` from the work country's data via `localAssumptions`), so a value that follows the monthly data never flags. `tAge ≥ life` is reported once, as B4 on `tAge`; B5 checks `life ≥ age + 2` and `life ≤ 110` and uses the backward rule only to choose its fix value. B13 computes `r` from S the way `buildParams` does (before the −50% floor) and reports `{ rule: 'B13', kind: 'flag', field: 'eqReal', at: 'ledger', note: '按 −50% 算' }`. B15 is `local`, row `null`, chip `null`.

- [ ] **Step 1: Write the failing tests** (append to `tests/problems.test.mjs`)

```js
const rel = (S, rule) => only(S, rule)[0]?.rel;
const fixTexts = (S, rule) => only(S, rule)[0]?.fixes.map(f => f.text);

test('B2: amounts below 0 block; 0 is fine; the exit drops the minus sign, savings go to 0', () => {
  assert.deepEqual(rel(S0({ expense: -6000 }), 'B2'), { sub: false, left: [{ label: '每月支出', value: -500 }], op: '<', right: { label: null, value: 0 } });
  assert.deepEqual(only(S0({ expense: -6000 }), 'B2')[0].fixes, [{ text: '→ 500', aria: '每月支出改成 500', set: { expense: 6000 } }]);
  assert.deepEqual(fixTexts(S0({ assets: -1 }), 'B2'), ['→ 0']);
  assert.equal(only(S0({ assets: 0 }), 'B2').length, 0);
  assert.equal(rel(S0({ view: 'pro', expense: -6000 }), 'B2').left[0].label, '当前年支出');
  assert.equal(only(S0({ selfPension: -100 }), 'B2')[0].chip, '自缴');
  let S = setSplit(defaultState(DATA), 'rent', '-500', DATA);
  assert.equal(only(S, 'B2')[0].field, 'split.rent');
});

test('B3: age from 16 to 85', () => {
  assert.deepEqual(rel(S0({ age: 120 }), 'B3'), { sub: false, left: [{ label: '年龄', value: 120 }], op: '>', right: { label: null, value: 85 } });
  assert.deepEqual(fixTexts(S0({ age: 120 }), 'B3'), ['→ 85']);
  assert.deepEqual(fixTexts(S0({ age: 12 }), 'B3'), ['→ 16']);
  assert.equal(only(S0({ age: 16 }), 'B3').length + only(S0({ age: 85 }), 'B3').length, 0);
});

test('B4: the age to holiday at sits strictly between age and the plan end; equal blocks', () => {
  const bwd = o => S0({ mode: 'bwd', ...o });
  assert.deepEqual(rel(bwd({ tAge: 25 }), 'B4'), { sub: false, left: [{ label: '想几岁放假', value: 25 }], op: '≤', right: { label: '年龄', value: 30 } });
  assert.deepEqual(fixTexts(bwd({ tAge: 25 }), 'B4'), ['→ 31']);
  assert.equal(only(bwd({ tAge: 30 }), 'B4').length, 1);
  assert.equal(only(bwd({ tAge: 31 }), 'B4').length, 0);
  assert.deepEqual(rel(bwd({ tAge: 95 }), 'B4').right, { label: '规划到', value: 95 });
  assert.deepEqual(fixTexts(bwd({ tAge: 99 }), 'B4'), ['→ 94']);
  assert.equal(only(S0({ tAge: 25 }), 'B4').length, 0);
  assert.equal(only(bwd({ view: 'pro', tAge: 25 }), 'B4')[0].chip, '目标年龄');
});

test('B5: the plan end is at least age + 2 and at most 110; too small goes to 95 or the least that works', () => {
  assert.deepEqual(rel(S0({ life: 31 }), 'B5'), { sub: false, left: [{ label: '规划到', value: 31 }], op: '<', right: { label: null, value: 32 } });
  assert.deepEqual(fixTexts(S0({ life: 31 }), 'B5'), ['→ 95']);
  assert.deepEqual(fixTexts(S0({ life: 111 }), 'B5'), ['→ 110']);
  assert.equal(only(S0({ life: 32 }), 'B5').length + only(S0({ life: 110 }), 'B5').length, 0);
  assert.deepEqual(fixTexts(S0({ age: 85, life: 86, mode: 'bwd', tAge: 100 }), 'B5'), ['→ 101']);
});

test('B6–B10: claim age, shares, correlation, volatilities, withdrawal rate', () => {
  assert.deepEqual(fixTexts(S0({ pAge: 30 }), 'B6'), ['→ 45']); assert.deepEqual(fixTexts(S0({ pAge: 80 }), 'B6'), ['→ 75']);
  assert.equal(only(S0({ pAge: 45 }), 'B6').length + only(S0({ pAge: 75 }), 'B6').length, 0);
  assert.deepEqual(rel(S0({ eq: 150 }), 'B7').left, [{ label: '股票占比', value: 150 }]); assert.deepEqual(fixTexts(S0({ eq: -5 }), 'B7'), ['→ 0']);
  assert.equal(only(S0({ flexCut: 150 }), 'B7')[0].chip, '少花');
  assert.deepEqual(rel(S0({ flexCut: 150 }), 'B7').left[0].label, '一年跌 ≥ 15% 后少花');
  assert.deepEqual(fixTexts(S0({ rho: 3 }), 'B8'), ['→ 1']); assert.deepEqual(fixTexts(S0({ rho: -2 }), 'B8'), ['→ −1']);
  assert.equal(only(S0({ rho: 1 }), 'B8').length + only(S0({ rho: -1 }), 'B8').length, 0);
  assert.deepEqual(only(S0({ sigEq: 17 }), 'B9')[0].fixes, [{ text: '→ 0.17', aria: '股票波动率改成 0.17', set: { sigEq: 0.17 } }]);
  assert.deepEqual(fixTexts(S0({ sigBd: -0.2 }), 'B9'), ['→ 0.2']);
  assert.equal(only(S0({ sigEq: 1 }), 'B9').length + only(S0({ sigEq: 0 }), 'B9').length, 0);
  assert.deepEqual(rel(S0({ autoSwr: false, swr: 0 }), 'B10'), { sub: false, left: [{ label: '安全提取率', value: 0 }], op: '≤', right: { label: null, value: 0 } });
  assert.deepEqual(fixTexts(S0({ autoSwr: false, swr: 0 }), 'B10'), ['→ 3.9']);
  assert.deepEqual(fixTexts(S0({ autoSwr: false, swr: 12 }), 'B10'), ['→ 10']);
  assert.equal(only(S0({ autoSwr: false, swr: 10 }), 'B10').length + only(S0({ autoSwr: true, swr: 0 }), 'B10').length, 0);
});

test('B11: a changed assumption outside the common range is flagged in the professional view; defaults never are', () => {
  const pro = o => S0({ view: 'pro', ...o });
  const [g] = only(pro({ growth: 6 }), 'B11');
  assert.equal(g.kind, 'flag'); assert.equal(g.note, '常见 −2 到 5'); assert.equal(g.field, 'growth');
  assert.equal(only(pro({ growth: 5 }), 'B11').length, 0);
  assert.equal(only(pro({ eqReal: 11 }), 'B11')[0].note, '常见 −2 到 10');
  assert.equal(only(pro({ infl: 7, touched: { infl: true } }), 'B11')[0].note, '常见 0 到 6');
  assert.equal(only(pro({}), 'B11').length, 0);
  assert.equal(only(S0({ growth: 6 }), 'B11').length, 0);
});

test('B12: a pension above the year\'s spending has the rest not counted; equal is fine', () => {
  const [q] = only(S0({ view: 'pro', pension: 60000, retExp: 54000 }), 'B12');
  assert.deepEqual(q.rel, { sub: false, left: [{ label: '养老金', value: 60000 }], op: '>', right: { label: '年支出', value: 54000 } });
  assert.equal(q.note, '多出 6,000 不计'); assert.equal(q.field, 'pension');
  assert.equal(only(S0({ view: 'pro', pension: 54000, retExp: 54000 }), 'B12').length, 0);
});

test('B13: a mix return below −50% is counted at −50%', () => {
  const [q] = only(S0({ view: 'pro', eq: 100, eqReal: -60 }), 'B13');
  assert.equal(q.kind, 'flag'); assert.equal(q.note, '按 −50% 算'); assert.equal(q.at, 'ledger');
  assert.equal(only(S0({ view: 'pro' }), 'B13').length, 0);
});

test('B15: the years paid by the claim cannot be fewer than the years already paid; equal is fine', () => {
  const pen = (paidYears, years) => S0({ pen: { ...defaultState(DATA).pen, paidYears, years } });
  const [q] = only(pen(15, 12), 'B15');
  assert.equal(q.kind, 'local'); assert.equal(q.field, 'pen.years'); assert.equal(q.chip, null);
  assert.deepEqual(q.rel, { sub: false, left: [{ label: '累计缴费', value: 12, unit: ' 年' }], op: '<', right: { label: '已缴', value: 15, unit: ' 年' } });
  assert.deepEqual(q.fixes, [{ text: '→ 15', aria: '累计缴费改成 15', set: { 'pen.years': 15 } }]);
  assert.equal(only(pen(15, 15), 'B15').length + only(pen(15, null), 'B15').length, 0);
});

test('a range problem and a blank sort by page order', () => {
  assert.deepEqual(P(S0({ age: 120, expense: null })).map(q => q.field), ['age', 'expense']);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/problems.test.mjs`
Expected: FAIL on the new tests only.

- [ ] **Step 3: Implement B2–B13, B15 in `problems()`** with the fix values from spec §4.1 table B and §10.2: negatives → absolute value (assets → 0); B9 above 1 → value ÷ 100, below 0 → absolute value; B5 too small → 95 when `95 ≥ age + 2` and (forward, or `95 > tAge`), else `max(age + 2, tAge + 1)`. Each fix carries `aria: '<FIELD_LABEL>改成 <num(value)>'`.

- [ ] **Step 4: Run to see it pass**

Run: `node --test tests/problems.test.mjs` then `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add site/js/state.js tests/problems.test.mjs
git commit -m "feat: problems() for ranges, common-range flags and the pension estimate years"
```

---

### Task 3: `storyRows()` and `firstDraw()`

**Files:**
- Modify: `site/js/state.js` (add `storyRows` after `problems`)
- Modify: `site/js/engine.js` (add `firstDraw` after `planFlows` ~214-232)
- Create: `tests/story.test.mjs`

**Interfaces:**
- Consumes: Task 1/2 `problems`, `splitOn`, `num`, `LIMITS`; engine `savingsAt`, `eventDelta`, `planFlows`.
- Produces:
  - `firstDraw(p, t) -> number` in `engine.js`: `planFlows(p, t, null).full[t]` — the yearly amount taken from savings in the first holiday year (work currency; real mortgage, self-pay, minus pension).
  - `storyRows(S, data, thisYear = new Date().getFullYear(), plan = null) -> StoryRow[]` in `state.js`. `plan = { p, t, need, unreachable = false }` (`t` the holiday year, `need` = `needLine(p)[t]` or `null`); `null` while blocked or blank.
    ```
    StoryRow = { key, section: 'now'|'after', label, value: number|null, op: '='|'−'|'⇒'|'└'|'→'|null,
                 cur: 'work'|'retire'|null, per: 'month'|'year'|null,
                 status: 'est'|'ended'|'block'|'blank'|'tool'|'flag'|null, field: FieldKey|null,
                 under: 'expense'|'retExp'|null, tag: '本工具设定'|null, views: 'both'|'simple'|'pro',
                 rel?: Rel, ages?: [number|null, number|null], end?: number, parts?: number[], before?: number,
                 struck?: string[], values?: number[] }
    ```
    Rows in order (simple label / pro label; simple amounts monthly, pro yearly):

    | key | section | label | value | notes |
    |---|---|---|---|---|
    | `have` | now | `已有` / `可投资资产` | `S.assets` | field `assets` |
    | `income` | now | `到手` / `税后年收入 · 实际增长 +2%/年` | income | pro `tag` 本工具设定 (growth shown with `S.growth`) |
    | `expense` | now | `支出` / `当前年支出 · 按今天的钱不变` | expense | op `−`; pro `tag` |
    | `split` | now | — | parts sum | only when `splitOn`; `parts` = [rent, food, other] (blank → 0), `before`, `under: 'expense'`, op `=` |
    | `mortgage`, `kids` | now | `月供` / `孩子` | monthly (pro yearly) | op `└`, `under: 'expense'`; only when filled, ended or blocked (C22); `end` = end year / 22; status `ended`/`block` with the matching problem's `rel` (the same object, C6); pro `kids` label `孩子` with `tag` and suffix `→ 22 岁（按最小的）` |
    | `items` | now | — | — | replaces `mortgage` + `kids` when A3 blocks with both; carries the A3 `rel` |
    | `mortgageReal` | now | `月供实际 × (1 + ${infl}%)^−t` | mortgage yearly × (1 + infl)^−(t−1) | pro only, needs plan, only when the mortgage is counted |
    | `save` | now | `每月存下` / `年储蓄` | `savingsAt(p, 0)` (÷ 12 simple); without plan `(income − expense)` | op `=`; pro `values: [savingsAt(p,0), savingsAt(p,t−1)]` |
    | `growth` | now | `收入每年 +${S.growth}%` | null | simple only, `tag` |
    | `saveLate` | now | `→ ${p.age + t − 1} 岁每月存下` | `savingsAt(p, t − 1) / 12` | simple only, needs plan, omitted when `t ≤ 1` |
    | `floor` | now | `年末存入 · 资产不低于 0` | null | pro only, `tag` |
    | `retExp` | after | `退休后` / `退休后年支出` | retExp (retirement currency) | `ages: [holidayAge or null, firstEndAge − 1 or null]`; status `est` when `!touched.retExp`; field `retExp` |
    | `retReal` | after | `月供实际变轻，${holidayAge} 岁实付` | `conv(retExp → work) + eventDelta(p, t)` | pro only, needs plan, mortgage running at the holiday |
    | `ret:mortgage`, `ret:kids` | after | `月供` / `孩子` | item in the retirement currency | `under: 'retExp'`, op `└`, for items that are filled, valid and not ended (also while A2/A3 block); not drawn in the ledger |
    | `ret:items` | after | — | — | replaces `ret:mortgage` + `ret:kids` when A4 blocks; carries the A4 `rel`, status `block` |
    | `after:${age}` | after | — | `(retExp − ended items converted) / 12` (pro yearly) | one per distinct end age above today's age, at most 2 (C23); `ages: [age, null]`, `struck` names, `under: 'retExp'`; status `flag` when A10 fires for it; value `null` while A4 blocks |
    | `self` | after | `自缴` / `自缴（工作地中国大陆且填了养老金才计）` | `+selfPay` | `ages: [holidayAge, pAge]`; simple only when `selfPay > 0` |
    | `pension` | after | `养老金` / `养老金（超出年支出不计）` | `−pension` or `null` | `ages: [pAge, null]`, field `pension` (shown `— ›` when blank) |
    | `flexCut` | after | `一年跌 ≥ 15% 次年少花（只砍生活费，月供、自缴照付）` | `S.flexCut` | pro only |
    | `fxDrift` | after | `退休币升值（只算到放假那年）` | `S.fxDrift` or `null` (same currency) | pro only |
    | `cross` | after | `≈ (年支出 − 月供和孩子) × 物价比 + 月供和孩子` | null | pro only, `workC ≠ retC` |
    | `need` | after | `${holidayAge} 岁放假要有` / `放假线（每条路径倒推，取 80 分位）` | `plan.need` | op `⇒` |
    | `times` | after | — | `Math.round(plan.need / firstDraw(p, t))` | |

    Cut rule: the first row whose status is `block` or `blank` (the expense row takes status `blank` when `expense` is blank, the `mortgage`/`kids`/`items` rows take `block` from A2/A3, `retExp` takes `blank` from B1 and `block` from A4) keeps its value; every later row in either section gets `value: null`, except the `ret:mortgage`/`ret:kids` rows, which only repeat a typed amount. A3/A4 are not evaluated while `expense`/`retExp` is blank.

- [ ] **Step 1: Write the failing tests** in `tests/story.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, storyRows, problems, toParams } from '../site/js/state.js';
import { firstDraw, planFlows, savingsAt } from '../site/js/engine.js';
import { needLine, oddsSolve } from '../site/js/odds.js';

const S = { ...defaultState(DATA), income: 360000, expense: 180000, retExp: 180000,
  real: { mortgage: { monthly: 7500, endYear: 2045 }, kids: { count: null, age: null, monthly: null } } };
const solved = s => { const p = toParams(s, DATA, 2026); const t = oddsSolve(p); return { p, t, need: needLine(p)[t] }; };
const row = (rows, key) => rows.find(r => r.key === key);

test('firstDraw is the first holiday year\'s draw from savings', () => {
  const p = toParams(defaultState(DATA), DATA, 2026);
  assert.equal(firstDraw(p, 10), p.retExp);
  const q = solved(S);
  assert.equal(firstDraw(q.p, q.t), planFlows(q.p, q.t, null).full[q.t]);
  assert.ok(firstDraw(q.p, q.t) < q.p.retExp);
});

test('storyRows: section ① follows the engine', () => {
  const plan = solved(S); const { p, t } = plan;
  assert.ok(t > 1 && 30 + t < 50);
  const rows = storyRows(S, DATA, 2026, plan);
  assert.deepEqual(rows.filter(r => r.section === 'now').map(r => r.key), ['have', 'income', 'expense', 'mortgage', 'save', 'growth', 'saveLate']);
  assert.equal(row(rows, 'have').value, 200000); assert.equal(row(rows, 'income').value, 30000); assert.equal(row(rows, 'expense').value, 15000);
  assert.deepEqual([row(rows, 'mortgage').value, row(rows, 'mortgage').end, row(rows, 'mortgage').under], [7500, 2045, 'expense']);
  assert.equal(row(rows, 'save').value, 15000);
  assert.equal(row(rows, 'growth').label, '收入每年 +2%'); assert.equal(row(rows, 'growth').tag, '本工具设定');
  assert.equal(row(rows, 'saveLate').label, `→ ${30 + t - 1} 岁每月存下`);
  assert.equal(row(rows, 'saveLate').value, Math.round(savingsAt(p, t - 1) / 12));
});

test('storyRows: section ② ages, amounts, the line and the multiple', () => {
  const plan = solved(S); const { p, t, need } = plan;
  const rows = storyRows(S, DATA, 2026, plan);
  assert.deepEqual([row(rows, 'retExp').ages, row(rows, 'retExp').value, row(rows, 'retExp').status], [[30 + t, 49], 15000, 'est']);
  const after = row(rows, 'after:50');
  assert.deepEqual([after.ages, after.struck, after.value, after.under], [[50, null], ['月供'], 7500, 'retExp']);
  assert.deepEqual([row(rows, 'pension').value, row(rows, 'pension').field], [null, 'pension']);
  assert.equal(row(rows, 'need').label, `${30 + t} 岁放假要有`); assert.equal(row(rows, 'need').value, need);
  assert.equal(row(rows, 'times').value, Math.round(need / firstDraw(p, t)));
  assert.equal(row(rows, 'ret:mortgage').value, 7500);
});

test('storyRows: two end ages give two → rows; a third never appears', () => {
  const s = { ...S, real: { ...S.real, kids: { count: 1, age: 19, monthly: 3200 } } };
  const rows = storyRows(s, DATA, 2026, null).filter(r => r.key.startsWith('after:'));
  assert.deepEqual(rows.map(r => [r.ages[0], r.value]), [[33, 15000 - 3200], [50, 15000 - 3200 - 7500]]);   // 30 + (22 − 19)
});

test('storyRows: without a plan, plan rows are empty and the rest still shows', () => {
  const rows = storyRows(S, DATA, 2026, null);
  assert.equal(row(rows, 'saveLate'), undefined);
  assert.equal(row(rows, 'need').value, null); assert.equal(row(rows, 'times').value, null);
  assert.equal(row(rows, 'save').value, 15000);
});

test('storyRows: a blocked row carries the same relation as problems() and everything after it is empty', () => {
  const s = { ...S, expense: 84000 };
  const rows = storyRows(s, DATA, 2026, null);
  const m = row(rows, 'mortgage');
  assert.equal(m.status, 'block');
  assert.deepEqual(m.rel, problems(s, DATA, 2026).find(q => q.rule === 'A3').rel);
  const after = rows.slice(rows.indexOf(m) + 1).filter(r => !r.key.startsWith('ret:'));
  assert.ok(after.length > 0 && after.every(r => r.value === null));
  assert.equal(row(rows, 'ret:mortgage').value, 7500);
});

test('storyRows: a blank spending row waits and empties the rows after it', () => {
  const rows = storyRows({ ...S, expense: null }, DATA, 2026, null);
  assert.equal(row(rows, 'expense').status, 'blank');
  assert.equal(row(rows, 'save').value, null);
});

test('storyRows: the → row is flagged when typed spending leaves less than a quarter', () => {
  const s = { ...S, retExp: (7500 + 3000) * 12, touched: { retExp: true } };
  assert.equal(row(storyRows(s, DATA, 2026, null), 'after:50').status, 'flag');
});

test('storyRows: the professional view speaks in years and adds its rows', () => {
  const plan = solved(S);
  const rows = storyRows({ ...S, view: 'pro' }, DATA, 2026, plan);
  assert.equal(row(rows, 'income').label, '税后年收入 · 实际增长 +2%/年'); assert.equal(row(rows, 'income').value, 360000);
  assert.equal(row(rows, 'mortgage').value, 90000);
  for (const key of ['mortgageReal', 'floor', 'retReal', 'flexCut', 'fxDrift']) assert.ok(row(rows, key), key);
  assert.equal(row(rows, 'growth'), undefined); assert.equal(row(rows, 'fxDrift').value, null);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/story.test.mjs`
Expected: FAIL (`firstDraw` / `storyRows` not exported).

- [ ] **Step 3: Implement `firstDraw` in `engine.js` and `storyRows` in `state.js`** per the table and cut rule above (state.js already imports from engine.js; add `savingsAt`, `eventDelta`, `planFlows`, `firstDraw`, `conv` to that import). Without a plan, `ages[0]` of `retExp` is `null`.

- [ ] **Step 4: Run to see it pass**

Run: `node --test tests/story.test.mjs` then `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add site/js/state.js site/js/engine.js tests/story.test.mjs
git commit -m "feat: storyRows() for the ledger and the lines under the fields, firstDraw()"
```

---

### Task 4: The stopped result, the chip and the jump to the problem

**Files:**
- Modify: `site/js/app.js` (`showBlanks` 700-715, `stopAtBlank` 718-726, `refresh` 728-750, `flushSimulation` 958-967, `onClick` export/share/start/life-draw branches 1002-1078, `init` change listener 1142-1159 and focusout 1187-1193)
- Modify: `site/js/views.js` (`stickyHtml` 574-586; add `chipText`, `heldHeroHtml`, `heldHeadHtml`)
- Modify: `site/index.html` (delete `#missing-note` line 89; give the three result links `data-needs-result`)
- Modify: `site/css/app.css` (replace 84-88: `.f.missing` rules, `请填写` content rules, `.missing-note`, `.inputs-missing`)
- Create: `tests/e2e/limits.spec.mjs`, `tests/lines.test.mjs` (unit tests for the views helpers of Tasks 4–10)
- Modify: `tests/e2e/start.spec.mjs` (62-75, 80-96), `tests/e2e/review-fixes.spec.mjs` (I1, 4-20), `tests/e2e/share.spec.mjs` (~70-83), `tests/e2e/life.spec.mjs` (the `99999` block, 86-95)

**Interfaces:**
- Consumes: `problems`, `rowOf`, `FIELD_ORDER`, `CHIP_NAME` (Task 1/2).
- Produces:
  - views.js `chipText(list: Problem[]) -> string`: '' when no `blank`/`block`; blanks first: one → `待填：${chip} ›`, several → `待填 ${n} 处 ›`; else one → `拦住：${chip} ›`, several → `拦住 ${n} 处 ›`.
  - views.js `heldHeroHtml() -> string`: `<div class="hero-big"><span aria-label="暂无结果">—</span> 岁放假</div>` plus `<div class="fund"><p>放假资金 —</p></div>` (Task 8 adds the ledger toggle).
  - views.js `heldHeadHtml(view) -> string`: pro `<p class="say">财务独立 <span aria-label="暂无结果">—</span> 岁</p>`; simple ''.
  - views.js `stickyHtml(h, { p, dispCur, success, pro, chip = '' })`: when `chip` is non-empty, returns `<b class="sticky-age">— 岁放假</b>` (pro `财务独立 — 岁`, the `—` with `aria-label="暂无结果"`) and `<button type="button" class="chip" data-chip>${chip}</button>`.
  - app.js: `fieldEl(key: FieldKey, view = S.view) -> HTMLElement|null` (simple prefix `s-`, pro `p-`; `retExp` simple → `s-retexp`; `tAge` simple → `s-tage`; `split.<k>` → `split-<k>` / `p-split-<k>`; `mortgage.monthly` → `life-mortgage`, `mortgage.endYear` → `life-mortgage-end`, `kids.count|age|monthly` → `life-kids|life-kid-age|life-kid-monthly`; `pen.years` → `pen-<s|p>-years`; `town.monthly` → `town-monthly`); `fieldKeyOf(el) -> FieldKey|null` (inverse); `let lastField = null` (set on every `change` of a rule field); `let shown = new Set()` (ids of stops currently marked); `goToField(key)` (if the field exists only in the professional view and `S.view === 'simple'`, set `S.view = 'pro'` and refresh first; open `#inputs-box`, open every `<details>` ancestor, `scrollIntoView({ block: 'center' })`, focus); `markProblems(list)` (solid: `aria-invalid="true"` and class `bad` on the field's wrapper, plus `more`; dashed: class `cmp` and `aria-description="和${FIELD_LABEL of the solid field}比较"`; removes stale marks); `stopAtProblem() -> boolean` (replaces `stopAtBlank`; marks all stops, `shown` = all, enters the held state, `goToField` of the first blank else the first block; false when there is none).
  - Body class `result-held` replaces `inputs-missing`.

Timing algorithm in `refresh({ commit = false } = {})`:
```
list  = problems(S, DATA, year, { last: lastField })
stops = list.filter(q => q.kind === 'blank' || q.kind === 'block')
typing = fieldKeyOf(document.activeElement)
held  = commit ? [] : stops.filter(q => !shown.has(q.id) && [q.field, ...q.more, ...q.compare].includes(typing))
live  = stops minus held
if live.length:  shown = ids(live); markProblems(live); enter held state (no renderFast, no simulation)
elif held.length: leave result and marks as they are (do not recompute)
else:            shown.clear(); markProblems([]); leave held state; render as today
```
`change`/`focusout`, every fix button and every jump call `refresh({ commit: true })`. `init` treats saved stops as committed (spec §4.2 "打开页面时").

Held state hides (CSS under `body.result-held`, `display: none`): `#headline` in the simple view, `#type-section`, `#type-all`, `#tiles`, `#views-banner`, `#life-tag`, `#zone-faster`, `#places-fold`, `#zone-risk`, `#share-section`, `#lab-fold`, and the professional tables in `#zone-learn`. `#zone-learn` and its title stay, so `参数` lands as today. `#hero` holds `heldHeroHtml()`; `#headline` (pro) holds `heldHeadHtml('pro')`; `#sticky-result` holds `stickyHtml(..., { chip })`. The links `怎么提前`, `撑得住吗`, `放假卡` (marked `data-needs-result`), `#share-btn`, `#export-csv`, `#export-json`, `#life-draw` and `#start-calc` call `stopAtProblem()` first and stop there when it returns true; `flushSimulation()` returns false while any stop exists. Empty money inputs (`data-unit` work/retire fields, split parts, `life-mortgage`, `life-kid-monthly`) get `placeholder="0"`.

- [ ] **Step 1: Write the failing tests**

`tests/lines.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { chipText } from '../site/js/views.js';
const b = (kind, chip) => ({ kind, chip });
test('chipText: blanks first, one names the item, several count', () => {
  assert.equal(chipText([]), '');
  assert.equal(chipText([b('flag', '每月存下')]), '');
  assert.equal(chipText([b('block', '房贷')]), '拦住：房贷 ›');
  assert.equal(chipText([b('block', '房贷'), b('block', '年龄')]), '拦住 2 处 ›');
  assert.equal(chipText([b('block', '房贷'), b('blank', '每月支出')]), '待填：每月支出 ›');
  assert.equal(chipText([b('blank', '每月支出'), b('blank', '退休后')]), '待填 2 处 ›');
});
```

`tests/e2e/limits.spec.mjs` (phone `{ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }`):
```js
const fresh = { cookies: [], origins: [] };
// Opens the page once (it saves its state), merges the overrides into the saved state and reloads.
const withSaved = async (page, over) => {
  await page.goto('/');
  await page.evaluate(o => { const k = 'fire-age-v1'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)), ...o })); }, over);
  await page.reload();
};

test.describe('the example path', () => {
  test.use({ storageState: fresh });
  test('no numbers typed, three taps to the card, no rule fires', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[aria-invalid="true"], .chip')).toHaveCount(0);
    await page.click('#start-calc');                                        // 1
    await page.locator('.zone-nav a', { hasText: '放假卡' }).click();       // 2
    await page.click('#share-btn');                                         // 3
    await expect(page.locator('#share-panel')).toBeVisible();
    await expect(page.locator('#share-img')).toHaveAttribute('src', /^data:image\/png/);
    await expect(page.locator('.chip')).toHaveCount(0);
  });
  test('your own numbers: four fields, three taps', async ({ page }) => {
    await page.goto('/');
    for (const [id, v] of [['#s-age', '35'], ['#s-assets', '300000'], ['#s-income', '15000'], ['#s-expense', '7000']]) await page.fill(id, v);
    await page.click('#start-calc');
    await page.locator('.zone-nav a', { hasText: '放假卡' }).click();
    await page.click('#share-btn');
    await expect(page.locator('#share-panel')).toBeVisible();
  });
});

test('a mortgage at or above monthly spending stops the result; the chip jumps to it', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-expense', '7000');
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '7500'); await page.fill('#life-mortgage-end', '2045');
  await page.locator('#life-mortgage-end').press('Tab');
  await expect(page.locator('#sticky-result')).toContainText('— 岁放假');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：房贷 ›');
  await expect(page.locator('#hero')).toContainText('— 岁放假');
  await expect(page.locator('.headline')).not.toContainText(/\d+ 岁放假/);
  for (const id of ['#type-section', '#zone-faster', '#zone-risk', '#places-fold', '#share-section', '#life-tag']) await expect(page.locator(id)).toBeHidden();
  await page.evaluate(() => { document.getElementById('inputs-box').open = false; document.getElementById('life-fold').open = false; });
  await page.locator('#sticky-result .chip').click();
  await expect(page.locator('#life-mortgage')).toBeFocused();
  await expect(page.locator('#life-mortgage')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#s-expense').locator('xpath=ancestor::div[contains(@class,"f")][1]')).toHaveClass(/cmp/);
});

test('typing turns nothing red and computes nothing; leaving the field stops; fixing clears at once', async ({ page }) => {
  await page.goto('/');
  const before = await page.locator('#sticky-result').innerText();
  await page.locator('#s-age').fill('3');
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await expect(page.locator('#sticky-result')).toHaveText(before);
  await page.locator('#s-age').press('Tab');
  await expect(page.locator('#s-age')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：年龄 ›');
  await page.locator('#s-age').fill('31');
  await expect(page.locator('#s-age')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#sticky-result')).toContainText(/\d+ 岁放假/);
});

test('a blank shows 待填 and — , never the old result', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-expense', ''); await page.locator('#s-expense').press('Tab');
  await expect(page.locator('#sticky-result .chip')).toHaveText('待填：每月支出 ›');
  await expect(page.locator('#hero')).toContainText('— 岁放假');
  await expect(page.locator('body')).toHaveClass(/result-held/);
});

test('the result links go to the problem instead', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-income', ''); await page.locator('#s-income').press('Tab');
  await page.evaluate(() => { document.getElementById('inputs-box').open = false; });
  for (const name of ['怎么提前', '撑得住吗', '放假卡']) {
    await page.locator('.zone-nav a', { hasText: name }).click();
    await expect(page.locator('#s-income')).toBeFocused();
    await page.locator('#s-age').focus();
  }
  await expect(page.locator('#share-panel')).toBeHidden();
});

test('saved numbers that break a rule (an older save with the mortgage above spending) open stopped, every mark shown', async ({ page }) => {
  await withSaved(page, { expense: 84000, real: { mortgage: { monthly: 7500, endYear: 2045 }, kids: { count: null, age: null, monthly: null } } });
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：房贷 ›');
  await expect(page.locator('#life-mortgage')).toHaveAttribute('aria-invalid', 'true');
});

test('a professional-only value saved out of range: the chip names it in the simple view and the jump opens the professional view', async ({ page }) => {
  await withSaved(page, { view: 'simple', eq: 150 });
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：股票占比 ›');
  await page.locator('#sticky-result .chip').click();
  await expect(page.locator('#to-pro')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#p-eq')).toBeFocused();
});

test('no horizontal scroll at 390 px while stopped', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-age', '120'); await page.locator('#s-age').press('Tab');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/lines.test.mjs` and `npx playwright test tests/e2e/limits.spec.mjs`
Expected: FAIL (no `chipText`, no chip, old dimmed result).

- [ ] **Step 3: Implement** the Interfaces and the timing algorithm above in app.js/views.js; index.html and app.css changes as listed. Delete `#missing-note`, `showBlanks`, `blankFields`, `stopAtBlank`, the `请填写` / `请填写，没有就填 0` CSS rules (spec §3 row 4; the placeholder `0` says it now) and `.inputs-missing`. Styles: `.chip` red pill button (`--bad` background, white text); `.f.bad input` 2 px solid `--bad`; `.f.cmp input` 1 px dashed `--bad`.

- [ ] **Step 4: Rewrite the old tests that asserted the removed behaviour** (find them with `grep -rn "missing-note\|inputs-missing\|stopAtBlank" tests`): `#missing-note` text → the chip text (`待填：每月支出 ›`, `待填：每月到手收入 ›`, `待填：年龄 ›` after leaving the field); `inputs-missing` → `result-held`; "the headline keeps the old result" → `#hero`/`#sticky-result` show `— 岁放假` after leaving the field and the old text while still typing; review-fixes I1: while backspacing, the result stays as it was and nothing is red; after typing `35` and leaving, the headline returns to `settled`. life.spec `99999`: after leaving `#life-mortgage`, chip `拦住：房贷 ›` and `#life-tag` hidden; after `7500` the age equals `withBoth` again.

- [ ] **Step 5: Run everything**

Run: `npm test`, `npx playwright test`, `node scripts/lint-copy.mjs site/index.html site/method.html site/sources.html site/404.html`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add site/js/app.js site/js/views.js site/index.html site/css/app.css tests/lines.test.mjs tests/e2e
git commit -m "feat: a broken rule stops the result with a chip that jumps to the field"
```

---

### Task 5: The locked split total (simple and professional)

**Files:**
- Modify: `site/js/app.js` (`fieldHtml` 216, `SPLIT_PARTS`/`SPLIT_NOTE`/`SPLIT_HTML`/`showSplitLife`/`clearSplit` 265-282, `syncInputs` 300-323, `placeFold` 327-331, `onInput` split branch 787-799 and the `s-expense` line 799, `onClick`)
- Modify: `site/js/views.js` (add `splitLineHtml`)
- Modify: `site/css/app.css`
- Modify: `tests/lines.test.mjs`, `tests/e2e/limits.spec.mjs`, `tests/e2e/layout.spec.mjs` (149-165)

**Interfaces:**
- Consumes: `setSplit`, `unsplit`, `splitOn` (Task 1); `storyRows` row `split` (Task 3); `fieldEl`, `refresh`, `goToField` (Task 4).
- Produces:
  - views.js `splitLineHtml(row: StoryRow, { view, wCur }) -> string`: simple `= 5,000 + 2,000 + 1,000` and button `只填总数 ¥6,000`; pro `(2,000 + 1,500 + 1,000) × 12` and `只填总数 ¥72,000`. Parts with `num`, blank parts as `0`; button `<button type="button" class="link" data-unsplit>只填总数 ${wholeMoney(before / (simple ? 12 : 1), wCur)}</button>`; '' when `row` is undefined.
  - DOM: simple parts `#split-rent|food|other`, pro parts `#p-split-rent|food|other` inside `<details class="split" id="p-expense-split">` placed after `#p-expense`'s `.f` (same summary text as the simple one); line containers `#split-line-s`, `#split-line-p` inside each split details.
  - `SPLIT_PARTS = [['rent', '房租和房贷'], ['food', '吃饭'], ['other', '其他']]` (C20).

Behaviour: typing a part calls `setSplit` then `refresh`; the expense input of the view shows the sum (simple monthly, pro yearly). While `splitOn(S)`: the expense input is `readonly`, `aria-readonly="true"`, `aria-label` `每月支出，三项合计` (pro `当前年支出，三项合计`), class `locked` (grey dashed frame) with a `<span class="f-pre" aria-hidden="true">=</span>` prefix drawn left inside the box (the value stays a plain number); focusing or clicking it moves the focus to the first part; the split details stay open. `[data-unsplit]` calls `unsplit`, refreshes and focuses the expense input. `SPLIT_NOTE`, `#split-note`, `clearSplit` and `splitting` are deleted; the `split-life` button stays.

- [ ] **Step 1: Write the failing tests**

`tests/lines.test.mjs`:
```js
import { splitLineHtml } from '../site/js/views.js';
test('splitLineHtml: the sum by month, or by month × 12 in the professional view', () => {
  const row = { key: 'split', parts: [5000, 2000, 0], before: 72000 };
  const simple = splitLineHtml(row, { view: 'simple', wCur: 'CNY' });
  assert.match(simple, /= 5,000 \+ 2,000 \+ 0/); assert.match(simple, /只填总数 ¥6,000/);
  const pro = splitLineHtml({ ...row, parts: [2000, 1500, 1000] }, { view: 'pro', wCur: 'CNY' });
  assert.match(pro, /\(2,000 \+ 1,500 \+ 1,000\) × 12/); assert.match(pro, /只填总数 ¥72,000/);
  assert.equal(splitLineHtml(undefined, { view: 'simple', wCur: 'CNY' }), '');
});
```

`tests/e2e/limits.spec.mjs`:
```js
test('splitting locks spending to the sum; 只填总数 brings back the old total; a reload keeps the parts', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  await expect(page.locator('#expense-split summary')).toContainText('拆开来加');
  await expect(page.locator('#expense-split')).toContainText('房租和房贷');
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) await page.fill(`#split-${k}`, v);
  const total = page.locator('#s-expense');
  await expect(total).toHaveValue('8000');
  await expect(total).toHaveAttribute('readonly', ''); await expect(total).toHaveAttribute('aria-readonly', 'true');
  await expect(page.locator('#split-line-s')).toContainText('= 5,000 + 2,000 + 1,000');
  await expect(page.locator('[data-unsplit]').first()).toHaveText('只填总数 ¥6,000');
  await total.click(); await expect(page.locator('#split-rent')).toBeFocused();
  await page.reload();
  await expect(page.locator('#split-food')).toHaveValue('2000'); await expect(total).toHaveValue('8000');
  await page.locator('#split-line-s [data-unsplit]').click();
  await expect(total).toHaveValue('6000'); await expect(total).toBeFocused();
  await expect(total).not.toHaveAttribute('readonly', ''); await expect(page.locator('#split-rent')).toHaveValue('');
});

test('clearing all three parts by hand unlocks with the old total', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  await page.fill('#split-rent', '5000'); await page.fill('#split-food', '2000');
  await page.fill('#split-rent', ''); await page.fill('#split-food', '');
  await expect(page.locator('#s-expense')).toHaveValue('6000');
  await expect(page.locator('#s-expense')).not.toHaveAttribute('readonly', '');
});

test('the professional view splits by month, shows × 12 and can leave the split', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  await page.locator('#p-expense-split summary').click();
  for (const [k, v] of [['rent', '2000'], ['food', '1500'], ['other', '1000']]) await page.fill(`#p-split-${k}`, v);
  await expect(page.locator('#p-expense')).toHaveValue('54000');
  await expect(page.locator('#split-line-p')).toContainText('(2,000 + 1,500 + 1,000) × 12');
  await page.locator('#split-line-p [data-unsplit]').click();
  await expect(page.locator('#p-expense')).toHaveValue('72000');
});

test('a mortgage above the rent part stops the result', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) await page.fill(`#split-${k}`, v);
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '9000'); await page.fill('#life-mortgage-end', '2045');
  await page.locator('#life-mortgage-end').press('Tab');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：房贷 ›');
});
```
Replace `layout.spec.mjs` 'the spending split spans the row, shows its total, and clears when spending is typed by hand' with 'the spending split spans the row and locks the total': keep the width assertions, then the sum `23333` in `#s-expense` with `readonly`, and `#split-line-s` containing `= 12,500 + 3,200 + 7,633`.

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/lines.test.mjs` and `npx playwright test tests/e2e/limits.spec.mjs tests/e2e/layout.spec.mjs`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement** the behaviour above.

- [ ] **Step 4: Run everything**

Run: `npm test`, `npx playwright test`, copy lint
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add site/js/app.js site/js/views.js site/css/app.css tests/lines.test.mjs tests/e2e
git commit -m "feat: the spending split is stored, locks the total and has 只填总数 to leave it"
```

---

### Task 6: The lines under the fields and the exit buttons

**Files:**
- Modify: `site/js/views.js` (`lifeTagText` 423-426 new signature, delete `lifeAfterText` 429-432; `pensionEstimateHtml` 92-107 gains the B15 line; add `num` re-export use, `relText`, `fieldLinesHtml`, `fixesHtml`)
- Modify: `site/js/app.js` (`renderEstimate` 368-384, `renderLife` 451-476, `placeFold`, `renderPen`, `renderTown`, `onClick` add `[data-fix]`, `data-pen-use` 993-1001)
- Modify: `site/js/state.js` (delete `lifeIssue` 70-78 and `lifeSummary` 100-115)
- Modify: `site/index.html` (delete lines 81-82 `#life-issue`, `#life-after`; line 84 keeps its first two sentences and drops "更细的安排（几个孩子年龄不同、兼职收入）会在后面的版本里加。"; line 73 stays verbatim (Q1); `#life-mortgage-end` `min`/`max` set by app.js; `#life-kids` `min="0"`)
- Modify: `site/method.html:95`, `docs/method.md:64-65`
- Modify: `site/css/app.css`
- Modify: `tests/lines.test.mjs`, `tests/holiday.test.mjs` (359-363), `tests/state.test.mjs` (201-280, the `lifeIssue`/`lifeSummary` tests), `tests/e2e/life.spec.mjs`, `tests/e2e/limits.spec.mjs`

**Interfaces:**
- Consumes: `problems`, `storyRows`, `num` (Tasks 1–3); `fieldEl`, `goToField`, `refresh`, `markProblems` (Task 4); `splitLineHtml` (Task 5).
- Produces (views.js):
  - `relText(rel: Rel) -> string`: `${sub ? '└ 其中' : ''}${left labels joined ' + '} ${num(sum of left values)}${left[0].unit ?? ''}${op ? ` ${op} ${right.label ? right.label + ' ' : ''}${num(right.value)}${right.unit ?? ''}` : ''}`; for `ended`: `└ 其中<s>${label} ${num(value)}</s> ${fact}` wrapped in `<span aria-label="已结束，不计入">`.
  - `fieldLinesHtml({ rows, list, at, view, wCur, rCur }) -> string` for `at` = `'expense'` or `'retExp'`: in order the `split` line (via `splitLineHtml`), the `└` rows (counted: `└ 其中月供 7,500`; ended: grey strike-through; blocked: red `relText(rel)`, a space, then `<span class="x" aria-label="拦住">✕</span>`, on a `<p>` with `id="rel-<field>"` of the problem's solid field), B14 `<p class="row warn"><span aria-label="提示">!</span> 每月存下 −1,000</p>` (pro `! 年储蓄 −12,000 · 存款用完后按 0 算`) under `expense`; under `retExp`: `ret:*` rows, the A4 line when blocked, then `→ ${age} 岁起 ¥X` per `after:` row (`—` with `aria-label="没有数"` while A4 blocks; `→ 50 岁起 <span class="warn"><span aria-label="提示">!</span> ¥1,200</span>` when flagged). Arrows and `└` are `aria-hidden`; "其中" is read.
  - `fieldLineHtml(problem) -> string` for range rules drawn under their own field: `<p class="row bad" id="rel-<field>">${relText(rel)} <span class="x" aria-label="拦住">✕</span></p>`.
  - `fixesHtml(fixes: Fix[]) -> string`: one `<button type="button" class="ghost fix" data-fix='${JSON}'${aria ? ` aria-label="${aria}"` : ''}>${text}</button>` per fix; '' when empty.
  - `lifeTagText(rows: StoryRow[]) -> string`: `已算：房贷到 2045、孩子到 22 岁 ›` listing only counted items (`mortgage`/`kids` rows with `status === null`), '' when none.
  - `pensionEstimateHtml(result, { used, held, problem = null })`: with a B15 problem, adds `fieldLineHtml(problem)` and `fixesHtml(problem.fixes)` above the use button.
- app.js: `applyFix(fix)`: `set` → each key through the matching setter (`setField`, `setReal`, `setSplit`, `setPen`, with `commit`), `focus` → `goToField`, `clear` → `setReal` blanks for that group, `reset` → `touched.retExp = false` and re-estimate, `unsplit` → `unsplit`; then `refresh({ commit: true })` and, when the fix was not `focus`, keep the focus on the fixed field.

Placement: `#lines-expense` sits right after the split details (pro: after `#p-expense-split`), then the life fold (extend `placeFold`); `#lines-retexp` sits under `#s-retexp`'s field (pro `#p-retExp`). A range rule's line is inserted after its own field wrapper. Fix buttons go right after the solid field's wrapper (inside the life grid / split row as a full-width cell), so `房租和房贷 → 9,000` `改月供` sit under the mortgage box as in `x1/mock-phone-simple-r3.png`. The solid field gets `aria-describedby="rel-<field>"` when its line exists. `#s-retexp` and `#p-retExp` show a blue `≈` prefix (`<span class="f-pre est" aria-label="估算">≈</span>`, drawn inside the box, not part of the value) while `!touched.retExp`; once typed, a link button `改回估算` sits right of the label (`data-fix='{"reset":"retExp"}'`) in both views (B16, C43). The `已算：` tag uses `lifeTagText(rows)` and is hidden while held; `#life-gain` shows when any item is counted. `#estimate`'s simple note keeps only the `mix-note` paragraph (the "估算值…" and "要包含月供和孩子…" sentences go, spec §9.3). Ended items need no exit. A9: `#town-monthly` gets the solid frame and the `改花销` button; the town line text is unchanged (C35). B15: `用这个结果` while B15 is present calls `goToField('pen.years')` instead of applying. `#life-mortgage-end` gets `min = year − 50`, `max = year + 40`.

method.html:95 becomes: `月供和孩子的花销加起来要比每月支出少，也要比手填的退休后每月想花少；不满足时页面拦住，结果先不算。“已算：……”标签只列进了计算的项，到期以后每月花多少写在退休后每月想花下面的 → 行。` `docs/method.md:64-65` say the same in English (the page stops the result; the tag lists the items without an amount; the amount after they end is on the `→` rows under retirement spending; the typed-spending check below a quarter is an orange `!` on that row).

- [ ] **Step 1: Write the failing tests**

`tests/lines.test.mjs`:
```js
import { relText, fieldLinesHtml, fixesHtml, lifeTagText } from '../site/js/views.js';
import DATA from '../site/js/data-latest.js';
import { defaultState, storyRows, problems, toParams } from '../site/js/state.js';
// Block ends and buttons become a space; inline tags vanish.
const strip = h => h.replace(/<\/(p|div|li|button)>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

test('relText writes the relation the way the spec does', () => {
  assert.equal(relText({ sub: true, left: [{ label: '月供', value: 7500 }], op: '≥', right: { label: '每月支出', value: 7000 } }), '└ 其中月供 7,500 ≥ 每月支出 7,000');
  assert.equal(relText({ sub: true, left: [{ label: '月供', value: 7500 }, { label: '孩子', value: 1700 }], op: '≥', right: { label: '每月支出', value: 8000 } }), '└ 其中月供 + 孩子 9,200 ≥ 每月支出 8,000');
  assert.equal(relText({ sub: false, left: [{ label: '还到哪年', value: 2200 }], op: '>', right: { label: null, value: 2066 } }), '还到哪年 2200 > 2066');
  assert.equal(relText({ sub: false, left: [{ label: '孩子几个', value: 1.5 }], op: null, right: null }), '孩子几个 1.5');
  assert.equal(relText({ sub: false, left: [{ label: '每月支出', value: -500 }], op: '<', right: { label: null, value: 0 } }), '每月支出 −500 < 0');
  assert.equal(relText({ sub: true, left: [{ label: '月供', value: 108000, unit: '/年' }], op: '≥', right: { label: '当前年支出', value: 96000 } }), '└ 其中月供 108,000/年 ≥ 当前年支出 96,000');
  assert.equal(strip(relText({ sub: true, ended: true, label: '月供', value: 3000, fact: '2024 已还完' })), '└ 其中月供 3,000 2024 已还完');
  assert.match(relText({ sub: true, ended: true, label: '月供', value: 3000, fact: '2024 已还完' }), /<s>月供 3,000<\/s>/);
});
```
Note: `relText` returns plain text for live relations and HTML only for `ended`; `fieldLinesHtml` escapes nothing user-typed (all labels are fixed copy).

```js
const S = { ...defaultState(DATA), income: 360000, expense: 180000, retExp: 180000,
  real: { mortgage: { monthly: 7500, endYear: 2045 }, kids: { count: 1, age: 19, monthly: 3200 } } };
const lines = (s, at) => strip(fieldLinesHtml({ rows: storyRows(s, DATA, 2026, null), list: problems(s, DATA, 2026), at, view: s.view, wCur: 'CNY', rCur: 'CNY' }));

test('lines under spending: the items it holds', () => {
  assert.equal(lines(S, 'expense'), '└ 其中月供 7,500 └ 其中孩子 3,200');
  assert.equal(lines({ ...S, real: { ...S.real, kids: { count: null, age: null, monthly: null } } }, 'expense'), '└ 其中月供 7,500');
  assert.equal(lines(defaultState(DATA), 'expense'), '');
  assert.equal(lines({ ...defaultState(DATA), income: 60000 }, 'expense'), '! 每月存下 −1,000');
});

test('lines under retirement spending: the items and at most two → rows', () => {
  assert.equal(lines(S, 'retExp'), '└ 其中月供 7,500 └ 其中孩子 3,200 → 33 岁起 ¥11,800 → 50 岁起 ¥4,300');
  const typed = { ...S, retExp: 120000, touched: { retExp: true }, real: { ...S.real, kids: { count: 1, age: 5, monthly: 2500 } } };
  assert.match(lines(typed, 'retExp'), /└ 其中月供 \+ 孩子 10,000 ≥ 退休后每月想花 10,000 ✕ .*→ 47 岁起 — → 50 岁起 —/);
  const low = { ...S, retExp: (7500 + 3200 + 1000) * 12, touched: { retExp: true } };
  assert.match(lines(low, 'retExp'), /→ 50 岁起 ! ¥1,000/);
});

test('fixesHtml and lifeTagText', () => {
  assert.equal(strip(fixesHtml([{ text: '房租和房贷 → 9,000', aria: '房租和房贷改成 9,000', set: { 'split.rent': 9000 } }, { text: '改月供', focus: 'mortgage.monthly' }])), '房租和房贷 → 9,000 改月供');
  assert.match(fixesHtml([{ text: '→ 85', aria: '年龄改成 85', set: { age: 85 } }]), /aria-label="年龄改成 85"/);
  assert.equal(lifeTagText(storyRows(S, DATA, 2026, null)), '已算：房贷到 2045、孩子到 22 岁 ›');
  assert.equal(lifeTagText(storyRows(defaultState(DATA), DATA, 2026, null)), '');
});
```

`tests/e2e/limits.spec.mjs` (and rewrite the matching `life.spec.mjs` tests):
```js
const roomy = async page => { await page.fill('#s-income', '30000'); await page.fill('#s-expense', '15000'); };
const mortgage = async (page, m, end = '2045') => {
  const fold = page.locator('#life-fold'); if (!(await fold.evaluate(el => el.open))) await fold.locator('summary').click();
  await page.fill('#life-mortgage', m); await page.fill('#life-mortgage-end', end); await page.locator('#life-mortgage-end').press('Tab');
};

test('a counted mortgage: the line under spending, the → line and the tag without an amount', async ({ page }) => {
  await page.goto('/'); await roomy(page); await mortgage(page, '7500');
  await expect(page.locator('#lines-expense')).toContainText('└ 其中月供 7,500');
  await expect(page.locator('#lines-retexp')).toContainText('→ 50 岁起 ¥7,500');
  await expect(page.locator('#life-tag')).toHaveText('已算：房贷到 2045 ›');
  await expect(page.locator('#life-issue, #life-after')).toHaveCount(0);
  await expect(page.locator('#estimate')).not.toContainText('估算值');
});

test('A3 shows the relation and its three-word exits', async ({ page }) => {
  await page.goto('/'); await page.fill('#s-expense', '7000'); await mortgage(page, '7500');
  await expect(page.locator('#lines-expense')).toContainText('└ 其中月供 7,500 ≥ 每月支出 7,000 ✕');
  await expect(page.locator('#life-mortgage')).toHaveAttribute('aria-describedby', 'rel-mortgage.monthly');
  await page.getByRole('button', { name: '改每月支出' }).click();
  await expect(page.locator('#s-expense')).toBeFocused();
});

test('A2: 房租和房贷 → 9,000 fixes it in one tap', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) await page.fill(`#split-${k}`, v);
  await mortgage(page, '9000');
  await expect(page.locator('#lines-expense')).toContainText('└ 其中月供 9,000 > 房租和房贷 5,000');
  await page.getByRole('button', { name: '房租和房贷改成 9,000' }).click();
  await expect(page.locator('#split-rent')).toHaveValue('9000');
  await expect(page.locator('#s-expense')).toHaveValue('12000');
  await expect(page.locator('.chip')).toHaveCount(0);
});

test('A4: typed retirement spending below the items; 改回估算 brings back ≈', async ({ page }) => {
  await page.goto('/'); await roomy(page); await mortgage(page, '7500');
  await page.fill('#s-retexp', '6000'); await page.locator('#s-retexp').press('Tab');
  await expect(page.locator('#lines-retexp')).toContainText('└ 其中月供 7,500 ≥ 退休后每月想花 6,000');
  await expect(page.locator('#lines-retexp')).toContainText('→ 50 岁起 —');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：退休后 ›');
  await page.getByRole('button', { name: '改回估算 ≈ 15,000' }).click();
  await expect(page.locator('#s-retexp')).toHaveValue('15000');
  await expect(page.locator('#estimate .f-pre')).toHaveText('≈');
});

test('a fix that leaves another problem moves the chip on and leaves no stale mark', async ({ page }) => {
  await page.goto('/');
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '3000'); await page.locator('#life-mortgage').press('Tab');
  await page.fill('#life-kids', '1.5'); await page.locator('#life-kids').press('Tab');
  await page.getByRole('button', { name: '孩子几个改成 1' }).click();
  await expect(page.locator('#life-kids')).toHaveValue('1');
  await expect(page.locator('#life-kids')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#sticky-result .chip')).toHaveText('待填 2 处 ›');
});

test('A5 不算房贷; an ended mortgage is struck through; a range line and its → button', async ({ page }) => {
  await page.goto('/');
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '3000'); await page.locator('#life-mortgage').press('Tab');
  await expect(page.locator('#sticky-result .chip')).toHaveText('待填：房贷 ›');
  await page.getByRole('button', { name: '不算房贷' }).click();
  await expect(page.locator('#life-mortgage')).toHaveValue(''); await expect(page.locator('.chip')).toHaveCount(0);
  await mortgage(page, '4000', '2020');
  await expect(page.locator('#lines-expense s')).toHaveText('月供 4,000');
  await expect(page.locator('#lines-expense')).toContainText('2020 已还完');
  await expect(page.locator('.chip')).toHaveCount(0);
  await page.fill('#s-age', '120'); await page.locator('#s-age').press('Tab');
  await expect(page.locator('#rel-age')).toContainText('年龄 120 > 85');
  await page.getByRole('button', { name: '年龄改成 85' }).click();
  await expect(page.locator('#s-age')).toHaveValue('85');
});

test('spending above income: an orange line, the result still shows', async ({ page }) => {
  await page.goto('/'); await page.fill('#s-income', '5000'); await page.locator('#s-income').press('Tab');
  await expect(page.locator('#lines-expense')).toContainText('! 每月存下 −1,000');
  await expect(page.locator('.chip')).toHaveCount(0);
});

test('the town line and the pension estimate stop only themselves', async ({ page }) => {
  await page.goto('/'); await roomy(page); await mortgage(page, '4000');
  await page.locator('#places-fold summary').click();
  await page.fill('#town-name', '大理'); await page.fill('#town-monthly', '3000'); await page.locator('#town-monthly').press('Tab');
  await expect(page.locator('#town-monthly')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.chip')).toHaveCount(0);
  await page.locator('#pen-fold-s summary').click();
  await page.fill('#pen-s-paid', '15'); await page.fill('#pen-s-years', '12'); await page.locator('#pen-s-years').press('Tab');
  await expect(page.locator('#pen-result-s')).toContainText('累计缴费 12 年 < 已缴 15 年');
  await page.getByRole('button', { name: '累计缴费改成 15' }).click();
  await expect(page.locator('#pen-s-years')).toHaveValue('15');
});
```
(The pension check needs a birth month and base for the estimate to render; fill `#pen-s-birth` `1990-06` and `#pen-s-base` `8000` first, as `tests/e2e/pension.spec.mjs` does.)

Rewrite `life.spec.mjs` tests that asserted `#life-issue`, `#life-after`, the tag's `· 之后每月约 ¥X`, the estimate sentences, the `min="1"`/`min=<year>` attributes: the tag is now `已算：房贷到 2045 ›` / `已算：房贷到 2045、孩子到 22 岁 ›`; the amount after expiry is read from `#lines-retexp` (`→ 50 岁起 ¥7,500`); the low case is `→ 50 岁起 ! ¥500`; ended entries show strike-through rows; `#life-kids` `min` is `0`, `#life-mortgage-end` `min` is `year − 50`. Update `tests/holiday.test.mjs` 359-363 to the new `lifeTagText(rows)` and delete the `lifeAfterText` assertions; delete the `lifeIssue`/`lifeSummary` tests in `tests/state.test.mjs` (their cases now live in `tests/problems.test.mjs` and `tests/story.test.mjs`).

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/lines.test.mjs` and `npx playwright test tests/e2e/limits.spec.mjs`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement** the Interfaces and placement above; delete `lifeIssue`, `lifeSummary`, `lifeAfterText`, the `dropped` sentences (`app.js:459-462`), `#life-issue`, `#life-after`; edit `method.html:95` and `docs/method.md:64-65`.

- [ ] **Step 4: Run everything**

Run: `npm test`, `npx playwright test`, copy lint
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add site tests docs/method.md
git commit -m "feat: lines under the fields say why a number is stopped and offer one-tap exits"
```

---

### Task 7: Group header statuses and the 我的数字 link

**Files:**
- Modify: `site/js/state.js` (add `groupStates`)
- Modify: `site/js/views.js` (add `groupStatusHtml`)
- Modify: `site/js/app.js` (`SIMPLE_FIELDS` 146-163: drop `note`, legend `养老金`; `buildForm` 284-286; `syncChrome` 359-362 drop `.legend-note`; `renderEstimate` simple header; `onClick` for `＋` and `#nav-numbers`)
- Modify: `site/index.html` (nav 38-43: `<a href="#inputs-box" id="nav-numbers">我的数字</a>` first)
- Modify: `site/css/app.css`
- Modify: `tests/problems.test.mjs`, `tests/lines.test.mjs`, `tests/e2e/limits.spec.mjs`, `tests/e2e/app.spec.mjs:96`, `tests/e2e/layout.spec.mjs:184-…`

**Interfaces:**
- Consumes: `problems`, `rowOf`, `formGroupOf` (Task 1).
- Produces:
  - state.js `groupStates(S, list: Problem[], data) -> Record<FormGroup, { blank: number, block: number, example: boolean, empty: boolean, changed: number|null }>`. FormGroups: simple `now where pension retire`; pro `region now retire returns risk sim`. `blank`/`block` count the group's problems through `formGroupOf(q.row, S.view)`; `example` (simple `now` only): `age assets income expense` equal `defaultState` and `!splitOn(S)`; `empty` (simple `pension`): `!(S.pension > 0)`; `changed` (pro `returns`, `risk`; `null` elsewhere): count of fields that differ from their default (`eq eqReal fxDrift sigEq sigBd rho flexCut` vs `defaultState`, `bondY infl drag` vs the work country's data) plus 1 for `returns` when `!S.autoSwr`.
  - views.js `groupStatusHtml(st, { version }) -> string`: when `blank + block > 0`: `<span class="grp-x" aria-label="${parts}">✕ ${blank + block}</span>` with `parts` = `拦住 N 处` and/or `待填 N 处` joined by `，` (C15); else `示例` when `example`; else `<button type="button" class="grp-plus" aria-label="可以不填，点此填写">＋</button>` when `empty`; else `默认` / `已改 ${changed}` when `changed !== null`. For `returns`/`risk` a space and the data label `<span class="grp-data">${version} 数据</span>` follow in every case.
  - DOM: every legend is `<legend>${name}<span class="grp-status" data-grp="${group}"></span></legend>`; the simple `#estimate` block gets a header in the same style: `<h3 class="grp-legend"><label for="s-retexp">退休后每月想花</label><span class="grp-status" data-grp="retire"></span></h3>`.
  - `#nav-numbers` click: open `#inputs-box`, scroll to the first fieldset (or the retire header) whose status holds `.grp-x`, else to the top of the form on screen; never intercepted by `stopAtProblem`. `.grp-plus` click: `goToField('pension')`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/problems.test.mjs
import { groupStates } from '../site/js/state.js';
test('groupStates: example, plus, counts, and changed assumptions', () => {
  const S = defaultState(DATA);
  const st = groupStates(S, problems(S, DATA, 2026), DATA);
  assert.equal(st.now.example, true); assert.equal(st.pension.empty, true); assert.equal(st.now.block + st.now.blank, 0);
  const bad = S0({ expense: 84000, real: real(M), retExp: null });
  const st2 = groupStates(bad, problems(bad, DATA, 2026), DATA);
  assert.deepEqual([st2.now.block, st2.retire.blank], [1, 1]); assert.equal(st2.now.example, false);
  const pro = S0({ view: 'pro', eq: 70, autoSwr: false });
  assert.equal(groupStates(pro, [], DATA).returns.changed, 2);
  assert.equal(groupStates({ ...S, view: 'pro' }, [], DATA).risk.changed, 0);
  assert.equal(groupStates(S0({ mode: 'bwd', tAge: 25 }), problems(S0({ mode: 'bwd', tAge: 25 }), DATA, 2026), DATA).pension.block, 1);
});
// tests/lines.test.mjs
import { groupStatusHtml } from '../site/js/views.js';
test('groupStatusHtml: ✕ N first, then 示例, ＋, 默认 / 已改 N with the data month', () => {
  const s = o => ({ blank: 0, block: 0, example: false, empty: false, changed: null, ...o });
  assert.match(groupStatusHtml(s({ block: 1, blank: 1, example: true }), { version: '2026-11' }), /aria-label="拦住 1 处，待填 1 处">✕ 2</);
  assert.equal(strip(groupStatusHtml(s({ example: true }), { version: '2026-11' })), '示例');
  assert.match(groupStatusHtml(s({ empty: true }), { version: '2026-11' }), /aria-label="可以不填，点此填写">＋</);
  assert.equal(strip(groupStatusHtml(s({ changed: 0 }), { version: '2026-11' })), '默认 2026-11 数据');
  assert.equal(strip(groupStatusHtml(s({ changed: 1 }), { version: '2026-11' })), '已改 1 2026-11 数据');
  assert.equal(groupStatusHtml(s(), { version: '2026-11' }), '');
});
```
```js
// tests/e2e/limits.spec.mjs
test('group headers carry the state of their entries', async ({ page }) => {
  await page.goto('/');
  const now = page.locator('[data-grp="now"]').first();
  await expect(now).toHaveText('示例');
  await expect(page.locator('#simple-form')).not.toContainText('示例，改成你的');
  await expect(page.locator('#simple-form')).not.toContainText('（可以不填）');
  await page.locator('[data-grp="pension"] .grp-plus').click();
  await expect(page.locator('#s-pension')).toBeFocused();
  await page.fill('#s-age', '120'); await page.locator('#s-age').press('Tab');
  await expect(now.locator('.grp-x')).toHaveText('✕ 1');
  await expect(now.locator('.grp-x')).toHaveAttribute('aria-label', '拦住 1 处');
});

test('我的数字 leads the second row and opens the numbers at the first group with ✕', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('.zone-nav a');
  await expect(links).toHaveText(['我的数字', '怎么提前', '撑得住吗', '参数', '放假卡']);
  const tops = await links.evaluateAll(as => as.map(a => a.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.evaluate(() => { document.getElementById('inputs-box').open = false; });
  await page.locator('#nav-numbers').click();
  expect(await page.locator('#inputs-box').evaluate(el => el.open)).toBe(true);
});

test('the professional assumption groups say 默认 until changed, with the data month', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  const ret = page.locator('#pro-form [data-grp="returns"]');
  await expect(ret).toContainText(/默认.*\d{4}-\d{2} 数据/);
  await page.fill('#p-eq', '70'); await page.locator('#p-eq').press('Tab');
  await expect(ret).toContainText('已改 1');
});
```
Update `app.spec.mjs:96` (`示例，改成你的` → the `now` status reads `示例`) and `layout.spec.mjs` 'the example label goes once the numbers are the person's own' (the status `示例` empties after a change).

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/problems.test.mjs tests/lines.test.mjs` and `npx playwright test tests/e2e/limits.spec.mjs`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement** the Interfaces; statuses are rewritten on every `refresh` (held or not).

- [ ] **Step 4: Run everything**

Run: `npm test`, `npx playwright test`, copy lint
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add site tests
git commit -m "feat: group headers show 示例, ✕ N, ＋ and 默认/已改 N; 我的数字 in the top bar"
```

---

### Task 8: The simple ledger, the two denominators and the method anchors

**Files:**
- Modify: `site/js/odds.js` (add `oddsAround`)
- Modify: `site/js/holiday.js:309` (`times`)
- Modify: `site/js/views.js` (`swrCompare` 119-122 and its callers in `tilesHtml` 124-141; `heroHtml` 635-641: drop the `times` span, add the toggle; add `ledgerHtml`)
- Modify: `site/js/app.js` (`renderHero`, `onClick` ledger toggle and `[data-field]`, `let ledgerOpen = false`)
- Modify: `site/index.html` (add `<div class="ledger" id="ledger" hidden></div>` after `.hero-grid`)
- Modify: `site/method.html` (h2 ids: 积累期 `accumulate`, 放假线 `need-line`, 放假年龄：八成把握 `odds`, 房贷和孩子 `items`, 养老金估算 `pension`; line 57 denominator sentence)
- Modify: `site/css/app.css`
- Create: `tests/ledger.test.mjs`, `tests/e2e/ledger.spec.mjs`
- Modify: `tests/holiday.test.mjs` / any test asserting `大约是 N 年的花销` (`grep -rn "年的花销" tests`)

**Interfaces:**
- Consumes: `storyRows`, `problems`, `firstDraw` (Tasks 1–3); `goToField`, held state (Task 4); `relText` (Task 6).
- Produces:
  - odds.js `oddsAround(p, t, s0 = null) -> { t, age, count, share }[]`: for `t − 1`, `t`, `t + 1` clipped to `0 … life − age − 1`; `share = successAt(p, T, s0)`, `count = Math.round(share × 2000)`.
  - holiday.js `heroModel` `times = reachable ? Math.round(line / firstDraw(p, workYears)) : null` (C27, spec §9.2).
  - views.js `swrCompare(p, line, t)`: denominator `firstDraw(p, t)`; `tilesHtml` passes `t` (`bwd.n` working backward).
  - views.js `ledgerHtml({ rows, list, odds, plan, state, view, mode, p, dispCur, mc = null, bwdOdds = null }) -> string` (`mc` used by Task 9's pro rows; `bwdOdds` = `latest.odds` working backward), `state` one of `'ok' | 'held' | 'unreachable' | 'now'`; simple copy verbatim from spec §7.2 and §7.4:
    - ① header `① 攒钱` with `${age} → ${holidayAge} 岁` (unreachable: `${age} → ${life − 1} 岁`; now: the whole section is one line `不用再攒`); rows `已有`, `到手`, `− 支出`, the `=` split row and `└ 其中` rows (`└ 其中月供 7,500 → 2045`; kids `→ 22 岁`), `= 每月存下`, `收入每年 +2%` with `<span class="tag">本工具设定</span>`, `→ 43 岁每月存下`.
    - ② header `② 放假以后` / `每月花` (unreachable: `如果 ${life − 1} 岁放假`); rows by `ages`: `44–49  退休后  ≈ ¥15,000`, `50 起  <s>月供</s>  ¥7,500`, `63 起  养老金  — ›` or `−¥4,000`, `44–63  自缴  +¥1,500`; `⇒ 44 岁放假要有  ¥391万` and the small line `≈ 年支出 × ${times} 倍 · 八成年景够花到 ${life} 岁` (no `⇒` line when unreachable).
    - ③ header `③ 2,000 种年景` with `平均每年 ${pct(p.r, 1)}` and the tag; one line per `oddsAround` entry: `${age} 岁  ${dots}  ${floor(share × 10)} 成` (dots: `●` × `floor(count / 2000 × 10)` then `○` to 10; the holiday year bold green); `⇒ 第一个到八成  ${holidayAge} 岁`. Unreachable: one line for `life − 1` and `规划期内到不了八成`. Now: `今天 ●●●●●●●●●○ 9 成`. Backward: the line reads `${tAge} 岁（你定的）` and `⇒ 要八成：第一年每月存 ${wholeMoney(odds.s0 / 12)}` (from `bwdOdds`).
    - Footer `≈ 估算 · 按今天的钱` and `<a href="method.html#…">计算方法 ›</a>` (① `#accumulate`, ② `#need-line`, ③ `#odds`, items `#items`, pension `#pension`).
    - Held: rows up to and including the cut row (`status` `block`: `relText(rel)` + `✕ ›`; `blank`: label + `待填 ›`), then the fixed lines that follow the cut's section: `= 每月存下 —`, `⇒ ② 要有 —`, `⇒ ③ 放假年龄 —` (each `—` with `aria-label="没有数"`).
    - Every row that has `field` renders its label as `<button type="button" class="link" data-field="${field}">`. Rows with `value === 0` are not drawn, except `pension`.
  - Fund line in `heroHtml`: `放假资金：已有 ¥20万 / 需要 ¥391万（5%）<button type="button" class="ledger-toggle" aria-expanded aria-controls="ledger">怎么算的 ▸</button>` (`▾` when open); held: `放假资金 — ` + the same toggle (in `heldHeroHtml`); unreachable: `放假资金：按现在的节奏到不了` + toggle.
  - app.js: the toggle flips `ledgerOpen`; while open, `#ledger` is rendered on every `refresh` after `flushSimulation()` (the held state renders with `plan = null`); `[data-field]` calls `goToField`.
  - method.html:57: "页面上的'≈ 年支出 × N 倍'就是放假线 ÷ 放假头一年从存款里取的钱（含还在还的月供的实际值、自缴，减去当年的养老金），四舍五入，与反推提取率互为倒数。" replaces the sentence that defines N.

- [ ] **Step 1: Write the failing tests**

`tests/ledger.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, storyRows, problems, toParams } from '../site/js/state.js';
import { firstDraw, fiNeed } from '../site/js/engine.js';
import { oddsAround, oddsSolve, needLine, successAt } from '../site/js/odds.js';
import { heroModel } from '../site/js/holiday.js';
import { ledgerHtml, tilesHtml } from '../site/js/views.js';
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const S = { ...defaultState(DATA), income: 360000, expense: 180000, retExp: 180000,
  real: { mortgage: { monthly: 7500, endYear: 2045 }, kids: { count: null, age: null, monthly: null } } };
const solve = s => { const p = toParams(s, DATA, 2026); const t = oddsSolve(p); return { p, t, need: needLine(p)[t] }; };

test('oddsAround: three years round the holiday, from the same simulation', () => {
  const { p, t } = solve(S);
  const rows = oddsAround(p, t);
  assert.deepEqual(rows.map(r => r.t), [t - 1, t, t + 1]);
  assert.equal(rows[1].share, successAt(p, t)); assert.equal(rows[1].count, Math.round(successAt(p, t) * 2000));
  assert.deepEqual(oddsAround(p, 0).map(r => r.t), [0, 1]);
});

test('the multiple and the implied rate share one denominator: the first holiday year\'s draw', () => {
  const { p, t, need } = solve(S);
  const h = heroModel({ mode: 'fwd', p, t, bwd: null, success: 0.8, need });
  assert.equal(h.times, Math.round(need / firstDraw(p, t)));
  const tiles = tilesHtml({ mode: 'fwd', p, t, bwd: null, mc: null, dispCur: 'CNY', target: needLine(p) });
  assert.match(tiles, new RegExp(`反推的提取率是 ${(firstDraw(p, t) / need * 100).toFixed(1)}%`));
});

test('ledgerHtml simple: the three sections in the spec\'s words', () => {
  const plan = solve(S); const { p, t } = plan;
  const html = ledgerHtml({ rows: storyRows(S, DATA, 2026, plan), list: [], odds: oddsAround(p, t), plan, state: 'ok', view: 'simple', mode: 'fwd', p, dispCur: 'CNY' });
  const text = strip(html);
  for (const s of ['① 攒钱', `30 → ${30 + t} 岁`, '已有', '到手', '− 支出', '└ 其中月供 7,500 → 2045', '= 每月存下', '收入每年 +2% 本工具设定',
    `→ ${29 + t} 岁每月存下`, '② 放假以后', '每月花', `${30 + t}–49 退休后 ≈ ¥15,000`, '50 起 月供 ¥7,500', '养老金 — ›',
    `⇒ ${30 + t} 岁放假要有`, '八成年景够花到 95 岁', '③ 2,000 种年景', '本工具设定', '⇒ 第一个到八成', '≈ 估算 · 按今天的钱', '计算方法 ›']) assert.ok(text.includes(s), s);
  assert.match(html, /<s>月供<\/s>/); assert.match(html, /href="method\.html#accumulate"/);
  assert.ok(!text.includes(' / 2,000') && !text.includes('成功率'));   // the simple view says only X 成
});

test('ledgerHtml held, unreachable, today and backward', () => {
  const s = { ...S, expense: 84000 };
  const held = strip(ledgerHtml({ rows: storyRows(s, DATA, 2026, null), list: problems(s, DATA, 2026), odds: [], plan: null, state: 'held', view: 'simple', mode: 'fwd', p: null, dispCur: 'CNY' }));
  for (const x of ['└ 其中月供 7,500 ≥ 每月支出 7,000 ✕ ›', '= 每月存下 —', '⇒ ② 要有 —', '⇒ ③ 放假年龄 —']) assert.ok(held.includes(x), x);
  const blank = { ...S, expense: null };
  assert.ok(strip(ledgerHtml({ rows: storyRows(blank, DATA, 2026, null), list: problems(blank, DATA, 2026), odds: [], plan: null, state: 'held', view: 'simple', mode: 'fwd', p: null, dispCur: 'CNY' })).includes('待填 ›'));
  const poor = { ...defaultState(DATA), income: 72000, expense: 72000 };
  const p = toParams(poor, DATA, 2026); const T = p.life - p.age - 1;
  const un = strip(ledgerHtml({ rows: storyRows(poor, DATA, 2026, { p, t: T, need: null, unreachable: true }), list: [], odds: oddsAround(p, T).slice(-1), plan: { p, t: T, need: null, unreachable: true }, state: 'unreachable', view: 'simple', mode: 'fwd', p, dispCur: 'CNY' }));
  for (const x of [`如果 ${p.age + T} 岁放假`, '规划期内到不了八成']) assert.ok(un.includes(x), x);
  assert.ok(!un.includes('放假要有'));
});
```
Add a `now` case (assets large enough that `oddsSolve` is 0: `不用再攒`, `今天`) and a backward case (`45 岁（你定的）`, `⇒ 要八成：第一年每月存 ¥`) the same way.

`tests/e2e/ledger.spec.mjs` (390 px):
```js
test('the fund line is the ledger\'s closed state and opens in place', async ({ page }) => {
  await page.goto('/');
  const fund = page.locator('#hero .fund');
  await expect(fund).toContainText(/放假资金：已有 ¥[\d.]+万 \/ 需要 ¥[\d.]+万（\d+%）/);
  await expect(fund).not.toContainText('年的花销');
  const toggle = page.locator('.ledger-toggle').first();
  await expect(toggle).toHaveText('怎么算的 ▸');
  await toggle.click();
  await expect(toggle).toHaveText('怎么算的 ▾'); await expect(page.locator('#ledger')).toBeVisible();
  await expect(page.locator('#ledger')).toContainText('① 攒钱');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.locator('#ledger [data-field="expense"]').click();
  await expect(page.locator('#s-expense')).toBeFocused();
});

test('stopped, the ledger still opens and stops at the stopped row', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-expense', '7000');
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '7500'); await page.fill('#life-mortgage-end', '2045'); await page.locator('#life-mortgage-end').press('Tab');
  await expect(page.locator('#hero .fund')).toContainText('放假资金 —');
  await page.locator('.ledger-toggle').first().click();
  await expect(page.locator('#ledger')).toContainText('└ 其中月供 7,500 ≥ 每月支出 7,000');
  await expect(page.locator('#ledger')).toContainText('⇒ ③ 放假年龄 —');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/ledger.test.mjs` and `npx playwright test tests/e2e/ledger.spec.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement** the Interfaces, the anchors and the method.html:57 sentence. Ledger CSS: two columns (label | number), numbers right-aligned, `font-variant-numeric: tabular-nums`, `white-space: nowrap`; labels may wrap.

- [ ] **Step 4: Run everything**

Run: `npm test`, `npx playwright test`, copy lint
Expected: all pass (rewrite any test that asserted `大约是 N 年的花销` or the old implied rate).

- [ ] **Step 5: Commit**

```bash
git add site tests
git commit -m "feat: the ledger behind the fund line, one denominator for N 倍 and the implied rate"
```

---

### Task 9: The professional ledger and the professional view's missing considerations

**Files:**
- Modify: `site/js/views.js` (`ledgerHtml` pro branch; add `proLinesHtml`)
- Modify: `site/js/app.js` (`PRO_FIELDS` 165-202: `growth` label tag, `flexCut` label `一年跌 ≥ 15% 后少花`, a read-only `模拟` fieldset; `renderEstimate`; pro collapsed ledger row)
- Modify: `site/index.html` (add `<div class="ledger-row pro-only" id="ledger-row" hidden></div>` after `#tiles`)
- Modify: `site/css/app.css`
- Modify: `tests/ledger.test.mjs`, `tests/lines.test.mjs`, `tests/e2e/ledger.spec.mjs`

**Interfaces:**
- Consumes: everything above; `oddsYears`, `fwdSolve`, `latest.mc.bands`.
- Produces:
  - Pro collapsed row in `#ledger-row`: `放假线 ${wholeMoney(need)} · ${pct(success, 1)}　<button class="ledger-toggle" …>怎么算的 ▸</button>`; held: `放假线 —　怎么算的 ▸`.
  - `ledgerHtml` pro branch, copy verbatim from spec §7.3: ① `t = 0…${t − 1}`, `可投资资产`, `税后年收入 · 实际增长 +2%/年` + tag, `− 当前年支出 · 按今天的钱不变` + tag, the `(… ) × 12` split row, `└ 其中月供 90,000/年 → 2045`, `月供实际 × (1 + ${infl}%)^−t` with `t = ${t − 1} 时 ¥X`, `= 年储蓄 t0 → t${t − 1}` with `a → b`, `年末存入 · 资产不低于 0` + tag (`! 存款用完后按 0 算` when B14). ② `年初取出`, `退休后年支出`, `月供实际变轻，${age} 岁实付`, `50 起 <s>月供</s>`, `→ ${pAge} 自缴（工作地中国大陆且填了养老金才计）`, `${pAge} 起 养老金（超出年支出不计）`, `一年跌 ≥ 15% 次年少花（只砍生活费，月供、自缴照付）  ${flexCut}%`, `退休币升值（只算到放假那年）` (`— 同币种` when one currency), the `cross` row when two currencies, `⇒ 放假线（每条路径倒推，取 80 分位）  ${wholeMoney(need)}`, `≈ 年支出 × ${times} 倍 · 反推提取率 ${pct(firstDraw / need, 1)} · 对照 3.9%`. ③ `③ 2,000 条路径 · 种子 20261026` + tag; `r = ${eq}% × ${eqReal}% + ${100 − eq}% × (${bondY}% − ${infl}%) − ${drag}%  ${pct(p.r, 2)}` (`! 按 −50% 算` when B13); `σ（股 ${sigEq×100}% · 债 ${sigBd×100}% · ρ ${rho}）  ${pct(p.sigma, 1)}`; per `oddsAround` entry `${age} 岁  ${count} / 2,000  ${pct(share, 1)}` (holiday year bold); `⇒ 第一个到 80%  ${age} 岁`; `插值 ${oddsYears(p).toFixed(1)} 年 · ${age} 岁中位资产  ${wholeMoney(mc.bands[t][2])}`; `按固定收益算（约五成）  ${p.age + fwdSolve(p)} 岁`; footer `本工具设定 · 按今天的钱 · 实际收益  计算方法 ›`. The r and σ rows render in every pro state that has `p` (also unreachable); percentages in the r formula use `num` (so `−60%`). A block in a ③ input (B7–B10) cuts at the r row (`relText` + `✕ ›`).
  - views.js `proLinesHtml({ S, p, data, list, rows }) -> Record<string, string>` keyed by anchor (`region`, `expense`, `retExp`, `pension`, `growth`), copy verbatim from spec §10.3: `region` `汇率 1 ${rCur} = ${(fx[wCur] / fx[rCur]).toFixed(2)} ${wCur}` (empty when one currency); `expense` `月供按名义值 · 实际 × (1 + ${infl}%)^−t` when a mortgage is counted, and the pro kids row `└ 其中孩子 38,400/年 → 22 岁（按最小的）` + tag; `retExp` when two currencies and `!touched.retExp`: `≈ (${num(expense)} − 月供和孩子 ${num(items)}) × 物价比 ${ratio.toFixed(2)} ÷ 汇率 ${rate.toFixed(2)}` plus ` + 月供和孩子 ${num(items)} ÷ 汇率 ${rate.toFixed(2)}` when `items > 0` (so the line equals `estimateRetireSpend`; spec §10.3's example shows items 0), or `≈ ${num(expense)} × 物价比 … ÷ 汇率 …` without items; the A10 `→` row gains `< 现在 ${wholeMoney(expense / 12)} × 25%` + tag; `pension` `养老金上限 = 年支出` and the B12 line `! 养老金 60,000 > 年支出 54,000 · 多出 6,000 不计`; each B11 field gets an orange frame (class `warn` on its wrapper) and `! ${note}` under it.
  - The `growth` label carries `<span class="tag">本工具设定</span>`; the `模拟` fieldset (group `sim`) holds one read-only line `八成 · 2,000 次 · 种子 20261026` + tag.

- [ ] **Step 1: Write the failing tests**

```js
// tests/ledger.test.mjs
test('ledgerHtml pro: every consideration the model uses, in years', () => {
  const s = { ...S, view: 'pro' };
  const plan = solve(s); const { p, t, need } = plan;
  const mc = { bands: Array.from({ length: p.life - p.age + 1 }, () => [0, 0, 4294780, 0, 0]) };
  const text = strip(ledgerHtml({ rows: storyRows(s, DATA, 2026, plan), list: [], odds: oddsAround(p, t), plan, state: 'ok', view: 'pro', mode: 'fwd', p, dispCur: 'CNY', mc }));
  for (const x of [`t = 0…${t - 1}`, '税后年收入 · 实际增长 +2%/年 本工具设定', '当前年支出 · 按今天的钱不变 本工具设定', '└ 其中月供 90,000/年 → 2045',
    `月供实际 × (1 + ${p.infl}%)^−t`, '年末存入 · 资产不低于 0 本工具设定', '年初取出', '一年跌 ≥ 15% 次年少花（只砍生活费，月供、自缴照付）',
    '退休币升值（只算到放假那年） — 同币种', '放假线（每条路径倒推，取 80 分位）', `反推提取率 ${(firstDraw(p, t) / need * 100).toFixed(1)}% · 对照 3.9%`,
    '③ 2,000 条路径 · 种子 20261026 本工具设定', `r = 60% × 5% + 40% × (`, ' / 2,000 ', '⇒ 第一个到 80%', '插值', '中位资产 ¥4,294,780', '按固定收益算（约五成）',
    '本工具设定 · 按今天的钱 · 实际收益', '计算方法 ›']) assert.ok(text.includes(x), x);
});
test('ledgerHtml pro: a return floored at −50% says so on the r row', () => {
  const s = { ...S, view: 'pro', eq: 100, eqReal: -60 };
  const p = toParams(s, DATA, 2026); const T = p.life - p.age - 1;
  const plan = { p, t: T, need: null, unreachable: true };
  const text = strip(ledgerHtml({ rows: storyRows(s, DATA, 2026, plan), list: problems(s, DATA, 2026), odds: oddsAround(p, T).slice(-1), plan, state: 'unreachable', view: 'pro', mode: 'fwd', p, dispCur: 'CNY', mc: null }));
  assert.ok(text.includes('r = 100% × −60%'));
  assert.ok(text.includes('! 按 −50% 算'));
});
// tests/lines.test.mjs
import { proLinesHtml } from '../site/js/views.js';
test('proLinesHtml: exchange rate, nominal mortgage, cross-country estimate, pension cap', () => {
  const s = { ...defaultState(DATA), view: 'pro', retC: 'TH', real: { mortgage: { monthly: 3000, endYear: 2045 }, kids: { count: null, age: null, monthly: null } } };
  const p = toParams(s, DATA, 2026);
  const out = proLinesHtml({ S: s, p, data: DATA, list: problems(s, DATA, 2026), rows: storyRows(s, DATA, 2026, null) });
  assert.match(strip(out.region), /^汇率 1 THB = \d\.\d\d CNY$/);
  assert.equal(strip(out.expense).startsWith(`月供按名义值 · 实际 × (1 + ${p.infl}%)^−t`), true);
  assert.match(strip(out.retExp), /^≈ \(72,000 − 月供和孩子 36,000\) × 物价比 [\d.]+ ÷ 汇率 [\d.]+ \+ 月供和孩子 36,000 ÷ 汇率 [\d.]+$/);
  assert.equal(strip(out.pension), '养老金上限 = 年支出');
  assert.equal(strip(proLinesHtml({ S: defaultState(DATA), p: toParams(defaultState(DATA), DATA), data: DATA, list: [], rows: [] }).region), '');
});
```
```js
// tests/e2e/ledger.spec.mjs
test('the professional view: its rows, its labels and its checks', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  await expect(page.locator('#ledger-row')).toContainText(/放假线 ¥[\d,]+ · \d+\.\d%/);
  await expect(page.locator('#pro-form')).toContainText('一年跌 ≥ 15% 后少花');
  await expect(page.locator('#pro-form')).toContainText('八成 · 2,000 次 · 种子 20261026');
  await expect(page.locator('#p-growth').locator('xpath=ancestor::div[contains(@class,"f")][1]')).toContainText('本工具设定');
  await expect(page.locator('#pro-form')).toContainText('养老金上限 = 年支出');
  await page.fill('#p-eqReal', '12'); await page.locator('#p-eqReal').press('Tab');
  await expect(page.locator('#pro-form')).toContainText('! 常见 −2 到 10');
  await expect(page.locator('.chip')).toHaveCount(0);
  await page.fill('#p-pension', '90000'); await page.locator('#p-pension').press('Tab');
  await expect(page.locator('#pro-form')).toContainText('! 养老金 90,000 > 年支出 72,000 · 多出 18,000 不计');
  await page.locator('#ledger-row .ledger-toggle').click();
  await expect(page.locator('#ledger')).toContainText('③ 2,000 条路径 · 种子 20261026');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/ledger.test.mjs tests/lines.test.mjs` and `npx playwright test tests/e2e/ledger.spec.mjs`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement** the Interfaces (pass `mc: latest.mc` into `ledgerHtml`; the ledger opens after `flushSimulation()`, so `mc` exists).

- [ ] **Step 4: Run everything**

Run: `npm test`, `npx playwright test`, copy lint
Expected: all pass (update any test that read the old label `大跌后少花` in the pro form).

- [ ] **Step 5: Commit**

```bash
git add site tests
git commit -m "feat: the professional ledger and every model consideration visible in the professional view"
```

---

### Task 10: The sidebar at 1024 px and wider

**Files:**
- Modify: `site/js/app.js` (`buildForm` 284-286 and both field lists: simple `now` holds `age assets income`, then a sub-block `data-row="spend"` with `expense`, the split and the life fold; pro `now` holds `age assets income growth`, then the `spend` sub-block; row headers; `init` 1126-1196 open state; result card and links rendering)
- Modify: `site/js/views.js` (add `sideSummary`, `sideCardHtml`)
- Modify: `site/index.html` (inside `.inputs`, after `#inputs-box`: `<div class="side-foot" id="side-foot"><nav class="side-links" id="side-links"></nav><div class="side-card" id="side-card"></div></div>`)
- Modify: `site/css/app.css` (new `@media (min-width: 1024px)` block; 900–1023 keeps today's two columns)
- Create: `tests/e2e/sidebar.spec.mjs`
- Modify: `tests/lines.test.mjs`; existing default-viewport (1280 × 720) browser tests that break, as described in Step 4

**Interfaces:**
- Consumes: `groupStates`, `groupStatusHtml` (Task 7), `storyRows` (Task 3), `chipText`, `goToField`, `stopAtProblem` (Task 4), `ledgerOpen` toggle (Task 8).
- Produces:
  - Row header per sidebar row (simple `tage` (backward only, first) `now spend where pension retire`; pro `region now spend retire returns risk sim`): `<button type="button" class="grp-head" data-row="${row}" aria-expanded="true|false" aria-controls="${body id}"><b>${name}</b><span class="grp-sum">${summary}</span><span class="grp-status">…</span><span aria-hidden="true">›|▾</span></button>`, rendered for every row and `display: none` below 1024 px; at ≥ 1024 px the fieldset legends are hidden and the headers shown. Names: simple `想几岁放假`, `现在`, `每月支出` (`每月支出 = 8,000` when locked, else `每月支出 8,000`), `在哪里`, `养老金`, `退休后每月想花`; pro `地区与币种`, `现在`, `当前年支出` (`当前年支出 = 96,000` / `96,000`), `退休后`, `收益假设`, `风险假设`, `模拟`. The status uses `groupStatusHtml` of the row (`spend`/`tage` count their own problems; `sim` shows the tag `本工具设定`).
  - views.js `sideSummary(row, { S, p, rows, data }) -> string`, copy verbatim from spec §6.3 tables: `tage` `45 岁`; `now` `30 岁 · ¥20万 · 到手 ¥1.2万/月 · 存下 ¥6,000/月` (negative: `存下 <span class="warn">!</span> −¥1,000/月`); `spend` `其中月供 7,500 · 孩子 3,200` ('' without items); `where` `中国大陆 → 泰国`; `pension` `—` when blank (`aria-label="没有数"`) else `¥3,000/月 · 63 岁起`; `retire` `≈ 8,000 → 50 岁起 ¥500` (no `≈` once typed; no `→` part without items); pro `region` `CN → TH · 1 THB = 0.20 CNY` + `<span>${version} 数据</span>`; pro `now` `30 岁 · ¥20万 · ¥14.4万/年 · 涨 2%/年 · 存 ¥7.2万/年`; pro `retire` `≈ ฿297,600/年 · 到 95 · 养老金 63 岁起`; `returns` `股 60% · 实际 5.0% · 通胀 2.1% → r 2.9%`; `risk` `σ 0.17/0.06 · ρ 0.2 · 一年跌 ≥ 15% 后少花 0%`; `sim` `八成 · 2,000 次 · 种子 20261026`. Amounts: `roughMoney` for 万 figures, `wholeMoney`/`num` otherwise, as the copy shows.
  - views.js `sideCardHtml(h, { view, mode, success, chip, p }) -> string` per spec §6.3 result-card table: simple `50 岁放假`, mini bar, `八成把握`, `<button class="link" data-how>怎么算的 ›</button>`; backward `想 45 岁 · 6 成把握 · 怎么算的 ›`; unreachable `还在路上 · 怎么算的 ›`; pro `财务独立 56 岁 · 81.9% · 怎么算的 ›`, `目标 45 岁 · 63.2% · …`, `规划期内未达到 · …`; held both views `— 岁` + the chip button.
  - `#side-links`: simple `怎么提前 ${n} · 撑得住吗 · 参数 · 放假卡`, pro without `放假卡`; `n` = `document.querySelectorAll('#levers .lever').length`; the links reuse the top bar's hrefs and its `data-needs-result` interception.
  - Open state: `let openRows = new Set()`; first visit (`!returning`): all rows open; returning: all closed except rows whose status has `✕`; a row with a new `✕` opens on `refresh({ commit: true })`; `goToField` opens the field's row first. Rows open and close independently (C36). `[data-how]` opens the ledger (`ledgerOpen = true`) and scrolls to the fund line (pro: `#ledger-row`).
  - At ≥ 1024 px: `#sticky-bar` is hidden (C17); `.inputs` is `position: sticky; top: 16px; height: calc(100vh - 32px)`, a flex column whose form area scrolls (`overflow-y: auto`) and whose `#side-foot` stays at the bottom; width stays 330 px.

- [ ] **Step 1: Write the failing tests**

```js
// tests/lines.test.mjs
import { sideSummary, sideCardHtml } from '../site/js/views.js';
test('sideSummary: the closed rows in the spec\'s words', () => {
  const S = defaultState(DATA); const p = toParams(S, DATA, 2026); const rows = storyRows(S, DATA, 2026, null);
  const at = (row, s = S) => strip(sideSummary(row, { S: s, p: toParams(s, DATA, 2026), rows: storyRows(s, DATA, 2026, null), data: DATA }));
  assert.equal(at('now'), '30 岁 · ¥20万 · 到手 ¥1.2万/月 · 存下 ¥6,000/月');
  assert.equal(at('where'), '中国大陆 → 中国大陆');
  assert.equal(at('pension'), '—');
  assert.equal(at('retire'), '≈ 6,000');
  assert.equal(at('spend'), '');
  assert.equal(at('now', { ...S, income: 120000, expense: 132000 }), '30 岁 · ¥20万 · 到手 ¥1万/月 · 存下 ! −¥1,000/月');
  assert.equal(at('returns', { ...S, view: 'pro' }), `股 60% · 实际 5.0% · 通胀 ${S.infl.toFixed(1)}% → r ${(p.r * 100).toFixed(1)}%`);
  assert.equal(at('sim', { ...S, view: 'pro' }), '八成 · 2,000 次 · 种子 20261026');
});
test('sideCardHtml: normal, unreachable and held', () => {
  const h = { reachable: true, holidayAge: 50, workYears: 20, holidayYears: 45, label: '八成把握' };
  const simple = strip(sideCardHtml(h, { view: 'simple', mode: 'fwd', success: 0.81, chip: '', p: null }));
  for (const x of ['50 岁放假', '八成把握', '怎么算的 ›']) assert.ok(simple.includes(x), x);
  assert.ok(!simple.includes('%'));
  assert.equal(strip(sideCardHtml(h, { view: 'pro', mode: 'fwd', success: 0.819, chip: '', p: null })), '财务独立 50 岁 · 81.9% · 怎么算的 ›');
  assert.equal(strip(sideCardHtml({ reachable: false }, { view: 'simple', mode: 'fwd', success: null, chip: '', p: null })), '还在路上 · 怎么算的 ›');
  const held = strip(sideCardHtml(h, { view: 'simple', mode: 'fwd', success: null, chip: '拦住：房贷 ›', p: null }));
  assert.ok(held.includes('— 岁') && held.includes('拦住：房贷 ›') && !held.includes('50'));
});
```
```js
// tests/e2e/sidebar.spec.mjs — test.use({ viewport: { width: 1280, height: 800 } })
test('a first visit shows every row open, no top bar, links and the result card at the bottom', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#sticky-bar')).toBeHidden();
  const heads = page.locator('.grp-head:visible');
  await expect(heads).toHaveCount(5);
  for (const h of await heads.all()) await expect(h).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#side-links')).toContainText(/怎么提前 \d+ · 撑得住吗 · 参数 · 放假卡/);
  const n = await page.locator('#levers .lever').count();
  await expect(page.locator('#side-links')).toContainText(`怎么提前 ${n}`);
  await expect(page.locator('#side-card')).toContainText(/\d+ 岁放假/);
  const box = await page.locator('.inputs').boundingBox();
  expect(Math.round(box.width)).toBe(330); expect(box.height).toBeLessThanOrEqual(800);
});
test('a returning visit folds the rows to their summaries; rows open on their own', async ({ page }) => {
  await page.goto('/'); await page.reload();
  const now = page.locator('.grp-head[data-row="now"]');
  await expect(now).toHaveAttribute('aria-expanded', 'false');
  await expect(now).toContainText('30 岁 · ¥20万 · 到手 ¥1.2万/月 · 存下 ¥6,000/月');
  await now.click(); await page.locator('.grp-head[data-row="where"]').click();
  await expect(now).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#s-age')).toBeVisible();
});
test('a stopped number opens its row and the card carries the chip', async ({ page }) => {
  await page.goto('/'); await page.reload();
  await page.locator('.grp-head[data-row="now"]').click();
  await page.fill('#s-age', '120'); await page.locator('#s-age').press('Tab');
  await page.locator('.grp-head[data-row="now"]').click();
  await expect(page.locator('#side-card')).toContainText('— 岁');
  await page.locator('#side-card .chip').click();
  await expect(page.locator('#s-age')).toBeFocused();
  await expect(page.locator('.grp-head[data-row="now"]')).toHaveAttribute('aria-expanded', 'true');
});
test('怎么算的 opens the ledger', async ({ page }) => {
  await page.goto('/');
  await page.locator('#side-card [data-how]').click();
  await expect(page.locator('#ledger')).toBeVisible();
});
test('the professional view has seven rows with their summaries', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  await expect(page.locator('.grp-head:visible')).toHaveCount(7);
  await expect(page.locator('.grp-head[data-row="sim"]')).toContainText('八成 · 2,000 次 · 种子 20261026');
  await expect(page.locator('.grp-head[data-row="sim"]')).toContainText('本工具设定');
  await expect(page.locator('#side-card')).toContainText(/财务独立 \d+ 岁 · \d+\.\d% · 怎么算的 ›/);
});
test.describe('between 900 and 1023 px', () => {
  test.use({ viewport: { width: 1000, height: 800 } });
  test('today\'s two columns stay, with the top bar and the group statuses', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#sticky-bar')).toBeVisible();
    await expect(page.locator('.grp-head').first()).toBeHidden();
    await expect(page.locator('[data-grp="now"]').first()).toHaveText('示例');
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/lines.test.mjs` and `npx playwright test tests/e2e/sidebar.spec.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement** the Interfaces and the CSS.

- [ ] **Step 4: Run the whole browser suite and repair default-viewport tests.** Playwright's default viewport is 1280 × 720, where the top bar is now gone and a reload folds the rows. For each failing test whose subject is not the wide layout (for example `layout.spec.mjs` 'the professional view drops the fun…' reading `#sticky-result`, `pension.spec.mjs` reading `#sticky-result`, tests that reload and then fill a field), add `test.use({ viewport: { width: 1000, height: 800 } })` to it or its describe, which keeps today's two-column layout. For a test whose subject is the wide layout (`layout.spec.mjs:73` 'on a wide screen the inputs stay open and beside the result…'), keep 1280 and assert the sidebar instead (inputs column 330 px beside the result; lives beside the quiz at ≥ 1100 px still hold).

Run: `npm test`, `npx playwright test`, copy lint
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add site tests
git commit -m "feat: a sidebar overview at 1024 px and wider, with row summaries, links and the result card"
```

---

### Task 11: Method page corrections and the page's limits

**Files:**
- Modify: `site/method.html` (35-36 积累期, 90-96 房贷和孩子 formula line 92, add a section 页面上的限制 before 模型不包含 ~149)
- Modify: `docs/method.md` (15 accumulation row, 44 bad-year cut, a "Limits on the page" list)
- Modify: `site/js/params.js:27`
- Create: `tests/method.test.mjs`
- Modify: `tests/e2e/pro.spec.mjs` ('method page publishes the formulas and the disclaimer', ~21-25)

**Interfaces:**
- Consumes: `LIMITS` (Task 1).
- Produces: page and doc text only, verbatim from spec §9.1:
  - method.html:35 formula: `A(t+1) = A(t) × (1 + r) + S(t)，S(t) = 收入 × (1 + 收入增长)^t − 当前支出 − 项目变化(t)` and a new formula line `项目变化(t) = − 已结束项目的年金额之和 + 还没还完的房贷年金额 × ((1 + 通胀)^−t − 1)`.
  - method.html:92: `第 t 年的支出 = 退休后支出 + 项目变化(t)（定义见上）`, next line `放假以后才结束的项目，从结束那年起同样减掉`.
  - New `<h2 id="limits">页面上的限制</h2>`: a table (关系 / 范围 / 常见范围) of spec §4.1: 月供和孩子 < 每月支出（相等也拦）; 手填的退休后每月想花 > 月供和孩子（相等也拦）; 拆开来加时 月供 ≤ 房租和房贷; 还到哪年 今年 − 50 到今年 + 40; 孩子几个 整数且 ≥ 0; 最小的孩子 ≥ 0，满 22 岁不再计入; 金额 ≥ 0; 年龄 16–85; 想几岁放假 大于年龄、小于规划到; 规划到 ≥ 年龄 + 2、≤ 110; 领取年龄 45–75; 股票占比、一年跌 ≥ 15% 后少花 0–100; 股债相关性 −1 到 1; 波动率 0–1; 安全提取率 大于 0、不超过 10%; 剩得很少 = 现在每月支出的 25%（只提示）; 常见范围（只提示，专业版）: 收入实际增长 −2–5%，股票实际收益 −2–10%，10 年国债 0–8%，长期通胀 0–6%，税费拖累 0–2%，退休币升值 −3–3%; 组合收益低于 −50% 按 −50% 算; 养老金超出年支出的部分不计; 累计缴费年限不少于已缴年限. One line under it: `这些上下限和常见范围都是本工具设定。`
  - docs/method.md:15: `S(t) = income(1 + g)^t − expense − itemDelta(t)` with the definition of `itemDelta(t)` in the table; :44 "a portfolio fall of more than 15%" → "a fall of 15% or more"; a "Limits on the page" list with the same values.
  - params.js:27: `组合某年跌超过 15%` → `组合某年跌了 15% 或更多`.
  - Spec §8.3 also asks the method page to say why 八成 and why 2,000 runs; the spec gives no wording (controller's ruling, 2026-11-11): under `<h2 id="odds">` add at most three plain sentences, facts only — 八成 = at least 1,600 of 2,000 simulated lives last to 规划到, chosen as 本工具设定 (a common middle ground between 五成 and 九成, the three chips the page already shows); 2,000 runs with a fixed seed so the same inputs give the same age; no promise wording. The method test asserts the section contains `1,600`, `2,000` and `本工具设定`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/method.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIMITS } from '../site/js/state.js';
import { PARAMS } from '../site/js/params.js';
const html = readFileSync(new URL('../site/method.html', import.meta.url), 'utf8');
const md = readFileSync(new URL('../docs/method.md', import.meta.url), 'utf8');

test('the method page writes the items into the formulas', () => {
  assert.ok(html.includes('− 当前支出 − 项目变化(t)'));
  assert.ok(html.includes('项目变化(t) = − 已结束项目的年金额之和 + 还没还完的房贷年金额 × ((1 + 通胀)^−t − 1)'));
  assert.ok(html.includes('第 t 年的支出 = 退休后支出 + 项目变化(t)（定义见上）'));
  assert.ok(md.includes('itemDelta(t)')); assert.ok(md.includes('a fall of 15% or more'));
});
test('the method page lists every limit the page enforces, as this tool\'s setting', () => {
  assert.ok(html.includes('id="limits"')); assert.ok(html.includes('这些上下限和常见范围都是本工具设定。'));
  for (const v of [...LIMITS.age, ...LIMITS.pAge, LIMITS.lifeMax, LIMITS.endYearBack, LIMITS.endYearAhead, `${LIMITS.low * 100}%`]) assert.ok(html.includes(String(v)), v);
  for (const [lo, hi] of Object.values(LIMITS.common)) assert.ok(html.includes(`${lo < 0 ? '−' + -lo : lo}–${hi}%`), `${lo}–${hi}`);
});
test('the bad-year card says 15% or more', () => {
  assert.ok(PARAMS.find(p => p.id === 'flexCut').what.includes('组合某年跌了 15% 或更多'));
});
```
In `pro.spec.mjs` 'method page publishes the formulas and the disclaimer' add: `await expect(page.locator('#limits')).toContainText('页面上的限制')` and `await expect(page.locator('main')).toContainText('项目变化(t)')` after opening `/method.html`.

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/method.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Edit** method.html, docs/method.md and params.js as listed.

- [ ] **Step 4: Run everything**

Run: `npm test`, `npx playwright test`, `node scripts/lint-copy.mjs site/index.html site/method.html site/sources.html site/404.html`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add site/method.html docs/method.md site/js/params.js tests/method.test.mjs tests/e2e/pro.spec.mjs
git commit -m "docs: the method page writes the items into the formulas and lists the page's limits"
```

---

## Self-review notes (kept for the executor)

- Spec coverage: §3 symbols (Tasks 4–9), §4.1 A1 (5), A2–A10 (1, 6), B1 (1, 4), B2–B15 (2, 6, 9), §4.2 timing (4), §4.3 stop/jump/chip (4), §5 sources (1–3), §6.1 lines (5, 6) and group headers (7), §6.2 phone top bar (4, 7), §6.3 sidebar (10), §7.1–7.4 ledger (8, 9), §8.1 split by view (all), §8.2 simple path (Task 4 test), §8.3 pro considerations (3, 9; method-only items in 11), §9.1 (6: `:95`; 8: `:57`, anchors; 11: the rest), §9.2 (8), §9.3 deletions (4, 5, 6, 7, 8), §10 copy (per task), §12 Q1 (Task 6 keeps `index.html:73`), Q2 (Tasks 1–2, 11).
- Decisions this plan makes where the spec is silent: A2 suppresses A3 (matches the mockup's `✕ 1`); `tAge ≥ life` reported once as B4; a non-integer end year blocks with no value button; kids `count 0` with other cells blank is not 待填; pro-only problems run in the simple view and jump into the pro view; `#zone-learn` keeps its title while held so `参数` still lands; pro held collapsed row `放假线 —`; the pro `retExp` estimate line adds `+ 月供和孩子 X ÷ 汇率` when items exist so it equals `estimateRetireSpend`; pro `growth` moves above `当前年支出` so the sidebar's `现在` row holds it; default-viewport browser tests that are not about the wide layout pin 1000 px.
