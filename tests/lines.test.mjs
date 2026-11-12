// The views helpers that draw the stopped result and, in later tasks, the lines under the fields.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chipText, heldHeadHtml, heldHeroHtml, splitLineHtml, stickyHtml, relText, fieldLinesHtml, fieldLineHtml, fixesHtml, lifeTagText, pensionEstimateHtml } from '../site/js/views.js';
import DATA from '../site/js/data-latest.js';
import { defaultState, storyRows, problems, resetRetExp } from '../site/js/state.js';

const b = (kind, chip) => ({ kind, chip });
test('chipText: blanks first, one names the item, several count', () => {
  assert.equal(chipText([]), '');
  assert.equal(chipText([b('flag', '每月存下')]), '');
  assert.equal(chipText([b('block', '房贷')]), '拦住：房贷 ›');
  assert.equal(chipText([b('block', '房贷'), b('block', '年龄')]), '拦住 2 处 ›');
  assert.equal(chipText([b('block', '房贷'), b('blank', '每月支出')]), '待填：每月支出 ›');
  assert.equal(chipText([b('blank', '每月支出'), b('blank', '退休后')]), '待填 2 处 ›');
});

test('the stopped result: — 岁放假, 放假资金 —, and 财务独立 — 岁 in the professional headline', () => {
  assert.equal(heldHeroHtml(), '<div class="hero-big"><span aria-label="暂无结果">—</span> 岁放假</div><div class="fund"><p>放假资金 —</p></div>');
  assert.equal(heldHeadHtml('pro'), '<p class="say">财务独立 <span aria-label="暂无结果">—</span> 岁</p>');
  assert.equal(heldHeadHtml('simple'), '');
});

test('stickyHtml with a chip: no age, the chip as a button; without one, as before', () => {
  const simple = stickyHtml(null, { chip: '拦住：房贷 ›' });
  assert.equal(simple, '<b class="sticky-age"><span aria-label="暂无结果">—</span> 岁放假</b><button type="button" class="chip" data-chip>拦住：房贷 ›</button>');
  const pro = stickyHtml(null, { pro: true, chip: '待填 2 处 ›' });
  assert.equal(pro, '<b class="sticky-age">财务独立 <span aria-label="暂无结果">—</span> 岁</b><button type="button" class="chip" data-chip>待填 2 处 ›</button>');
  const h = { reachable: false };
  assert.equal(stickyHtml(h, {}), '<b class="sticky-age">还在路上</b><span>先看提前的办法</span>');
});

const visible = html => html.replace(/<[^>]+>/g, '');
test('splitLineHtml: the sum by month, or by month × 12 in the professional view', () => {
  const row = { key: 'split', parts: [5000, 2000, 0], before: 72000 };
  const simple = splitLineHtml(row, { view: 'simple', wCur: 'CNY' });
  assert.match(visible(simple), /= 5,000 \+ 2,000 \+ 0/); assert.match(visible(simple), /只填总数 ¥6,000/);
  const pro = splitLineHtml({ ...row, parts: [2000, 1500, 1000] }, { view: 'pro', wCur: 'CNY' });
  assert.match(visible(pro), /\(2,000 \+ 1,500 \+ 1,000\) × 12/); assert.match(visible(pro), /只填总数 ¥72,000/);
  assert.equal(splitLineHtml(undefined, { view: 'simple', wCur: 'CNY' }), '');
});

test('splitLineHtml: the operators are not read; the sum carries a readable label', () => {
  const row = { key: 'split', parts: [5000, 2000, 1000], before: 72000 };
  const simple = splitLineHtml(row, { view: 'simple', wCur: 'CNY' });
  assert.match(simple, /aria-label="三项合计 8,000：房租和房贷 5,000，吃饭 2,000，其他 1,000"/);
  const pro = splitLineHtml(row, { view: 'pro', wCur: 'CNY' });
  assert.match(pro, /aria-label="三项合计每月 8,000 × 12 = 96,000：房租和房贷 5,000，吃饭 2,000，其他 1,000"/);
  for (const html of [simple, pro]) {
    const shown = html.replace(/<span aria-hidden="true">[^<]*<\/span>/g, '');
    assert.doesNotMatch(visible(shown), /[=+×]/);
  }
  assert.match(splitLineHtml({ ...row, parts: [-500, 0, 0] }, { view: 'simple', wCur: 'CNY' }), /aria-label="三项合计 −500：房租和房贷 −500，吃饭 0，其他 0"/);
});

// ---- The lines under the fields and the exit buttons.
// Block ends and buttons become a space; inline tags vanish; the escaped operators read as themselves.
const strip = h => h.replace(/<\/(p|div|li|button)>/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

test('relText writes the relation the way the spec does', () => {
  assert.equal(relText({ sub: true, left: [{ label: '月供', value: 7500 }], op: '≥', right: { label: '每月支出', value: 7000 } }), '└ 其中月供 7,500 ≥ 每月支出 7,000');
  assert.equal(relText({ sub: true, left: [{ label: '月供', value: 7500 }, { label: '孩子', value: 1700 }], op: '≥', right: { label: '每月支出', value: 8000 } }), '└ 其中月供 + 孩子 9,200 ≥ 每月支出 8,000');
  assert.equal(relText({ sub: false, left: [{ label: '还到哪年', value: 2200, year: true }], op: '>', right: { label: null, value: 2066 } }), '还到哪年 2200 > 2066');
  // The flag, not the label, keeps a year ungrouped.
  assert.equal(relText({ sub: false, left: [{ label: '还清那年', value: 2200, year: true }], op: '>', right: { label: null, value: 2066 } }), '还清那年 2200 > 2066');
  assert.equal(relText({ sub: false, left: [{ label: '还到哪年', value: 2200 }], op: '>', right: { label: null, value: 2066 } }), '还到哪年 2,200 > 2,066');
  assert.equal(relText({ sub: false, left: [{ label: '还到哪年', value: 20, year: true }], op: '<', right: { label: null, value: 1976 } }), '还到哪年 20 < 1976');
  assert.equal(relText({ sub: false, left: [{ label: '孩子几个', value: 1.5 }], op: null, right: null }), '孩子几个 1.5');
  assert.equal(relText({ sub: false, left: [{ label: '每月支出', value: -500 }], op: '<', right: { label: null, value: 0 } }), '每月支出 −500 < 0');
  assert.equal(relText({ sub: true, left: [{ label: '月供', value: 108000, unit: '/年' }], op: '≥', right: { label: '当前年支出', value: 96000 } }), '└ 其中月供 108,000/年 ≥ 当前年支出 96,000');
  assert.equal(relText({ sub: false, left: [{ label: '累计缴费', value: 12, unit: ' 年' }], op: '<', right: { label: '已缴', value: 15, unit: ' 年' } }), '累计缴费 12 年 < 已缴 15 年');
  assert.equal(strip(relText({ sub: true, ended: true, label: '月供', value: 3000, fact: '2024 已还完' })), '└ 其中月供 3,000 2024 已还完');
  assert.match(relText({ sub: true, ended: true, label: '月供', value: 3000, fact: '2024 已还完' }), /<s>月供 3,000<\/s>/);
  assert.match(relText({ sub: true, ended: true, label: '月供', value: 3000, fact: '2024 已还完' }), /aria-label="已结束，不计入"/);
});

const S = { ...defaultState(DATA), income: 360000, expense: 180000, retExp: 180000,
  real: { mortgage: { monthly: 7500, endYear: 2045 }, kids: { count: 1, age: 19, monthly: 3200 } } };
const html = (s, at, list = problems(s, DATA, 2026)) => fieldLinesHtml({ rows: storyRows(s, DATA, 2026, null), list, at, view: s.view, wCur: 'CNY', rCur: 'CNY' });
const lines = (s, at) => strip(html(s, at));

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

// Beyond the brief's cases.
test('a blocked line carries the solid field id, its marks are not read, and the ✕ says 拦住', () => {
  const tight = { ...S, expense: 84000, real: { ...S.real, kids: { count: null, age: null, monthly: null } } };
  const out = html(tight, 'expense');
  assert.equal(strip(out), '└ 其中月供 7,500 ≥ 每月支出 7,000 ✕');
  assert.match(out, /<p class="row bad" id="rel-mortgage\.monthly">/);
  assert.match(out, /<span aria-hidden="true">└<\/span> 其中/);
  assert.match(out, /<span class="x" aria-label="拦住">✕<\/span>/);
  // A stop not shown yet (the field is still being typed in) draws only the item, not red.
  const quiet = html(tight, 'expense', problems(tight, DATA, 2026).filter(q => q.kind !== 'block'));
  assert.equal(strip(quiet), '└ 其中月供 7,500');
  assert.doesNotMatch(quiet, /bad|✕/);
});

test('A2 under spending, with the split line routed through the same lines', () => {
  const split = { ...S, expense: 96000, split: { rent: 5000, food: 2000, other: 1000, before: 72000 }, real: { mortgage: { monthly: 7500, endYear: 2045 }, kids: { count: null, age: null, monthly: null } } };
  const rows = storyRows(split, DATA, 2026, null).map(r => (r.key === 'split' ? { ...r, before: 72000 } : r));
  const out = fieldLinesHtml({ rows, list: problems(split, DATA, 2026), at: 'expense', view: 'simple', wCur: 'CNY', rCur: 'CNY' });
  assert.equal(strip(out), '= 5,000 + 2,000 + 1,000只填总数 ¥6,000 └ 其中月供 7,500 > 房租和房贷 5,000 ✕');
  assert.match(out, /^<p class="split-line" id="split-line-s">/);
  assert.match(out, /&gt;/);
});

test('ended items are grey and struck; a half-filled group and a range block add no line under spending', () => {
  const ended = { ...S, real: { mortgage: { monthly: 3000, endYear: 2024 }, kids: { count: 0, age: 5, monthly: 1600 } } };
  assert.equal(lines(ended, 'expense'), '└ 其中月供 3,000 2024 已还完 └ 其中孩子 1,600 0 个');
  assert.match(html(ended, 'expense'), /<p class="row ended">/);
  const half = { ...S, real: { mortgage: { monthly: 3000, endYear: null }, kids: { count: null, age: null, monthly: null } } };
  assert.equal(lines(half, 'expense'), '');
  const far = { ...S, real: { mortgage: { monthly: 3000, endYear: 2200 }, kids: { count: null, age: null, monthly: null } } };
  assert.equal(lines(far, 'expense'), '');
});

test('the professional view: yearly items, the kids tag, the yearly B14 line and A10 against today', () => {
  const pro = { ...S, view: 'pro', income: 60000, expense: 180000 };
  assert.equal(lines(pro, 'expense'), '└ 其中月供 90,000/年 └ 其中孩子 38,400/年 → 22 岁（按最小的） 本工具设定 ! 年储蓄 −120,000 · 存款用完后按 0 算');
  const low = { ...S, view: 'pro', retExp: (7500 + 3200 + 1000) * 12, touched: { retExp: true } };
  assert.match(lines(low, 'retExp'), /→ 50 岁起 ! ¥12,000 < 现在 ¥180,000 × 25% 本工具设定/);
});

test('fieldLineHtml: a range rule under its own field', () => {
  const [q] = problems({ ...defaultState(DATA), age: 120 }, DATA, 2026);
  assert.equal(fieldLineHtml(q), '<p class="row bad" id="rel-age">年龄 120 &gt; 85 <span class="x" aria-label="拦住">✕</span></p>');
  const far = problems({ ...S, real: { mortgage: { monthly: 3000, endYear: 2200 }, kids: S.real.kids } }, DATA, 2026).find(x => x.rule === 'A6');
  assert.equal(strip(fieldLineHtml(far)), '还到哪年 2200 > 2066 ✕');
});

test('fixesHtml: the action only in data-fix, nothing when there is no fix', () => {
  assert.equal(fixesHtml([]), '');
  assert.equal(fixesHtml([{ text: '改回估算 ≈ 8,000', reset: 'retExp' }]), `<button type="button" class="ghost fix" data-fix='{"reset":"retExp"}'>改回估算 ≈ 8,000</button>`);
  assert.match(fixesHtml([{ text: '→ 9,000', aria: '房租和房贷改成 9,000', set: { 'split.rent': 9000 } }]), /data-fix='\{"set":\{"split\.rent":9000\}\}'/);
});

test('pensionEstimateHtml: B15 draws its line and its button above the use button', () => {
  const result = { st: { years: 63, months: 0 }, est: { eligible: true, basic: 1000, personal: 500, monthly: 1500 }, years: 12, claimAge: 63 };
  const q = { rule: 'B15', field: 'pen.years', rel: { sub: false, left: [{ label: '累计缴费', value: 12, unit: ' 年' }], op: '<', right: { label: '已缴', value: 15, unit: ' 年' } },
    fixes: [{ text: '→ 15', aria: '累计缴费改成 15', set: { 'pen.years': 15 } }] };
  assert.match(strip(pensionEstimateHtml(result, { problem: q })), /累计缴费 12 年 < 已缴 15 年 ✕ → 15 用这个结果/);
  assert.doesNotMatch(pensionEstimateHtml(result, {}), /✕/);
});

test('resetRetExp: 改回估算 makes retirement spending the estimate again, A4 gone', () => {
  const typed = { ...S, retExp: 72000, touched: { retExp: true } };
  assert.ok(problems(typed, DATA, 2026).some(q => q.rule === 'A4'));
  const back = resetRetExp(typed, DATA);
  assert.deepEqual([back.retExp, back.touched.retExp, back.lastValid.retExp], [180000, false, 180000]);
  assert.ok(!problems(back, DATA, 2026).some(q => q.rule === 'A4'));
});
