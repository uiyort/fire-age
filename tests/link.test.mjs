import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState } from '../site/js/state.js';
import { linkHash, stateFromLink } from '../site/js/link.js';

test('an address without numbers in its fragment is not a link', () => {
  assert.equal(stateFromLink('', DATA), null);
  assert.equal(stateFromLink('#', DATA), null);
  assert.equal(stateFromLink('#about', DATA), null);
  assert.equal(stateFromLink('#colour=red', DATA), null);
});

test('money in a link is monthly, as the simple form asks for it', () => {
  const S = stateFromLink('#age=35&assets=500000&income=20000&expense=8000', DATA);
  assert.equal(S.age, 35);
  assert.equal(S.assets, 500000);
  assert.equal(S.income, 240000);
  assert.equal(S.expense, 96000);
  // Retirement spending follows the spending, as it does when the person types it.
  assert.equal(S.retExp, 96000);
  assert.equal(S.touched.retExp, undefined);
});

test('a link starts from the examples, so fields it leaves out keep their example values', () => {
  const S = stateFromLink('#age=40', DATA);
  const base = defaultState(DATA);
  assert.equal(S.age, 40);
  for (const id of ['assets', 'income', 'expense', 'retExp', 'tAge']) assert.equal(S[id], base[id], id);
});

test('retirement spending in a link counts as typed and is no longer estimated', () => {
  const S = stateFromLink('#expense=8000&retexp=5000', DATA);
  assert.equal(S.retExp, 60000);
  assert.equal(S.touched.retExp, true);
});

test('a link can work backward from an age to holiday at', () => {
  const S = stateFromLink('#mode=bwd&tage=40', DATA);
  assert.equal(S.mode, 'bwd');
  assert.equal(S.tAge, 40);
  assert.equal(stateFromLink('#mode=sideways&age=30', DATA).mode, 'fwd');
});

test('places in a link are set before the money, which is then in their currencies', () => {
  const S = stateFromLink('#work=US&retire=TH&income=5000&expense=3000&retexp=40000', DATA);
  assert.equal(S.workC, 'US');
  assert.equal(S.retC, 'TH');
  assert.equal(S.income, 60000);
  assert.equal(S.retExp, 480000);
  // The assumptions follow the place of work, as choosing it on the page does.
  assert.equal(S.bondY, DATA.countries.US.y10.value);
  assert.notEqual(S.bondY, defaultState(DATA).bondY);
});

test('a place that cannot be chosen on the page is ignored', () => {
  const S = stateFromLink('#work=XX&retire=YY&age=33', DATA);
  assert.equal(S.workC, 'CN');
  assert.equal(S.retC, 'CN');
  assert.equal(S.age, 33);
});

test('a value that is not a number is left out, and a number the form would stop is kept for it to stop', () => {
  const S = stateFromLink('#age=abc&assets=-5&income=1e400', DATA);
  assert.equal(S.age, defaultState(DATA).age);
  assert.equal(S.assets, -5);
  assert.equal(S.income, defaultState(DATA).income);
});

test('a link names what it holds in a fixed order and reads back the same', () => {
  const hash = linkHash({ retexp: 5000, age: 30, work: 'CN', income: 12000, tage: 40, mode: 'bwd' });
  assert.equal(hash, '#age=30&income=12000&retexp=5000&tage=40&mode=bwd&work=CN');
  const S = stateFromLink(hash, DATA);
  assert.equal(S.age, 30);
  assert.equal(S.income, 144000);
  assert.equal(S.retExp, 60000);
  assert.equal(S.mode, 'bwd');
  assert.throws(() => linkHash({ colour: 'red' }), /colour/);
});
