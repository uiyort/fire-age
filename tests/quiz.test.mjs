import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { fwdSolve, buildParams } from '../site/js/engine.js';
import { defaultState, setField, toParams } from '../site/js/state.js';
import { quizRounds, quizScore, quizTitle } from '../site/js/quiz.js';
import { tryParam, tryRange } from '../site/js/levers.js';
import { PARAMS } from '../site/js/params.js';
import { findBannedCopy } from '../scripts/lint-copy.mjs';

const person = (fields = {}) => {
  let S = defaultState(DATA);
  for (const [id, value] of Object.entries(fields)) S = setField(S, id, String(value), DATA);
  return toParams(S, DATA);
};

test('each round compares two changes using this person\'s own numbers', () => {
  const rounds = quizRounds(person());
  assert.ok(rounds.length >= 4);
  for (const r of rounds) {
    assert.ok(r.a.label && r.b.label && r.insight);
    assert.ok(Number.isFinite(r.a.gain) && Number.isFinite(r.b.gain));
    assert.ok(['a', 'b', 'either'].includes(r.answer));
  }
});

test('the right answer is the change that moves the age most, even when it pushes it back', () => {
  for (const r of quizRounds(person())) {
    const diff = Math.abs(r.a.gain) - Math.abs(r.b.gain);
    if (Math.abs(diff) < 0.05) assert.equal(r.answer, 'either');
    else assert.equal(r.answer, diff > 0 ? 'a' : 'b');
  }
});

test('different people get different answers', () => {
  const answers = p => quizRounds(p).map(r => r.answer).join();
  assert.notEqual(answers(person({ age: 25, assets: 0, income: 200000, expense: 60000 })), answers(person({ age: 50, assets: 3000000, income: 200000, expense: 190000 })));
});

test('nobody is quizzed when the age cannot move', () => {
  assert.deepEqual(quizRounds(person({ assets: 1e9 })), []);
  assert.deepEqual(quizRounds(person({ assets: 0, income: 60000, expense: 60000, growth: 0, retExp: 500000 })), []);
});

test('no round asks about the stock share, which would read as advice', () => {
  for (const r of quizRounds(person())) assert.ok(!/股票/.test(r.a.label + r.b.label + r.insight));
});

test('round copy passes the compliance rules', () => {
  assert.deepEqual(findBannedCopy(JSON.stringify(quizRounds(person()))), []);
});

test('scoring counts matches and accepts either on a tie', () => {
  const rounds = [{ answer: 'a' }, { answer: 'b' }, { answer: 'either' }];
  assert.equal(quizScore(rounds, { 0: 'a', 1: 'a', 2: 'b' }), 2);
  assert.equal(quizScore(rounds, {}), 0);
});

test('titles rise with the share answered correctly', () => {
  assert.notEqual(quizTitle(0, 6), quizTitle(6, 6));
  assert.equal(quizTitle(6, 6), '放假军师');
});

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

test('every parameter belongs to exactly one group', async () => {
  const { PARAM_GROUPS } = await import('../site/js/params.js');
  const grouped = PARAM_GROUPS.flatMap(g => g.ids);
  assert.equal(new Set(grouped).size, grouped.length);
  assert.deepEqual([...grouped].sort(), PARAMS.map(c => c.id).sort());
});
