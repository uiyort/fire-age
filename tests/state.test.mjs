import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, setField, setWorkCountry, setRetireCountry, estimateRetireSpend, toParams, loadState, saveState, missingFields, setTown } from '../site/js/state.js';

test('the bad-year cut stays between 0 and 100 percent', () => {
  const at = v => toParams(setField(defaultState(DATA), 'flexCut', String(v), DATA), DATA).flexCut;
  assert.equal(at(150), 100);
  assert.equal(at(-50), 0);
  assert.equal(at(30), 30);
});

const fx = c => DATA.fx[c]?.value ?? 1;

test('clearing a money field means zero, never the example default', () => {
  const s = setField(defaultState(DATA), 'assets', '');
  assert.equal(s.assets, null);
  assert.equal(toParams(s, DATA).assets, 0);
});

test('clearing age keeps the last valid age', () => {
  let s = setField(defaultState(DATA), 'age', '35');
  s = setField(s, 'age', '');
  assert.equal(toParams(s, DATA).age, 35);
});

test('non-numeric text reads as blank', () => {
  const s = setField(defaultState(DATA), 'income', 'abc');
  assert.equal(s.income, null);
  assert.equal(toParams(s, DATA).income, 0);
});

test('retirement spending estimate is an identity within one country', () => {
  assert.equal(estimateRetireSpend(120000, 'CN', 'CN', DATA), 120000);
});

test('retirement estimate uses price levels, not only the market rate', () => {
  const pl = c => DATA.countries[c].priceLevel.value;
  const out = estimateRetireSpend(120000, 'CN', 'MY', DATA);
  const expected = 120000 / fx('CNY') * (pl('MY') / pl('CN')) * fx('MYR');
  assert.ok(Math.abs(out - expected) < 1e-6);
});

test('switching retirement country keeps a hand-edited spend', () => {
  const edited = setField(defaultState(DATA), 'retExp', '88888');
  const moved = setRetireCountry(edited, 'MY', DATA);
  assert.equal(moved.retExp, 88888);
  assert.match(moved.notice, /调整/);
  const auto = setRetireCountry(defaultState(DATA), 'MY', DATA);
  assert.notEqual(auto.retExp, 120000);
  assert.ok(!auto.notice);
});

test('changing current spending updates an untouched retirement estimate only', () => {
  const auto = setField(defaultState(DATA), 'expense', '60000', DATA);
  assert.equal(auto.retExp, 60000);
  const edited = setField(setField(defaultState(DATA), 'retExp', '88888', DATA), 'expense', '60000', DATA);
  assert.equal(edited.retExp, 88888);
});

test('switching retirement country converts a pension at the market rate', () => {
  const s = setRetireCountry(setField(defaultState(DATA), 'pension', '36000'), 'MY', DATA);
  assert.ok(Math.abs(s.pension - 36000 / fx('CNY') * fx('MYR')) < 1);
});

test('switching work country preserves purchasing power and fills local data', () => {
  const s = setWorkCountry(defaultState(DATA), 'US', DATA);
  assert.ok(Math.abs(s.assets - 200000 / fx('CNY')) < 1);
  assert.equal(s.bondY, DATA.countries.US.y10.value);
  assert.equal(s.pAge, DATA.countries.US.pAge.value);
  assert.equal(s.drag, DATA.countries.US.drag.value);
});

test('a retirement-only country cannot become the work country', () => {
  const s = defaultState(DATA);
  assert.equal(setWorkCountry(s, 'MY', DATA).workC, 'CN');
});

test('toParams flattens exchange rates for the engine', () => {
  const p = toParams(defaultState(DATA), DATA);
  assert.equal(p.fx.USD, 1);
  assert.equal(p.fx.CNY, fx('CNY'));
  assert.equal(p.wCur, 'CNY');
  assert.equal(p.rCur, 'CNY');
  assert.ok(Number.isFinite(p.r));
});

test('storage failures and corrupt saves fall back to defaults', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadState(DATA, throwing), defaultState(DATA));
  assert.doesNotThrow(() => saveState(defaultState(DATA), throwing));
  assert.deepEqual(loadState(DATA, null), defaultState(DATA));
  const corrupt = { getItem: () => '{not json', setItem() {} };
  assert.deepEqual(loadState(DATA, corrupt), defaultState(DATA));
  const unknown = { getItem: () => JSON.stringify({ workC: 'XX' }), setItem() {} };
  assert.equal(loadState(DATA, unknown).workC, 'CN');
});

test('a saved state round-trips', () => {
  let saved = null;
  const store = { getItem: () => saved, setItem: (_, v) => { saved = v; } };
  const s = setField(defaultState(DATA), 'age', '41');
  saveState(s, store);
  assert.equal(loadState(DATA, store).age, 41);
});

test('the numbers the result rests on must be filled in before it updates', () => {
  const s = defaultState(DATA);
  assert.deepEqual(missingFields(s), []);
  const blank = ['age', 'assets', 'income', 'expense'].reduce((acc, id) => setField(acc, id, '', DATA, { commit: false }), s);
  assert.deepEqual(missingFields(blank), ['age', 'assets', 'income', 'expense']);
  assert.deepEqual(missingFields(setField(s, 'assets', '0', DATA)), [], 'zero is an answer');
});

test('retirement spending must be filled in; a pension may stay blank', () => {
  const s = defaultState(DATA);
  assert.deepEqual(missingFields(setField(s, 'retExp', '', DATA)), ['retExp']);
  assert.deepEqual(missingFields(setField(s, 'pension', '', DATA)), []);
});

test('working backward also needs the age to holiday at', () => {
  const s = setField(defaultState(DATA), 'tAge', '', DATA);
  assert.deepEqual(missingFields(s), []);
  assert.deepEqual(missingFields({ ...s, mode: 'bwd' }), ['tAge']);
});

test('the town the person types keeps six characters and survives old or broken saved states', () => {
  assert.deepEqual(defaultState(DATA).town, { name: '', monthly: null });
  assert.equal(setTown(defaultState(DATA), { name: '一二三四五六七' }).town.name, '一二三四五六');
  assert.equal(setTown(defaultState(DATA), { monthly: '4000' }).town.monthly, 4000);
  assert.equal(setTown(defaultState(DATA), { monthly: '' }).town.monthly, null);
  const mem = v => ({ getItem: () => JSON.stringify(v) });
  const saved = defaultState(DATA);
  delete saved.town;
  assert.deepEqual(loadState(DATA, mem(saved)).town, { name: '', monthly: null });
  for (const bad of ['大理', ['x'], null, { name: 5, monthly: 'a' }]) {
    assert.deepEqual(loadState(DATA, mem({ ...saved, town: bad })).town, { name: '', monthly: null });
  }
  assert.deepEqual(loadState(DATA, mem({ ...saved, town: { name: '大理', monthly: 4000 } })).town, { name: '大理', monthly: 4000 });
});

test('selfPay: monthly pension and medical payments become a yearly amount when working in China with a pension', () => {
  let s = setField(defaultState(DATA), 'pension', '36000');
  s = setField(s, 'selfPension', '1200');
  s = setField(s, 'selfMedical', '300');
  assert.equal(toParams(s, DATA).selfPay, 18000);
  s = setField(s, 'selfMedical', '');
  assert.equal(toParams(s, DATA).selfPay, 14400);
});

test('selfPay: zero without a pension, for old saves, and when working in the US', () => {
  let s = setField(defaultState(DATA), 'selfPension', '1200');
  assert.equal(toParams(s, DATA).selfPay, 0);
  const store = { getItem: () => JSON.stringify({ workC: 'CN', retC: 'CN', dispCur: 'CNY', pension: 36000 }) };
  assert.equal(toParams(loadState(DATA, store), DATA).selfPay, 0);
  let us = setWorkCountry(defaultState(DATA), 'US', DATA);
  us = setField(setField(setField(us, 'pension', '36000'), 'selfPension', '1200'), 'selfMedical', '300');
  assert.equal(toParams(us, DATA).selfPay, 0);
});

test('pen: defaults, old saves, and cleaning', async () => {
  const { setPen } = await import('../site/js/state.js');
  const d = defaultState(DATA);
  assert.deepEqual(d.pen, { birth: '', kind: 'm', paidYears: null, years: null, account: null, base: null, index: 1 });
  const old = loadState(DATA, { getItem: () => JSON.stringify({ workC: 'CN', retC: 'CN', dispCur: 'CNY', pension: 36000 }) });
  assert.deepEqual(old.pen, d.pen);
  const half = loadState(DATA, { getItem: () => JSON.stringify({ workC: 'CN', retC: 'CN', dispCur: 'CNY', pen: { birth: '1996-06', index: 'x', kind: 'zz' } }) });
  assert.deepEqual(half.pen, { ...d.pen, birth: '1996-06' });
  let s = setPen(d, { birth: '1996-06', paidYears: '8', account: '60000', base: '8000', index: '5' });
  assert.deepEqual(s.pen, { birth: '1996-06', kind: 'm', paidYears: 8, years: null, account: 60000, base: 8000, index: 3 });
  s = setPen(s, { index: '0.1', years: '10', birth: 'bad', kind: 'f50', paidYears: '' });
  assert.equal(s.pen.index, 0.6);
  assert.equal(s.pen.years, 10);
  assert.equal(s.pen.birth, '');
  assert.equal(s.pen.kind, 'f50');
  assert.equal(s.pen.paidYears, null);
  assert.equal(setPen(d, { index: '' }).pen.index, 1);
});

test('selfPay: a negative entry counts as zero', () => {
  let s = setField(defaultState(DATA), 'pension', '36000');
  s = setField(setField(s, 'selfPension', '-500'), 'selfMedical', '300');
  assert.equal(toParams(s, DATA).selfPay, 3600);
  assert.equal(toParams(s, DATA).selfPension, 0);
});

test('using a pension estimate writes the yearly pension in the retirement currency, the age, and the default self-pay', async () => {
  const { applyPensionEstimate } = await import('../site/js/state.js');
  let s = applyPensionEstimate(defaultState(DATA), { monthly: 5959, claimAge: 63, selfPay: 960 }, DATA);
  assert.equal(s.pension, 71508);
  assert.equal(s.pAge, 63);
  assert.equal(s.selfPension, 960);
  assert.equal(s.touched.pAge, true);
  s = applyPensionEstimate(setField(defaultState(DATA), 'selfPension', '0'), { monthly: 5959, claimAge: 63, selfPay: 960 }, DATA);
  assert.equal(s.selfPension, 0);
  const my = applyPensionEstimate(setRetireCountry(defaultState(DATA), 'MY', DATA), { monthly: 5000, claimAge: 63, selfPay: 960 }, DATA);
  assert.equal(my.pension, Math.round(60000 / fx('CNY') * fx('MYR')));
});

// ---- spending that ends at a known age ----
import { eventsOf, lifeIssue } from '../site/js/state.js';
const withReal = (real, o = {}) => ({ ...defaultState(DATA), age: 35, expense: 120000, retExp: 120000, real, ...o });
const emptyReal = { mortgage: { monthly: null, endYear: null }, kids: { count: null, age: null, monthly: null } };

test('events: default state has an empty real block and no events', () => {
  const S = defaultState(DATA);
  assert.deepEqual(S.real, emptyReal);
  assert.deepEqual(eventsOf(S, DATA, 2026), []);
  assert.deepEqual(toParams(S, DATA, 2026).events, []);
});

test('events: eventsOf turns a mortgage and children into events, and drops finished ones', () => {
  const S = withReal({ mortgage: { monthly: 3000, endYear: 2046 }, kids: { count: 2, age: 6, monthly: 1500 } });
  assert.deepEqual(eventsOf(S, DATA, 2026), [
    { id: 'mortgage', amount: 36000, endAge: 56, nominal: true },
    { id: 'kids', amount: 36000, endAge: 51, nominal: false },
  ]);
  assert.deepEqual(toParams(S, DATA, 2026).events, eventsOf(S, DATA, 2026));
  assert.deepEqual(eventsOf(withReal({ mortgage: { monthly: 3000, endYear: null }, kids: { count: 2, age: null, monthly: 1500 } }), 2026), []);
  assert.deepEqual(eventsOf(withReal({ mortgage: { monthly: 3000, endYear: 2025 }, kids: { count: 1, age: 22, monthly: 1500 } }), DATA, 2026), []);
  // "until 2026" still counts this year's payments
  assert.deepEqual(eventsOf(withReal({ mortgage: { monthly: 3000, endYear: 2026 }, kids: emptyReal.kids }, { age: 35.4 }), DATA, 2026),
    [{ id: 'mortgage', amount: 36000, endAge: 36, nominal: true }]);
});

test('events: lifeIssue speaks up when the payments do not fit, and events are dropped', () => {
  const big = withReal({ mortgage: { monthly: 6000, endYear: 2046 }, kids: { count: 2, age: 6, monthly: 3000 } });
  assert.equal(lifeIssue(big, DATA), '月供和孩子的花销加起来超过了每月支出，请检查这两处');
  assert.deepEqual(eventsOf(big, DATA, 2026), []);
  const ret = withReal({ mortgage: { monthly: 6000, endYear: 2046 }, kids: { count: 1, age: 6, monthly: 3000 } }, { expense: 240000, retExp: 60000 });
  assert.equal(lifeIssue(ret, DATA), '退休后每月想花里也要算上月供和孩子的花销');
  assert.deepEqual(eventsOf(ret, DATA, 2026), []);
  assert.equal(lifeIssue(withReal({ mortgage: { monthly: 3000, endYear: 2046 }, kids: { count: 1, age: 6, monthly: 1000 } }), DATA), '');
  assert.equal(lifeIssue(defaultState(DATA), DATA), '');
});

test('events: an old save has empty events, and a bad real block reads as empty', () => {
  const store = v => ({ getItem: () => JSON.stringify(v) });
  const { real, ...old } = defaultState(DATA);
  assert.deepEqual(toParams(loadState(DATA, store(old)), DATA, 2026).events, []);
  for (const bad of ['abc', [1, 2], 7, null, { mortgage: 'x', kids: [] }]) {
    const S = loadState(DATA, store({ ...old, real: bad }));
    assert.deepEqual(S.real, emptyReal);
    assert.deepEqual(toParams(S, DATA, 2026).events, []);
  }
});

test('events: payments in the work currency are compared with retirement spending in the same currency', () => {
  const real = { mortgage: { monthly: 2000, endYear: 2046 }, kids: { count: 1, age: 6, monthly: 1500 } };
  const S = withReal(real, { expense: 144000, retExp: 72000 });
  assert.equal(lifeIssue(S, DATA), '');
  for (const code of ['US', 'DE', 'UK', 'AU', 'CA', 'SG', 'MY']) {
    if (!DATA.countries[code]) continue;
    const abroad = setRetireCountry(S, code, DATA);
    const inWork = { ...abroad, retExp: Math.round(estimateRetireSpend(144000, 'CN', code, DATA)) };
    assert.equal(lifeIssue(inWork, DATA), '', code);
    assert.equal(eventsOf(inWork, DATA, 2026).length, 2, code);
  }
});

test('events: moving the work country converts the monthly payments', () => {
  const real = { mortgage: { monthly: 3000, endYear: 2046 }, kids: { count: 2, age: 6, monthly: 1500 } };
  const S = withReal(real);
  const moved = setWorkCountry(S, 'US', DATA);
  const k = fx(DATA.countries.US.cur) / fx(DATA.countries.CN.cur);
  assert.equal(moved.real.mortgage.monthly, Math.round(3000 * k));
  assert.equal(moved.real.kids.monthly, Math.round(1500 * k));
  assert.equal(moved.real.mortgage.endYear, 2046);
  assert.equal(moved.real.kids.count, 2);
  assert.deepEqual(setWorkCountry(defaultState(DATA), 'US', DATA).real, emptyReal);
});
