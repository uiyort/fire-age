import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, loadState, problems, setField, setReal, setSplit, unsplit, splitOn, cleanSplit, itemsYearly, setWorkCountry, setRetireCountry, num, groupStates } from '../site/js/state.js';
import { relText } from '../site/js/views.js';

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
  assert.deepEqual(q.fixes.slice(1), [{ text: '改月供', focus: 'mortgage.monthly' }]);
  assert.equal(only(S0({ expense: 90000, real: real(M) }), 'A3').length, 1);
  assert.equal(only(S0({ expense: 90012, real: real(M) }), 'A3').length, 0);
});

test('A3: mortgage and children together; the last committed field takes the solid frame', () => {
  const S = S0({ expense: 96000, real: real(M, { count: 1, age: 5, monthly: 1700 }) });
  const [q] = only(S, 'A3');
  assert.deepEqual(q.rel.left, [{ label: '月供', value: 7500 }, { label: '孩子', value: 1700 }]);
  assert.deepEqual(q.fixes.map(f => f.text), ['每月支出 + 月供 + 孩子 → 17,200', '改月供', '改孩子']);
  const [byExpense] = only(S, 'A3', { last: 'expense' });
  assert.equal(byExpense.field, 'expense'); assert.equal(byExpense.chip, '每月支出');
  assert.deepEqual(byExpense.compare, ['mortgage.monthly', 'kids.monthly']);
  const [kidsOnly] = only(S0({ expense: 12000, real: real({}, { count: 1, age: 5, monthly: 1000 }) }), 'A3');
  assert.equal(kidsOnly.field, 'kids.monthly'); assert.equal(kidsOnly.chip, '孩子');
});

test('A3: with the split on, the dashed frame and 改每月支出 go to 其他; pro speaks in years', () => {
  const S = setSplit(S0({ real: real(M) }), 'rent', '7500', DATA);   // rent part = mortgage (A2 allows equal), total 7,500 (A3 blocks equal)
  const [q] = only(S, 'A3');
  assert.deepEqual(q.compare, ['split.other']); assert.deepEqual(q.fixes.map(f => f.text), ['每月支出 + 月供 → 15,000', '改月供']);
  const [pro] = only(S0({ view: 'pro', expense: 84000, real: real(M) }), 'A3');
  assert.deepEqual(pro.rel, { sub: true, left: [{ label: '月供', value: 90000, unit: '/年' }], op: '≥', right: { label: '当前年支出', value: 84000 } });
  assert.equal(pro.chip, '房贷'); assert.equal(pro.fixes[0].text, '当前年支出 + 月供 → 174,000');
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
  assert.deepEqual(q.fixes.map(f => f.text), ['退休后每月想花 + 月供 + 孩子 → 12,400', '改回估算 ≈ 10,000']);
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
  assert.deepEqual(at(20)[0].rel, { sub: false, left: [{ label: '还到哪年', value: 20, year: true }], op: '不在', right: { label: null, range: [1976, 2066] } });
  assert.deepEqual(at(20)[0].fixes.map(f => f.text), ['→ 2020']); assert.equal(at(20)[0].chip, '房贷');
  assert.equal(at(1975)[0].kind, 'block');
  assert.deepEqual(at(1976)[0].rel, { sub: true, ended: true, label: '月供', value: 3000, fact: '1976 已还完' });
  assert.equal(at(2025)[0].kind, 'ended');
  assert.deepEqual(at(2026), []); assert.deepEqual(at(2066), []);
  assert.deepEqual(at(2067)[0].rel.right, { label: null, range: [1976, 2066] }); assert.equal(at(2067)[0].rel.op, '不在');
  assert.deepEqual(at(2045.5)[0].rel, { sub: false, left: [{ label: '还到哪年', value: 2045.5, year: true }], op: null, right: null });
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

// Review focus 2: clearing all three parts by hand ends exactly where 只填总数 (unsplit) does.
test('the split: clearing all three parts by hand equals unsplit, retirement estimate included', () => {
  let S = defaultState(DATA);
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) S = setSplit(S, k, v, DATA);
  let byHand = S;
  for (const k of ['rent', 'food', 'other']) byHand = setSplit(byHand, k, '', DATA);
  const byButton = unsplit(S, DATA);
  assert.deepEqual(byHand, byButton);
  assert.equal(byHand.expense, 72000); assert.equal(byHand.retExp, 72000);
  assert.deepEqual(byHand.split, { rent: null, food: null, other: null, before: null });
  assert.deepEqual(P(byHand), []);
});

// Review focus 3: the parts and the old total move at the market rate like the other work-currency fields.
test('moving the work country converts the parts and the old total at the market rate', () => {
  let S = defaultState(DATA);
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) S = setSplit(S, k, v, DATA);
  const moved = setWorkCountry(S, 'US', DATA);
  const fx = c => (c === 'USD' ? 1 : DATA.fx[c].value);
  const conv = v => Math.round(v / fx(DATA.countries.CN.cur) * fx(DATA.countries.US.cur));
  assert.deepEqual(moved.split, { rent: conv(5000), food: conv(2000), other: conv(1000), before: conv(72000) });
  assert.equal(moved.expense, (conv(5000) + conv(2000) + conv(1000)) * 12);
  assert.equal(unsplit(moved, DATA).expense, conv(72000));
  const plain = setWorkCountry(defaultState(DATA), 'US', DATA);
  assert.deepEqual(plain.split, { rent: null, food: null, other: null, before: null });
  assert.equal(plain.expense, conv(72000));
});

// Review focus 4: an old or broken saved split reads as not split; the saved total stays editable, nothing breaks.
test('a broken saved split: no split, the saved spending kept, no problems', () => {
  const store = v => ({ getItem: () => JSON.stringify(v) });
  const { split, ...old } = { ...defaultState(DATA), expense: 96000 };
  for (const bad of [undefined, 'x', [1, 2], { rent: 'a', food: true, other: {} }, null, 7]) {
    const S = loadState(DATA, store({ ...old, split: bad }));
    assert.deepEqual(S.split, { rent: null, food: null, other: null, before: null });
    assert.equal(S.expense, 96000);
    assert.deepEqual(P(S), []);
  }
});

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

// Task 1 review items.
test('the split: typing 0 into the only filled part ends the split like 只填总数; a negative part stays so B2 can stop it', () => {
  let S = setSplit(defaultState(DATA), 'rent', '5000', DATA);
  assert.equal(splitOn(S), true);
  const zero = setSplit(S, 'rent', '0', DATA);
  assert.deepEqual(zero, unsplit(S, DATA));
  assert.equal(zero.expense, 72000); assert.equal(zero.retExp, 72000);
  assert.deepEqual(zero.split, { rent: null, food: null, other: null, before: null });
  const two = setSplit(setSplit(S, 'food', '1000', DATA), 'rent', '0', DATA);
  assert.equal(splitOn(two), true); assert.equal(two.expense, 12000);
  const neg = setSplit(S, 'rent', '-500', DATA);
  assert.equal(only(neg, 'B2')[0].field, 'split.rent');
});

test('simple-view monthly numbers are rounded the way the form shows them', () => {
  const S = S0({ expense: 10050, real: real({ monthly: 838, endYear: 2045 }) });
  const [a3] = only(S, 'A3');
  assert.equal(a3.rel.right.value, 838);
  assert.deepEqual(rel(S0({ income: 60000, expense: 60007 }), 'B14').left, [{ label: '每月存下', value: -1 }]);
  assert.deepEqual(rel(S0({ expense: -6005 }), 'B2').left, [{ label: '每月支出', value: -500 }]);
  assert.deepEqual(only(S0({ expense: -6005 }), 'B2')[0].fixes, [{ text: '→ 500', aria: '每月支出改成 500', set: { expense: 6005 } }]);
  const typed = S0({ expense: 120000, retExp: 74395, touched: { retExp: true }, real: real({ monthly: 4000, endYear: 2045 }, { count: 1, age: 5, monthly: 2200 }) });
  assert.equal(only(typed, 'A4')[0].rel.right.value, 6200);
});

test('A4 fix text is a yearly figure in the professional view; a monthly one in the simple view', () => {
  const items = real({ monthly: 4000, endYear: 2045 }, { count: 1, age: 5, monthly: 2200 });
  const typed = view => S0({ view, expense: 120000, retExp: 74400, touched: { retExp: true }, real: items });
  assert.deepEqual(fixTexts(typed('pro'), 'A4').slice(1), ['改回估算 ≈ 120,000']);
  assert.deepEqual(fixTexts(typed('simple'), 'A4').slice(1), ['改回估算 ≈ 10,000']);
});

test('A8: a fractional youngest child blocks with floor and ceil buttons', () => {
  const [q] = only(S0({ expense: 120000, real: real({}, { count: 2, age: 5.5, monthly: 1600 }) }), 'A8');
  assert.equal(q.kind, 'block'); assert.deepEqual(q.rel, { sub: false, left: [{ label: '最小的孩子', value: 5.5 }], op: null, right: null });
  assert.deepEqual(q.fixes, [{ text: '→ 5', aria: '最小的孩子改成 5', set: { 'kids.age': 5 } }, { text: '→ 6', aria: '最小的孩子改成 6', set: { 'kids.age': 6 } }]);
});

const fxOf = c => (c === 'USD' ? 1 : DATA.fx[c].value);
const cn2us = v => v / fxOf(DATA.countries.CN.cur) * fxOf(DATA.countries.US.cur);

test('A4 with different work and retirement currencies compares in the retirement currency', () => {
  const items = real({ monthly: 4000, endYear: 2045 });
  const S = setRetireCountry(S0({ expense: 120000, real: items }), 'US', DATA);
  const itemsRet = Math.round(cn2us(4000));
  const low = { ...S, retExp: Math.round(cn2us(4000) * 12 / 2), touched: { retExp: true } };
  const [q] = only(low, 'A4');
  assert.deepEqual(q.rel.left, [{ label: '月供', value: itemsRet }]);
  assert.equal(q.rel.right.value, Math.round(low.retExp / 12));
  assert.equal(only({ ...low, retExp: Math.round(cn2us(4000) * 12 * 2) }, 'A4').length, 0);
});

test('A9 with a different retirement currency compares the town spend in that currency', () => {
  const S = m => setRetireCountry(S0({ expense: 120000, real: real({ monthly: 4000, endYear: 2045 }), town: { name: '大理', monthly: m } }), 'US', DATA);
  assert.equal(only(S(Math.floor(cn2us(4000) / 2)), 'A9').length, 1);
  assert.equal(only(S(Math.ceil(cn2us(4000) * 2)), 'A9').length, 0);
});

test('B4: while the age itself is out of range, the plan-end side waits too', () => {
  assert.equal(only(S0({ mode: 'bwd', age: 120, tAge: 99, life: 95 }), 'B4').length, 0);
  assert.equal(only(S0({ mode: 'bwd', age: 120, tAge: 25 }), 'B4').length, 0);
  assert.equal(only(S0({ mode: 'bwd', tAge: 99, life: 95 }), 'B4').length, 1);
});

test('B5: the exit never proposes a plan end above 110; with no value in range there is no value button', () => {
  const [q] = only(S0({ age: 85, life: 86, mode: 'bwd', tAge: 110 }), 'B5');
  assert.equal(q.kind, 'block'); assert.deepEqual(q.fixes, []);
  assert.deepEqual(fixTexts(S0({ age: 85, life: 86, mode: 'bwd', tAge: 109 }), 'B5'), ['→ 110']);
});

test('a value that rounds to −0 is shown as 0', () => {
  assert.equal(num(-0), '0'); assert.equal(num(-0.001), '0');
  assert.ok(Object.is(rel(S0({ expense: -5 }), 'B2').left[0].value, 0));
  assert.ok(Object.is(rel(S0({ income: 72000, expense: 72005 }), 'B14').left[0].value, 0));
});

// Task 5 review round 1.
test('the split stays on while any part is not blank and not 0: a negative-only part keeps the lock, and B2 stops the part, not the total', () => {
  const neg = setSplit(defaultState(DATA), 'rent', '-500', DATA);
  assert.equal(splitOn(neg), true);
  assert.equal(neg.expense, -6000);
  assert.deepEqual(only(neg, 'B2').map(q => q.field), ['split.rent']);
  assert.equal(neg.split.before, 72000);
  // Blank or 0 everywhere is still the same as 只填总数.
  const zero = setSplit(neg, 'rent', '0', DATA);
  assert.equal(splitOn(zero), false); assert.deepEqual(zero, unsplit(neg, DATA));
  const mixed = setSplit(setSplit(defaultState(DATA), 'rent', '5000', DATA), 'food', '-500', DATA);
  assert.equal(splitOn(mixed), true); assert.equal(mixed.expense, 54000);
  assert.deepEqual(only(mixed, 'B2').map(q => q.field), ['split.food']);
  assert.equal(splitOn({ split: { rent: 0, food: null, other: 0 } }), false);
});

test('setting spending directly while split leaves the split first, then takes the value', () => {
  let S = defaultState(DATA);
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) S = setSplit(S, k, v, DATA);
  const set = setField(S, 'expense', '90000', DATA);
  assert.equal(splitOn(set), false);
  assert.deepEqual(set.split, { rent: null, food: null, other: null, before: null });
  assert.equal(set.expense, 90000);
  assert.equal(set.retExp, setField(unsplit(S, DATA), 'expense', '90000', DATA).retExp);
  // Not split: unchanged behaviour.
  assert.deepEqual(setField(defaultState(DATA), 'expense', '90000', DATA), setField({ ...defaultState(DATA) }, 'expense', '90000', DATA));
});

test('a saved split is the spending: a save whose total is not the parts × 12 loads with their sum', () => {
  const store = v => ({ getItem: () => JSON.stringify(v) });
  let S = defaultState(DATA);
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) S = setSplit(S, k, v, DATA);
  const loaded = loadState(DATA, store({ ...S, expense: 12345 }));
  assert.equal(loaded.expense, 96000);
  assert.equal(loaded.retExp, S.retExp);
  assert.equal(loadState(DATA, store({ ...S, split: { rent: -500, food: null, other: null, before: 72000 } })).expense, -6000);
  // A save that is not split keeps its own total.
  assert.equal(loadState(DATA, store({ ...defaultState(DATA), expense: 12345 })).expense, 12345);
});

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
  const back = S0({ mode: 'bwd', tAge: 25 });
  const st3 = groupStates(back, P(back), DATA);
  assert.deepEqual([st3.tage.block, st3.pension.block], [1, 0]);
});

test('formGroupOf: the age to holiday at is its own group in the simple view, in the retirement group in pro', async () => {
  const { formGroupOf } = await import('../site/js/state.js');
  assert.equal(formGroupOf('tage', 'simple'), 'tage');
  assert.equal(formGroupOf('retire', 'pro'), 'retire');
});

test('final review: a negative spending stops once, on spending; the retirement estimate stays at 0 and follows on', () => {
  const S = setField(defaultState(DATA), 'expense', '-500', DATA);
  assert.ok(S.retExp >= 0); assert.ok(!S.touched.retExp);
  const stops = P(S).filter(q => q.kind === 'block' || q.kind === 'blank');
  assert.deepEqual(stops.map(q => q.field), ['expense']);
});

test('final review: 示例 leaves 现在 once a mortgage or children are filled, even a stopped one', () => {
  assert.equal(groupStates(defaultState(DATA), [], DATA).now.example, true);
  const m = S0({ real: real({ monthly: 8000, endYear: 2045 }) });
  assert.equal(groupStates(m, P(m), DATA).now.example, false);
  const k = S0({ real: real({}, { count: 1, age: 3, monthly: 1000 }) });
  assert.equal(groupStates(k, P(k), DATA).now.example, false);
});

test('final re-review: a negative spending stays one stop through the mortgage, children and country paths', () => {
  const neg = setField(defaultState(DATA), 'expense', '-500', DATA);
  const stops = S => P(S).filter(q => q.kind === 'block' || q.kind === 'blank').map(q => q.field);
  for (const S of [
    setReal(neg, 'mortgage', 'monthly', '3000', DATA),
    setReal(neg, 'kids', 'count', '1', DATA),
    setRetireCountry(neg, neg.workC, DATA),
    setWorkCountry(neg, neg.retC, DATA),
  ]) {
    assert.equal(S.retExp >= 0, true);
    assert.equal(stops(S).includes('retExp'), false);
    assert.equal(!!S.touched?.retExp, false);
  }
});

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
test('the button number equals what the field shows after the exit, with fractional amounts across currencies', () => {
  for (const [monthly, retExp] of [[7501, 40001], [7503, 40007], [3333, 50011], [777, 100], [1234, 9999], [5555, 30001]]) {
    let S = setRetireCountry(S0({ expense: 216001, real: real({ monthly, endYear: 2045 }) }), 'TH', DATA);
    S = { ...S, retExp, touched: { retExp: true } };
    const fix = only(S, 'A4')[0].fixes[0];
    const next = setField(S, 'retExp', String(fix.set.retExp), DATA);
    assert.equal(num(Math.round(next.retExp / 12)), fix.text.split('→ ')[1], `${monthly}/${retExp}`);
  }
  const a3 = only(S0({ expense: 84001, real: real({ monthly: 7501, endYear: 2045 }) }), 'A3')[0].fixes[0];
  assert.equal(num(Math.round(setField(S0({}), 'expense', String(a3.set.expense), DATA).expense / 12)), a3.text.split('→ ')[1]);
});
