import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { fwdSolve, buildParams } from '../site/js/engine.js';
import { defaultState, setField, toParams } from '../site/js/state.js';
import { tryParam, tryRange } from '../site/js/levers.js';
import { PARAMS } from '../site/js/params.js';

const person = (fields = {}) => {
  let S = defaultState(DATA);
  for (const [id, value] of Object.entries(fields)) S = setField(S, id, String(value), DATA);
  return toParams(S, DATA);
};

test('every parameter card has a slider range holding its current value', () => {
  const p = person({ pension: 24000 });
  for (const { id } of PARAMS) {
    const r = tryRange(p, id);
    assert.ok(r.min < r.max, id);
    assert.ok(r.step > 0, id);
    assert.ok(r.value >= r.min && r.value <= r.max, `${id}: ${r.value} in ${r.min}..${r.max}`);
  }
});

test('a slider range works when the money amounts are zero', () => {
  const p = person({ assets: 0, income: 0, expense: 0, retExp: 0 });
  for (const { id } of PARAMS) {
    const r = tryRange(p, id);
    assert.ok(r.min < r.max && Number.isFinite(r.max), id);
  }
});

test('trying a value reports the age it would give and leaves the plan alone', () => {
  const p = person();
  const before = { ...p };
  const out = tryParam(p, 'expense', 60000);
  assert.ok(out.age < p.age + fwdSolve(p));
  assert.equal(out.success, null);
  assert.deepEqual(p, before);
});

test('trying the current value gives the current age', () => {
  const p = person();
  assert.equal(tryParam(p, 'assets', p.assets).age, p.age + fwdSolve(p));
});

test('risk parameters report a success rate, which moves with risk', () => {
  const p = person();
  const calm = tryParam(p, 'sigEq', 0.05), wild = tryParam(p, 'sigEq', 0.35);
  assert.ok(calm.success > wild.success);
});

test('trying a withdrawal rate takes effect even with automatic rates on', () => {
  const p = person();
  assert.equal(p.autoSwr, true);
  assert.ok(tryParam(p, 'swr', 6).age < tryParam(p, 'swr', 2.5).age);
});

test('trying a value that can never work reports no age', () => {
  const p = person({ assets: 0, income: 60000, expense: 60000, growth: 0 });
  assert.equal(tryParam(buildParams(p, p.fx), 'retExp', 5000000).age, null);
});

test('the current spending change says retirement spending is held', async () => {
  const { impactOf } = await import('../site/js/levers.js');
  const { trySentence } = await import('../site/js/views.js');
  const p = person();
  assert.match(impactOf(p, 'expense').stepLabel, /退休支出不变/);
  assert.match(trySentence(p, 'expense', 60000, tryRange(p, 'expense')), /退休支出不变/);
});

