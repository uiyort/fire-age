import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, setField, setWorkCountry, setRetireCountry, estimateRetireSpend, toParams, loadState, saveState } from '../site/js/state.js';

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
  assert.ok(Math.abs(s.assets - 500000 / fx('CNY')) < 1);
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
