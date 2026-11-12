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
